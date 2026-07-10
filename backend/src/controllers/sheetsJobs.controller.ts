import { Request, Response } from "express";
import mongoose from "mongoose";
import { ClosedDeal } from "../models/ClosedDeal.model";
import { SeedBrand } from "../models/SeedBrand.model";
import { JobLog } from "../models/JobLog.model";
import { intelligenceQueue } from "../queues/intelligence.queue";

function cleanText(value: any) {
  return String(value || "").trim();
}

function cleanEmail(value: any) {
  return String(value || "").trim().toLowerCase();
}

function getLimit(value: any) {
  const parsed = Number(value || 500);

  if (Number.isNaN(parsed) || parsed <= 0) {
    return 500;
  }

  return Math.min(parsed, 5000);
}

function normalizeClosedDealPayload(body: any) {
  return {
    month: cleanText(body.month || body.Month),
    influencerHandle: cleanText(
      body.influencerHandle || body.influencer || body["Influencer Handle"]
    ),
    brandName:
      cleanText(body.brandName) ||
      cleanText(body.brand) ||
      cleanText(body.companyName) ||
      cleanText(body["Brand Name"]) ||
      cleanText(body.Brand) ||
      cleanText(body["Company Name"]),
    productName:
      cleanText(body.productName) ||
      cleanText(body.product) ||
      cleanText(body.productNameWithModel) ||
      cleanText(body["Product Name"]) ||
      cleanText(body.Product),
    email: cleanEmail(body.email || body.Email),
    totalDealAmount: Number(body.totalDealAmount || body.amount || body["Total Deal Amount"] || 0),
    channel: cleanText(body.channel || body.Channel),
    status: cleanText(body.status || body.Status) || "pending"
  };
}

function normalizeJobStatus(status: any) {
  const value = cleanText(status).toLowerCase();

  if (!value) return "queued";

  if (["completed", "success", "done"].includes(value)) return "completed";
  if (["failed", "error"].includes(value)) return "failed";
  if (["active", "running", "processing"].includes(value)) return "running";
  if (["paused"].includes(value)) return "paused";
  if (["stopped", "stop_requested", "cancelled", "canceled"].includes(value)) {
    return "stopped";
  }

  return value;
}

function getJobControlMessage(action: "pause" | "resume" | "stop") {
  if (action === "pause") return "Crawl paused. Resume to continue.";
  if (action === "resume") return "Crawl resumed.";
  return "Crawl stopped.";
}

async function updateSeedBrandStatus(seedBrandId: any, status: string) {
  if (!seedBrandId || !mongoose.Types.ObjectId.isValid(String(seedBrandId))) {
    return;
  }

  await SeedBrand.findByIdAndUpdate(String(seedBrandId), {
    $set: {
      status
    }
  });
}

async function getJobControlContext(jobId: string) {
  const job = await intelligenceQueue.getJob(jobId);
  const log = await JobLog.findOne({ jobId });

  return {
    job,
    log,
    state: job ? await job.getState() : ""
  };
}

function isFinishedStatus(status: any) {
  return ["completed", "failed", "stopped"].includes(normalizeJobStatus(status));
}

function isActiveCrawlStatus(status: any) {
  return ["queued", "running", "paused"].includes(normalizeJobStatus(status));
}

function getActiveJobStaleMs() {
  const hours = Number(process.env.CRAWL_ACTIVE_JOB_STALE_HOURS || 12);
  const safeHours = Number.isFinite(hours) && hours > 0 ? hours : 12;

  return safeHours * 60 * 60 * 1000;
}

function getJobCreatedTime(job: any, log: any) {
  const values = [
    job?.timestamp,
    log?.startedAt,
    log?.createdAt,
    log?.updatedAt
  ];

  for (const value of values) {
    const time = typeof value === "number" ? value : new Date(value || 0).getTime();

    if (Number.isFinite(time) && time > 0) {
      return time;
    }
  }

  return Date.now();
}

function isStaleQueuedCrawl(job: any, log: any, state: any, status: any) {
  if (normalizeJobStatus(status) !== "queued") return false;
  if (state === "active") return false;

  return Date.now() - getJobCreatedTime(job, log) > getActiveJobStaleMs();
}

