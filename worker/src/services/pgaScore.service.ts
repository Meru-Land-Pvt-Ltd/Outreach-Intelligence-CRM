import { BrandMap } from "../models/BrandMap.model";
import { getAppSettings, AppSettings } from "./appSettings.service";
import { callOpenAIWithWebSearch } from "./openaiResponses.service";

// PGA (probability of acquisition) scoring core.
// Prompt/parse are twins of backend/src/utils/pgaScore.ts — keep in lockstep.

const BrandMapModel = BrandMap as any;

export type PgaParseResult = {
  score: number;
  subScores: {
    productLaunch: number;
    creatorCollab: number;
    promoActivity: number;
    usAvailability: number;
  };
  summary: string;
  signals: any[];
};

function cleanValue(value: any) {
  return String(value || "").trim();
}

export function buildPgaPrompt(brandMap: any) {
  const brandName = cleanValue(brandMap.brandName);
  const domain = cleanValue(brandMap.domain);
  const niche = cleanValue(brandMap.niche);

  return [
    'You are a B2B outreach analyst. Use web search to research the brand "' +
      brandName +
      '"' +
      (domain ? " (website: " + domain + ")" : "") +
      (niche ? " in the " + niche + " niche" : "") +
      " and rate it on four criteria, each as an integer 0-100:",
    "",
    "1. productLaunchScore — Did the brand launch or announce a new product in the last 120 days? 70-100 for a launch within 120 days; at most 50 for a launch 4-6 months ago; 0-20 if nothing within 6 months.",
    "2. creatorCollabScore — Has the brand worked with YouTube tech creators in the last 12 months (sponsored videos, paid reviews, creator partnerships)? Collaborations with \"Enoylity\", \"MHD Tech\", or any US-based tech YouTube creator count strongly.",
    "3. promoActivityScore — Does the brand have active or recent promotional activity in the last 6 months (sales, discount campaigns, seasonal promos, affiliate programs, ad campaigns)?",
    "4. usAvailabilityScore — Are the brand's products available to US customers (US store, ships to the US, listed on amazon.com)? Specifically check amazon.com availability.",
    "",
    "Return STRICT JSON only, no prose before or after:",
    '{"productLaunchScore": <int>, "creatorCollabScore": <int>, "promoActivityScore": <int>, "usAvailabilityScore": <int>, "summary": "<2-3 sentences>", "signals": [{"criterion": "launch|collab|promo|us", "date": "YYYY-MM-DD", "signal": "<what was found>", "source": "<source domain>"}]}'
  ].join("\n");
}

function clampScore(value: any) {
  const parsed = Math.round(Number(value));

  if (!Number.isFinite(parsed)) return null;

  return Math.min(Math.max(parsed, 0), 100);
}

export function parsePgaJson(text: string): PgaParseResult | null {
  const cleaned = String(text || "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));

    const productLaunch = clampScore(parsed.productLaunchScore);
    const creatorCollab = clampScore(parsed.creatorCollabScore);
    const promoActivity = clampScore(parsed.promoActivityScore);
    const usAvailability = clampScore(parsed.usAvailabilityScore);

    if (
      productLaunch === null ||
      creatorCollab === null ||
      promoActivity === null ||
      usAvailability === null
    ) {
      return null;
    }

    // The average is computed here — never trust model arithmetic.
    const score = Math.round(
      (productLaunch + creatorCollab + promoActivity + usAvailability) / 4
    );

    return {
      score,
      subScores: {
        productLaunch,
        creatorCollab,
        promoActivity,
        usAvailability
      },
      summary: String(parsed.summary || "").trim(),
      signals: Array.isArray(parsed.signals) ? parsed.signals.slice(0, 12) : []
    };
  } catch {
    return null;
  }
}

export function isPgaCacheFresh(row: any, cacheDays: number) {
  if (!row?.pgaCheckedAt) return false;

  const ageMs = Date.now() - new Date(row.pgaCheckedAt).getTime();

  return ageMs < cacheDays * 24 * 60 * 60 * 1000;
}

