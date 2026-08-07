import { Request, Response } from "express";
import axios from "axios";
import { AiSetting } from "../models/AiSetting.model";
import { encryptSecret, decryptSecret } from "../utils/secretCrypto";
import {
  AI_PROVIDER_LABELS,
  AiProvider,
  clearAiConfigCache
} from "../utils/aiText";
import { clearBillingReportCache } from "./billing.controller";

const AiSettingModel = AiSetting as any;

const VALID_PROVIDERS: AiProvider[] = ["openai", "gemini", "anthropic"];

function cleanText(value: any) {
  return String(value || "").trim();
}

function isValidProvider(value: any): value is AiProvider {
  return VALID_PROVIDERS.includes(cleanText(value) as AiProvider);
}

function maskKey(last4: string) {
  return last4 ? "••••••••••••" + last4 : "";
}

function settingsView(doc: any) {
  if (!doc || !doc.apiKeyEncrypted) {
    return {
      configured: false,
      provider: "",
      providerLabel: "",
      model: "",
      apiKeyMasked: "",
      updatedAt: null,
      updatedBy: "",
      envFallbackActive: Boolean(
        process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.includes("your_")
      )
    };
  }

  return {
    configured: true,
    provider: doc.provider,
    providerLabel: AI_PROVIDER_LABELS[doc.provider as AiProvider] || doc.provider,
    model: doc.model,
    apiKeyMasked: maskKey(doc.apiKeyLast4),
    updatedAt: doc.updatedAt || null,
    updatedBy: doc.updatedBy || "",
    envFallbackActive: false
  };
}

