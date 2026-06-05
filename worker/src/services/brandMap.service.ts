import { RawYoutubeVideo } from "../models/RawYoutubeVideo.model";
import { BrandMap } from "../models/BrandMap.model";
import { ExcludedBrand } from "../models/ExcludedBrand.model";
import { addPipelineTrackerLog } from "./pipelineTracker.service";
import {
  findOfficialDomainForBrand,
  cleanDomain,
  isValidDomain
} from "./domainResolver.service";

function cleanValue(value: any) {
  return String(value || "").trim();
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeComparable(value: any) {
  return cleanValue(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
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
    "sihoo": "Sihoo",
    "sihoo office": "Sihoo",
    "anker": "Anker",
    "anker solix": "Anker",
    "anker soundcore": "Anker soundcore",
    "bluetti": "BLUETTI",
    "blueetti": "BLUETTI",
    "asus": "Asus",
    "gopro": "GoPro",
    "sony": "Sony",
    "oppo": "OPPO",
    "eufy": "eufy",
    "dreame": "Dreame",
    "baseus": "Baseus"
  };

  return aliases[lower] || raw;
}

function getKnownDomain(brandName: string) {
  const lower = cleanValue(brandName).toLowerCase();

  const domains: Record<string, string> = {
    "ecoflow": "ecoflow.com",
    "sihoo": "sihoooffice.com",
    "anker": "anker.com",
    "anker soundcore": "soundcore.com",
    "bluetti": "bluettipower.com",
    "jackery": "jackery.com",
    "baseus": "baseus.com",
    "asus": "asus.com",
    "sony": "sony.com",
    "gopro": "gopro.com",
    "eufy": "eufy.com",
    "dreame": "dreame.tech",
    "oppo": "oppo.com"
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

function formatDateShort(date: Date | null) {
  if (!date) return "";

  return date.toISOString().substring(0, 10);
}

function getRecencyTag(date: Date | null) {
  if (!date) return "";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 30) return "Last 30 days";
  if (diffDays <= 60) return "Last 60 days";
  if (diffDays <= 90) return "Last 90 days";

  return "90+ days";
}

async function isExcludedBrand(brandName: string, domain: string) {
  const brand = cleanValue(brandName);
  const cleanDom = cleanDomain(domain);

  const conditions: any[] = [];

  if (brand) {
    conditions.push({
      brandName: new RegExp("^" + escapeRegex(brand) + "$", "i")
    });
  }

  if (cleanDom) {
    conditions.push({
      domain: new RegExp("^" + escapeRegex(cleanDom) + "$", "i")
    });
  }

  if (conditions.length === 0) {
    return false;
  }

  const excluded = await ExcludedBrand.findOne({
    $or: conditions
  });

  return Boolean(excluded);
}

function isSeedBrand(sponsorBrand: string, seedBrandName: string) {
  const sponsor = normalizeComparable(normalizeBrandName(sponsorBrand));
  const seed = normalizeComparable(normalizeBrandName(seedBrandName));

  if (!sponsor || !seed) return false;

  return sponsor === seed;
}

function isSelfPromotion(brandName: string, videos: any[]) {
  const brandLower = cleanValue(brandName).toLowerCase();

  for (const video of videos) {
    const channelName = cleanValue(video.channelName).toLowerCase();

    if (!channelName) continue;

    if (
      channelName.includes(brandLower) ||
      brandLower.includes(channelName)
    ) {
      return true;
    }
  }

  return false;
}

function buildChannelNames(videos: any[], brandName: string) {
  const lines: string[] = [];

  for (let i = 0; i < videos.length; i++) {
    const video = videos[i];

    const productPart =
      video.productNameWithModel && video.productNameWithModel !== "N/A"
        ? video.productNameWithModel
        : brandName;

    const datePart = video.publishedDate
      ? " on " + formatDateShort(new Date(video.publishedDate))
      : "";

    lines.push(
      String(i + 1) +
        ". " +
        video.channelName +
        " (" +
        productPart +
        ")" +
        datePart
    );
  }

  return lines;
}

export async function buildBrandMapForSeedBrand(seedBrandId: string) {
  const videos = await RawYoutubeVideo.find({
    seedBrandId
  }).lean();

  await BrandMap.deleteMany({
    seedBrandId
  });

  const validVideos = videos.filter((video: any) => {
    if (isInvalidValue(video.sponsorBrand)) return false;
    if (isSeedBrand(video.sponsorBrand, video.seedBrandName)) return false;
    return true;
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

  const existingDomains: Record<string, boolean> = {};
  const existingRows = await BrandMap.find({}).lean();

  for (const row of existingRows as any[]) {
    const domain = cleanDomain(row.domain);
    if (domain) existingDomains[domain] = true;
  }

  let createdOrUpdated = 0;
  let skippedExcluded = 0;
  let skippedSeedBrand = videos.length - validVideos.length;
  let skippedMissingDomain = 0;
  let skippedDuplicateDomain = 0;
  let skippedSelfPromotion = 0;

  const brandNames = Array.from(grouped.keys());

  for (let i = 0; i < brandNames.length; i++) {
    const brandName = brandNames[i];
    const brandVideos = grouped.get(brandName) || [];

    if (isSelfPromotion(brandName, brandVideos)) {
      skippedSelfPromotion += 1;
      continue;
    }

    const productNames = unique(
      brandVideos.map((video: any) => video.productNameWithModel)
    );

    const productHint = productNames[0] || "";

    let domain = cleanDomain(getKnownDomain(brandName));

    if (!isValidDomain(domain)) {
      domain = await findOfficialDomainForBrand({
        brandName,
        productHint
      });
    }

    domain = cleanDomain(domain);

    if (!isValidDomain(domain)) {
      skippedMissingDomain += 1;

      await addPipelineTrackerLog({
        type: "Discovered",
        brandName,
        domain: "",
        status: "Skipped - Missing Domain"
      });

      continue;
    }

    if (await isExcludedBrand(brandName, domain)) {
      skippedExcluded += 1;

      await addPipelineTrackerLog({
        type: "Discovered",
        brandName,
        domain,
        status: "Skipped - Excluded Brand"
      });

      continue;
    }

    if (existingDomains[domain]) {
      skippedDuplicateDomain += 1;

      await addPipelineTrackerLog({
        type: "Discovered",
        brandName,
        domain,
        status: "Skipped - Duplicate Domain"
      });

      continue;
    }

    const channelNames = buildChannelNames(brandVideos, brandName);

    const channelCount = new Set(
      brandVideos.map((video: any) => video.channelId).filter(Boolean)
    ).size;

    const sourceVideoIds = unique(
      brandVideos.map((video: any) => video.videoId)
    );

    const sourceVideoUrls = unique(
      brandVideos.map((video: any) => video.videoUrl)
    );

    const mostRecentSponsorshipDate = getLatestDate(brandVideos);

    const niche = mostCommon(
      brandVideos.map((video: any) => video.channelCategory)
    );

    const foundVia = brandVideos[0]?.seedBrandName || "";

    await BrandMap.create({
      seedBrandId,
      seedBrandName: foundVia,

      brandName,
      foundVia,
      channelCount,
      channelNames,
      mostRecentSponsorshipDate,
      recencyTag: getRecencyTag(mostRecentSponsorshipDate),
      niche,
      domain,

      productNames,
      sourceVideoIds,
      sourceVideoUrls,

      status: "domain_found",
      isExcluded: false,

      raw: {
        videoCount: brandVideos.length,
        originalSponsorBrands: unique(
          brandVideos.map((video: any) => video.sponsorBrand)
        ),
        foundViaSeedBrand: foundVia
      }
    });

    existingDomains[domain] = true;

    await addPipelineTrackerLog({
      type: "Discovered",
      brandName,
      domain,
      status: "Discovered via " + foundVia
    });

    createdOrUpdated += 1;
  }

  return {
    totalRawVideos: videos.length,
    validSponsoredVideos: validVideos.length,
    brandsCreatedOrUpdated: createdOrUpdated,
    skippedExcluded,
    skippedSeedBrand,
    skippedMissingDomain,
    skippedDuplicateDomain,
    skippedSelfPromotion
  };
}
