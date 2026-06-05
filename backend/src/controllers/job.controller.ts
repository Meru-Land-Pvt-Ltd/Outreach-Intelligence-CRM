import { Request, Response } from "express";
import { intelligenceQueue } from "../queues/queues";
import { JobLog } from "../models/JobLog.model";
import { SeedBrand } from "../models/SeedBrand.model";

export async function runIntelligenceJob(req: Request, res: Response) {
  try {
    const { seedBrandId } = req.params;

    const seedBrand = await SeedBrand.findById(seedBrandId);

    if (!seedBrand) {
      return res.status(404).json({
        success: false,
        message: "Seed brand not found"
      });
    }

    const job = await intelligenceQueue.add("run-intelligence", {
      seedBrandId
    });

    await JobLog.create({
      jobId: String(job.id),
      seedBrandId,
      type: "run-intelligence",
      status: "queued",
      currentStep: "Job added to queue",
      progress: 0
    });

    seedBrand.status = "running";
    await seedBrand.save();

    res.status(201).json({
      success: true,
      message: "Intelligence job queued",
      jobId: job.id
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export async function refreshLatestReviewsJob(req: Request, res: Response) {
  try {
    const job = await intelligenceQueue.add("refresh-latest-reviews", {});

    await JobLog.create({
      jobId: String(job.id),
      type: "refresh-latest-reviews",
      status: "queued",
      currentStep: "Refresh latest uploads job added to queue",
      progress: 0
    });

    res.status(201).json({
      success: true,
      message: "Refresh latest uploads job queued",
      jobId: job.id
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export async function getJobStatus(req: Request, res: Response) {
  try {
    const { jobId } = req.params;

    const jobLog = await JobLog.findOne({ jobId });

    if (!jobLog) {
      return res.status(404).json({
        success: false,
        message: "Job not found"
      });
    }

    res.json({
      success: true,
      data: jobLog
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}
