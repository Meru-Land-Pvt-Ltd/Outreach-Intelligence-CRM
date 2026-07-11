import axios from "axios";
import { NicheAlias } from "../models/NicheAlias.model";
import { AppSettings } from "./appSettings.service";

// Maps free-form AI niche labels onto the canonical category list so the
// niche filter, niche-scoped push and Instantly tags share one vocabulary.
// Results are cached in NicheAlias (deterministic + reusable by the migration).

const NicheAliasModel = NicheAlias as any;

const FALLBACK_NICHE = "Uncategorized";

function cleanValue(value: any) {
  return String(value || "").trim();
}

function matchCanonical(value: string, canonical: string[]) {
  const lower = value.toLowerCase();

  return (
    canonical.find((niche) => niche.toLowerCase() === lower) || ""
  );
}

async function askOpenAiForCanonical(
  rawNiche: string,
  canonical: string[]
): Promise<string> {
  const key = process.env.OPENAI_API_KEY || "";

  if (!key) return FALLBACK_NICHE;

  const prompt =
    'Map the niche label "' +
    rawNiche +
    '" to exactly ONE of these standard categories:\n' +
    canonical.map((niche) => "- " + niche).join("\n") +
    '\n\nReturn JSON only: {"canonical":"<one category from the list>"}. ' +
    'If none fit, use "' +
    FALLBACK_NICHE +
    '".';

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
    text = text
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    const match = text.match(/\{[\s\S]*\}/);
    const parsed = match ? JSON.parse(match[0]) : JSON.parse(text);

    // Only accept an answer that is actually in the canonical list.
    return matchCanonical(cleanValue(parsed.canonical), canonical) || FALLBACK_NICHE;
  } catch {
    return FALLBACK_NICHE;
  }
}

export async function normalizeNiche(
  rawNiche: any,
  settings: AppSettings
): Promise<string> {
  const raw = cleanValue(rawNiche);

  if (!raw) return FALLBACK_NICHE;

  const canonical = settings.canonicalNiches;

  // Exact canonical match — nothing to map.
  const direct = matchCanonical(raw, canonical);
  if (direct) return direct;

  const key = raw.toLowerCase();

  const cached = await NicheAliasModel.findOne({ rawNiche: key }).lean();

  if (cached?.canonicalNiche) {
    // Honor cache only if it still points at a valid canonical value.
    const stillValid = matchCanonical(cached.canonicalNiche, canonical);
    if (stillValid) return stillValid;
  }

  const canonicalNiche = await askOpenAiForCanonical(raw, canonical);

  await NicheAliasModel.findOneAndUpdate(
    { rawNiche: key },
    {
      $set: {
        rawNiche: key,
        canonicalNiche,
        source: "ai",
        raw: { original: raw }
      }
    },
    { upsert: true }
  );

  return canonicalNiche;
}
