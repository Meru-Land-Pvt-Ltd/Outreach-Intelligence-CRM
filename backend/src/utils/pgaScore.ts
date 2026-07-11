// PGA (probability of acquisition) scoring core.
// Twin of worker/src/services/pgaScore.service.ts — keep prompt and parsing
// in lockstep.

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
