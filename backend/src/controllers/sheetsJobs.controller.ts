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
    month: cleanText(body.month),
    influencerHandle: cleanText(body.influencerHandle),
    brandName:
      cleanText(body.brandName) ||
      cleanText(body.brand) ||
      cleanText(body.companyName),
    productName:
      cleanText(body.productName) ||
      cleanText(body.product) ||
      cleanText(body.productNameWithModel),
    email: cleanEmail(body.email),
    totalDealAmount: Number(body.totalDealAmount || body.amount || 0),
    channel: cleanText(body.channel),
    status: cleanText(body.status) || "pending"
  };
}

function normalizeJobStatus(status: any) {
  const value = cleanText(status).toLowerCase();

  if (!value) return "queued";

  if (["completed", "success", "done"].includes(value)) return "completed";
  if (["failed", "error"].includes(value)) return "failed";
  if (["active", "running", "processing"].includes(value)) return "running";

  return value;
}

function normalizeJobLog(log: any) {
  const rawSeed = log?.raw?.seedBrand || {};

  return {
    _id: String(log?._id || ""),
    jobId: String(log?.jobId || ""),
    seedBrandId: String(log?.seedBrandId || rawSeed?._id || ""),
    month: log?.month || rawSeed?.month || "",
    productName: log?.productName || rawSeed?.productName || "",
    brandName: log?.brandName || rawSeed?.brandName || "",
    influencerHandle: log?.influencerHandle || rawSeed?.influencerHandle || "",
    email: log?.email || rawSeed?.email || "",
    totalDealAmount: Number(log?.totalDealAmount || rawSeed?.totalDealAmount || 0),
    crawlCount: Number(log?.crawlCount || rawSeed?.crawlCount || 0),
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

    res.json({
      success: true,
      count: rows.length,
      data: rows
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

    const existingJob = existingActiveJobs.find(
      (job) => String(job.data?.seedBrandId) === seedBrandId
    );

    if (existingJob) {
      return res.status(200).json({
        success: true,
        jobId: String(existingJob.id),
        seedBrandId,
        data: {
          jobId: String(existingJob.id),
          seedBrandId,
          status: "queued",
          message: "Job already active or queued"
        }
      });
    }

    const job = await intelligenceQueue.add(
      "run-intelligence",
      {
        seedBrandId
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

    const data = await Promise.all(
      jobs.map(async (job) => {
        const state = await job.getState();
        const log = logByJobId.get(String(job.id));

        if (log) {
          return {
            ...normalizeJobLog(log),
            status: normalizeJobStatus(log.status || state),
            jobId: String(job.id)
          };
        }

        const seedBrand = job.data?.seedBrandId
          ? await SeedBrand.findById(job.data.seedBrandId).lean()
          : null;

        return {
          jobId: String(job.id),
          seedBrandId: String(job.data?.seedBrandId || ""),
          brandName: seedBrand?.brandName || "",
          influencerHandle: seedBrand?.influencerHandle || "",
          status: normalizeJobStatus(state),
          startedAt: job.timestamp ? new Date(job.timestamp).toISOString() : null,
          createdAt: job.timestamp ? new Date(job.timestamp).toISOString() : null,
          totalFound: 0,
          message: state === "active" ? "Crawl is running." : "Crawl queued.",
          progress: Number(job.progress || 0)
        };
      })
    );

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

export async function getIntelligenceJobHistory(req: Request, res: Response) {
  try {
    const limit = getLimit(req.query.limit);

    const rows = await JobLog.find({
      type: "intelligence"
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const data = rows.map(normalizeJobLog);

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
