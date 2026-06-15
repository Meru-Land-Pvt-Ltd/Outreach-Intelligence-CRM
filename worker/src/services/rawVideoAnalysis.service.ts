import { RawYoutubeVideo } from "../models/RawYoutubeVideo.model";
import { env } from "../config/env";
import { buildRawVideoAnalysisPrompt } from "../prompts/rawVideoAnalysis.prompt";
import { callOpenAIText } from "./ai.service";

type ParsedLine = {
  videoNumber: number;
  channelCategory: string;
  sponsorBrand: string;
  promoCode: string;
  productNameWithModel: string;
  sponsorshipType: string;
};

function normalizeCell(value: any) {
  return String(value || "").trim();
}

function normalizeAiValue(value: any, fallback = "N/A") {
  const text = normalizeCell(value)
    .replace(/^[-*\s]+/, "")
    .replace(/\*\*/g, "")
    .trim();

  return text || fallback;
}

function isValidSponsorBrand(value: any) {
  const brand = normalizeCell(value).toLowerCase();

  if (!brand) return false;
  if (brand === "none") return false;
  if (brand === "n/a") return false;
  if (brand === "na") return false;
  if (brand === "unknown") return false;
  if (brand === "-") return false;

  return true;
}

function parseVideoNumber(value: any) {
  const match = normalizeCell(value).match(/(?:video\s*)?(\d+)/i);

  if (!match) return 0;

  const parsed = Number(match[1]);

  if (!parsed || Number.isNaN(parsed)) return 0;

  return parsed;
}

function parseOpenAIResponse(text: string): ParsedLine[] {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const parsed: ParsedLine[] = [];

  for (const line of lines) {
    const lower = line.toLowerCase();

    if (lower.includes("videonumber") || lower.includes("channel category")) {
      continue;
    }

    if (/^\|?\s*-+\s*(\|\s*-+\s*)+\|?$/.test(line)) {
      continue;
    }

    const parts = line
      .split("|")
      .map((part) => normalizeAiValue(part, ""))
      .filter(Boolean);

    if (parts.length < 6) continue;

    const videoNumber = parseVideoNumber(parts[0]);

    if (!videoNumber) continue;

    parsed.push({
      videoNumber,
      channelCategory: normalizeAiValue(parts[1], "Uncategorized"),
      sponsorBrand: normalizeAiValue(parts[2]),
      promoCode: normalizeAiValue(parts[3]),
      productNameWithModel: normalizeAiValue(parts[4]),
      sponsorshipType: normalizeAiValue(parts[5])
    });
  }

  return parsed;
}

async function analyzeBatch(videos: any[]) {
  const batch = videos.map((video: any) => ({
    channelName: video.channelName || "",
    title: video.videoTitle || "",
    duration: video.durationSec || 0,
    description: video.videoDescription || ""
  }));

  const prompt = buildRawVideoAnalysisPrompt(batch);
  const aiText = await callOpenAIText(prompt);
  const parsed = parseOpenAIResponse(aiText);
  const parsedByVideoNumber = new Map<number, ParsedLine>();

  for (const item of parsed) {
    parsedByVideoNumber.set(item.videoNumber, item);
  }

  let processed = 0;
  let missed = 0;

  for (let index = 0; index < videos.length; index++) {
    const video = videos[index];
    const item = parsedByVideoNumber.get(index + 1);

    if (!item) {
      missed += 1;

      await RawYoutubeVideo.findByIdAndUpdate(video._id, {
        $set: {
          analysisStatus: "pending_retry",
          analysisError: "AI response did not include this video number"
        }
      });

      continue;
    }

    await RawYoutubeVideo.findByIdAndUpdate(video._id, {
      $set: {
        isSponsored: isValidSponsorBrand(item.sponsorBrand),
        channelCategory: item.channelCategory,
        sponsorBrand: item.sponsorBrand,
        promoCode: item.promoCode,
        productNameWithModel: item.productNameWithModel,
        sponsorshipType: item.sponsorshipType,
        aiProcessed: true,
        analysisStatus: "completed",
        analysisError: "",
        analyzedAt: new Date()
      }
    });

    processed += 1;
  }

  return {
    processed,
    missed,
    rawResponse: aiText
  };
}

export async function analyzeUnprocessedRawVideos(seedBrandId: string) {
  const batchSize = Math.max(1, env.rawVideoAnalysisBatchSize || 5);
  const maxTotalToAnalyze = Math.max(1, env.rawVideoAnalysisLimit || 1000);

  let totalProcessed = 0;
  let totalMissed = 0;
  let totalBatches = 0;
  const rawResponses: string[] = [];

  while (totalProcessed + totalMissed < maxTotalToAnalyze) {
    const remaining = maxTotalToAnalyze - totalProcessed - totalMissed;

    const videos = await RawYoutubeVideo.find({
      seedBrandId,
      $or: [
        { aiProcessed: { $ne: true } },
        { sponsorBrand: { $exists: false } },
        { sponsorBrand: "" },
        { channelCategory: "" }
      ]
    })
      .sort({ publishedDate: -1 })
      .limit(Math.min(batchSize, remaining));

    if (videos.length === 0) {
      break;
    }

    const result = await analyzeBatch(videos);

    totalProcessed += result.processed;
    totalMissed += result.missed;
    totalBatches += 1;
    rawResponses.push(result.rawResponse);

    if (result.processed === 0 && result.missed === 0) {
      break;
    }
  }

  return {
    processed: totalProcessed,
    missed: totalMissed,
    totalBatches,
    limit: maxTotalToAnalyze,
    rawResponse: rawResponses.join("\n\n---BATCH---\n\n")
  };
}
