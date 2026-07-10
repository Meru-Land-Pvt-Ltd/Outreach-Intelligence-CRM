import { AppSetting } from "../models/AppSetting.model";
import { env } from "../config/env";

const AppSettingModel = AppSetting as any;

export type AppSettings = {
  manualSelectionMode: boolean;
  maxBrandsPerSeed: number;
  maxEmailsPerBrand: number;
  scrapeFirstSkipPaid: boolean;
  scrapeSkipThreshold: number;
  coolingOffMonths: number;
  intentLookbackDays: number;
  intentCacheDays: number;
  intentModel: string;
};

export const APP_SETTING_DEFAULTS: AppSettings = {
  manualSelectionMode: false,
  maxBrandsPerSeed: 100,
  maxEmailsPerBrand: env.instantlyLimitEmailsPerCompany,
  scrapeFirstSkipPaid: true,
  scrapeSkipThreshold: 3,
  coolingOffMonths: 3,
  intentLookbackDays: 60,
  intentCacheDays: 14,
  intentModel: ""
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
  intentLookbackDays: (value) =>
    clampNumber(value, APP_SETTING_DEFAULTS.intentLookbackDays, 30, 90),
  intentCacheDays: (value) =>
    clampNumber(value, APP_SETTING_DEFAULTS.intentCacheDays, 1, 90),
  intentModel: (value) => String(value || "").trim()
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
