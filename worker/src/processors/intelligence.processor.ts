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
import { fillInstantlyLeadCompetitors } from "../services/competitor.service";
import { backfillInstantlyLeadVerificationAndGateway } from "../services/instantlyLeadHygiene.service";
import { updateTotalEmailsForBrand } from "../services/totalEmails.service";
import { addPipelineTrackerLog } from "../services/pipelineTracker.service";
import { crawlLatestReviewVideos } from "../services/latestReviews.service";
import { getAppSettings } from "../services/appSettings.service";
import { scorePgaForSeed } from "../services/pgaScore.service";
import {
  enforceCrawlerControl,
  getStageState,
  markJobCompleted,
  markJobFailed,
  markJobStopped,
  registerActiveJob,
  runStage,
  unregisterActiveJob,
  updateProgress
} from "../services/jobControl.service";

import { ClosedDeal } from "../models/ClosedDeal.model";
import { BrandMap } from "../models/BrandMap.model";

const BrandMapModel = BrandMap as any;
const ClosedDealModel = ClosedDeal as any;

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

const SeedBrand: any =
  mongoose.models.SeedBrand || mongoose.model("SeedBrand", SeedBrandSchema);

function cleanText(value: any) {
  return String(value || "").trim();
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

export async function intelligenceProcessor(job: Job, token?: string) {
  const { seedBrandId } = job.data;
  const jobId = String(job.id);

  registerActiveJob(jobId, job, token);

  try {
    if (job.name === "refresh-latest-reviews") {
      await updateProgress(job, jobId, "REFRESH_LATEST_REVIEWS_STARTED", 10);

      const result = await crawlLatestReviewVideos();

      await updateProgress(job, jobId, "REFRESH_LATEST_REVIEWS_DONE", 95);
      await markJobCompleted(jobId, "REFRESH_LATEST_REVIEWS_COMPLETE", {
        latestReviews: result
      });

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

    // If the job re-entered while paused, block here before touching state.
    await enforceCrawlerControl(jobId);

    const settings = await getAppSettings(true);
    const stageState = await getStageState(jobId);
    const checkControl = () => enforceCrawlerControl(jobId);

    console.log("====================================");
    console.log("MASTER PIPELINE STARTED");
    console.log("JOB ID:", jobId);
    console.log("SEED BRAND:", seedBrandName);
    console.log("SEED PRODUCT:", seedProductName || "-");
    console.log("MANUAL SELECTION MODE:", settings.manualSelectionMode);
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

    const crawlResult = await runStage(jobId, "CRAWL", stageState, () =>
      crawlSeedBrandYoutubeVideos({
        seedBrandId,
        brandName: seedBrandName,
        productName: seedProductName,
        checkControl
      })
    );

    await updateProgress(
      job,
      jobId,
      "CRAWL_BRANDS_DONE_" + crawlResult.saved + "_VIDEOS",
      20
    );

    await updateProgress(job, jobId, "PROCESS_RAW_VIDEOS_STARTED", 30);

    const aiResult = await runStage(jobId, "AI_ANALYSIS", stageState, () =>
      analyzeUnprocessedRawVideos(seedBrandId, checkControl)
    );

    await updateProgress(
      job,
      jobId,
      "PROCESS_RAW_VIDEOS_DONE_" + aiResult.processed + "_VIDEOS",
      42
    );

    await updateProgress(job, jobId, "FILL_BRAND_MAP_STARTED", 50);

    const brandMapResult = await runStage(jobId, "BRAND_MAP", stageState, () =>
      buildBrandMapForSeedBrand(seedBrandId, {
        maxBrands: Number(job.data?.maxBrands) || undefined,
        checkControl
      })
    );

    await updateProgress(
      job,
      jobId,
      "FILL_BRAND_MAP_DONE_" +
        brandMapResult.brandsCreatedOrUpdated +
        "_BRANDS",
      60
    );

    let pgaResult: any = null;

    if (settings.pgaAutoScore) {
      await updateProgress(job, jobId, "PGA_SCAN_STARTED", 61);

      pgaResult = await runStage(jobId, "PGA_SCAN", stageState, () =>
        scorePgaForSeed(seedBrandId, {
          checkControl,
          onProgress: (done, total, brandName) =>
            updateProgress(
              job,
              jobId,
              "PGA_SCAN_" + done + "/" + total + "_" + brandName,
              61,
              { pgaDone: done, pgaTotal: total }
            )
        })
      );

      console.log("PGA scan result:", pgaResult);

      await updateProgress(
        job,
        jobId,
        "PGA_SCAN_DONE_" + (pgaResult?.gatedOut ?? 0) + "_GATED",
        62
      );
    }

    await updateProgress(job, jobId, "NICHE_ANALYSIS_STARTED", 62);

    const nicheResult = await runStage(jobId, "NICHE", stageState, () =>
      rebuildNicheAnalysis()
    );

    await updateProgress(
      job,
      jobId,
      "NICHE_ANALYSIS_DONE_" + nicheResult.nicheCount + "_NICHES",
      64
    );

    await runStage(jobId, "CRAWL_COUNT", stageState, async () => {
      await incrementClosedDealCrawlCount(seedBrand, seedBrandId);
      return { incremented: true };
    });

    if (settings.manualSelectionMode) {
      await addPipelineTrackerLog({
        type: "Seed",
        brandName: seedBrandName,
        domain: "",
        status: "COMPLETE - Ready for email crawling"
      });

      await SeedBrand.findByIdAndUpdate(seedBrandId, {
        $set: {
          status: "completed"
        }
      });

      await markJobCompleted(jobId, "COMPLETE_AWAITING_EMAIL_CRAWLING", {
        crawlResult,
        aiResult,
        brandMapResult,
        pgaResult,
        nicheResult,
        manualSelectionMode: true
      });

      console.log("====================================");
      console.log("PIPELINE COMPLETE — READY FOR EMAIL CRAWLING");
      console.log("JOB ID:", jobId);
      console.log("SEED BRAND:", seedBrandName);
      console.log("====================================");

      return {
        success: true,
        awaitingSelection: true,
        crawlResult,
        aiResult,
        brandMapResult,
        nicheResult
      };
    }

    await updateProgress(job, jobId, "DOMAIN_FINDER_STARTED", 68);

    const domainResult = await runStage(jobId, "DOMAIN_FINDER", stageState, () =>
      fillMissingDomainsForSeed(seedBrandName)
    );

    console.log("Domain finder result:", domainResult);

    await updateProgress(
      job,
      jobId,
      "DOMAIN_FINDER_DONE_" + domainResult.domainFound + "_DOMAINS",
      76
    );

    await updateProgress(job, jobId, "EMAIL_DISCOVERY_STARTED", 80);

    const emailDiscoveryResult = await runStage(
      jobId,
      "EMAIL_DISCOVERY",
      stageState,
      () => discoverEmailsForPendingBrands(seedBrandName)
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

    const verificationResult = await runStage(
      jobId,
      "EMAIL_VERIFICATION",
      stageState,
      () => verifyPendingContacts()
    );

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

    const instantlyExportResult = await runStage(
      jobId,
      "INSTANTLY_EXPORT",
      stageState,
      () =>
        exportDiscoveredBrandsToInstantly(
          job,
          jobId,
          seedBrandId,
          seedBrandName
        )
    );

    console.log("Instantly export result:", instantlyExportResult);

    await updateProgress(
      job,
      jobId,
      "INSTANTLY_EXPORT_DONE_" +
        instantlyExportResult.exportedRows +
        "_ROWS",
      97
    );

    await updateProgress(job, jobId, "INSTANTLY_COMPETITORS_STARTED", 98);

    const instantlyCompetitorResult = await runStage(
      jobId,
      "INSTANTLY_COMPETITORS",
      stageState,
      () => fillInstantlyLeadCompetitors()
    );

    console.log("Instantly competitor result:", instantlyCompetitorResult);

    await updateProgress(
      job,
      jobId,
      "INSTANTLY_COMPETITORS_DONE_" +
        instantlyCompetitorResult.updated +
        "_ROWS",
      98
    );

    await updateProgress(job, jobId, "INSTANTLY_VERIFICATION_GATEWAY_STARTED", 99);

    const instantlyHygieneResult = await runStage(
      jobId,
      "INSTANTLY_HYGIENE",
      stageState,
      () => backfillInstantlyLeadVerificationAndGateway()
    );

    console.log("Instantly verification/gateway result:", instantlyHygieneResult);

    await updateProgress(
      job,
      jobId,
      "INSTANTLY_VERIFICATION_GATEWAY_DONE_" +
        instantlyHygieneResult.verificationUpdated +
        "_VERIFIED_" +
        instantlyHygieneResult.gatewayUpdated +
        "_GATEWAYS",
      99
    );

    await runStage(jobId, "NICHE_FINAL", stageState, () =>
      rebuildNicheAnalysis()
    );

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

    await markJobCompleted(jobId, "MASTER_PIPELINE_COMPLETE", {
      crawlResult,
      aiResult,
      brandMapResult,
      pgaResult,
      nicheResult,
      domainResult,
      emailDiscoveryResult,
      verificationResult,
      instantlyExportResult,
      instantlyCompetitorResult,
      instantlyHygieneResult
    });

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
      instantlyExportResult,
      instantlyCompetitorResult,
      instantlyHygieneResult
    };
  } catch (error: any) {
    // A long pause re-queues the job as delayed; BullMQ owns it from here.
    // This must not be recorded as a failure.
    if (error?.name === "DelayedError") {
      throw error;
    }

    const { seedBrandId } = job.data;
    const failedSeedBrand: any = await SeedBrand.findById(seedBrandId).lean();

    if (error?.name === "CrawlStoppedError") {
      console.log("PIPELINE STOPPED:", jobId);

      if (failedSeedBrand?.brandName) {
        await addPipelineTrackerLog({
          type: "Seed",
          brandName: failedSeedBrand.brandName,
          domain: "",
          status: "STOPPED"
        });
      }

      await SeedBrand.findByIdAndUpdate(seedBrandId, {
        $set: {
          status: "stopped"
        }
      });

      await markJobStopped(jobId);

      return {
        success: false,
        stopped: true
      };
    }

    console.error("PIPELINE FAILED:", error?.message || error);

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
  } finally {
    unregisterActiveJob(jobId);
  }
}
