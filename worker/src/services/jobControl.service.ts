import { DelayedError, Job } from "bullmq";
import mongoose from "mongoose";

const JobLogSchema = new mongoose.Schema(
  {
    jobId: String,
    seedBrandId: mongoose.Schema.Types.ObjectId,
    type: String,
    status: String,
    currentStep: String,
    progress: Number,
    message: String,
    error: String,
    startedAt: Date,
    completedAt: Date,
    totalFound: Number,
    result: Object,
    raw: Object
  },
  { timestamps: true, strict: false }
);

export const JobLog: any =
  mongoose.models.JobLog || mongoose.model("JobLog", JobLogSchema);

export class CrawlStoppedError extends Error {
  constructor(message = "Crawl stopped by user") {
    super(message);
    this.name = "CrawlStoppedError";
  }
}

function cleanText(value: any) {
  return String(value || "").trim();
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeControlStatus(status: any) {
  const value = cleanText(status).toLowerCase();

  if (["stopped", "stop_requested", "cancelled", "canceled"].includes(value)) {
    return "stopped";
  }

  if (value === "paused") {
    return "paused";
  }

  return value;
}

async function readControlState(jobId: string) {
  const log = await JobLog.findOne({ jobId }).lean();

  return {
    status: normalizeControlStatus(log?.status),
    pausedAt: log?.pausedAt ? new Date(log.pausedAt).getTime() : 0
  };
}

// The BullMQ job + token for each running job, so control checks deep inside
// services can move a long-paused job back to the delayed queue and free the
// worker slot for other queued crawls.
const activeJobs = new Map<string, { job: Job; token?: string }>();

export function registerActiveJob(jobId: string, job: Job, token?: string) {
  activeJobs.set(jobId, { job, token });
}

export function unregisterActiveJob(jobId: string) {
  activeJobs.delete(jobId);
}

const PAUSE_MAX_HOLD_MS = Number(
  process.env.CRAWL_PAUSE_MAX_WAIT_MS || 5 * 60 * 1000
);

const PAUSE_REQUEUE_DELAY_MS = Number(
  process.env.CRAWL_PAUSE_REQUEUE_DELAY_MS || 60 * 1000
);

export async function enforceCrawlerControl(jobId: string) {
  let state = await readControlState(jobId);

  if (state.status === "stopped") {
    throw new CrawlStoppedError();
  }

  if (state.status !== "paused") {
    return;
  }

  const pausedSince = state.pausedAt || Date.now();

  await JobLog.findOneAndUpdate(
    { jobId },
    {
      $set: {
        status: "paused",
        currentStep: "PAUSED",
        message: "Crawl paused. Resume to continue.",
        pausedAt: new Date(pausedSince)
      }
    }
  );

  const pollMs = Number(process.env.CRAWL_CONTROL_POLL_MS || 3000);

  while (true) {
    // A short pause is held in place (fast resume). Once it exceeds the max
    // hold, the job is re-queued as delayed so other crawls can use the slot.
    if (Date.now() - pausedSince >= PAUSE_MAX_HOLD_MS) {
      const entry = activeJobs.get(jobId);

      if (entry?.token) {
        await JobLog.findOneAndUpdate(
          { jobId },
          {
            $set: {
              message:
                "Crawl paused. Waiting in background — other queued crawls can run."
            }
          }
        );

        await entry.job.moveToDelayed(
          Date.now() + PAUSE_REQUEUE_DELAY_MS,
          entry.token
        );

        throw new DelayedError();
      }
    }

    await delay(pollMs > 0 ? pollMs : 3000);

    state = await readControlState(jobId);

    if (state.status === "stopped") {
      throw new CrawlStoppedError();
    }

    if (state.status !== "paused") {
      return;
    }
  }
}

export async function updateProgress(
  job: Job,
  jobId: string,
  currentStep: string,
  progress: number,
  extraSet: Record<string, any> = {}
) {
  await enforceCrawlerControl(jobId);

  console.log("JOB STEP:", currentStep);

  try {
    await job.updateProgress(progress);
  } catch {
    // BullMQ progress update is helpful but not required.
  }

  await JobLog.findOneAndUpdate(
    { jobId },
    {
      $set: {
        status: "running",
        currentStep,
        message: currentStep,
        progress,
        ...extraSet
      }
    },
    {
      upsert: true,
      new: true
    }
  );
}

export async function markJobCompleted(
  jobId: string,
  currentStep: string,
  result: Record<string, any> = {}
) {
  await JobLog.findOneAndUpdate(
    { jobId },
    {
      $set: {
        status: "completed",
        currentStep,
        message: currentStep,
        progress: 100,
        completedAt: new Date(),
        result,
        error: ""
      },
      $unset: {
        pausedAt: "",
        completedStages: "",
        stageResults: ""
      }
    },
    {
      upsert: true,
      new: true
    }
  );
}

export async function markJobStopped(
  jobId: string,
  message = "Crawl stopped by user"
) {
  await JobLog.findOneAndUpdate(
    { jobId },
    {
      $set: {
        status: "stopped",
        currentStep: "STOPPED",
        message,
        completedAt: new Date(),
        error: ""
      },
      $unset: {
        pausedAt: ""
      }
    },
    {
      upsert: true,
      new: true
    }
  );
}

export async function markJobFailed(jobId: string, error: any) {
  const message = error?.message || String(error);

  await JobLog.findOneAndUpdate(
    { jobId },
    {
      $set: {
        status: "failed",
        currentStep: "PIPELINE_FAILED",
        message,
        completedAt: new Date(),
        error: message
      }
    },
    {
      upsert: true,
      new: true
    }
  );
}

// Stage checkpointing: a job that gets re-queued (long pause) re-enters the
// processor from the top; completed stages are skipped and their persisted
// results reused, so at most the interrupted stage repeats.
export type StageState = {
  stages: Set<string>;
  results: Record<string, any>;
};

export async function getStageState(jobId: string): Promise<StageState> {
  const log = await JobLog.findOne({ jobId }).lean();

  return {
    stages: new Set<string>((log?.completedStages || []).map(String)),
    results: log?.stageResults || {}
  };
}

export async function runStage<T>(
  jobId: string,
  stage: string,
  state: StageState,
  runner: () => Promise<T>
): Promise<T> {
  if (state.stages.has(stage)) {
    console.log("Stage already completed, skipping:", stage);
    return state.results[stage] as T;
  }

  const result = await runner();

  await JobLog.findOneAndUpdate(
    { jobId },
    {
      $addToSet: { completedStages: stage },
      $set: {
        ["stageResults." + stage]: result === undefined ? null : result
      }
    }
  );

  state.stages.add(stage);
  state.results[stage] = result;

  return result;
}
