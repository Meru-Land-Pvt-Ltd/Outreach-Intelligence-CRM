import { Request, Response } from "express";
import { AppSetting } from "../models/AppSetting.model";

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

function numberFromEnv(value: any, fallback: number) {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export const APP_SETTING_DEFAULTS: AppSettings = {
  manualSelectionMode: false,
  maxBrandsPerSeed: 100,
  maxEmailsPerBrand: numberFromEnv(
    process.env.INSTANTLY_LIMIT_EMAILS_PER_COMPANY,
    4
  ),
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

function mergeStoredSettings(stored: any): AppSettings {
  const merged: any = { ...APP_SETTING_DEFAULTS };

  for (const key of Object.keys(SETTING_SANITIZERS)) {
    if (stored && stored[key] !== undefined && stored[key] !== null) {
      merged[key] = SETTING_SANITIZERS[key](stored[key]);
    }
  }

  return merged as AppSettings;
}

export async function getAppSettings(): Promise<AppSettings> {
  const stored = await AppSettingModel.findOne({ key: "global" })
    .lean()
    .catch(() => null);

  return mergeStoredSettings(stored);
}

export async function getSettings(req: Request, res: Response) {
  try {
    const stored = await AppSettingModel.findOne({ key: "global" }).lean();

    res.json({
      success: true,
      data: mergeStoredSettings(stored),
      defaults: APP_SETTING_DEFAULTS,
      overridden: Object.keys(stored || {}).filter(
        (key) => key in SETTING_SANITIZERS
      )
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export async function updateSettings(req: Request, res: Response) {
  try {
    const body = req.body || {};
    const updates: Record<string, any> = {};

    for (const key of Object.keys(SETTING_SANITIZERS)) {
      if (body[key] !== undefined) {
        updates[key] = SETTING_SANITIZERS[key](body[key]);
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid settings provided."
      });
    }

    updates.updatedBy = String((req as any).user?.email || "");

    const stored = await AppSettingModel.findOneAndUpdate(
      { key: "global" },
      { $set: updates },
      { upsert: true, new: true }
    ).lean();

    res.json({
      success: true,
      data: mergeStoredSettings(stored)
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}
