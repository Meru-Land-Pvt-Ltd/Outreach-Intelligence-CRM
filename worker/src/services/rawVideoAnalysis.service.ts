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

// Errors where retrying is pointless: quota exhausted, bad/expired API key.
// Continuing would stamp every remaining video with useless heuristic fields
// (the heuristic returns the seed brand's own name, which the brand-map build
// then excludes) — better to abort and leave videos pending for a re-run.
export class AiUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiUnavailableError";
  }
}

function isPermanentAiError(message: string) {
  const lower = String(message || "").toLowerCase();

  return (
    lower.includes("exceeded your current quota") ||
    lower.includes("insufficient_quota") ||
    lower.includes("invalid api key") ||
    lower.includes("incorrect api key") ||
    lower.includes("401")
  );
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
  let aiBatches = 0;
  let fallbackBatches = 0;
  let consecutiveFailures = 0;
  let lastFailureReason = "";
  const rawResponses: string[] = [];

  // Each video is attempted at most once per run — without this, a batch that
  // fell back (status fallback_completed, which is retryable across runs)
  // would be re-selected by the very next query and loop forever.
  const attemptedIds: any[] = [];

  while (totalProcessed < maxTotalToAnalyze) {
    await checkControl?.();
    const remaining = maxTotalToAnalyze - totalProcessed;
    const videos = await RawYoutubeVideo.find({
      seedBrandId,
      _id: { $nin: attemptedIds },
      $or: [
        { aiProcessed: { $ne: true } },
        {
          analysisStatus: {
            // fallback_completed is retried so a re-run after an outage
            // (e.g. OpenAI quota refill) heals heuristic-stamped videos.
            $in: ["", "pending", "pending_retry", "failed", "fallback_completed"]
          }
        },
        { analysisStatus: { $exists: false } },
        ...blankRawVideoAiFieldFilter().$or
      ]
    })
      .sort({ publishedDate: -1, createdAt: -1 })
      .limit(Math.min(batchSize, remaining));

    if (videos.length === 0) {
      break;
    }

    for (const video of videos) {
      attemptedIds.push(video._id);
    }

    totalBatches += 1;

    console.log("Raw video analysis batch started:", {
      batch: totalBatches,
      batchSize: videos.length,
      totalProcessed,
      maxTotalToAnalyze
    });

    try {
      await checkControl?.();
      const result = await analyzeBatch(videos);

      if (result.parsedRows === 0) {
        throw new Error("OpenAI response parsed zero rows");
      }

      totalProcessed += result.processed;
      aiBatches += 1;
      consecutiveFailures = 0;
      rawResponses.push(result.rawResponse);

      console.log("Raw video analysis batch completed:", {
        batch: totalBatches,
        processed: result.processed,
        parsedRows: result.parsedRows,
        totalProcessed
      });
    } catch (error: any) {
      const reason = error?.message || "Raw video analysis failed";

      // Quota/auth failures never recover mid-run: abort, keep videos pending.
      if (isPermanentAiError(reason)) {
        throw new AiUnavailableError(
          "OpenAI is unavailable (" +
            reason +
            "). Videos were left unanalyzed — fix the OpenAI quota/key and run the crawl again."
        );
      }

      // Transient failure: fall back for THIS batch only and keep trying AI
      // on the next batch, with a circuit breaker for repeated failures.
      consecutiveFailures += 1;
      lastFailureReason = reason;

      if (consecutiveFailures >= 3) {
        throw new AiUnavailableError(
          "OpenAI failed " +
            consecutiveFailures +
            " batches in a row (" +
            reason +
            "). Remaining videos were left unanalyzed — run the crawl again once the AI is healthy."
        );
      }

      await checkControl?.();
      totalProcessed += await applyFallbackBatch(
        videos,
        reason + "; fallback fields applied"
      );
      fallbackBatches += 1;

      console.log("Raw video analysis batch failed; fallback applied:", {
        batch: totalBatches,
        consecutiveFailures,
        reason
      });
    }
  }

  return {
    processed: totalProcessed,
    totalBatches,
    aiBatches,
    fallbackBatches,
    fallbackOnly: totalBatches > 0 && aiBatches === 0,
    fallbackReason: lastFailureReason,
    rawResponse: rawResponses.join("\n\n---BATCH---\n\n")
  };
}
