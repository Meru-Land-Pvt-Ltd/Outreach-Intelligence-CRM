import { Request, Response } from "express";
import axios from "axios";

// Live billing/credit status for every external API the pipeline uses.
// Providers that expose balances (Hunter, MillionVerifier, Prospeo) report
// real numbers; providers that hide them (OpenAI, YouTube) get a tiny health
// probe that distinguishes "working" from "out of credits" from "bad key".
// Results are cached so opening the page doesn't burn quota.

type ProviderStatus =
  | "ok"
  | "low"
  | "exhausted"
  | "invalid_key"
  | "not_configured"
  | "error";

type ProviderReport = {
  provider: string;
  label: string;
  status: ProviderStatus;
  detail: string;
  credits?: Record<string, any>;
  checkedAt: string;
};

const PROBE_TIMEOUT_MS = 10000;
const CACHE_TTL_MS = 10 * 60 * 1000;

let cachedReport: { data: ProviderReport[]; loadedAt: number } | null = null;

function nowIso() {
  return new Date().toISOString();
}

function report(
  provider: string,
  label: string,
  status: ProviderStatus,
  detail: string,
  credits?: Record<string, any>
): ProviderReport {
  return { provider, label, status, detail, credits, checkedAt: nowIso() };
}

async function probeOpenAi(): Promise<ProviderReport> {
  const key = process.env.OPENAI_API_KEY || "";

  if (!key) {
    return report("openai", "OpenAI", "not_configured", "OPENAI_API_KEY missing");
  }

  try {
    // OpenAI does not expose balance via API keys — a 1-token completion
    // (fraction of a cent) is the reliable recharge check.
    const response = await axios.post(
      process.env.OPENAI_CHAT_COMPLETIONS_URL ||
        "https://api.openai.com/v1/chat/completions",
      {
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1
      },
      {
        headers: { Authorization: "Bearer " + key },
        timeout: PROBE_TIMEOUT_MS,
        validateStatus: () => true
      }
    );

    if (response.status === 200) {
      return report(
        "openai",
        "OpenAI",
        "ok",
        "API responding — credits available. (OpenAI hides exact balance; see platform.openai.com/usage.)"
      );
    }

    const message = String(
      response.data?.error?.message || response.statusText || ""
    );

    if (
      response.status === 429 &&
      (message.toLowerCase().includes("quota") ||
        String(response.data?.error?.code || "").includes("insufficient_quota"))
    ) {
      return report(
        "openai",
        "OpenAI",
        "exhausted",
        "Out of credits: " + message.slice(0, 180)
      );
    }

    if (response.status === 401) {
      return report("openai", "OpenAI", "invalid_key", "API key rejected (401).");
    }

    return report(
      "openai",
      "OpenAI",
      "error",
      "HTTP " + response.status + ": " + message.slice(0, 160)
    );
  } catch (error: any) {
    return report("openai", "OpenAI", "error", error?.message || "Probe failed");
  }
}

async function probeYoutube(): Promise<ProviderReport> {
  const keys = Array.from(
    new Set(
      [
        process.env.YOUTUBE_API_KEY || "",
        ...String(process.env.YOUTUBE_API_KEYS || "").split(",")
      ]
        .map((key) => key.trim())
        .filter(Boolean)
    )
  );

  if (keys.length === 0) {
    return report("youtube", "YouTube Data API", "not_configured", "No API keys set");
  }

  const perKey: Array<{ key: string; status: string }> = [];
  let okCount = 0;
  let exhaustedCount = 0;
  let invalidCount = 0;

  for (const key of keys) {
    try {
      // i18nLanguages costs 1 quota unit — the cheapest live probe.
      const response = await axios.get(
        "https://www.googleapis.com/youtube/v3/i18nLanguages",
        {
          params: { part: "snippet", key },
          timeout: PROBE_TIMEOUT_MS,
          validateStatus: () => true
        }
      );

      const reason = String(
        response.data?.error?.errors?.[0]?.reason ||
          response.data?.error?.status ||
          ""
      ).toLowerCase();

      let status = "ok";

      if (response.status === 200) {
        okCount += 1;
      } else if (reason.includes("quota")) {
        status = "quota exhausted";
        exhaustedCount += 1;
      } else if (
        response.status === 400 ||
        response.status === 403 ||
        reason.includes("keyinvalid")
      ) {
        status = "invalid key";
        invalidCount += 1;
      } else {
        status = "error " + response.status;
      }

      perKey.push({ key: "…" + key.slice(-6), status });
    } catch (error: any) {
      perKey.push({ key: "…" + key.slice(-6), status: "error" });
    }
  }

  const status: ProviderStatus =
    okCount > 0
      ? okCount < keys.length
        ? "low"
        : "ok"
      : exhaustedCount > 0
        ? "exhausted"
        : "invalid_key";

  return report(
    "youtube",
    "YouTube Data API",
    status,
    okCount +
      "/" +
      keys.length +
      " keys have quota right now. (Google hides exact quota; see console.cloud.google.com.)",
    { keys: perKey }
  );
}