export async function getAiSettings(req: Request, res: Response) {
  try {
    const doc = await AiSettingModel.findOne({ key: "ai" }).lean();

    res.json({
      success: true,
      data: settingsView(doc),
      providers: VALID_PROVIDERS.map((provider) => ({
        id: provider,
        label: AI_PROVIDER_LABELS[provider]
      }))
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

// --- Live model listing per provider ----------------------------------------
// Always fetched from the provider's own /models API with the given key, so
// newly released models show up automatically — nothing is hardcoded.

type ModelItem = { id: string; label: string; releasedAt?: string };

async function listOpenAiModels(apiKey: string): Promise<ModelItem[]> {
  const response = await axios.get("https://api.openai.com/v1/models", {
    headers: { Authorization: "Bearer " + apiKey },
    timeout: 20000
  });

  const rows: any[] = response.data?.data || [];

  return rows
    .map((row) => ({
      id: String(row.id || ""),
      label: String(row.id || ""),
      releasedAt: row.created
        ? new Date(Number(row.created) * 1000).toISOString().substring(0, 10)
        : undefined,
      created: Number(row.created || 0)
    }))
    .filter((row) => row.id)
    .sort((a, b) => b.created - a.created)
    .map(({ id, label, releasedAt }) => ({ id, label, releasedAt }));
}

async function listAnthropicModels(apiKey: string): Promise<ModelItem[]> {
  const response = await axios.get("https://api.anthropic.com/v1/models", {
    params: { limit: 1000 },
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    timeout: 20000
  });

  const rows: any[] = response.data?.data || [];

  return rows
    .map((row) => ({
      id: String(row.id || ""),
      label: String(row.display_name || row.id || ""),
      releasedAt: row.created_at
        ? String(row.created_at).substring(0, 10)
        : undefined
    }))
    .filter((row) => row.id)
    .sort((a, b) => String(b.releasedAt || "").localeCompare(String(a.releasedAt || "")));
}

async function listGeminiModels(apiKey: string): Promise<ModelItem[]> {
  const response = await axios.get(
    "https://generativelanguage.googleapis.com/v1beta/models",
    {
      params: { pageSize: 1000 },
      headers: { "x-goog-api-key": apiKey },
      timeout: 20000
    }
  );

  const rows: any[] = response.data?.models || [];

  return rows
    .filter((row) =>
      Array.isArray(row.supportedGenerationMethods)
        ? row.supportedGenerationMethods.includes("generateContent")
        : true
    )
    .map((row) => ({
      id: String(row.name || "").replace(/^models\//, ""),
      label: String(row.displayName || row.name || "").replace(/^models\//, "")
    }))
    .filter((row) => row.id)
    .sort((a, b) => b.id.localeCompare(a.id));
}

export async function listAiModels(req: Request, res: Response) {
  try {
    const provider = cleanText(req.body?.provider);
    let apiKey = cleanText(req.body?.apiKey);

    if (!isValidProvider(provider)) {
      return res.status(400).json({
        success: false,
        message: "Choose a valid AI provider first (OpenAI, Gemini or Claude)."
      });
    }

    // "Search Models" without re-typing the key: reuse the stored key when
    // the provider matches the saved configuration.
    if (!apiKey) {
      const doc = await AiSettingModel.findOne({ key: "ai" }).lean();

      if (doc?.provider === provider && doc.apiKeyEncrypted) {
        apiKey = decryptSecret(doc.apiKeyEncrypted);
      }
    }

    if (!apiKey) {
      return res.status(400).json({
        success: false,
        message: "Enter the API key first, then search models."
      });
    }

    let models: ModelItem[] = [];

    if (provider === "openai") models = await listOpenAiModels(apiKey);
    else if (provider === "anthropic") models = await listAnthropicModels(apiKey);
    else models = await listGeminiModels(apiKey);

    res.json({
      success: true,
      provider,
      count: models.length,
      models
    });
  } catch (error: any) {
    const status = error?.response?.status;

    if (status === 401 || status === 403) {
      return res.status(400).json({
        success: false,
        message:
          "The API key was rejected by the provider (" +
          status +
          "). Check the key and try again."
      });
    }

    res.status(500).json({
      success: false,
      message:
        "Could not load models: " +
        String(
          error?.response?.data?.error?.message || error?.message || "unknown error"
        ).slice(0, 200)
    });
  }
}

export async function saveAiSettings(req: Request, res: Response) {
  try {
    const provider = cleanText(req.body?.provider);
    const model = cleanText(req.body?.model);
    const apiKey = cleanText(req.body?.apiKey);

    if (!isValidProvider(provider)) {
      return res.status(400).json({
        success: false,
        message: "Choose a valid AI provider (OpenAI, Gemini or Claude)."
      });
    }

    if (!model) {
      return res.status(400).json({
        success: false,
        message: "Choose a model before saving."
      });
    }

    const existing = await AiSettingModel.findOne({ key: "ai" }).lean();

    let apiKeyEncrypted = "";
    let apiKeyLast4 = "";

    if (apiKey) {
      apiKeyEncrypted = encryptSecret(apiKey);
      apiKeyLast4 = apiKey.slice(-4);
    } else if (existing?.provider === provider && existing.apiKeyEncrypted) {
      // Key unchanged — keep the stored encrypted key.
      apiKeyEncrypted = existing.apiKeyEncrypted;
      apiKeyLast4 = existing.apiKeyLast4 || "";
    } else {
      return res.status(400).json({
        success: false,
        message: "Enter the API key for this provider."
      });
    }

    const doc = await AiSettingModel.findOneAndUpdate(
      { key: "ai" },
      {
        $set: {
          provider,
          model,
          apiKeyEncrypted,
          apiKeyLast4,
          updatedBy: String((req as any).user?.email || "")
        }
      },
      { upsert: true, new: true }
    ).lean();

    // Backend picks the change up immediately; the worker's 60s config cache
    // refreshes on its own. The billing report cache is cleared too so the
    // API Billing page shows the new provider/model right away.
    clearAiConfigCache();
    clearBillingReportCache();

    res.json({
      success: true,
      message:
        "Saved. The platform now uses " +
        AI_PROVIDER_LABELS[provider as AiProvider] +
        " — " +
        model +
        " for all AI features.",
      data: settingsView(doc)
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}
