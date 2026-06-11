import { Request, Response } from "express";
import { BrandMap } from "../models/BrandMap.model";
import { RawYoutubeVideo } from "../models/RawYoutubeVideo.model";

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
