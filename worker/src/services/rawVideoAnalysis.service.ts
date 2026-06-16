import { RawYoutubeVideo } from "../models/RawYoutubeVideo.model";
import { buildRawVideoAnalysisPrompt } from "../prompts/rawVideoAnalysis.prompt";
import { callOpenAIText } from "./ai.service";
import {
  blankRawVideoAiFieldFilter,
  buildRawVideoFieldSet,
  inferRawVideoFields
} from "./rawVideoFieldInference.service";

type ParsedLine = {
  videoNumber: number;
  channelCategory: string;
  sponsorBrand: string;
  promoCode: string;
  productNameWithModel: string;
  sponsorshipType: string;
};

function normalizeCell(value: any) {
  return String(value || "")
    .replace(/\*\*/g, "")
    .replace(/^['\"]|['\"]$/g, "")
    .trim();
}

function stripCodeFence(text: string) {
  return String(text || "")
    .replace(/```(?:json|markdown|md)?/gi, "")
    .replace(/```/g, "")
    .trim();
}

function parseJsonResponse(text: string): ParsedLine[] {
  const cleaned = stripCodeFence(text);

  try {
    const parsed = JSON.parse(cleaned);
    const rows = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.videos)
        ? parsed.videos
        : Array.isArray(parsed?.data)
          ? parsed.data
          : [];

    return rows
      .map((row: any, index: number) => ({
        videoNumber: Number(row.videoNumber || row.video_number || row.index || index + 1),
        channelCategory: normalizeCell(row.channelCategory || row.channel_category || row.category),
        sponsorBrand: normalizeCell(row.sponsorBrand || row.sponsor_brand || row.brand),
        promoCode: normalizeCell(row.promoCode || row.promo_code || row.code),
        productNameWithModel: normalizeCell(
          row.productNameWithModel ||
            row.product_name_with_model ||
            row.productName ||
            row.product_name ||
            row.product
        ),
        sponsorshipType: normalizeCell(row.sponsorshipType || row.sponsorship_type || row.type)
      }))
      .filter((row: ParsedLine) => row.videoNumber > 0);
  } catch {
    return [];
  }
}

function parsePipeResponse(text: string): ParsedLine[] {
  const lines = stripCodeFence(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const parsed: ParsedLine[] = [];

  for (const line of lines) {
    const cleanedLine = line.replace(/^\|/, "").replace(/\|$/, "").trim();

    if (/^[-:\s|]+$/.test(cleanedLine) || /video\s*number/i.test(cleanedLine)) {
      continue;
    }

    const parts = cleanedLine.split("|").map((part) => normalizeCell(part));

    if (parts.length < 6) continue;

    const videoNumberText = parts[0].replace(/^video\s*/i, "").trim();
    const videoNumber = Number(videoNumberText);

    if (!videoNumber || Number.isNaN(videoNumber)) continue;

    parsed.push({
      videoNumber,
      channelCategory: parts[1] || "",
      sponsorBrand: parts[2] || "",
      promoCode: parts[3] || "",
      productNameWithModel: parts[4] || "",
      sponsorshipType: parts[5] || ""
    });
  }

  return parsed;
}

function parseOpenAIResponse(text: string): ParsedLine[] {
  const jsonRows = parseJsonResponse(text);

  if (jsonRows.length > 0) {
    return jsonRows;
  }

  return parsePipeResponse(text);
}

function buildCompletedSet(video: any, item?: Partial<ParsedLine>, status = "completed", error = "") {
  const fields = inferRawVideoFields(video, item || {});

  return {
    ...buildRawVideoFieldSet(fields),
    aiProcessed: true,
    analysisStatus: status,
    analysisError: error,
    analyzedAt: new Date()
  };
}

async function applyFallbackBatch(videos: any[], reason: string) {
  let processed = 0;

  for (const video of videos) {
    await RawYoutubeVideo.findByIdAndUpdate(video._id, {
      $set: buildCompletedSet(video, {}, "fallback_completed", reason)
    });

    processed += 1;
  }

  return processed;
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

  let processed = 0;

  for (const item of parsed) {
    const video = videos[item.videoNumber - 1];

    if (!video) continue;

    await RawYoutubeVideo.findByIdAndUpdate(video._id, {
      $set: buildCompletedSet(video, item, "completed", "")
    });

    processed += 1;
  }

  const parsedVideoNumbers = new Set(parsed.map((item) => item.videoNumber));

  for (let index = 0; index < videos.length; index += 1) {
    const video = videos[index];

    if (parsedVideoNumbers.has(index + 1)) continue;

    await RawYoutubeVideo.findByIdAndUpdate(video._id, {
      $set: buildCompletedSet(
        video,
        {},
        "fallback_completed",
        "OpenAI response did not include this row; fallback fields applied"
      )
    });

    processed += 1;
  }

  return {
    processed,
    parsedRows: parsed.length,
    rawResponse: aiText
  };
}

function numberEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

export async function analyzeUnprocessedRawVideos(
  seedBrandId: string,
  checkControl?: () => Promise<void>
) {
  const batchSize = Math.min(numberEnv("RAW_VIDEO_ANALYSIS_BATCH_SIZE", 10), 25);
  const maxTotalToAnalyze = numberEnv("RAW_VIDEO_ANALYSIS_LIMIT", 100000);

  console.log("Raw video analysis limits:", {
    batchSize,
    maxTotalToAnalyze
  });

  let totalProcessed = 0;
  let totalBatches = 0;
  let fallbackOnlyReason = "";
  const rawResponses: string[] = [];

  while (totalProcessed < maxTotalToAnalyze) {
    await checkControl?.();
    const remaining = maxTotalToAnalyze - totalProcessed;
    const videos = await RawYoutubeVideo.find({
      seedBrandId,
      $or: [
        { aiProcessed: { $ne: true } },
        { analysisStatus: { $in: ["", "pending", "pending_retry", "failed"] } },
        { analysisStatus: { $exists: false } },
        ...blankRawVideoAiFieldFilter().$or
      ]
    })
      .sort({ publishedDate: -1, createdAt: -1 })
      .limit(Math.min(batchSize, remaining));

    if (videos.length === 0) {
      break;
    }

    totalBatches += 1;

    console.log("Raw video analysis batch started:", {
      batch: totalBatches,
      batchSize: videos.length,
      totalProcessed,
      maxTotalToAnalyze
    });

    if (fallbackOnlyReason) {
      await checkControl?.();
      totalProcessed += await applyFallbackBatch(videos, fallbackOnlyReason);
      console.log("Raw video analysis failed; fallback batch completed:", {
        batch: totalBatches,
        totalProcessed,
        reason: fallbackOnlyReason
      });
      console.log("Raw video fallback batch completed:", {
        batch: totalBatches,
        totalProcessed,
        reason: fallbackOnlyReason
      });
      continue;
    }

    try {
      await checkControl?.();
      const result = await analyzeBatch(videos);

      totalProcessed += result.processed;
      rawResponses.push(result.rawResponse);

      console.log("Raw video analysis batch completed:", {
        batch: totalBatches,
        processed: result.processed,
        parsedRows: result.parsedRows,
        totalProcessed
      });

      if (result.parsedRows === 0) {
        fallbackOnlyReason = "OpenAI response parsed zero rows; fallback fields applied";
      }
    } catch (error: any) {
      fallbackOnlyReason =
        (error.message || "Raw video analysis failed") + "; fallback fields applied";

      await checkControl?.();
      totalProcessed += await applyFallbackBatch(videos, fallbackOnlyReason);
      console.log("Raw video analysis failed; fallback batch completed:", {
        batch: totalBatches,
        totalProcessed,
        reason: fallbackOnlyReason
      });
    }
  }

  return {
    processed: totalProcessed,
    totalBatches,
    fallbackOnly: Boolean(fallbackOnlyReason),
    fallbackReason: fallbackOnlyReason,
    rawResponse: rawResponses.join("\n\n---BATCH---\n\n")
  };
}
