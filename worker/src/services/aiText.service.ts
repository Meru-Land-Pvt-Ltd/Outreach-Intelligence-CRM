import axios from "axios";
import { AiSetting } from "../models/AiSetting.model";
import { decryptSecret } from "../utils/secretCrypto";

// Provider-agnostic AI text generation. Uses the provider/API key/model saved
// from the Settings page (encrypted in Mongo). Falls back to the legacy
// OPENAI_API_KEY env vars only when nothing is saved, so existing deployments
// keep working. Keep backend/src/utils/aiText.ts in sync.

const AiSettingModel = AiSetting as any;

export type AiProvider = "openai" | "gemini" | "anthropic";

export type AiConfig = {
  provider: AiProvider;
  apiKey: string;
  model: string;
  source: "settings" | "env";
};

export const AI_PROVIDER_LABELS: Record<AiProvider, string> = {
  openai: "OpenAI",
  gemini: "Google Gemini",
  anthropic: "Anthropic Claude"
};

const CACHE_TTL_MS = 60 * 1000;

let cache: { config: AiConfig | null; loadedAt: number } | null = null;

export function clearAiConfigCache() {
  cache = null;
}

export async function getActiveAiConfig(): Promise<AiConfig | null> {
  if (cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) {
    return cache.config;
  }

  let config: AiConfig | null = null;

  try {
    const doc: any = await AiSettingModel.findOne({ key: "ai" }).lean();

    if (doc?.apiKeyEncrypted && doc.provider && doc.model) {
      const apiKey = decryptSecret(doc.apiKeyEncrypted);

      if (apiKey) {
        config = {
          provider: doc.provider,
          apiKey,
          model: String(doc.model),
          source: "settings"
        };
      }
    }
  } catch (error: any) {
    console.error("AI settings load failed:", error?.message || error);
  }

  if (!config) {
    const envKey = process.env.OPENAI_API_KEY || "";

    if (envKey && !envKey.includes("your_")) {
      config = {
        provider: "openai",
        apiKey: envKey,
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        source: "env"
      };
    }
  }

  cache = { config, loadedAt: Date.now() };

  return config;
}

export type GenerateAiTextInput = {
  prompt: string;
  system?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
};

// Returns the model's text output, or throws with a provider-labelled error.
export async function generateAiText(input: GenerateAiTextInput): Promise<string> {
  const config = await getActiveAiConfig();

  if (!config) {
    throw new Error(
      "No AI model configured. Choose a provider, API key and model in Settings."
    );
  }

  const temperature = input.temperature ?? 0;
  const timeout = input.timeoutMs ?? 60000;

  if (config.provider === "openai") {
    const messages: Array<{ role: string; content: string }> = [];

    if (input.system) messages.push({ role: "system", content: input.system });
    messages.push({ role: "user", content: input.prompt });

    const response = await axios.post(
      process.env.OPENAI_CHAT_COMPLETIONS_URL ||
        "https://api.openai.com/v1/chat/completions",
      {
        model: config.model,
        messages,
        temperature,
        ...(input.maxTokens ? { max_tokens: input.maxTokens } : {})
      },
      {
        headers: {
          Authorization: "Bearer " + config.apiKey,
          "Content-Type": "application/json"
        },
        timeout
      }
    );

    return String(response.data?.choices?.[0]?.message?.content || "");
  }

  if (config.provider === "anthropic") {
    const response = await axios.post(
      "https://api.anthropic.com/v1/messages",
      {
        model: config.model,
        max_tokens: input.maxTokens ?? 4096,
        ...(input.system ? { system: input.system } : {}),
        messages: [{ role: "user", content: input.prompt }],
        temperature: Math.min(Math.max(temperature, 0), 1)
      },
      {
        headers: {
          "x-api-key": config.apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json"
        },
        timeout
      }
    );

    const blocks: any[] = response.data?.content || [];

    return blocks
      .filter((block) => block?.type === "text")
      .map((block) => String(block.text || ""))
      .join("\n")
      .trim();
  }

  // Google Gemini
  const response = await axios.post(
    "https://generativelanguage.googleapis.com/v1beta/models/" +
      encodeURIComponent(config.model) +
      ":generateContent",
    {
      ...(input.system
        ? { systemInstruction: { parts: [{ text: input.system }] } }
        : {}),
      contents: [{ role: "user", parts: [{ text: input.prompt }] }],
      generationConfig: {
        temperature,
        ...(input.maxTokens ? { maxOutputTokens: input.maxTokens } : {})
      }
    },
    {
      headers: {
        "x-goog-api-key": config.apiKey,
        "Content-Type": "application/json"
      },
      timeout
    }
  );

  const parts: any[] = response.data?.candidates?.[0]?.content?.parts || [];

  return parts
    .map((part) => String(part?.text || ""))
    .filter(Boolean)
    .join("\n")
    .trim();
}
