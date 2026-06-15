import axios from "axios";
import dotenv from "dotenv";
import mongoose from "mongoose";

import { RawYoutubeVideo } from "../models/RawYoutubeVideo.model";

dotenv.config({ path: ".env.production" });
dotenv.config();

type CliOptions = {
  seedBrand?: string;
  channel?: string;
  limit: number;
  batchSize: number;
  dryRun: boolean;
  force: boolean;
  delayMs: number;
};

type AiResult = {
  videoNumber: number;
  channelCategory: string;
  sponsorBrand: string;
  promoCode: string;
  productNameWithModel: string;
  sponsorshipType: string;
};

const EMPTY_VALUES = [null, "", "-", "Pending AI analysis"];
const VALID_SPONSOR_BLOCKLIST = new Set(["", "-", "n/a", "na", "none", "unknown", "no sponsor"]);

function readArg(name: string) {
  const index = process.argv.indexOf("--" + name);
  if (index === -1) return "";
  return process.argv[index + 1] || "";
}

function hasFlag(name: string) {
  return process.argv.includes("--" + name);
}

function numberArg(name: string, fallback: number) {
  const value = Number(readArg(name));
  return Number.isNaN(value) || value <= 0 ? fallback : value;
}

function getOptions(): CliOptions {
  return {
    seedBrand: readArg("seedBrand") || readArg("brand") || undefined,
    channel: readArg("channel") || undefined,
    limit: numberArg("limit", 500),
    batchSize: Math.min(numberArg("batchSize", 5), 10),
    dryRun: hasFlag("dryRun"),
    force: hasFlag("force"),
    delayMs: numberArg("delayMs", 1200)
  };
}

function clean(value: any) {
  return String(value || "")
    .replace(/\*\*/g, "")
    .trim();
}

function isBlankish(value: any) {
  const text = clean(value).toLowerCase();
  return !text || text === "-" || text === "pending ai analysis";
}

