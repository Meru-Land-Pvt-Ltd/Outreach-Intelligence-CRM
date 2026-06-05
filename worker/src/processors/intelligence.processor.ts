import { Job } from "bullmq";
import mongoose from "mongoose";

import { crawlSeedBrandYoutubeVideos } from "../services/youtubeSeedCrawler.service";
import { analyzeUnprocessedRawVideos } from "../services/rawVideoAnalysis.service";
import { buildBrandMapForSeedBrand } from "../services/brandMap.service";
import { rebuildNicheAnalysis } from "../services/nicheAnalysis.service";
import { fillMissingDomainsForSeed } from "../services/domainFinder.service";
import { discoverEmailsForPendingBrands } from "../services/emailDiscovery.service";
import { verifyPendingContacts } from "../services/emailVerifier.service";
import { exportBrandToInstantlyTabs } from "../services/instantlyExport.service";
import { updateTotalEmailsForBrand } from "../services/totalEmails.service";
import { addPipelineTrackerLog } from "../services/pipelineTracker.service";
import { crawlLatestReviewVideos } from "../services/latestReviews.service";

import { ClosedDeal } from "../models/ClosedDeal.model";
import { BrandMap } from "../models/BrandMap.model";

const BrandMapModel = BrandMap as any;
const ClosedDealModel = ClosedDeal as any;

const JobLogSchema = new mongoose.Schema(
  {
    jobId: String,
    seedBrandId: mongoose.Schema.Types.ObjectId,
    type: String,
    status: String,
    currentStep: String,
    progress: Number,
    error: String
  },
  { timestamps: true }
);

const SeedBrandSchema = new mongoose.Schema(
  {
    brandName: String,
    productName: String,
    channel: String,
    status: String,
    closedDealId: mongoose.Schema.Types.ObjectId
  },
  { timestamps: true }
);

const JobLog: any =
  mongoose.models.JobLog || mongoose.model("JobLog", JobLogSchema);

const SeedBrand: any =
  mongoose.models.SeedBrand || mongoose.model("SeedBrand", SeedBrandSchema);

function cleanText(value: any) {
  return String(value || "").trim();
}

async function updateProgress(
  job: Job,
  jobId: string,
  currentStep: string,
  progress: number
) {
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
        progress
      }
    },
    {
      upsert: true,
      new: true
    }
  );
}

async function markJobCompleted(jobId: string, currentStep: string) {
  await JobLog.findOneAndUpdate(
    { jobId },
    {
      $set: {
        status: "completed",
        currentStep,
        progress: 100,
        error: ""
      }
    },
    {
      upsert: true,
      new: true
    }
  );
}

async function markJobFailed(jobId: string, error: any) {
  await JobLog.findOneAndUpdate(
    { jobId },
    {
      $set: {
        status: "failed",
        currentStep: "PIPELINE_FAILED",
        error: error?.message || String(error)
      }
    },
    {
      upsert: true,
      new: true
    }
  );
}

async function incrementClosedDealCrawlCount(seedBrand: any, seedBrandId: string) {
  if (seedBrand.closedDealId) {
    await ClosedDealModel.updateOne(
      { _id: seedBrand.closedDealId },
      {
        $inc: {
          crawlCount: 1
        }
      }
    );

    return;
  }

  await ClosedDealModel.updateOne(
    { seedBrandId },
    {
      $inc: {
        crawlCount: 1
      }
    }
  );
}

async function getDiscoveredBrandMaps(seedBrandId: string, seedBrandName: string) {
  return BrandMapModel.find({
    isExcluded: { $ne: true },
    domain: {
      $exists: true,
      $nin: ["", "-", null, "N/A", "unspecified"]
    },
    $or: [
      {
        seedBrandId
      },
      {
        foundVia: seedBrandName
      }
    ]
  }).sort({
    mostRecentSponsorshipDate: -1,
    updatedAt: -1
  });
}

