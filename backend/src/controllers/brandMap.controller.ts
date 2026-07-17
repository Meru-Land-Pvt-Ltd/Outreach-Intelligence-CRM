import { Request, Response } from "express";
import mongoose from "mongoose";
import { BrandMap } from "../models/BrandMap.model";
import { RawYoutubeVideo } from "../models/RawYoutubeVideo.model";
import { JobLog } from "../models/JobLog.model";
import { intelligenceQueue } from "../queues/intelligence.queue";
import {
  buildExclusionRowConditions,
  upsertExcludedBrand
} from "./sheets.controller";
import { ExcludedBrand } from "../models/ExcludedBrand.model";
import { getAppSettings } from "./settings.controller";
import { callOpenAIWithWebSearch } from "../utils/openaiResponses";
import {
  buildPgaPrompt,
  isPgaCacheFresh,
  parsePgaJson
} from "../utils/pgaScore";

function cleanValue(value: any) {
  return String(value || "").trim();
}

function isInvalidValue(value: any) {
  const text = cleanValue(value).toLowerCase();

  if (!text) return true;
  if (text === "none") return true;
  if (text === "n/a") return true;
  if (text === "na") return true;
  if (text === "unknown") return true;
  if (text === "-") return true;

  return false;
}

function normalizeBrandName(value: any) {
  const raw = cleanValue(value);
  const lower = raw.toLowerCase();

  const aliases: Record<string, string> = {
    "ef ecoflow": "EcoFlow",
    "ecoflow": "EcoFlow",
    "eco flow": "EcoFlow",

    "anker": "Anker",
    "anker solix": "Anker",

    "bluetti": "BLUETTI",
    "blueetti": "BLUETTI",

    "jackery": "Jackery"
  };

  if (aliases[lower]) {
    return aliases[lower];
  }

  return raw;
}

function getKnownDomain(brandName: string) {
  const lower = cleanValue(brandName).toLowerCase();

  const domains: Record<string, string> = {
    "ecoflow": "ecoflow.com",
    "anker": "anker.com",
    "bluetti": "bluettipower.com",
    "jackery": "jackery.com"
  };

  return domains[lower] || "";
}

function unique(values: string[]) {
  return Array.from(
    new Set(
      values
        .map((value) => cleanValue(value))
        .filter((value) => !isInvalidValue(value))
    )
  );
}

function mostCommon(values: string[]) {
  const countMap = new Map<string, number>();

  for (const value of values) {
    const clean = cleanValue(value);
    if (isInvalidValue(clean)) continue;

    countMap.set(clean, (countMap.get(clean) || 0) + 1);
  }

  let winner = "";
  let max = 0;

  for (const [value, count] of countMap.entries()) {
    if (count > max) {
      winner = value;
      max = count;
    }
  }

  return winner;
}

function getLatestDate(videos: any[]) {
  let latest: Date | null = null;

  for (const video of videos) {
    const date = video.publishedDate ? new Date(video.publishedDate) : null;

    if (!date) continue;

    if (!latest || date > latest) {
      latest = date;
    }
  }

  return latest;
}

