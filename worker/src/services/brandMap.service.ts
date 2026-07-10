import { RawYoutubeVideo } from "../models/RawYoutubeVideo.model";
import { BrandMap } from "../models/BrandMap.model";
import { ExcludedBrand } from "../models/ExcludedBrand.model";
import { addPipelineTrackerLog } from "./pipelineTracker.service";
import {
  findOfficialDomainForBrand,
  cleanDomain,
  isValidDomain
} from "./domainResolver.service";
import { buildExcludedBrandMatch } from "../utils/normalize";

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
  const match = buildExcludedBrandMatch(cleanValue(brandName), cleanDomain(domain));

  if (!match) return false;

  const excluded = await ExcludedBrand.findOne(match);

  return Boolean(excluded);
}

// Domain registrars, platforms and mega-corporations that show up in video
// descriptions but almost never sponsor the creators we target.
const LOW_SPONSOR_INTENT_BRANDS = [
  "godaddy",
  "namecheap",
  "squarespace",
  "wix",
  "wordpress",
  "shopify",
  "amazon",
  "google",
  "youtube",
  "facebook",
  "instagram",
  "tiktok",
  "microsoft",
  "apple",
  "netflix",
  "spotify",
  "paypal",
  "visa",
  "mastercard"
];

const WEAK_SPONSORSHIP_TYPE = /tutorial|mention/i;
const STRONG_SPONSORSHIP_TYPE = /dedicated|review|unboxing|comparison/i;
const MID_SPONSORSHIP_TYPE = /affiliate|integration/i;

function hasRealPromoCode(video: any) {
  const code = cleanValue(video.promoCode).toLowerCase();

  return Boolean(code) && code !== "n/a" && code !== "none" && code !== "-";
}