async function exportDiscoveredBrandsToInstantly(
  job: Job,
  jobId: string,
  seedBrandId: string,
  seedBrandName: string
) {
  const discoveredBrands = await getDiscoveredBrandMaps(
    seedBrandId,
    seedBrandName
  );

  let exportedRows = 0;
  let skippedAlreadyExported = 0;
  let contactsNormalized = 0;
  let exportedBrands = 0;

  for (const brand of discoveredBrands as any[]) {
    const brandName = cleanText(brand.brandName);
    const domain = cleanText(brand.domain);

    if (!brandName || !domain) continue;

    await updateProgress(
      job,
      jobId,
      "EXPORT_TO_INSTANTLY_" + brandName,
      96
    );

    const exportResult = await exportBrandToInstantlyTabs(brandName);

    exportedRows += Number(exportResult.exported || 0);
    skippedAlreadyExported += Number(
      exportResult.skippedAlreadyExported || 0
    );
    contactsNormalized += Number(exportResult.contactsNormalized || 0);

    if (Number(exportResult.exported || 0) > 0) {
      exportedBrands += 1;
    }

    await updateTotalEmailsForBrand(brandName, domain);

    await addPipelineTrackerLog({
      type: "Discovered",
      brandName,
      domain,
      status:
        Number(exportResult.exported || 0) > 0
          ? "Exported to Instantly"
          : "Instantly Export Skipped"
    });
  }

  return {
    brandsScanned: discoveredBrands.length,
    exportedBrands,
    exportedRows,
    skippedAlreadyExported,
    contactsNormalized
  };
}

