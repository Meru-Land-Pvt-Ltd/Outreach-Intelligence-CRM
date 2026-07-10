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

      const domain = await ensureBrandDomain(brandMap);

      if (!domain) {
        summary.skippedNoDomain += 1;

        await addPipelineTrackerLog({
          type: "Discovered",
          brandName,
          domain: "",
          status: "Skipped - No Domain Found"
        });

        continue;
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
