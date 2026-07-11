import mongoose from "mongoose";
import dotenv from "dotenv";
import { BrandMap } from "../models/BrandMap.model";
import { NicheAnalysis } from "../models/NicheAnalysis.model";
import { AppSetting } from "../models/AppSetting.model";
import { APP_SETTING_DEFAULTS } from "../controllers/settings.controller";

dotenv.config();

const dryRun = process.argv.includes("--dry-run");

// Uses the same OpenAI chat idiom as the worker's nicheNormalizer, but the
// backend has no dependency on the worker package, so the mapping call is
// inlined here.
const axios = require("axios");

function cleanValue(value: any) {
  return String(value || "").trim();
}

async function mapToCanonical(rawNiche: string, canonical: string[]) {
  const lower = rawNiche.toLowerCase();
  const direct = canonical.find((n) => n.toLowerCase() === lower);
  if (direct) return direct;

  const key = process.env.OPENAI_API_KEY || "";
  if (!key) return "Uncategorized";

  const prompt =
    'Map the niche label "' +
    rawNiche +
    '" to exactly ONE of these standard categories:\n' +
    canonical.map((n) => "- " + n).join("\n") +
    '\n\nReturn JSON only: {"canonical":"<one category>"}. If none fit, use "Uncategorized".';

  try {
    const response = await axios.post(
      process.env.OPENAI_CHAT_COMPLETIONS_URL ||
        "https://api.openai.com/v1/chat/completions",
      {
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        messages: [
          { role: "system", content: "Return valid JSON only." },
          { role: "user", content: prompt }
        ],
        temperature: 0
      },
      {
        headers: {
          Authorization: "Bearer " + key,
          "Content-Type": "application/json"
        },
        timeout: 30000
      }
    );

    let text = String(response.data?.choices?.[0]?.message?.content || "");
    text = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    const match = text.match(/\{[\s\S]*\}/);
    const parsed = match ? JSON.parse(match[0]) : JSON.parse(text);
    const answer = cleanValue(parsed.canonical);

    return canonical.find((n) => n.toLowerCase() === answer.toLowerCase()) || "Uncategorized";
  } catch {
    return "Uncategorized";
  }
}

async function main() {
  const mongoUri =
    process.env.MONGODB_URI ||
    "mongodb://127.0.0.1:27017/outreach_intelligence_crm";

  await mongoose.connect(mongoUri);

  const brandMaps = BrandMap as any;
  const nicheAnalysis = NicheAnalysis as any;

  const stored = await (AppSetting as any).findOne({ key: "global" }).lean();
  const canonical =
    Array.isArray(stored?.canonicalNiches) && stored.canonicalNiches.length > 0
      ? stored.canonicalNiches
      : APP_SETTING_DEFAULTS.canonicalNiches;

  const rawNiches: string[] = (await brandMaps.distinct("niche"))
    .map((n: any) => cleanValue(n))
    .filter(Boolean);

  console.log("Distinct niches:", rawNiches.length);
  console.log("Mode:", dryRun ? "DRY RUN (no writes)" : "LIVE");
  console.log("Canonical categories:", canonical.length);

  const mapping: Record<string, string> = {};

  for (const raw of rawNiches) {
    const canonicalNiche = await mapToCanonical(raw, canonical);
    mapping[raw] = canonicalNiche;
    console.log("  " + raw + "  →  " + canonicalNiche);
  }

  if (!dryRun) {
    for (const raw of rawNiches) {
      const canonicalNiche = mapping[raw];

      if (canonicalNiche === raw) continue;

      // Record the original label first (only where not already set), then
      // remap. Order matters: after the remap, `niche` no longer equals raw.
      await brandMaps.updateMany(
        { niche: raw, nicheRaw: { $in: [null, ""] } },
        { $set: { nicheRaw: raw } }
      );

      await brandMaps.updateMany(
        { niche: raw },
        { $set: { niche: canonicalNiche } }
      );
    }

    // Rebuild NicheAnalysis (upsert-then-prune, mirroring the worker service).
    const agg = await brandMaps.aggregate([
      {
        $match: {
          niche: { $exists: true, $nin: ["", null, "-", "N/A", "None"] }
        }
      },
      { $group: { _id: "$niche", brandCount: { $sum: 1 } } }
    ]);

    const names: string[] = [];

    for (const item of agg) {
      names.push(item._id);
      await nicheAnalysis.findOneAndUpdate(
        { nicheName: item._id },
        { $set: { brandCount: item.brandCount } },
        { upsert: true }
      );
    }

    await nicheAnalysis.deleteMany({ nicheName: { $nin: names } });

    console.log("NicheAnalysis rebuilt:", names.length, "niches");
  }

  await mongoose.disconnect();
  console.log("Done.");
}

main().catch((error) => {
  console.error("Niche normalization failed:", error);
  process.exit(1);
});