async function probeHunter(): Promise<ProviderReport> {
  const key = process.env.HUNTER_API_KEY || "";

  if (!key) {
    return report("hunter", "Hunter.io", "not_configured", "HUNTER_API_KEY missing");
  }

  try {
    const base = process.env.HUNTER_BASE_URL || "https://api.hunter.io/v2";
    const response = await axios.get(base + "/account", {
      params: { api_key: key },
      timeout: PROBE_TIMEOUT_MS,
      validateStatus: () => true
    });

    if (response.status === 200) {
      const data = response.data?.data || {};
      const searches = data.requests?.searches || {};
      const verifications = data.requests?.verifications || {};

      const searchesLeft =
        Number(searches.available || 0) - Number(searches.used || 0);

      const status: ProviderStatus =
        searchesLeft <= 0 ? "exhausted" : searchesLeft < 25 ? "low" : "ok";

      return report(
        "hunter",
        "Hunter.io",
        status,
        "Plan: " +
          (data.plan_name || "?") +
          " — searches " +
          (searches.used || 0) +
          "/" +
          (searches.available || 0) +
          ", verifications " +
          (verifications.used || 0) +
          "/" +
          (verifications.available || 0),
        {
          plan: data.plan_name,
          searchesUsed: searches.used,
          searchesAvailable: searches.available,
          verificationsUsed: verifications.used,
          verificationsAvailable: verifications.available,
          resetDate: data.reset_date
        }
      );
    }

    if (response.status === 401) {
      return report("hunter", "Hunter.io", "invalid_key", "API key rejected (401).");
    }

    return report(
      "hunter",
      "Hunter.io",
      "error",
      "HTTP " + response.status
    );
  } catch (error: any) {
    return report("hunter", "Hunter.io", "error", error?.message || "Probe failed");
  }
}

async function probeApollo(): Promise<ProviderReport> {
  const key = process.env.APOLLO_API_KEY || "";

  if (!key) {
    return report("apollo", "Apollo.io", "not_configured", "APOLLO_API_KEY missing");
  }

  try {
    const base = process.env.APOLLO_BASE_URL || "https://api.apollo.io/api/v1";
    const response = await axios.get(base + "/auth/health", {
      headers: { "X-Api-Key": key },
      timeout: PROBE_TIMEOUT_MS,
      validateStatus: () => true
    });

    if (response.status === 200 && response.data?.is_logged_in) {
      return report(
        "apollo",
        "Apollo.io",
        "ok",
        "API key valid. (Apollo does not expose credit balance via API — see app.apollo.io settings for credits.)"
      );
    }

    if (response.status === 401 || response.data?.is_logged_in === false) {
      return report("apollo", "Apollo.io", "invalid_key", "API key rejected.");
    }

    return report("apollo", "Apollo.io", "error", "HTTP " + response.status);
  } catch (error: any) {
    return report("apollo", "Apollo.io", "error", error?.message || "Probe failed");
  }
}

async function probeProspeo(): Promise<ProviderReport> {
  const key = process.env.PROSPEO_API_KEY || "";

  if (!key || key.includes("your_")) {
    return report("prospeo", "Prospeo.io", "not_configured", "PROSPEO_API_KEY missing");
  }

  try {
    const response = await axios.post(
      "https://api.prospeo.io/account-information",
      {},
      {
        headers: { "Content-Type": "application/json", "X-KEY": key },
        timeout: PROBE_TIMEOUT_MS,
        validateStatus: () => true
      }
    );

    if (response.status === 200 && response.data?.error === false) {
      const info = response.data?.response || {};
      const remaining = Number(info.remaining_credits ?? -1);

      const status: ProviderStatus =
        remaining === 0 ? "exhausted" : remaining > 0 && remaining < 50 ? "low" : "ok";

      return report(
        "prospeo",
        "Prospeo.io",
        remaining < 0 ? "ok" : status,
        remaining >= 0
          ? remaining + " credits remaining"
          : "API key valid",
        info
      );
    }

    if (response.status === 401 || response.status === 403) {
      return report("prospeo", "Prospeo.io", "invalid_key", "API key rejected.");
    }

    return report(
      "prospeo",
      "Prospeo.io",
      "error",
      "HTTP " + response.status + " " + String(response.data?.message || "").slice(0, 120)
    );
  } catch (error: any) {
    return report("prospeo", "Prospeo.io", "error", error?.message || "Probe failed");
  }
}