async function rebuildBrandMapForSeed(seedBrandId: string) {
  const videos = await RawYoutubeVideo.find({
    seedBrandId
  }).lean();

  // Do not clear Brand Map before rebuilding one seed.
  // Rebuild should update/append rows instead of wiping existing data.

  const validVideos = videos.filter((video: any) => {
    return !isInvalidValue(video.sponsorBrand);
  });

  const grouped = new Map<string, any[]>();

  for (const video of validVideos) {
    const brandName = normalizeBrandName(video.sponsorBrand);

    if (!brandName) continue;

    if (!grouped.has(brandName)) {
      grouped.set(brandName, []);
    }

    grouped.get(brandName)!.push(video);
  }

  let createdOrUpdated = 0;

  for (const [brandName, brandVideos] of grouped.entries()) {
    const productNames = unique(
      brandVideos.map((video: any) => video.productNameWithModel)
    );

    const sourceChannels = unique(
      brandVideos.map((video: any) => video.channelName)
    );

    const sourceVideoIds = unique(
      brandVideos.map((video: any) => video.videoId)
    );

    const sourceVideoUrls = unique(
      brandVideos.map((video: any) => video.videoUrl)
    );

    const category = mostCommon(
      brandVideos.map((video: any) => video.channelCategory)
    );

    const latestSponsorshipDate = getLatestDate(brandVideos);
    const knownDomain = getKnownDomain(brandName);

    await BrandMap.create({
      seedBrandId,
      seedBrandName: brandVideos[0]?.seedBrandName || "",
      brandName,
      productNames,
      category,
      domain: knownDomain,
      latestSponsorshipDate,
      channelCount: sourceChannels.length,
      sourceChannels,
      sourceVideoIds,
      sourceVideoUrls,
      status: knownDomain ? "domain_found" : "new",
      isExcluded: false,
      raw: {
        videoCount: brandVideos.length,
        originalSponsorBrands: unique(
          brandVideos.map((video: any) => video.sponsorBrand)
        )
      }
    });

    createdOrUpdated += 1;
  }

  return {
    seedBrandId,
    totalRawVideos: videos.length,
    validSponsoredVideos: validVideos.length,
    brandsCreatedOrUpdated: createdOrUpdated
  };
}