function isValidSponsorBrand(value: any) {
  return !VALID_SPONSOR_BLOCKLIST.has(clean(value).toLowerCase());
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildMongoFilter(options: CliOptions) {
  const filter: Record<string, any> = {
    $or: [
      { channelCategory: { $in: EMPTY_VALUES } },
      { channelCategory: { $exists: false } },
      { sponsorBrand: { $in: EMPTY_VALUES } },
      { sponsorBrand: { $exists: false } },
      { promoCode: { $in: EMPTY_VALUES } },
      { promoCode: { $exists: false } },
      { productNameWithModel: { $in: EMPTY_VALUES } },
      { productNameWithModel: { $exists: false } },
      { sponsorshipType: { $in: EMPTY_VALUES } },
      { sponsorshipType: { $exists: false } },
      { aiProcessed: { $ne: true } }
    ]
  };

  if (options.seedBrand) {
    const regex = new RegExp(escapeRegex(options.seedBrand), "i");
    filter.$and = [
      {
        $or: [
          { seedBrandName: regex },
          { sponsorBrand: regex },
          { channelName: regex },
          { videoTitle: regex },
          { videoDescription: regex }
        ]
      }
    ];
  }

  if (options.channel) {
    filter.channelName = new RegExp(escapeRegex(options.channel), "i");
  }

  return filter;
}

function buildPrompt(videos: any[]) {
  const rows = videos
    .map((video, index) => {
      return [
        "Video " + (index + 1),
        "Seed brand: " + clean(video.seedBrandName),
        "Channel: " + clean(video.channelName),
        "Title: " + clean(video.videoTitle),
        "Description: " + clean(video.videoDescription).slice(0, 1800)
      ].join("\n");
    })
    .join("\n\n---\n\n");

  return `You are cleaning a raw YouTube sponsorship database.

For each video, fill these exact fields:
- channelCategory: 1 to 3 words describing the channel/product category. Example: Portable Power, Tech, Outdoor, Lifestyle.
- sponsorBrand: primary featured brand. For official brand/channel videos, use the brand/channel name, not None.
- promoCode: real coupon or discount code only. Do not put URLs here. If no code, use N/A.
- productNameWithModel: exact product name with model if visible. If no specific model, use N/A.
- sponsorshipType: one of Dedicated Review, Comparison, Integration, Affiliate, Unboxing, Mention, Official Brand Promo, N/A.

Important rules:
- Return JSON only. No markdown. No explanation.
- Return an array with one object per video.
- Use this exact object shape:
[
  {
    "videoNumber": 1,
    "channelCategory": "Portable Power",
    "sponsorBrand": "Anker SOLIX",
    "promoCode": "N/A",
    "productNameWithModel": "Anker SOLIX S2000",
    "sponsorshipType": "Official Brand Promo"
  }
]

Videos:
${rows}`;
}

function extractJsonArray(text: string) {
  const cleaned = text
    .replace(/```json/gi, "```")
    .replace(/```/g, "")
    .trim();

  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("OpenAI response did not contain a JSON array: " + cleaned.slice(0, 300));
  }

  return cleaned.slice(start, end + 1);
}

function normalizeAiResult(item: any): AiResult {
  return {
    videoNumber: Number(item.videoNumber || item.VideoNumber || item.video || 0),
    channelCategory: clean(item.channelCategory || item["Channel Category"] || item.category),
    sponsorBrand: clean(item.sponsorBrand || item["Sponsor Brand"] || item.brand),
    promoCode: clean(item.promoCode || item["Promo Code"] || item.code),
    productNameWithModel: clean(
      item.productNameWithModel ||
        item["Product Name With Model"] ||
        item["Product Name (with model)"] ||
        item.product
    ),
    sponsorshipType: clean(item.sponsorshipType || item["Sponsorship Type"] || item.type)
  };
}

async function callOpenAI(prompt: string): Promise<AiResult[]> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing. Add it to worker/.env.production or the shell environment.");
  }

  const url = process.env.OPENAI_CHAT_COMPLETIONS_URL || "https://api.openai.com/v1/chat/completions";
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  const response = await axios.post(
    url,
    {
      model,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    },
    {
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json"
      },
      timeout: 90000
    }
  );

  const text = response.data?.choices?.[0]?.message?.content || "";
  const json = extractJsonArray(text);
  const parsed = JSON.parse(json);

  if (!Array.isArray(parsed)) {
    throw new Error("OpenAI response JSON was not an array");
  }

  return parsed.map(normalizeAiResult).filter((item) => item.videoNumber > 0);
}

function findKnownProduct(video: any, aiProduct: string) {
  if (!isBlankish(aiProduct) && clean(aiProduct).toLowerCase() !== "n/a") {
    return aiProduct;
  }

  const text = (clean(video.videoTitle) + "\n" + clean(video.videoDescription)).replace(/\s+/g, " ");

  const patterns = [
    /Anker\s+SOLIX\s+F3800\s*\+?/i,
    /Anker\s+SOLIX\s+F3800\s+Plus/i,
    /Anker\s+SOLIX\s+S2000/i,
    /SOLIX\s+C800\s*\+?/i,
    /\bF3800\s*\+\b/i,
    /\bS2000\b/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match?.[0]) {
      const product = match[0].replace(/\s+/g, " ").trim();

      if (/^S2000$/i.test(product)) return "Anker SOLIX S2000";
      if (/^F3800/i.test(product)) return "Anker SOLIX F3800 Plus";
      if (/^SOLIX/i.test(product)) return "Anker " + product;

      return product;
    }
  }

  return aiProduct || "N/A";
}

function fixSponsorBrand(video: any, aiSponsorBrand: string) {
  if (isValidSponsorBrand(aiSponsorBrand)) return aiSponsorBrand;

  const seedBrand = clean(video.seedBrandName);
  const channelName = clean(video.channelName);
  const titleAndDescription = (clean(video.videoTitle) + " " + clean(video.videoDescription)).toLowerCase();

  if (seedBrand && titleAndDescription.includes(seedBrand.toLowerCase())) {
    return seedBrand;
  }

  if (channelName && channelName.toLowerCase().includes("anker solix")) {
    return "Anker SOLIX";
  }

  if (titleAndDescription.includes("anker solix") || titleAndDescription.includes("#ankersolix")) {
    return "Anker SOLIX";
  }

  return aiSponsorBrand || "None";
}

function fixChannelCategory(video: any, aiCategory: string) {
  if (!isBlankish(aiCategory) && clean(aiCategory).toLowerCase() !== "n/a") {
    return aiCategory;
  }

  const text = (clean(video.videoTitle) + " " + clean(video.videoDescription) + " " + clean(video.channelName)).toLowerCase();

  if (
    text.includes("anker solix") ||
    text.includes("power station") ||
    text.includes("backup power") ||
    text.includes("home backup") ||
    text.includes("outage")
  ) {
    return "Portable Power";
  }

  if (text.includes("tech") || text.includes("gadget")) return "Tech";

  return aiCategory || "Uncategorized";
}

function fixSponsorshipType(video: any, aiType: string, sponsorBrand: string) {
  const title = clean(video.videoTitle).toLowerCase();
  const description = clean(video.videoDescription).toLowerCase();
  const channelName = clean(video.channelName).toLowerCase();

  if (!isValidSponsorBrand(sponsorBrand)) return "N/A";
  if (title.includes("unboxing")) return "Unboxing";

  if (
    channelName.includes("anker solix") ||
    description.includes("learn more") ||
    description.includes("early-bird") ||
    description.includes("going live")
  ) {
    return "Official Brand Promo";
  }

  if (!isBlankish(aiType) && clean(aiType).toLowerCase() !== "n/a") return aiType;

  return "Mention";
}

function buildUpdate(video: any, ai: AiResult, force: boolean) {
  const sponsorBrand = fixSponsorBrand(video, ai.sponsorBrand);
  const channelCategory = fixChannelCategory(video, ai.channelCategory);
  const productNameWithModel = findKnownProduct(video, ai.productNameWithModel);
  const promoCode = !isBlankish(ai.promoCode) ? ai.promoCode : "N/A";
  const sponsorshipType = fixSponsorshipType(video, ai.sponsorshipType, sponsorBrand);

  const fields: Record<string, any> = {
    channelCategory,
    sponsorBrand,
    promoCode,
    productNameWithModel,
    sponsorshipType
  };

  const $set: Record<string, any> = {};

  for (const [key, value] of Object.entries(fields)) {
    if (force || isBlankish(video[key])) {
      $set[key] = value;
    }
  }

  $set.isSponsored = isValidSponsorBrand($set.sponsorBrand ?? video.sponsorBrand);
  $set.aiProcessed = true;
  $set.analysisStatus = "completed";
  $set.analysisError = "";
  $set.analyzedAt = new Date();

  return $set;
}

async function main() {
  const options = getOptions();
  const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/outreach_intelligence_crm";

  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB");

  const filter = buildMongoFilter(options);
  const total = await RawYoutubeVideo.countDocuments(filter);
  const videos = await RawYoutubeVideo.find(filter)
    .sort({ addedOn: -1, publishedDate: -1, createdAt: -1 })
    .limit(options.limit);

  console.log(
    JSON.stringify(
      {
        matched: total,
        selected: videos.length,
        limit: options.limit,
        batchSize: options.batchSize,
        seedBrand: options.seedBrand || "all",
        channel: options.channel || "all",
        dryRun: options.dryRun,
        force: options.force
      },
      null,
      2
    )
  );

  let updated = 0;
  let failed = 0;

  for (let start = 0; start < videos.length; start += options.batchSize) {
    const batch = videos.slice(start, start + options.batchSize);

    try {
      const aiResults = await callOpenAI(buildPrompt(batch));
      const aiByNumber = new Map<number, AiResult>();

      for (const item of aiResults) {
        aiByNumber.set(item.videoNumber, item);
      }

      for (let index = 0; index < batch.length; index++) {
        const video = batch[index];
        const ai = aiByNumber.get(index + 1);

        if (!ai) {
          failed += 1;
          console.warn("Missing AI result for video:", video._id?.toString(), video.videoTitle);
          continue;
        }

        const $set = buildUpdate(video, ai, options.force);

        if (options.dryRun) {
          console.log("DRY RUN", video._id?.toString(), video.videoTitle, $set);
        } else {
          await RawYoutubeVideo.updateOne({ _id: video._id }, { $set });
        }

        updated += 1;
      }
    } catch (error: any) {
      failed += batch.length;
      console.error("Batch failed:", error?.response?.data || error.message);
    }

    if (start + options.batchSize < videos.length) {
      await sleep(options.delayMs);
    }
  }

  console.log(
    JSON.stringify(
      {
        done: true,
        updated,
        failed,
        dryRun: options.dryRun
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error?.response?.data || error);
  await mongoose.disconnect();
  process.exit(1);
});
