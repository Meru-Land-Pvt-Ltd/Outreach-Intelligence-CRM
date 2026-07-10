import { Request, Response } from "express";
import { BrandMap } from "../models/BrandMap.model";
import { RawYoutubeVideo } from "../models/RawYoutubeVideo.model";
import { ExcludedBrand } from "../models/ExcludedBrand.model";
import { LatestReview } from "../models/LatestReview.model";
import { exportBrandMapsToChannel } from "./instantly.controller";
import { intelligenceQueue } from "../queues/intelligence.queue";
import {
  buildExcludedBrandMatch,
  normalizeBrandNameValue,
  normalizeDomainValue
} from "../utils/normalize";
import { computePga, getPgaWeights, pgaPriority } from "../utils/pga";

function cleanValue(value: any) {
  return String(value || "").trim();
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function exactInsensitive(value: string) {
  return new RegExp("^" + escapeRegex(value) + "$", "i");
}

function getIdsFromBody(req: Request): string[] {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];

  return ids
    .map((id: any) => cleanValue(id))
    .filter((id: string) => /^[a-f0-9]{24}$/i.test(id));
}

async function isBrandExcluded(brandName: string, domain: string) {
  const match = buildExcludedBrandMatch(brandName, domain);

  if (!match) return false;

  const existing = await ExcludedBrand.findOne(match);

  return Boolean(existing);
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
    if (await isBrandExcluded(brandName, getKnownDomain(brandName))) {
      continue;
    }

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

    const query = BrandMap.find(filter)
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

export async function selectBrandMapRows(req: Request, res: Response) {
  try {
    const ids = getIdsFromBody(req);
    const selected = req.body?.selected !== false;

    if (ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "ids array with Brand Map row ids is required"
      });
    }

    const result = await BrandMap.updateMany(
      { _id: { $in: ids } },
      selected
        ? { $set: { isSelected: true, selectedAt: new Date() } }
        : { $set: { isSelected: false } }
    );

    res.json({
      success: true,
      selected,
      requested: ids.length,
      matched: result.matchedCount || 0,
      modified: result.modifiedCount || 0
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function excludeBrandMapRows(req: Request, res: Response) {
  try {
    const ids = getIdsFromBody(req);

    if (ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "ids array with Brand Map row ids is required"
      });
    }

    const rows: any[] = await BrandMap.find({ _id: { $in: ids } }).lean();

    let excludedCreated = 0;
    let alreadyExcluded = 0;
    let rowsMarked = 0;
    let skippedNoIdentity = 0;

    for (const row of rows) {
      const brandName = cleanValue(row.brandName);
      const domain = normalizeDomainValue(row.domain);

      if (!brandName && !domain) {
        skippedNoIdentity += 1;
        continue;
      }

      // Atomic upsert keyed on normalized + legacy fields. No unique index
      // (legacy duplicates may exist), so readers always match via $or.
      const match = buildExcludedBrandMatch(brandName, domain);
      const upsertResult: any = await ExcludedBrand.updateOne(
        match as any,
        {
          $setOnInsert: {
            brandName,
            domain,
            normalizedBrandName: normalizeBrandNameValue(brandName),
            normalizedDomain: domain,
            source: "brand-map-bulk-exclude",
            brandMapId: row._id
          }
        },
        { upsert: true }
      );

      if (upsertResult.upsertedId) {
        excludedCreated += 1;
      } else {
        alreadyExcluded += 1;
      }

      const markConditions: any[] = [{ _id: row._id }];

      if (domain) {
        markConditions.push({ domain: exactInsensitive(domain) });
      }

      const markResult = await BrandMap.updateMany(
        { $or: markConditions },
        { $set: { isExcluded: true, isSelected: false } }
      );

      rowsMarked += markResult.modifiedCount || 0;
    }

    res.json({
      success: true,
      requested: ids.length,
      found: rows.length,
      excludedCreated,
      alreadyExcluded,
      rowsMarked,
      skippedNoIdentity
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

function daysBetween(from: Date, to: Date) {
  return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

const WEAK_SPONSORSHIP_TYPES = /tutorial|mention/i;

// PGA = Probability of Getting Acquired (as a sponsorship/collab opportunity).
// Weighted, configurable score over the four marketing factors. Uses data the
// pipeline already collects (LatestReview for our handles, RawYoutubeVideo for
// creator activity). Product-launch and US-store factors have no data source
// yet, so they are reported as unknown — never assumed positive.
export async function discoverBrandIntent(req: Request, res: Response) {
  try {
    const id = cleanValue(req.params.id);

    if (!/^[a-f0-9]{24}$/i.test(id)) {
      return res.status(400).json({
        success: false,
        message: "Valid Brand Map row id is required"
      });
    }

    const brandMap: any = await BrandMap.findById(id).lean();

    if (!brandMap) {
      return res.status(404).json({
        success: false,
        message: "Brand Map row not found"
      });
    }

    const brandName = cleanValue(brandMap.brandName);

    if (!brandName) {
      return res.status(400).json({
        success: false,
        message: "Brand Map row has no brand name"
      });
    }

    const now = new Date();
    const nameRegex = new RegExp(escapeRegex(brandName), "i");
    const weights = getPgaWeights();
    const dataSources: string[] = [];

    // Factor 1: previous video/collaboration on OUR handles.
    const ourReviews: any[] = await LatestReview.find({
      videoTitle: nameRegex
    })
      .sort({ publishedDate: -1 })
      .limit(3)
      .lean();

    let collabScore: number | null = null;
    let collabDetail = "";

    if (ourReviews.length > 0 && ourReviews[0].publishedDate) {
      const days = daysBetween(new Date(ourReviews[0].publishedDate), now);

      collabScore = days <= 183 ? 80 : days <= 365 ? 60 : 25;
      collabDetail =
        "Previous video on our handle (" +
        cleanValue(ourReviews[0].channel) +
        ") " +
        days +
        " day(s) ago";
      dataSources.push("latest-reviews (our handles)");
    } else {
      collabScore = 10;
      collabDetail = "No previous video found on our handles";
      dataSources.push("latest-reviews (our handles, no match)");
    }

    // Factor 3: promotional activity in the last 90 days on creator channels.
    // Genuine sponsorship types count higher than tutorial/brief mentions.
    const cutoff90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const recentVideos: any[] = await RawYoutubeVideo.find({
      sponsorBrand: nameRegex,
      publishedDate: { $gte: cutoff90 }
    })
      .select("sponsorshipType publishedDate")
      .limit(50)
      .lean();

    const genuineCount = recentVideos.filter(
      (video) => !WEAK_SPONSORSHIP_TYPES.test(String(video.sponsorshipType || ""))
    ).length;
    const weakCount = recentVideos.length - genuineCount;

    const lastSponsorship =
      brandMap.mostRecentSponsorshipDate || brandMap.latestSponsorshipDate;

    let activityScore: number | null = null;
    let activityDetail = "";

    if (recentVideos.length > 0) {
      const base =
        genuineCount >= 3 ? 95 : genuineCount === 2 ? 85 : genuineCount === 1 ? 75 : 45;

      activityScore = base;
      activityDetail =
        genuineCount +
        " genuine sponsorship/collab video(s) and " +
        weakCount +
        " tutorial/mention-only video(s) in the last 90 days";
      dataSources.push("raw-youtube-videos (last 90 days)");
    } else if (lastSponsorship) {
      const days = daysBetween(new Date(lastSponsorship), now);

      activityScore = days <= 120 ? 60 : days <= 240 ? 35 : 20;
      activityDetail = "Most recent recorded sponsorship " + days + " day(s) ago";
      dataSources.push("brand-map sponsorship history");
    } else {
      activityScore = null;
      activityDetail = "No sponsorship activity recorded yet";
    }

    const pga = computePga([
      {
        key: "previousCollab",
        label: "Previous collaboration on our handle",
        score: collabScore,
        weight: weights.previousCollab,
        detail: collabDetail
      },
      {
        key: "productLaunch",
        label: "New product launch in past 90 days",
        score: null,
        weight: weights.productLaunch,
        detail: "Unknown - needs external product/news scan (not implemented yet)"
      },
      {
        key: "promoActivity",
        label: "Promotional activity in past 90 days",
        score: activityScore,
        weight: weights.promoActivity,
        detail: activityDetail
      },
      {
        key: "usAvailability",
        label: "US store / Amazon.com availability",
        score: null,
        weight: weights.usAvailability,
        detail: "Unknown - needs external store scan (not implemented yet)"
      }
    ]);

    const hasRealSignal =
      ourReviews.length > 0 || recentVideos.length > 0 || Boolean(lastSponsorship);

    const insufficientData = pga.insufficientData || !hasRealSignal;

    const intentScore = activityScore !== null ? activityScore : pga.pgaScore;

    const update = {
      intentScore: insufficientData ? 0 : intentScore,
      pgaScore: insufficientData ? 0 : pga.pgaScore,
      intentStatus: insufficientData
        ? "insufficient_data"
        : pgaPriority(pga.pgaScore),
      intentReason: insufficientData
        ? "Insufficient data: no reviews on our handles and no sponsorship history recorded for this brand."
        : pga.breakdown
            .map((factor) => factor.label + ": " + factor.detail)
            .join("; "),
      pgaBreakdown: {
        factors: pga.breakdown,
        confidence: pga.confidence,
        weights
      },
      intentDataSources: dataSources,
      insufficientData,
      lastIntentCheckedAt: now
    };

    await BrandMap.updateOne({ _id: brandMap._id }, { $set: update });

    return res.json({ success: true, data: { _id: id, ...update } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function discoverEmailsForBrandMapRows(req: Request, res: Response) {
  try {
    const ids = getIdsFromBody(req);

    if (ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "ids array with Brand Map row ids is required"
      });
    }

    const eligible = await BrandMap.countDocuments({
      _id: { $in: ids },
      isExcluded: { $ne: true }
    });

    if (eligible === 0) {
      return res.status(400).json({
        success: false,
        message: "No eligible (non-excluded) Brand Map rows in selection."
      });
    }

    const job = await intelligenceQueue.add(
      "discover-selected-emails",
      { brandMapIds: ids },
      {
        attempts: 1,
        removeOnComplete: false,
        removeOnFail: false
      }
    );

    res.status(202).json({
      success: true,
      jobId: String(job.id),
      queued: eligible,
      message:
        "Email discovery started in background for " +
        eligible +
        " selected brand(s). Contacts appear as the worker processes them."
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function pushBrandMapRowsToInstantly(req: Request, res: Response) {
  try {
    const ids = getIdsFromBody(req);
    const channel = cleanValue(req.body?.channel);

    if (ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "ids array with Brand Map row ids is required"
      });
    }

    const result = await exportBrandMapsToChannel({
      brandMapIds: ids,
      channel
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
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