export async function intelligenceProcessor(job: Job) {
  const { seedBrandId } = job.data;
  const jobId = String(job.id);

  try {
    if (job.name === "refresh-latest-reviews") {
      await updateProgress(job, jobId, "REFRESH_LATEST_REVIEWS_STARTED", 10);

      const result = await crawlLatestReviewVideos();

      await updateProgress(job, jobId, "REFRESH_LATEST_REVIEWS_DONE", 95);
      await markJobCompleted(jobId, "REFRESH_LATEST_REVIEWS_COMPLETE");

      return {
        success: true,
        result
      };
    }
    const seedBrand: any = await SeedBrand.findById(seedBrandId).lean();

    if (!seedBrand) {
      throw new Error("Seed brand not found");
    }

    const seedBrandName = cleanText(seedBrand.brandName);
    const seedProductName = cleanText(seedBrand.productName);

    if (!seedBrandName) {
      throw new Error("Seed brand name is missing");
    }

    console.log("====================================");
    console.log("MASTER PIPELINE STARTED");
    console.log("JOB ID:", jobId);
    console.log("SEED BRAND:", seedBrandName);
    console.log("SEED PRODUCT:", seedProductName || "-");
    console.log("====================================");

    await SeedBrand.findByIdAndUpdate(seedBrandId, {
      $set: {
        status: "running"
      }
    });

    await addPipelineTrackerLog({
      type: "Seed",
      brandName: seedBrandName,
      domain: "",
      status: "Seed Started"
    });

    await updateProgress(job, jobId, "CRAWL_BRANDS_STARTED", 5);

    const crawlResult = await crawlSeedBrandYoutubeVideos({
      seedBrandId,
      brandName: seedBrandName,
      productName: seedProductName
    });

    await updateProgress(
      job,
      jobId,
      "CRAWL_BRANDS_DONE_" + crawlResult.saved + "_VIDEOS",
      20
    );

    await updateProgress(job, jobId, "PROCESS_RAW_VIDEOS_STARTED", 30);

    const aiResult = await analyzeUnprocessedRawVideos(seedBrandId);

    await updateProgress(
      job,
      jobId,
      "PROCESS_RAW_VIDEOS_DONE_" + aiResult.processed + "_VIDEOS",
      42
    );

    await updateProgress(job, jobId, "FILL_BRAND_MAP_STARTED", 50);

    const brandMapResult = await buildBrandMapForSeedBrand(seedBrandId);

    await updateProgress(
      job,
      jobId,
      "FILL_BRAND_MAP_DONE_" +
        brandMapResult.brandsCreatedOrUpdated +
        "_BRANDS",
      60
    );

    await updateProgress(job, jobId, "NICHE_ANALYSIS_STARTED", 62);

    const nicheResult = await rebuildNicheAnalysis();

    await updateProgress(
      job,
      jobId,
      "NICHE_ANALYSIS_DONE_" + nicheResult.nicheCount + "_NICHES",
      64
    );

    await incrementClosedDealCrawlCount(seedBrand, seedBrandId);

    await updateProgress(job, jobId, "DOMAIN_FINDER_STARTED", 68);

    const domainResult = await fillMissingDomainsForSeed(seedBrandName);

    console.log("Domain finder result:", domainResult);

    await updateProgress(
      job,
      jobId,
      "DOMAIN_FINDER_DONE_" + domainResult.domainFound + "_DOMAINS",
      76
    );

    await updateProgress(job, jobId, "EMAIL_DISCOVERY_STARTED", 80);

    const emailDiscoveryResult = await discoverEmailsForPendingBrands(
      seedBrandName
    );

    console.log("Email discovery result:", emailDiscoveryResult);

    await updateProgress(
      job,
      jobId,
      "EMAIL_DISCOVERY_DONE_" +
        emailDiscoveryResult.processed +
        "_BRANDS",
      88
    );

    await updateProgress(job, jobId, "EMAIL_VERIFICATION_STARTED", 92);

    const verificationResult = await verifyPendingContacts();

    console.log("Verification result:", verificationResult);

    await updateProgress(
      job,
      jobId,
      "EMAIL_VERIFICATION_DONE_" +
        verificationResult.verified +
        "_VERIFIED",
      95
    );

    await updateProgress(job, jobId, "INSTANTLY_EXPORT_STARTED", 96);

    const instantlyExportResult = await exportDiscoveredBrandsToInstantly(
      job,
      jobId,
      seedBrandId,
      seedBrandName
    );

    console.log("Instantly export result:", instantlyExportResult);

    await updateProgress(
      job,
      jobId,
      "INSTANTLY_EXPORT_DONE_" +
        instantlyExportResult.exportedRows +
        "_ROWS",
      98
    );

    await rebuildNicheAnalysis();

    await addPipelineTrackerLog({
      type: "Seed",
      brandName: seedBrandName,
      domain: "",
      status: "COMPLETE"
    });

    await SeedBrand.findByIdAndUpdate(seedBrandId, {
      $set: {
        status: "completed"
      }
    });

    await markJobCompleted(jobId, "MASTER_PIPELINE_COMPLETE");

    console.log("====================================");
    console.log("MASTER PIPELINE COMPLETED");
    console.log("JOB ID:", jobId);
    console.log("SEED BRAND:", seedBrandName);
    console.log("====================================");

    return {
      success: true,
      crawlResult,
      aiResult,
      brandMapResult,
      nicheResult,
      domainResult,
      emailDiscoveryResult,
      verificationResult,
      instantlyExportResult
    };
  } catch (error: any) {
    console.error("PIPELINE FAILED:", error?.message || error);

    const { seedBrandId } = job.data;
    const failedSeedBrand: any = await SeedBrand.findById(seedBrandId).lean();

    if (failedSeedBrand?.brandName) {
      await addPipelineTrackerLog({
        type: "Seed",
        brandName: failedSeedBrand.brandName,
        domain: "",
        status: "FAILED: " + (error?.message || String(error))
      });

      await SeedBrand.findByIdAndUpdate(seedBrandId, {
        $set: {
          status: "failed"
        }
      });
    }

    await markJobFailed(jobId, error);

    throw error;
  }
}