async function stopAndRemoveStaleQueueJob(job: any, log: any) {
  const jobId = String(job?.id || log?.jobId || "");

  if (!jobId) return;

  const seedBrandId = getJobLogSeedBrandId(log, job?.data || {});

  await JobLog.findOneAndUpdate(
    { jobId },
    {
      $set: {
        status: "stopped",
        currentStep: "STALE_QUEUE_REMOVED",
        message: "Old queued crawl was removed from Active. Start again to run from step 0.",
        completedAt: new Date(),
        error: ""
      },
      $unset: {
        pausedAt: ""
      }
    },
    {
      upsert: true,
      returnDocument: "after"
    }
  );

  await updateSeedBrandStatus(seedBrandId, "stopped");

  try {
    await job?.remove();
  } catch {
    // Ignore stale queue cleanup races.
  }
}

function getObjectIdString(value: any) {
  const text = cleanText(value?._id || value);

  if (!mongoose.Types.ObjectId.isValid(text)) {
    return "";
  }

  return text;
}

function getJobLogSeedBrandId(log: any, jobData: any = {}) {
  return (
    getObjectIdString(log?.seedBrandId) ||
    getObjectIdString(log?.raw?.seedBrand?._id) ||
    getObjectIdString(jobData?.seedBrandId)
  );
}

function buildSeedBrandFields(seedBrand: any = {}) {
  return {
    brandName: cleanText(seedBrand?.brandName),
    month: cleanText(seedBrand?.month),
    productName: cleanText(seedBrand?.productName),
    influencerHandle: cleanText(seedBrand?.influencerHandle),
    email: cleanEmail(seedBrand?.email),
    totalDealAmount: Number(seedBrand?.totalDealAmount || 0),
    crawlCount: Number(seedBrand?.crawlCount || 0)
  };
}

async function getSeedBrandSnapshot(seedBrandId: any) {
  const id = getObjectIdString(seedBrandId);

  if (!id) {
    return null;
  }

  return SeedBrand.findById(id).lean();
}

function getRawBrandName(raw: any = {}) {
  return (
    cleanText(raw?.brandName) ||
    cleanText(raw?.brand) ||
    cleanText(raw?.companyName) ||
    cleanText(raw?.["Brand Name"]) ||
    cleanText(raw?.Brand) ||
    cleanText(raw?.["Company Name"])
  );
}

function normalizeClosedDealRow(row: any) {
  const raw = row?.raw || {};

  return {
    ...row,
    brandName: cleanText(row?.brandName) || getRawBrandName(raw),
    productName:
      cleanText(row?.productName) ||
      cleanText(raw?.productName) ||
      cleanText(raw?.product) ||
      cleanText(raw?.["Product Name"]),
    influencerHandle:
      cleanText(row?.influencerHandle) ||
      cleanText(raw?.influencerHandle) ||
      cleanText(raw?.influencer) ||
      cleanText(raw?.["Influencer Handle"]),
    email: cleanEmail(row?.email) || cleanEmail(raw?.email || raw?.Email)
  };
}