export async function getBrandMap(req: Request, res: Response) {
  try {
    const seedBrandId = req.query.seedBrandId as string | undefined;
    const limitParam = String(req.query.limit || "").trim().toLowerCase();

    const filter: Record<string, any> = {};

    if (seedBrandId) {
      filter.seedBrandId = seedBrandId;
    }

    // Exclude heavy fields the Brand Map UI never renders: raw video blobs,
    // full AI responses and per-video URL arrays dominate the payload
    // (3+ MB → ~0.5 MB) and the transfer from remote Mongo.
    const query = BrandMap.find(filter)
      .select("-raw -pgaRaw -pgaSignals -sourceVideoIds -sourceVideoUrls")
      .sort({
        mostRecentSponsorshipDate: -1,
        latestSponsorshipDate: -1,
        updatedAt: -1,
        createdAt: -1
      })
      .lean();

    if (limitParam && limitParam !== "max" && limitParam !== "all") {
      const limit = Number(limitParam);

      if (Number.isFinite(limit) && limit > 0) {
        query.limit(limit);
      }
    }

    const brands = await query;

    res.json({
      success: true,
      count: brands.length,
      data: brands
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export async function rebuildBrandMap(req: Request, res: Response) {
  try {
    const seedBrandId = String(req.params.seedBrandId || "");

    const result = await rebuildBrandMapForSeed(seedBrandId);

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export async function rebuildAllBrandMaps(req: Request, res: Response) {
  try {
    const seedBrandIds = await RawYoutubeVideo.distinct("seedBrandId");

    // Do not clear all Brand Map rows.
    // Rebuild-all should update/append rows instead of wiping existing data.

    const results = [];

    for (const seedBrandId of seedBrandIds) {
      const result = await rebuildBrandMapForSeed(String(seedBrandId));
      results.push(result);
    }

    res.json({
      success: true,
      count: results.length,
      data: results
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export async function bulkSelectBrands(req: Request, res: Response) {
  try {
    const action = String(req.body?.action || "").toLowerCase();
    const force = Boolean(req.body?.force);

    const ids: string[] = (Array.isArray(req.body?.ids) ? req.body.ids : [])
      .map((id: any) => String(id))
      .filter((id: string) => mongoose.Types.ObjectId.isValid(id));

    if (!["approve", "exclude", "reset"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "action must be approve, exclude or reset"
      });
    }

    if (ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "ids is required"
      });
    }

    if (ids.length > 500) {
      return res.status(400).json({
        success: false,
        message: "Too many ids in one request (max 500)."
      });
    }

    const updatedBy = String((req as any).user?.email || "");
    const now = new Date();

    const rows = await BrandMap.find({ _id: { $in: ids } }).lean();

    if (action === "approve") {
      // Excluded brands stay excluded unless explicitly forced, so a stray
      // select-all cannot resurrect trashed brands.
      const eligible = rows.filter(
        (row: any) => force || row.selectionStatus !== "excluded"
      );
      const rejectedExcluded = rows
        .filter((row: any) => !force && row.selectionStatus === "excluded")
        .map((row: any) => String(row._id));

      await BrandMap.updateMany(
        { _id: { $in: eligible.map((row: any) => row._id) } },
        {
          $set: {
            selectionStatus: "approved",
            isExcluded: false,
            selectionUpdatedAt: now,
            selectionUpdatedBy: updatedBy
          },
          $unset: { previousSelectionStatus: "" }
        }
      );

      return res.json({
        success: true,
        action,
        updated: eligible.length,
        rejectedExcluded
      });
    }

    if (action === "exclude") {
      let excludedListUpserts = 0;

      // The ExcludedBrand rows are what keep these brands out of future
      // crawls; the BrandMap flags remove them from the current pipeline.
      for (const row of rows as any[]) {
        const upserted = await upsertExcludedBrand({
          brandName: String(row.brandName || ""),
          domain: String(row.domain || ""),
          source: "brand_map_bulk"
        });

        if (upserted) {
          excludedListUpserts += 1;
        }
      }

      // Snapshot each row's current status first so a restore can bring it
      // back exactly where it was (approved stays approved).
      await BrandMap.updateMany(
        {
          _id: { $in: rows.map((row: any) => row._id) },
          selectionStatus: { $ne: "excluded" }
        },
        [{ $set: { previousSelectionStatus: "$selectionStatus" } }]
      );

      await BrandMap.updateMany(
        { _id: { $in: rows.map((row: any) => row._id) } },
        {
          $set: {
            selectionStatus: "excluded",
            isExcluded: true,
            status: "excluded",
            selectionUpdatedAt: now,
            selectionUpdatedBy: updatedBy
          }
        }
      );

      return res.json({
        success: true,
        action,
        updated: rows.length,
        excludedListUpserts
      });
    }

    // reset: back to pending. Rows that were excluded also come off the
    // global exclude list — otherwise future crawls would keep skipping the
    // brand and pushes would keep rejecting its leads, which makes the reset
    // look like it never happened.
    await BrandMap.updateMany(
      { _id: { $in: ids } },
      {
        $set: {
          selectionStatus: "pending",
          isExcluded: false,
          selectionUpdatedAt: now,
          selectionUpdatedBy: updatedBy
        },
        $unset: { previousSelectionStatus: "" }
      }
    );

    await BrandMap.updateMany(
      { _id: { $in: ids }, status: "excluded" },
      {
        $set: {
          status: "domain_found"
        }
      }
    );

    let removedExclusions = 0;
    const wasExcluded = (rows as any[]).filter(
      (row) => row.selectionStatus === "excluded" || row.isExcluded === true
    );

    if (wasExcluded.length > 0) {
      const exclusionConditions = wasExcluded.flatMap((row) =>
        buildExclusionRowConditions(
          String(row.brandName || ""),
          String(row.domain || "")
        )
      );

      if (exclusionConditions.length > 0) {
        const removed = await (ExcludedBrand as any).deleteMany({
          $or: exclusionConditions
        });
        removedExclusions = Number(removed?.deletedCount || 0);
      }
    }

    return res.json({
      success: true,
      action,
      updated: ids.length,
      removedExclusions
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

// "Send Selected to Campaign": approve the picked brands and queue the worker
// job that runs discovery → verification → Instantly staging for them only.
export async function processSelectedBrands(req: Request, res: Response) {
  try {
    const ids: string[] = (
      Array.isArray(req.body?.brandMapIds) ? req.body.brandMapIds : []
    )
      .map((id: any) => String(id))
      .filter((id: string) => mongoose.Types.ObjectId.isValid(id));

    if (ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "brandMapIds is required"
      });
    }

    if (ids.length > 200) {
      return res.status(400).json({
        success: false,
        message: "Too many brands in one request (max 200)."
      });
    }

    const requestedBy = String((req as any).user?.email || "");
    const now = new Date();

    const rows = await BrandMap.find({ _id: { $in: ids } }).lean();

    const eligible = rows.filter(
      (row: any) => row.selectionStatus !== "excluded" && row.isExcluded !== true
    );
    const rejected = rows
      .filter(
        (row: any) =>
          row.selectionStatus === "excluded" || row.isExcluded === true
      )
      .map((row: any) => String(row._id));

    if (eligible.length === 0) {
      return res.status(400).json({
        success: false,
        message: "All selected brands are excluded.",
        rejected
      });
    }

    const eligibleIds = eligible.map((row: any) => String(row._id));

    await BrandMap.updateMany(
      { _id: { $in: eligibleIds } },
      {
        $set: {
          selectionStatus: "approved",
          isExcluded: false,
          selectionUpdatedAt: now,
          selectionUpdatedBy: requestedBy
        }
      }
    );

    const job = await intelligenceQueue.add(
      "process-selected-brands",
      {
        brandMapIds: eligibleIds,
        requestedBy
      },
      {
        attempts: 1,
        removeOnComplete: false,
        removeOnFail: false
      }
    );

    await JobLog.findOneAndUpdate(
      { jobId: String(job.id) },
      {
        $set: {
          jobId: String(job.id),
          type: "intelligence",
          brandName: `Selected brands (${eligibleIds.length})`,
          status: "queued",
          currentStep: "QUEUED",
          progress: 0,
          totalFound: eligibleIds.length,
          message: "Selected-brands processing queued",
          startedAt: now,
          raw: {
            kind: "process-selected",
            brandMapIds: eligibleIds,
            requestedBy
          }
        }
      },
      { upsert: true, returnDocument: "after" }
    );

    res.status(201).json({
      success: true,
      jobId: String(job.id),
      queued: eligibleIds.length,
      rejected
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

// ---------------------------------------------------------------------------
// Intent discovery: on-demand AI scan of a brand's recent public activity,
// scored 0-100 for how likely the brand is to buy influencer outreach now.
// Never runs automatically — button/bulk only, so web-search cost is bounded.
// ---------------------------------------------------------------------------

// PGA (probability of acquisition) scan: 4-criterion web-search rating.
// Prompt/parse live in utils/pgaScore.ts (twin of the worker's service).
async function runPgaScan(brandMapId: string) {
  const settings = await getAppSettings();
  const brandMap: any = await BrandMap.findById(brandMapId).lean();

  if (!brandMap) {
    throw new Error("Brand map row not found");
  }

  await BrandMap.findByIdAndUpdate(brandMapId, {
    $set: { pgaStatus: "running" }
  });

  try {
    const prompt = buildPgaPrompt(brandMap);
    const text = await callOpenAIWithWebSearch(
      prompt,
      settings.pgaModel || undefined
    );

    const parsed = parsePgaJson(text);

    if (!parsed) {
      throw new Error("AI returned no parseable PGA JSON");
    }

    const updated = await BrandMap.findByIdAndUpdate(
      brandMapId,
      {
        $set: {
          pgaScore: parsed.score,
          pgaSubScores: parsed.subScores,
          pgaSummary: parsed.summary,
          pgaSignals: parsed.signals,
          pgaCheckedAt: new Date(),
          pgaStatus: "done",
          pgaRaw: { text }
        }
      },
      { new: true }
    ).lean();

    return updated;
  } catch (error: any) {
    // Keep any previous score; only the status flips to failed.
    await BrandMap.findByIdAndUpdate(brandMapId, {
      $set: { pgaStatus: "failed" }
    });

    throw error;
  }
}

export async function findBrandPga(req: Request, res: Response) {
  try {
    const id = String(req.params.id || "");

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid brand map id"
      });
    }

    const settings = await getAppSettings();
    const existing: any = await BrandMap.findById(id).lean();

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Brand map row not found"
      });
    }

    const force = Boolean(req.body?.force);

    if (!force && isPgaCacheFresh(existing, settings.pgaCacheDays)) {
      return res.json({
        success: true,
        cached: true,
        data: existing
      });
    }

    const updated = await runPgaScan(id);

    res.json({
      success: true,
      cached: false,
      data: updated
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

// Bulk PGA scans run sequentially in-process (same idiom as the export
// job map in instantly.controller) with a small delay between calls.
type PgaJob = {
  total: number;
  processed: number;
  failed: number;
  skippedCached: number;
  done: boolean;
  startedAt: number;
};

const pgaJobs = new Map<string, PgaJob>();

export async function runBulkPga(req: Request, res: Response) {
  try {
    const ids: string[] = (
      Array.isArray(req.body?.ids) ? req.body.ids : []
    )
      .map((id: any) => String(id))
      .filter((id: string) => mongoose.Types.ObjectId.isValid(id));

    if (ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "ids is required"
      });
    }

    if (ids.length > 50) {
      return res.status(400).json({
        success: false,
        message: "Too many brands in one PGA batch (max 50)."
      });
    }

    const settings = await getAppSettings();
    const rows = await BrandMap.find({ _id: { $in: ids } }).lean();

    const force = Boolean(req.body?.force);
    const toScan = rows.filter(
      (row: any) => force || !isPgaCacheFresh(row, settings.pgaCacheDays)
    );
    const skippedCached = rows.length - toScan.length;

    const jobId =
      "pga_" + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);

    const job: PgaJob = {
      total: toScan.length,
      processed: 0,
      failed: 0,
      skippedCached,
      done: toScan.length === 0,
      startedAt: Date.now()
    };

    pgaJobs.set(jobId, job);

    // Prune finished jobs older than an hour.
    for (const [key, value] of pgaJobs.entries()) {
      if (value.done && Date.now() - value.startedAt > 60 * 60 * 1000) {
        pgaJobs.delete(key);
      }
    }

    if (toScan.length > 0) {
      setImmediate(async () => {
        for (const row of toScan as any[]) {
          try {
            await runPgaScan(String(row._id));
            job.processed += 1;
          } catch (error: any) {
            job.failed += 1;
            console.error(
              "Bulk PGA scan failed for",
              row.brandName,
              "-",
              error?.message || error
            );
          }

          await new Promise((resolve) => setTimeout(resolve, 2000));
        }

        job.done = true;
      });
    }

    res.status(202).json({
      success: true,
      jobId,
      queued: toScan.length,
      skippedCached
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export async function getBulkPgaStatus(req: Request, res: Response) {
  const jobId = String(req.params.jobId || "");
  const job = pgaJobs.get(jobId);

  if (!job) {
    return res.status(404).json({
      success: false,
      message: "PGA job not found (it may have expired)."
    });
  }

  res.json({
    success: true,
    ...job
  });
}

// "Run Web Scrape": queue a free scrape-only email discovery for one brand.
export async function scrapeBrandWebsite(req: Request, res: Response) {
  try {
    const id = String(req.params.id || "");

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid brand map id"
      });
    }

    const brandMap: any = await BrandMap.findById(id).lean();

    if (!brandMap) {
      return res.status(404).json({
        success: false,
        message: "Brand map row not found"
      });
    }

    const domain = String(brandMap.domain || "").trim();

    if (!domain || ["-", "N/A", "unspecified"].includes(domain)) {
      return res.status(400).json({
        success: false,
        message: "This brand has no domain to scrape."
      });
    }

    const requestedBy = String((req as any).user?.email || "");

    const job = await intelligenceQueue.add(
      "discover-emails",
      {
        brandMapId: id,
        mode: "scrape_only",
        requestedBy
      },
      {
        attempts: 1,
        removeOnComplete: false,
        removeOnFail: false
      }
    );

    await JobLog.findOneAndUpdate(
      { jobId: String(job.id) },
      {
        $set: {
          jobId: String(job.id),
          type: "intelligence",
          brandName: `Web scrape: ${brandMap.brandName || domain}`,
          status: "queued",
          currentStep: "QUEUED",
          progress: 0,
          message: "Web scrape queued",
          startedAt: new Date(),
          raw: {
            kind: "discover-emails",
            brandMapId: id,
            mode: "scrape_only",
            requestedBy
          }
        }
      },
      { upsert: true, returnDocument: "after" }
    );

    res.status(201).json({
      success: true,
      jobId: String(job.id),
      brandName: brandMap.brandName || "",
      domain
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}