async function probeMillionVerifier(): Promise<ProviderReport> {
  const key = process.env.MILLION_VERIFIER_API_KEY || "";

  if (!key) {
    return report(
      "millionverifier",
      "MillionVerifier",
      "not_configured",
      "MILLION_VERIFIER_API_KEY missing"
    );
  }

  try {
    const response = await axios.get(
      "https://api.millionverifier.com/api/v3/credits",
      {
        params: { api: key },
        timeout: PROBE_TIMEOUT_MS,
        validateStatus: () => true
      }
    );

    const credits = Number(response.data?.credits ?? -1);

    if (response.status === 200 && credits >= 0) {
      const status: ProviderStatus =
        credits === 0 ? "exhausted" : credits < 200 ? "low" : "ok";

      return report(
        "millionverifier",
        "MillionVerifier",
        status,
        credits + " verification credits remaining",
        { credits }
      );
    }

    const errorText = String(response.data?.error || "").toLowerCase();

    if (errorText.includes("key")) {
      return report(
        "millionverifier",
        "MillionVerifier",
        "invalid_key",
        "API key rejected."
      );
    }

    return report(
      "millionverifier",
      "MillionVerifier",
      "error",
      "HTTP " + response.status + " " + String(response.data?.error || "")
    );
  } catch (error: any) {
    return report(
      "millionverifier",
      "MillionVerifier",
      "error",
      error?.message || "Probe failed"
    );
  }
}

async function probeInstantly(): Promise<ProviderReport> {
  const key = process.env.INSTANTLY_API_KEY || "";

  if (!key) {
    return report(
      "instantly",
      "Instantly.ai",
      "not_configured",
      "INSTANTLY_API_KEY missing"
    );
  }

  try {
    const base = process.env.INSTANTLY_BASE_URL || "https://api.instantly.ai/api/v2";
    const response = await axios.get(base + "/campaigns", {
      params: { limit: 1 },
      headers: { Authorization: "Bearer " + key },
      timeout: PROBE_TIMEOUT_MS,
      validateStatus: () => true
    });

    if (response.status === 200) {
      return report(
        "instantly",
        "Instantly.ai",
        "ok",
        "API key valid — subscription active. (Instantly is subscription-based; manage billing at app.instantly.ai.)"
      );
    }

    if (response.status === 401 || response.status === 403) {
      return report(
        "instantly",
        "Instantly.ai",
        "invalid_key",
        "API key rejected — key revoked or subscription lapsed."
      );
    }

    return report("instantly", "Instantly.ai", "error", "HTTP " + response.status);
  } catch (error: any) {
    return report("instantly", "Instantly.ai", "error", error?.message || "Probe failed");
  }
}

export async function getBillingStatus(req: Request, res: Response) {
  try {
    const forceRefresh = String(req.query.refresh || "") === "1";

    if (
      !forceRefresh &&
      cachedReport &&
      Date.now() - cachedReport.loadedAt < CACHE_TTL_MS
    ) {
      return res.json({
        success: true,
        cached: true,
        cachedAt: new Date(cachedReport.loadedAt).toISOString(),
        data: cachedReport.data
      });
    }

    const results = await Promise.allSettled([
      probeOpenAi(),
      probeYoutube(),
      probeHunter(),
      probeApollo(),
      probeProspeo(),
      probeMillionVerifier(),
      probeInstantly()
    ]);

    const data = results.map((result, index) => {
      if (result.status === "fulfilled") return result.value;

      const names = [
        ["openai", "OpenAI"],
        ["youtube", "YouTube Data API"],
        ["hunter", "Hunter.io"],
        ["apollo", "Apollo.io"],
        ["prospeo", "Prospeo.io"],
        ["millionverifier", "MillionVerifier"],
        ["instantly", "Instantly.ai"]
      ][index];

      return report(names[0], names[1], "error", "Probe crashed");
    });

    cachedReport = { data, loadedAt: Date.now() };

    res.json({ success: true, cached: false, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}