function normalizeJobLog(log: any, seedBrand: any = null) {
  const rawSeed = log?.raw?.seedBrand || {};
  const seedFields = buildSeedBrandFields(seedBrand || rawSeed);

  return {
    _id: String(log?._id || ""),
    jobId: String(log?.jobId || ""),
    seedBrandId: getJobLogSeedBrandId(log) || getObjectIdString(seedBrand?._id),
    month: cleanText(log?.month) || cleanText(rawSeed?.month) || seedFields.month,
    productName:
      cleanText(log?.productName) || cleanText(rawSeed?.productName) || seedFields.productName,
    brandName:
      cleanText(log?.brandName) || cleanText(rawSeed?.brandName) || seedFields.brandName,
    influencerHandle:
      cleanText(log?.influencerHandle) ||
      cleanText(rawSeed?.influencerHandle) ||
      seedFields.influencerHandle,
    email: cleanEmail(log?.email) || cleanEmail(rawSeed?.email) || seedFields.email,
    totalDealAmount: Number(
      log?.totalDealAmount || rawSeed?.totalDealAmount || seedFields.totalDealAmount || 0
    ),
    crawlCount: Number(log?.crawlCount || rawSeed?.crawlCount || seedFields.crawlCount || 0),
    status: normalizeJobStatus(log?.status),
    startedAt: log?.startedAt || log?.createdAt || null,
    completedAt: log?.completedAt || null,
    createdAt: log?.createdAt || null,
    updatedAt: log?.updatedAt || null,
    totalFound: Number(log?.totalFound || log?.result?.discoveredBrandsProcessed || 0),
    message: log?.message || log?.currentStep || log?.error || "",
    currentStep: log?.currentStep || "",
    progress: Number(log?.progress || 0),
    error: log?.error || "",
    raw: log?.raw || {}
  };
}