// Quality score for AI pre-filtering. Prefers small brands with recent,
// genuine collaborations; penalizes tutorial-only mentions and platforms
// with no sponsor intent.
export function scoreBrandQuality(brandName: string, brandVideos: any[]) {
  const reasons: string[] = [];
  let score = 30;

  const types = brandVideos.map((video) => cleanValue(video.sponsorshipType));
  const hasStrong = types.some((type) => STRONG_SPONSORSHIP_TYPE.test(type));
  const hasMid = types.some((type) => MID_SPONSORSHIP_TYPE.test(type));
  const weakOnly =
    types.filter(Boolean).length > 0 &&
    types.filter(Boolean).every((type) => WEAK_SPONSORSHIP_TYPE.test(type));
  const hasPromo = brandVideos.some(hasRealPromoCode);

  if (hasStrong) {
    score += 30;
    reasons.push("dedicated review/unboxing/comparison found");
  } else if (hasMid) {
    score += 18;
    reasons.push("affiliate/integration promotion found");
  }

  if (hasPromo) {
    score += 15;
    reasons.push("promo code present (paid sponsorship signal)");
  }

  if (weakOnly && !hasPromo) {
    score -= 25;
    reasons.push("tutorial/brief mention only - weak sponsor intent");
  }

  const latest = getLatestDate(brandVideos);

  if (latest) {
    const days = Math.floor((Date.now() - latest.getTime()) / (1000 * 60 * 60 * 24));

    if (days <= 90) {
      score += 20;
      reasons.push("active collaboration in last " + days + " day(s)");
    } else if (days <= 180) {
      score += 8;
      reasons.push("collaboration within 6 months");
    } else {
      score -= 10;
      reasons.push("no recent collaboration (180+ days)");
    }
  } else {
    score -= 10;
    reasons.push("no dated activity");
  }

  if (brandVideos.length >= 3) {
    score += 5;
    reasons.push(brandVideos.length + " videos found");
  }

  const lowerBrand = cleanValue(brandName).toLowerCase();

  if (LOW_SPONSOR_INTENT_BRANDS.some((bad) => lowerBrand === bad)) {
    if (hasStrong || hasPromo) {
      score -= 15;
      reasons.push("platform/mega-brand, kept due to real collaboration evidence");
    } else {
      score -= 40;
      reasons.push("platform/registrar/mega-brand with no sponsor-intent evidence");
    }
  }

  score = Math.max(0, Math.min(100, score));

  const status = score >= 70 ? "high" : score >= 40 ? "medium" : "low";

  return { score, status, reason: reasons.join("; ") };
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

export async function buildBrandMapForSeedBrand(
  seedBrandId: string,
  options: { maxBrands?: number; checkControl?: () => Promise<void> } = {}
) {
  const maxBrands = Math.max(0, Number(options.maxBrands || 0));
  const minQualityScore = Math.max(
    0,
    Number(process.env.BRANDMAP_MIN_QUALITY_SCORE || 0)
  );

  const videos = await RawYoutubeVideo.find({
    seedBrandId
  }).lean();

  // Do not clear Brand Map on every crawl.
  // New crawl results should be appended/updated below existing rows.

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

  const existingDomainSeedMap: Record<string, string> = {};
  const existingRows = await BrandMap.find({}).lean();

  for (const row of existingRows as any[]) {
    const domain = cleanDomain(row.domain);
    if (domain) {
      existingDomainSeedMap[domain] = String(row.seedBrandId || "");
    }
  }

  let createdOrUpdated = 0;
  let skippedExcluded = 0;
  let skippedSeedBrand = videos.length - validVideos.length;
  let skippedMissingDomain = 0;
  let skippedDuplicateDomain = 0;
  let skippedSelfPromotion = 0;
  let skippedByLimit = 0;
  let skippedLowQuality = 0;

  let seedRowCount = await BrandMap.countDocuments({ seedBrandId });

  const brandNames = Array.from(grouped.keys());

  for (let i = 0; i < brandNames.length; i++) {
    await options.checkControl?.();

    const brandName = brandNames[i];
    const brandVideos = grouped.get(brandName) || [];

    if (isSelfPromotion(brandName, brandVideos)) {
      skippedSelfPromotion += 1;
      continue;
    }

    const quality = scoreBrandQuality(brandName, brandVideos);

    // Threshold is opt-in (default 0 = score everything, filter nothing).
    // Filtered brands keep an audit trail in the pipeline tracker.
    if (minQualityScore > 0 && quality.score < minQualityScore) {
      skippedLowQuality += 1;

      await addPipelineTrackerLog({
        type: "Discovered",
        brandName,
        domain: "",
        status:
          "Filtered - Low Quality (" +
          quality.score +
          "/" +
          minQualityScore +
          "): " +
          quality.reason
      });

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

    const existingSeedForDomain = existingDomainSeedMap[domain];

    if (existingSeedForDomain && existingSeedForDomain !== String(seedBrandId)) {
      skippedDuplicateDomain += 1;

      await addPipelineTrackerLog({
        type: "Discovered",
        brandName,
        domain,
        status: "Skipped - Duplicate Domain"
      });

      continue;
    }

    const existingRow = await BrandMap.findOne({ seedBrandId, domain })
      .select("_id")
      .lean();

    // The per-seed crawl limit caps NEW brands only; refreshing rows that
    // already exist for this seed is always allowed.
    if (!existingRow && maxBrands > 0 && seedRowCount >= maxBrands) {
      skippedByLimit += 1;

      await addPipelineTrackerLog({
        type: "Discovered",
        brandName,
        domain,
        status: "Skipped - Brand Limit Reached (" + maxBrands + ")"
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

    await BrandMap.findOneAndUpdate(
      {
        seedBrandId,
        domain
      },
      {
        $set: {
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

          qualityScore: quality.score,
          qualityReason: quality.reason,
          qualityStatus: quality.status,

          raw: {
            videoCount: brandVideos.length,
            originalSponsorBrands: unique(
              brandVideos.map((video: any) => video.sponsorBrand)
            ),
            foundViaSeedBrand: foundVia
          }
        },
        $setOnInsert: {
          createdAt: new Date()
        }
      },
      {
        upsert: true,
        new: true
      }
    );

    existingDomainSeedMap[domain] = String(seedBrandId);

    if (!existingRow) {
      seedRowCount += 1;
    }

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
    skippedSelfPromotion,
    skippedByLimit,
    skippedLowQuality,
    minQualityScore,
    candidateBrands: brandNames.length,
    maxBrands
  };
}
