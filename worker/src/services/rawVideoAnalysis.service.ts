import { RawYoutubeVideo } from "../models/RawYoutubeVideo.model";
import { buildRawVideoAnalysisPrompt } from "../prompts/rawVideoAnalysis.prompt";
import { callOpenAIText } from "./ai.service";
import {
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
  return String(value || "").replace(/\*\*/g, "").trim();
}


function parseOpenAIResponse(text: string): ParsedLine[] {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const parsed: ParsedLine[] = [];

  for (const line of lines) {
    const cleanedLine = line.replace(/^\|/, "").replace(/\|$/, "").trim();

    if (/^-{2,}\|/.test(cleanedLine) || /video\s*number/i.test(cleanedLine)) {
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

function buildSet(video: any, item: ParsedLine) {
  const inferredFields = inferRawVideoFields(video, item);
  const fieldSet = buildRawVideoFieldSet(inferredFields);

  return {
    ...fieldSet,
    aiProcessed: true,
    analysisStatus: "completed",
    analysisError: "",
    analyzedAt: new Date()
  };
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
      $set: buildSet(video, item)
    });

    processed += 1;
  }

  const parsedVideoNumbers = new Set(parsed.map((item) => item.videoNumber));

  for (let index = 0; index < videos.length; index += 1) {
    const video = videos[index];

    if (parsedVideoNumbers.has(index + 1)) continue;

    const inferredFields = inferRawVideoFields(video);

    await RawYoutubeVideo.findByIdAndUpdate(video._id, {
      $set: {
        ...buildRawVideoFieldSet(inferredFields),
        aiProcessed: true,
        analysisStatus: "fallback_completed",
        analysisError: "OpenAI response did not include this row; fallback fields applied",
        analyzedAt: new Date()
      }
    });

    processed += 1;
  }

  return {
    processed,
    rawResponse: aiText
  };
}

function numberEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

export async function analyzeUnprocessedRawVideos(seedBrandId: string) {
  const batchSize = Math.min(numberEnv("RAW_VIDEO_ANALYSIS_BATCH_SIZE", 5), 10);
  const maxTotalToAnalyze = numberEnv("RAW_VIDEO_ANALYSIS_LIMIT", 1000);

  let totalProcessed = 0;
  let totalBatches = 0;
  const rawResponses: string[] = [];

  while (totalProcessed < maxTotalToAnalyze) {
    const videos = await RawYoutubeVideo.find({
      seedBrandId,
      $or: [
        { aiProcessed: { $ne: true } },
        { analysisStatus: { $in: ["", "pending", "failed"] } },
        { analysisStatus: { $exists: false } },
        { sponsorBrand: { $exists: false } },
        { sponsorBrand: null },
        { sponsorBrand: /^\s*$/ },
        { sponsorBrand: /^\s*-\s*$/ },
        { promoCode: { $exists: false } },
        { promoCode: null },
        { promoCode: /^\s*$/ },
        { promoCode: /^\s*-\s*$/ },
        { channelCategory: { $exists: false } },
        { channelCategory: null },
        { channelCategory: /^\s*$/ },
        { channelCategory: /^\s*-\s*$/ },
        { productNameWithModel: { $exists: false } },
        { productNameWithModel: null },
        { productNameWithModel: /^\s*$/ },
        { productNameWithModel: /^\s*-\s*$/ },
        { sponsorshipType: { $exists: false } },
        { sponsorshipType: null },
        { sponsorshipType: /^\s*$/ },
        { sponsorshipType: /^\s*-\s*$/ }
      ]
    })
      .sort({ publishedDate: -1 })
      .limit(batchSize);

    if (videos.length === 0) {
      break;
    }

    try {
      const result = await analyzeBatch(videos);

      totalProcessed += result.processed;
      totalBatches += 1;
      rawResponses.push(result.rawResponse);

      if (result.processed === 0) {
        let fallbackProcessed = 0;

        for (const video of videos) {
          const inferredFields = inferRawVideoFields(video);

          await RawYoutubeVideo.findByIdAndUpdate(video._id, {
            $set: {
              ...buildRawVideoFieldSet(inferredFields),
              aiProcessed: true,
              analysisStatus: "fallback_completed",
              analysisError: "OpenAI response parsed zero rows; fallback fields applied",
              analyzedAt: new Date()
            }
          });

          fallbackProcessed += 1;
        }

        totalProcessed += fallbackProcessed;
        break;
      }
    } catch (error: any) {
      for (const video of videos) {
        const inferredFields = inferRawVideoFields(video);

        await RawYoutubeVideo.findByIdAndUpdate(video._id, {
          $set: {
            ...buildRawVideoFieldSet(inferredFields),
            aiProcessed: true,
            analysisStatus: "fallback_completed",
            analysisError:
              (error.message || "Raw video analysis failed") +
              "; fallback fields applied",
            analyzedAt: new Date()
          }
        });
      }

      totalProcessed += videos.length;
      break;
    }
  }

  return {
    processed: totalProcessed,
    totalBatches,
    rawResponse: rawResponses.join("\n\n---BATCH---\n\n")
  };
}
