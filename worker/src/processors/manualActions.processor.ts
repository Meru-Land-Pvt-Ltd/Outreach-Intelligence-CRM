import { Job } from "bullmq";
import mongoose from "mongoose";

import { BrandMap } from "../models/BrandMap.model";
import { discoverEmailsForBrandMap } from "../services/emailDiscovery.service";
import { verifyContactsForBrand } from "../services/emailVerifier.service";
import { exportBrandToInstantlyTabs } from "../services/instantlyExport.service";
import { updateTotalEmailsForBrand } from "../services/totalEmails.service";
import { addPipelineTrackerLog } from "../services/pipelineTracker.service";
import {
  cleanDomain,
  findOfficialDomainForBrand,
  isValidDomain
} from "../services/domainResolver.service";
import {
  enforceCrawlerControl,
  markJobCompleted,
  markJobFailed,
  markJobStopped,
  registerActiveJob,
  unregisterActiveJob,
  updateProgress
} from "../services/jobControl.service";

const BrandMapModel = BrandMap as any;

function cleanText(value: any) {
  return String(value || "").trim();
}

async function ensureBrandDomain(brandMap: any) {
  let domain = cleanDomain(brandMap.domain);

  if (isValidDomain(domain)) {
    return domain;
  }

  domain = cleanDomain(
    await findOfficialDomainForBrand({
      brandName: cleanText(brandMap.brandName),
      productHint: cleanText(brandMap.productNames?.[0])
    })
  );

  if (!isValidDomain(domain)) {
    await BrandMapModel.findByIdAndUpdate(brandMap._id, {
      $set: { status: "domain_not_found" }
    });

    return "";
  }

  await BrandMapModel.findByIdAndUpdate(brandMap._id, {
    $set: { domain, status: "domain_found" }
  });

  brandMap.domain = domain;

  return domain;
}

type CampaignProcessSummary = {
  processed: number;
  skippedNoDomain: number;
  contactsFound: number;
  contactsVerified: number;
  leadsStaged: number;
};

// The per-brand campaign chain shared by "Send Selected to Campaign" and the
// per-seed "Start Email Crawling" job: domain → discovery → verification →
// Instantly staging → totals + tracker.
async function processBrandMapRowForCampaign(
  brandMap: any,
  summary: CampaignProcessSummary
) {
  const brandName = cleanText(brandMap.brandName);
  const domain = await ensureBrandDomain(brandMap);

  if (!domain) {
    summary.skippedNoDomain += 1;

    await addPipelineTrackerLog({
      type: "Discovered",
      brandName,
      domain: "",
      status: "Skipped - No Domain Found"
    });

    return false;
  }

  const discovery = await discoverEmailsForBrandMap(brandMap);
  summary.contactsFound += Number(discovery.saved || 0);

  const verification = await verifyContactsForBrand(brandName, domain);
  summary.contactsVerified += Number(verification.verified || 0);

  const exportResult = await exportBrandToInstantlyTabs(brandName);
  summary.leadsStaged += Number(exportResult.exported || 0);

  await updateTotalEmailsForBrand(brandName, domain);

  await addPipelineTrackerLog({
    type: "Discovered",
    brandName,
    domain,
    status: "Processed for campaign (manual selection)"
  });

  summary.processed += 1;

  return true;
}

// "Send Selected to Campaign": run discovery → verification → Instantly
// staging for exactly the approved brands the user picked, one at a time.
export async function processSelectedBrandsJob(job: Job, token?: string) {
  const jobId = String(job.id);

  const brandMapIds: string[] = (
    Array.isArray(job.data?.brandMapIds) ? job.data.brandMapIds : []
  )
    .map((id: any) => String(id))
    .filter((id: string) => mongoose.Types.ObjectId.isValid(id))
    .slice(0, 200);

  registerActiveJob(jobId, job, token);

  try {
    const summary = {
      requested: brandMapIds.length,
      processed: 0,
      skippedMissing: 0,
      skippedNotApproved: 0,
      skippedNoDomain: 0,
      contactsFound: 0,
      contactsVerified: 0,
      leadsStaged: 0
    };

    await updateProgress(
      job,
      jobId,
      "PROCESS_SELECTED_STARTED_" + brandMapIds.length + "_BRANDS",
      2
    );

    for (let i = 0; i < brandMapIds.length; i++) {
      await enforceCrawlerControl(jobId);

      const brandMap = await BrandMapModel.findById(brandMapIds[i]);

      if (!brandMap) {
        summary.skippedMissing += 1;
        continue;
      }

      // Re-check at run time: the user may have excluded the brand between
      // clicking the button and this job reaching the front of the queue.
      if (
        brandMap.selectionStatus !== "approved" ||
        brandMap.isExcluded === true
      ) {
        summary.skippedNotApproved += 1;
        continue;
      }

      const brandName = cleanText(brandMap.brandName);
      const progress = 5 + Math.round(((i + 1) / brandMapIds.length) * 90);

      await updateProgress(
        job,
        jobId,
        "PROCESS_BRAND_" + brandName + "_" + (i + 1) + "/" + brandMapIds.length,
        progress
      );

      await processBrandMapRowForCampaign(brandMap, summary);
    }

    await markJobCompleted(
      jobId,
      "PROCESS_SELECTED_COMPLETE_" + summary.processed + "_BRANDS",
      summary
    );

    return {
      success: true,
      ...summary
    };
  } catch (error: any) {
    if (error?.name === "DelayedError") {
      throw error;
    }

    if (error?.name === "CrawlStoppedError") {
      await markJobStopped(jobId, "Selected-brands processing stopped by user");

      return {
        success: false,
        stopped: true
      };
    }

    console.error("PROCESS SELECTED FAILED:", error?.message || error);
    await markJobFailed(jobId, error);

    throw error;
  } finally {
    unregisterActiveJob(jobId);
  }
}

