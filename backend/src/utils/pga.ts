// PGA (Probability of Getting Acquired as a sponsorship/collaboration
// prospect) scoring. Pure functions — the controller supplies the signals.

export type PgaFactorInput = {
  key: string;
  label: string;
  // null score = factor could not be checked (unknown). Unknown factors are
  // excluded from the weighted average and reduce confidence; they are never
  // treated as positive.
  score: number | null;
  weight: number;
  detail: string;
};

export type PgaResult = {
  pgaScore: number;
  confidence: number;
  insufficientData: boolean;
  breakdown: Array<{
    key: string;
    label: string;
    score: number | null;
    weight: number;
    known: boolean;
    detail: string;
  }>;
};

function envWeight(name: string, fallback: number) {
  const value = Number(process.env[name]);

  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function getPgaWeights() {
  return {
    previousCollab: envWeight("PGA_WEIGHT_PREVIOUS_COLLAB", 35),
    productLaunch: envWeight("PGA_WEIGHT_PRODUCT_LAUNCH", 25),
    promoActivity: envWeight("PGA_WEIGHT_PROMO_ACTIVITY", 25),
    usAvailability: envWeight("PGA_WEIGHT_US_AVAILABILITY", 15)
  };
}

export function computePga(factors: PgaFactorInput[]): PgaResult {
  const breakdown = factors.map((factor) => ({
    key: factor.key,
    label: factor.label,
    score: factor.score,
    weight: factor.weight,
    known: factor.score !== null,
    detail: factor.detail
  }));

  const known = factors.filter((factor) => factor.score !== null);
  const totalWeight = factors.reduce((sum, factor) => sum + factor.weight, 0);
  const knownWeight = known.reduce((sum, factor) => sum + factor.weight, 0);

  if (known.length === 0 || knownWeight === 0) {
    return {
      pgaScore: 0,
      confidence: 0,
      insufficientData: true,
      breakdown
    };
  }

  const pgaScore = Math.round(
    known.reduce((sum, factor) => sum + (factor.score as number) * factor.weight, 0) /
      knownWeight
  );

  const confidence = totalWeight > 0 ? Math.round((knownWeight / totalWeight) * 100) : 0;

  return {
    pgaScore: Math.max(0, Math.min(100, pgaScore)),
    confidence,
    insufficientData: false,
    breakdown
  };
}

export function pgaPriority(score: number) {
  if (score >= 80) return "high";
  if (score >= 50) return "medium";
  return "low";
}