export async function scorePgaBrandMapRow(row: any, settings: AppSettings) {
  await BrandMapModel.findByIdAndUpdate(row._id, {
    $set: { pgaStatus: "running" }
  });

  try {
    const prompt = buildPgaPrompt(row);
    const text = await callOpenAIWithWebSearch(
      prompt,
      undefined,
      settings.pgaModel || undefined
    );

    const parsed = parsePgaJson(text);

    if (!parsed) {
      throw new Error("AI returned no parseable PGA JSON");
    }

    await BrandMapModel.findByIdAndUpdate(row._id, {
      $set: {
        pgaScore: parsed.score,
        pgaSubScores: parsed.subScores,
        pgaSummary: parsed.summary,
        pgaSignals: parsed.signals,
        pgaCheckedAt: new Date(),
        pgaStatus: "done",
        pgaRaw: { text }
      }
    });

    return parsed;
  } catch (error: any) {
    // Keep any previous score; only the status flips to failed.
    await BrandMapModel.findByIdAndUpdate(row._id, {
      $set: { pgaStatus: "failed" }
    });

    throw error;
  }
}

// Auto-scan for a whole seed crawl: cache-aware, cross-seed reusing, chunked
// by pgaConcurrency, pause/stop-aware, and finally applies the min-score gate
// to still-pending rows (manual approvals are never demoted; failed or
// unscored rows are never gated).
export async function scorePgaForSeed(
  seedBrandId: string,
  options: {
    checkControl?: () => Promise<void>;
    onProgress?: (done: number, total: number, brandName: string) => Promise<void> | void;
  } = {}
) {
  const settings = await getAppSettings(true);

  const rows = await BrandMapModel.find({
    seedBrandId,
    isExcluded: { $ne: true },
    domain: { $exists: true, $nin: ["", "-", null, "N/A", "unspecified"] }
  }).lean();

  let cached = 0;
  let copied = 0;
  let scored = 0;
  let failed = 0;

  const toScore: any[] = [];

  for (const row of rows) {
    if (isPgaCacheFresh(row, settings.pgaCacheDays)) {
      cached += 1;
      continue;
    }

    // Cross-seed cache: another seed may have scored the same domain recently.
    const twin = await BrandMapModel.findOne({
      _id: { $ne: row._id },
      domain: row.domain,
      pgaStatus: "done",
      pgaCheckedAt: {
        $gte: new Date(Date.now() - settings.pgaCacheDays * 24 * 60 * 60 * 1000)
      }
    })
      .sort({ pgaCheckedAt: -1 })
      .lean();

    if (twin) {
      await BrandMapModel.findByIdAndUpdate(row._id, {
        $set: {
          pgaScore: twin.pgaScore,
          pgaSubScores: twin.pgaSubScores,
          pgaSummary: twin.pgaSummary,
          pgaSignals: twin.pgaSignals,
          pgaCheckedAt: twin.pgaCheckedAt,
          pgaStatus: "done",
          pgaRaw: { copiedFrom: String(twin._id) }
        }
      });

      copied += 1;
      continue;
    }

    toScore.push(row);
  }

  const concurrency = Math.max(1, settings.pgaConcurrency);
  let done = 0;

  for (let i = 0; i < toScore.length; i += concurrency) {
    if (options.checkControl) {
      await options.checkControl();
    }

    const chunk = toScore.slice(i, i + concurrency);

    const results = await Promise.allSettled(
      chunk.map((row) => scorePgaBrandMapRow(row, settings))
    );

    for (const result of results) {
      if (result.status === "fulfilled") scored += 1;
      else failed += 1;
    }

    done += chunk.length;

    if (options.onProgress) {
      await options.onProgress(
        done,
        toScore.length,
        cleanValue(chunk[chunk.length - 1]?.brandName)
      );
    }
  }

  // Gate: only pending + successfully-scored rows below the threshold are
  // auto-excluded. Deliberately NOT written to the permanent ExcludedBrand
  // list — a quiet quarter must not ban a brand forever.
  const gateResult = await BrandMapModel.updateMany(
    {
      seedBrandId,
      selectionStatus: "pending",
      pgaStatus: "done",
      pgaScore: { $lt: settings.pgaMinScore }
    },
    {
      $set: {
        selectionStatus: "excluded",
        isExcluded: true,
        status: "excluded",
        selectionUpdatedAt: new Date(),
        selectionUpdatedBy: "pga-gate"
      }
    }
  );

  return {
    scannedRows: rows.length,
    cached,
    copied,
    scored,
    failed,
    gatedOut: Number(gateResult?.modifiedCount || 0),
    minScore: settings.pgaMinScore
  };
}