// "Start Email Crawling": run the campaign chain for every surviving brand
// of one seed. Survivors are resolved at run time (pending AND approved;
// PGA-gated and manually excluded brands are out; no auto-approve side
// effect — selectionStatus stays a purely manual signal).
export async function processSeedBrandsJob(job: Job, token?: string) {
  const jobId = String(job.id);
  const seedBrandId = String(job.data?.seedBrandId || "");

  registerActiveJob(jobId, job, token);

  try {
    if (!mongoose.Types.ObjectId.isValid(seedBrandId)) {
      throw new Error("Invalid seedBrandId");
    }

    const brandMaps = await BrandMapModel.find({
      seedBrandId,
      selectionStatus: { $ne: "excluded" },
      isExcluded: { $ne: true },
      domain: { $exists: true, $nin: ["", "-", null, "N/A", "unspecified"] }
    })
      .sort({ pgaScore: -1, mostRecentSponsorshipDate: -1 })
      .limit(500);

    const summary = {
      seedBrandId,
      totalBrands: brandMaps.length,
      processed: 0,
      skippedNoDomain: 0,
      contactsFound: 0,
      contactsVerified: 0,
      leadsStaged: 0
    };

    await updateProgress(
      job,
      jobId,
      "EMAIL_CRAWL_STARTED_" + brandMaps.length + "_BRANDS",
      2
    );

    for (let i = 0; i < brandMaps.length; i++) {
      await enforceCrawlerControl(jobId);

      const brandMap = brandMaps[i];
      const brandName = cleanText(brandMap.brandName);
      const progress = 5 + Math.round(((i + 1) / brandMaps.length) * 90);

      await updateProgress(
        job,
        jobId,
        "EMAIL_CRAWL_" + brandName + "_" + (i + 1) + "/" + brandMaps.length,
        progress
      );

      await processBrandMapRowForCampaign(brandMap, summary);
    }

    await markJobCompleted(
      jobId,
      "EMAIL_CRAWL_COMPLETE_" + summary.processed + "_BRANDS",
      summary
    );

    return {
      success: true,
      ...summary
    };
  } catch (error: any) {
    if (error?.name === "DelayedError") {
      throw error;
    }

    if (error?.name === "CrawlStoppedError") {
      await markJobStopped(jobId, "Email crawling stopped by user");

      return {
        success: false,
        stopped: true
      };
    }

    console.error("EMAIL CRAWL FAILED:", error?.message || error);
    await markJobFailed(jobId, error);

    throw error;
  } finally {
    unregisterActiveJob(jobId);
  }
}

// "Run Web Scrape": refresh the free website/social scrape for one brand
// without touching paid-provider results.
export async function discoverEmailsJob(job: Job, token?: string) {
  const jobId = String(job.id);
  const brandMapId = String(job.data?.brandMapId || "");
  const mode = job.data?.mode === "scrape_only" ? "scrape_only" : "full";

  registerActiveJob(jobId, job, token);

  try {
    if (!mongoose.Types.ObjectId.isValid(brandMapId)) {
      throw new Error("Invalid brandMapId");
    }

    const brandMap = await BrandMapModel.findById(brandMapId);

    if (!brandMap) {
      throw new Error("Brand map row not found");
    }

    const brandName = cleanText(brandMap.brandName);

    await updateProgress(job, jobId, "WEB_SCRAPE_" + brandName + "_STARTED", 10);

    const result = await discoverEmailsForBrandMap(brandMap, { mode });

    await markJobCompleted(
      jobId,
      "WEB_SCRAPE_COMPLETE_" + Number(result.saved || 0) + "_EMAILS",
      result
    );

    return {
      success: true,
      result
    };
  } catch (error: any) {
    if (error?.name === "DelayedError") {
      throw error;
    }

    if (error?.name === "CrawlStoppedError") {
      await markJobStopped(jobId, "Web scrape stopped by user");

      return {
        success: false,
        stopped: true
      };
    }

    console.error("WEB SCRAPE FAILED:", error?.message || error);
    await markJobFailed(jobId, error);

    throw error;
  } finally {
    unregisterActiveJob(jobId);
  }
}
