import { AppSetting } from "../models/AppSetting.model";
import { env } from "../config/env";

// Twin of backend/src/controllers/settings.controller.ts — keep the keys,
// defaults and sanitizers in lockstep.
const AppSettingModel = AppSetting as any;

export type AppSettings = {
  manualSelectionMode: boolean;
  maxBrandsPerSeed: number;
  maxEmailsPerBrand: number;
  scrapeFirstSkipPaid: boolean;
  scrapeSkipThreshold: number;
  coolingOffMonths: number;
  pgaAutoScore: boolean;
  pgaMinScore: number;
  pgaCacheDays: number;
  pgaConcurrency: number;
  pgaModel: string;
  providerEmailCap: number;
  targetRoleKeywords: string[];
  excludeRoleKeywords: string[];
  targetSeniorityKeywords: string[];
  canonicalNiches: string[];
  nicheNormalization: boolean;
};

export const APP_SETTING_DEFAULTS: AppSettings = {
  manualSelectionMode: false,
  maxBrandsPerSeed: 100,
  maxEmailsPerBrand: env.instantlyLimitEmailsPerCompany,
  scrapeFirstSkipPaid: true,
  scrapeSkipThreshold: 3,
  coolingOffMonths: 3,
  pgaAutoScore: false,
  pgaMinScore: 35,
  pgaCacheDays: 30,
  pgaConcurrency: 4,
  pgaModel: "",
  providerEmailCap: 5,
  targetRoleKeywords: [
    "influencer marketing",
    "creator partnerships",
    "partnerships",
    "partner marketing",
    "affiliate",
    "product marketing",
    "brand marketing",
    "event marketing",
    "sponsorships",
    "media relations",
    "pr",
    "growth marketing",
    "social media"
  ],
  excludeRoleKeywords: [
    "accounting",
    "accounts",
    "finance",
    "legal",
    "hr",
    "human resources",
    "recruiting",
    "talent acquisition",
    "people operations",
    "engineering",
    "software",
    "developer",
    "devops",
    "qa",
    "customer support",
    "customer success",
    "supply chain",
    "logistics",
    "procurement"
  ],
  targetSeniorityKeywords: [
    "manager",
    "head",
    "director",
    "senior",
    "lead",
    "vp",
    "chief"
  ],
  canonicalNiches: [
    "AI Software / AI Tools",
    "Tech & Gadgets",
    "Power & Energy",
    "Smart Home",
    "Audio",
    "Gaming",
    "Computing & Accessories",
    "Mobile & Photography",
    "Outdoor & Camping",
    "Automotive",
    "Home & Kitchen",
    "Health & Fitness",
    "Office & Furniture",
    "Productivity Software",
    "Uncategorized"
  ],
  nicheNormalization: false
};

function clampNumber(value: any, fallback: number, min: number, max: number) {
  const parsed = Number(value);

  if (Number.isNaN(parsed)) return fallback;

  return Math.min(Math.max(Math.round(parsed), min), max);
}

function booleanFrom(value: any, fallback: boolean) {
  if (value === true || value === false) return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function stringListFrom(value: any, fallback: string[]) {
  const items = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[\n,]+/)
      : null;

  if (!items) return fallback;

  const seen = new Set<string>();
  const cleaned: string[] = [];

  for (const item of items) {
    const text = String(item || "").trim();
    const key = text.toLowerCase();

    if (!text || seen.has(key)) continue;

    seen.add(key);
    cleaned.push(text);

    if (cleaned.length >= 100) break;
  }

  return cleaned.length > 0 ? cleaned : fallback;
}

const SETTING_SANITIZERS: Record<string, (value: any) => any> = {
  manualSelectionMode: (value) =>
    booleanFrom(value, APP_SETTING_DEFAULTS.manualSelectionMode),
  maxBrandsPerSeed: (value) =>
    clampNumber(value, APP_SETTING_DEFAULTS.maxBrandsPerSeed, 10, 500),
  maxEmailsPerBrand: (value) =>
    clampNumber(value, APP_SETTING_DEFAULTS.maxEmailsPerBrand, 1, 10),
  scrapeFirstSkipPaid: (value) =>
    booleanFrom(value, APP_SETTING_DEFAULTS.scrapeFirstSkipPaid),
  scrapeSkipThreshold: (value) =>
    clampNumber(value, APP_SETTING_DEFAULTS.scrapeSkipThreshold, 1, 10),
  coolingOffMonths: (value) =>
    clampNumber(value, APP_SETTING_DEFAULTS.coolingOffMonths, 1, 24),
  pgaAutoScore: (value) =>
    booleanFrom(value, APP_SETTING_DEFAULTS.pgaAutoScore),
  pgaMinScore: (value) =>
    clampNumber(value, APP_SETTING_DEFAULTS.pgaMinScore, 0, 100),
  pgaCacheDays: (value) =>
    clampNumber(value, APP_SETTING_DEFAULTS.pgaCacheDays, 1, 365),
  pgaConcurrency: (value) =>
    clampNumber(value, APP_SETTING_DEFAULTS.pgaConcurrency, 1, 8),
  pgaModel: (value) => String(value || "").trim(),
  providerEmailCap: (value) =>
    clampNumber(value, APP_SETTING_DEFAULTS.providerEmailCap, 1, 20),
  targetRoleKeywords: (value) =>
    stringListFrom(value, APP_SETTING_DEFAULTS.targetRoleKeywords),
  excludeRoleKeywords: (value) =>
    stringListFrom(value, APP_SETTING_DEFAULTS.excludeRoleKeywords),
  targetSeniorityKeywords: (value) =>
    stringListFrom(value, APP_SETTING_DEFAULTS.targetSeniorityKeywords),
  canonicalNiches: (value) =>
    stringListFrom(value, APP_SETTING_DEFAULTS.canonicalNiches),
  nicheNormalization: (value) =>
    booleanFrom(value, APP_SETTING_DEFAULTS.nicheNormalization)
};

const SETTINGS_CACHE_TTL_MS = 60 * 1000;

let cachedSettings: { value: AppSettings; loadedAt: number } | null = null;

function mergeStoredSettings(stored: any): AppSettings {
  const merged: any = { ...APP_SETTING_DEFAULTS };

  for (const key of Object.keys(SETTING_SANITIZERS)) {
    if (stored && stored[key] !== undefined && stored[key] !== null) {
      merged[key] = SETTING_SANITIZERS[key](stored[key]);
    }
  }

  return merged as AppSettings;
}

export async function getAppSettings(forceRefresh = false): Promise<AppSettings> {
  if (
    !forceRefresh &&
    cachedSettings &&
    Date.now() - cachedSettings.loadedAt < SETTINGS_CACHE_TTL_MS
  ) {
    return cachedSettings.value;
  }

  const stored = await AppSettingModel.findOne({ key: "global" })
    .lean()
    .catch(() => null);

  const merged = mergeStoredSettings(stored);

  cachedSettings = { value: merged, loadedAt: Date.now() };

  return merged;
}