export async function getClosedDeals(req: Request, res: Response) {
  try {
    const limit = getLimit(req.query.limit);

    const rows = await ClosedDeal.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const data = rows.map(normalizeClosedDealRow);

    res.json({
      success: true,
      count: data.length,
      data
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export async function createClosedDeal(req: Request, res: Response) {
  try {
    const payload = normalizeClosedDealPayload(req.body || {});

    if (!payload.brandName) {
      return res.status(400).json({
        success: false,
        message: "brandName is required"
      });
    }

    const seedBrand = await SeedBrand.create({
      ...payload,
      status: "pending",
      raw: req.body || {}
    });

    const closedDeal = await ClosedDeal.create({
      ...payload,
      seedBrandId: seedBrand._id,
      crawlCount: 0,
      raw: req.body || {}
    });

    await SeedBrand.findByIdAndUpdate(seedBrand._id, {
      $set: {
        closedDealId: closedDeal._id
      }
    });

    const savedClosedDeal = await ClosedDeal.findById(closedDeal._id).lean();

    res.status(201).json({
      success: true,
      data: savedClosedDeal,
      seedBrandId: String(seedBrand._id)
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export async function runIntelligenceJob(req: Request, res: Response) {
  try {
    const seedBrandId = cleanText(req.params.seedBrandId);

    if (!mongoose.Types.ObjectId.isValid(seedBrandId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid seedBrandId"
      });
    }

    const seedBrand = await SeedBrand.findById(seedBrandId).lean();

    if (!seedBrand) {
      return res.status(404).json({
        success: false,
        message: "Seed brand not found"
      });
    }

    const existingActiveJobs = await intelligenceQueue.getJobs(
      ["waiting", "active", "delayed", "paused"],
      0,
      100
    );

    const existingSameSeedJobs = existingActiveJobs.filter(
      (job) => String(job.data?.seedBrandId) === seedBrandId
    );

    if (existingSameSeedJobs.length > 0) {
      const existingJobIds = existingSameSeedJobs.map((job) => String(job.id));
      const existingLogs = await JobLog.find({
        jobId: {
          $in: existingJobIds
        }
      }).lean();
      const existingLogByJobId = new Map<string, any>();

      for (const log of existingLogs) {
        existingLogByJobId.set(String(log.jobId), log);
      }

      for (const existingJob of existingSameSeedJobs) {
        const existingJobId = String(existingJob.id);
        const state = await existingJob.getState();
        const log = existingLogByJobId.get(existingJobId);
        const status = normalizeJobStatus(log?.status || state);

        // A fresh Start/Add should never resume a paused/stopped/stale job. Only
        // an actually running job is kept to avoid duplicate simultaneous crawls.
        // Paused jobs must be continued only from the Resume button.
        if (state === "active" && status === "running") {
          return res.status(200).json({
            success: true,
            jobId: existingJobId,
            seedBrandId,
            data: {
              jobId: existingJobId,
              seedBrandId,
              status: "running",
              message: "Job already running"
            }
          });
        }

        await JobLog.findOneAndUpdate(
          { jobId: existingJobId },
          {
            $set: {
              status: "stopped",
              currentStep: "REPLACED_BY_FRESH_START",
              message: "Old queued/paused crawl replaced by a fresh start.",
              completedAt: new Date(),
              error: ""
            },
            $unset: {
              pausedAt: ""
            }
          },
          {
            upsert: true,
            returnDocument: "after"
          }
        );

        if (state !== "active") {
          try {
            await existingJob.remove();
          } catch {
            // If BullMQ state changed while replacing, JobLog status still keeps
            // the old job hidden/stopped and the worker will honor it at checkpoint.
          }
        }
      }
    }

    const requestedMaxBrands = Number(req.body?.maxBrands);
    const maxBrands =
      Number.isFinite(requestedMaxBrands) && requestedMaxBrands > 0
        ? Math.min(Math.max(Math.round(requestedMaxBrands), 10), 500)
        : undefined;

    const job = await intelligenceQueue.add(
      "run-intelligence",
      {
        seedBrandId,
        ...(maxBrands ? { maxBrands } : {})
      },
      {
        attempts: 1,
        removeOnComplete: false,
        removeOnFail: false
      }
    );

    await JobLog.findOneAndUpdate(
      {
        jobId: String(job.id)
      },
      {
        $set: {
          jobId: String(job.id),
          seedBrandId,
          type: "intelligence",
          brandName: seedBrand.brandName || "",
          month: seedBrand.month || "",
          productName: seedBrand.productName || "",
          influencerHandle: seedBrand.influencerHandle || "",
          email: seedBrand.email || "",
          totalDealAmount: Number(seedBrand.totalDealAmount || 0),
          crawlCount: Number(seedBrand.crawlCount || 0),
          status: "queued",
          currentStep: "QUEUED",
          progress: 0,
          totalFound: 0,
          message: "Crawl queued",
          startedAt: new Date(),
          ...(maxBrands ? { maxBrands } : {}),
          raw: {
            seedBrand
          }
        }
      },
      {
        upsert: true,
        returnDocument: "after"
      }
    );

    await SeedBrand.findByIdAndUpdate(seedBrandId, {
      $set: {
        status: "queued"
      }
    });

    res.status(201).json({
      success: true,
      jobId: String(job.id),
      seedBrandId,
      data: {
        jobId: String(job.id),
        seedBrandId,
        brandName: seedBrand.brandName || "",
        month: seedBrand.month || "",
        productName: seedBrand.productName || "",
        influencerHandle: seedBrand.influencerHandle || "",
        email: seedBrand.email || "",
        totalDealAmount: Number(seedBrand.totalDealAmount || 0),
        crawlCount: Number(seedBrand.crawlCount || 0),
        status: "queued",
        startedAt: new Date().toISOString(),
        message: "Crawl queued"
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}


export async function pauseIntelligenceJob(req: Request, res: Response) {
  try {
    const jobId = cleanText(req.params.jobId);

    if (!jobId) {
      return res.status(400).json({
        success: false,
        message: "jobId is required"
      });
    }

    const { job, log, state } = await getJobControlContext(jobId);

    if (!job && !log) {
      return res.status(404).json({
        success: false,
        message: "Crawl job not found"
      });
    }

    if (isFinishedStatus(log?.status || state)) {
      return res.status(400).json({
        success: false,
        message: "This crawl has already finished and cannot be paused."
      });
    }

    const seedBrandId = log?.seedBrandId || job?.data?.seedBrandId || null;
    const seedBrand = await getSeedBrandSnapshot(seedBrandId);
    const seedBrandFields = seedBrand ? buildSeedBrandFields(seedBrand) : {};
    const message = getJobControlMessage("pause");

    await JobLog.findOneAndUpdate(
      { jobId },
      {
        $set: {
          jobId,
          seedBrandId,
          type: "intelligence",
          ...seedBrandFields,
          status: "paused",
          currentStep: "PAUSED",
          message,
          pausedAt: new Date()
        }
      },
      {
        upsert: true,
        returnDocument: "after"
      }
    );

    await updateSeedBrandStatus(seedBrandId, "paused");

    res.json({
      success: true,
      message,
      data: {
        jobId,
        seedBrandId: seedBrandId ? String(seedBrandId) : "",
        ...seedBrandFields,
        status: "paused",
        currentStep: "PAUSED"
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export async function resumeIntelligenceJob(req: Request, res: Response) {
  try {
    const jobId = cleanText(req.params.jobId);

    if (!jobId) {
      return res.status(400).json({
        success: false,
        message: "jobId is required"
      });
    }

    const { job, log, state } = await getJobControlContext(jobId);

    if (!job && !log) {
      return res.status(404).json({
        success: false,
        message: "Crawl job not found"
      });
    }

    const currentStatus = normalizeJobStatus(log?.status || state);

    if (currentStatus !== "paused") {
      return res.status(400).json({
        success: false,
        message: "Only paused crawls can be resumed."
      });
    }

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "This crawl is no longer in the queue. Please start a new crawl."
      });
    }

    const seedBrandId = log?.seedBrandId || job.data?.seedBrandId || null;
    const seedBrand = await getSeedBrandSnapshot(seedBrandId);
    const seedBrandFields = seedBrand ? buildSeedBrandFields(seedBrand) : {};
    const nextStatus = state === "active" ? "running" : "queued";
    const message = getJobControlMessage("resume");

    await JobLog.findOneAndUpdate(
      { jobId },
      {
        $set: {
          ...seedBrandFields,
          status: nextStatus,
          currentStep: state === "active" ? "RESUMED" : "QUEUED",
          message,
          resumedAt: new Date()
        },
        $unset: {
          pausedAt: ""
        }
      },
      {
        upsert: true,
        returnDocument: "after"
      }
    );

    await updateSeedBrandStatus(seedBrandId, nextStatus);

    // A crawl paused past the hold window sits in the delayed queue;
    // promote it so resume takes effect immediately.
    if (state === "delayed") {
      try {
        await job.promote();
      } catch {
        // Already promoted or picked up; the worker honors JobLog status anyway.
      }
    }

    res.json({
      success: true,
      message,
      data: {
        jobId,
        seedBrandId: seedBrandId ? String(seedBrandId) : "",
        ...seedBrandFields,
        status: nextStatus,
        currentStep: state === "active" ? "RESUMED" : "QUEUED"
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export async function stopIntelligenceJob(req: Request, res: Response) {
  try {
    const jobId = cleanText(req.params.jobId);

    if (!jobId) {
      return res.status(400).json({
        success: false,
        message: "jobId is required"
      });
    }

    const { job, log, state } = await getJobControlContext(jobId);

    if (!job && !log) {
      return res.status(404).json({
        success: false,
        message: "Crawl job not found"
      });
    }

    if (normalizeJobStatus(log?.status) === "completed") {
      return res.status(400).json({
        success: false,
        message: "Completed crawls cannot be stopped."
      });
    }

    const seedBrandId = log?.seedBrandId || job?.data?.seedBrandId || null;
    const seedBrand = await getSeedBrandSnapshot(seedBrandId);
    const seedBrandFields = seedBrand ? buildSeedBrandFields(seedBrand) : {};
    const message =
      state === "active"
        ? "Crawl stop requested. It will stop after the current step finishes."
        : getJobControlMessage("stop");

    if (job && state !== "active") {
      try {
        await job.remove();
      } catch {
        // If BullMQ cannot remove it because the state changed, the worker will
        // still respect the stopped JobLog status at the next checkpoint.
      }
    }

    await JobLog.findOneAndUpdate(
      { jobId },
      {
        $set: {
          jobId,
          seedBrandId,
          type: "intelligence",
          ...seedBrandFields,
          status: "stopped",
          currentStep: "STOPPED",
          message,
          stoppedAt: new Date(),
          completedAt: new Date(),
          error: ""
        },
        $unset: {
          pausedAt: ""
        }
      },
      {
        upsert: true,
        returnDocument: "after"
      }
    );

    await updateSeedBrandStatus(seedBrandId, "stopped");

    res.json({
      success: true,
      message,
      data: {
        jobId,
        seedBrandId: seedBrandId ? String(seedBrandId) : "",
        ...seedBrandFields,
        status: "stopped",
        currentStep: "STOPPED"
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export async function getActiveIntelligenceJobs(req: Request, res: Response) {
  try {
    const jobs = await intelligenceQueue.getJobs(
      ["waiting", "active", "delayed", "paused"],
      0,
      100
    );

    const jobIds = jobs.map((job) => String(job.id));

    const logs = await JobLog.find({
      jobId: {
        $in: jobIds
      }
    }).lean();

    const logByJobId = new Map<string, any>();

    for (const log of logs) {
      logByJobId.set(String(log.jobId), log);
    }

    const seedBrandIds = Array.from(
      new Set(
        jobs
          .map((job) => {
            const log = logByJobId.get(String(job.id));
            return getJobLogSeedBrandId(log, job.data);
          })
          .filter(Boolean)
      )
    );

    const seedBrands = seedBrandIds.length
      ? await SeedBrand.find({
          _id: {
            $in: seedBrandIds
          }
        }).lean()
      : [];

    const seedBrandById = new Map<string, any>();

    for (const seedBrand of seedBrands) {
      seedBrandById.set(String(seedBrand._id), seedBrand);
    }

    const data = await Promise.all(
      jobs.map(async (job) => {
        const state = await job.getState();
        const log = logByJobId.get(String(job.id));
        const seedBrandId = getJobLogSeedBrandId(log, job.data);
        const seedBrand = seedBrandId ? seedBrandById.get(seedBrandId) : null;

        if (log) {
          const status = normalizeJobStatus(log.status || state);

          if (isStaleQueuedCrawl(job, log, state, status)) {
            await stopAndRemoveStaleQueueJob(job, log);
            return null;
          }

          if (!isActiveCrawlStatus(status)) {
            if (job && state !== "active") {
              try {
                await job.remove();
              } catch {
                // Ignore remove failures; the job is hidden from the active list
                // because JobLog is now the source of truth for stopped/finished state.
              }
            }

            return null;
          }

          return {
            ...normalizeJobLog(log, seedBrand),
            status,
            jobId: String(job.id)
          };
        }

        const status = normalizeJobStatus(state);

        if (isStaleQueuedCrawl(job, log, state, status)) {
          await stopAndRemoveStaleQueueJob(job, log);
          return null;
        }

        if (!isActiveCrawlStatus(status)) {
          return null;
        }

        const seedFields = seedBrand ? buildSeedBrandFields(seedBrand) : {};

        return {
          jobId: String(job.id),
          seedBrandId,
          ...seedFields,
          status,
          startedAt: job.timestamp ? new Date(job.timestamp).toISOString() : null,
          createdAt: job.timestamp ? new Date(job.timestamp).toISOString() : null,
          totalFound: 0,
          currentStep: state === "active" ? "RUNNING" : "QUEUED",
          message: state === "active" ? "Crawl is running." : "Crawl queued.",
          progress: Number(job.progress || 0)
        };
      })
    );

    const activeData = data.filter(Boolean);

    res.json({
      success: true,
      count: activeData.length,
      data: activeData
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export async function getIntelligenceJobHistory(req: Request, res: Response) {
  try {
    const limit = getLimit(req.query.limit);

    const rows = await JobLog.find({
      type: "intelligence"
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const seedBrandIds = Array.from(
      new Set(rows.map((row: any) => getJobLogSeedBrandId(row)).filter(Boolean))
    );

    const seedBrands = seedBrandIds.length
      ? await SeedBrand.find({
          _id: {
            $in: seedBrandIds
          }
        }).lean()
      : [];

    const seedBrandById = new Map<string, any>();

    for (const seedBrand of seedBrands) {
      seedBrandById.set(String(seedBrand._id), seedBrand);
    }

    const data = rows.map((row: any) => {
      const seedBrandId = getJobLogSeedBrandId(row);
      return normalizeJobLog(row, seedBrandId ? seedBrandById.get(seedBrandId) : null);
    });

    res.json({
      success: true,
      count: data.length,
      data
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}
