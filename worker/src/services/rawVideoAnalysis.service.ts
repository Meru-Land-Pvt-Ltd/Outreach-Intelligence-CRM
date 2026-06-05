import { RawYoutubeVideo } from "../models/RawYoutubeVideo.model";
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

function parseOpenAIResponse(text: string): ParsedLine[] {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const parsed: ParsedLine[] = [];

  for (const line of lines) {
    const parts = line.split("|").map((part) => part.trim());

    if (parts.length < 6) continue;

    const videoNumber = Number(parts[0]);

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
      $set: {
        isSponsored: isValidSponsorBrand(item.sponsorBrand),
        channelCategory: item.channelCategory,
        sponsorBrand: item.sponsorBrand,
        promoCode: item.promoCode,
        productNameWithModel: item.productNameWithModel,
        sponsorshipType: item.sponsorshipType
      }
    });

    processed += 1;
  }

  return {
    processed,
    rawResponse: aiText
  };
}

export async function analyzeUnprocessedRawVideos(seedBrandId: string) {
  const batchSize = 3;
  const maxTotalToAnalyze = 30;

  let totalProcessed = 0;
  let totalBatches = 0;
  const rawResponses: string[] = [];

  while (totalProcessed < maxTotalToAnalyze) {
    const videos = await RawYoutubeVideo.find({
      seedBrandId,
      $or: [
        { sponsorBrand: { $exists: false } },
        { sponsorBrand: "" },
        { channelCategory: "" }
      ]
    })
      .sort({ publishedDate: -1 })
      .limit(batchSize);

    if (videos.length === 0) {
      break;
    }

    const result = await analyzeBatch(videos);

    totalProcessed += result.processed;
    totalBatches += 1;
    rawResponses.push(result.rawResponse);

    if (result.processed === 0) {
      break;
    }
  }

  return {
    processed: totalProcessed,
    totalBatches,
    rawResponse: rawResponses.join("\n\n---BATCH---\n\n")
  };
}
