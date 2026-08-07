"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, KeyRound, Pencil, RefreshCw, Save, Search } from "lucide-react";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Notice } from "@/components/shared/notice";

type NoticeState = { type: "success" | "error"; text: string };

type AiSettingsView = {
  configured: boolean;
  provider: string;
  providerLabel: string;
  model: string;
  apiKeyMasked: string;
  updatedAt: string | null;
  updatedBy: string;
  envFallbackActive: boolean;
};

type ProviderOption = { id: string; label: string };

type ModelItem = { id: string; label: string; releasedAt?: string };

const PROVIDER_HINTS: Record<string, string> = {
  openai: "Create a key at platform.openai.com → API keys (starts with sk-...).",
  gemini: "Create a key at aistudio.google.com → Get API key (starts with AIza...).",
  anthropic: "Create a key at console.anthropic.com → API keys (starts with sk-ant-...).",
};

function formatDate(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SettingsPage() {
  const [view, setView] = useState<AiSettingsView | null>(null);
  const [providers, setProviders] = useState<ProviderOption[]>([
    { id: "openai", label: "OpenAI" },
    { id: "gemini", label: "Google Gemini" },
    { id: "anthropic", label: "Anthropic Claude" },
  ]);

  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);

  const [provider, setProvider] = useState("openai");
  const [apiKey, setApiKey] = useState("");
  const [models, setModels] = useState<ModelItem[]>([]);
  const [modelSearch, setModelSearch] = useState("");
  const [selectedModel, setSelectedModel] = useState("");

  const [searchingModels, setSearchingModels] = useState(false);
  const [saving, setSaving] = useState(false);

  async function loadSettings() {
    setLoading(true);

    try {
      const response = (await apiGet("/settings/ai")) as {
        success?: boolean;
        data?: AiSettingsView;
        providers?: ProviderOption[];
      } | null;

      if (response?.success && response.data) {
        setView(response.data);

        if (response.providers?.length) setProviders(response.providers);

        if (response.data.configured) {
          setProvider(response.data.provider);
          setSelectedModel(response.data.model);
          setEditing(false);
        } else {
          setEditing(true);
        }
      } else {
        setView(null);
        setEditing(true);
      }
    } catch {
      setView(null);
      setEditing(true);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadSettings();
  }, []);

  const keyStoredForProvider =
    Boolean(view?.configured) && view?.provider === provider;

  const filteredModels = useMemo(() => {
    const query = modelSearch.trim().toLowerCase();

    if (!query) return models;

    return models.filter(
      (model) =>
        model.id.toLowerCase().includes(query) ||
        model.label.toLowerCase().includes(query)
    );
  }, [models, modelSearch]);

  function switchProvider(next: string) {
    setProvider(next);
    setModels([]);
    setModelSearch("");
    setApiKey("");

    // Keep the saved model preselected when returning to the saved provider.
    setSelectedModel(view?.configured && view.provider === next ? view.model : "");
  }

  async function searchModels() {
    if (searchingModels) return;

    if (!apiKey.trim() && !keyStoredForProvider) {
      setNotice({ type: "error", text: "Enter the API key first, then search models." });
      return;
    }

    setSearchingModels(true);
    setNotice(null);
    setModels([]);

    try {
      const response = (await apiPost("/settings/ai/models", {
        provider,
        apiKey: apiKey.trim(),
      })) as {
        success?: boolean;
        message?: string;
        models?: ModelItem[];
        count?: number;
      } | null;

      if (response?.success && Array.isArray(response.models)) {
        setModels(response.models);
        setNotice({
          type: "success",
          text:
            `Found ${response.models.length} model(s) available for this API key — ` +
            "fetched live from the provider, so newly released models are included.",
        });

        if (
          selectedModel &&
          !response.models.some((model) => model.id === selectedModel)
        ) {
          setSelectedModel("");
        }
      } else {
        setNotice({
          type: "error",
          text: response?.message || "Could not load models for this key.",
        });
      }
    } catch (error) {
      setNotice({
        type: "error",
        text: error instanceof Error ? error.message : "Could not load models.",
      });
    }

    setSearchingModels(false);
  }

  async function saveSettings() {
    if (saving) return;

    if (!selectedModel) {
      setNotice({ type: "error", text: "Search models and choose one before saving." });
      return;
    }

    setSaving(true);
    setNotice(null);

    try {
      const response = (await apiPut("/settings/ai", {
        provider,
        apiKey: apiKey.trim(),
        model: selectedModel,
      })) as { success?: boolean; message?: string; data?: AiSettingsView } | null;

      if (response?.success) {
        setNotice({
          type: "success",
          text: response.message || "AI settings saved.",
        });
        setApiKey("");
        setModels([]);
        setModelSearch("");
        await loadSettings();
      } else {
        setNotice({
          type: "error",
          text: response?.message || "Failed to save AI settings.",
        });
      }
    } catch (error) {
      setNotice({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to save AI settings.",
      });
    }

    setSaving(false);
  }

  return (
    <main className="w-full max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950">
          Settings
        </h1>

        <p className="mt-1 text-sm font-medium text-slate-500">
          AI model configuration. The provider, API key and model saved here are
          used by every AI feature on the platform — no .env changes needed.
        </p>
      </div>

      {notice ? <Notice type={notice.type} text={notice.text} /> : null}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm font-semibold text-slate-500">
          Loading AI settings...
        </div>
      ) : !editing && view?.configured ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <Check className="h-5 w-5" />
              </span>

              <div>
                <h2 className="text-base font-bold text-slate-950">
                  AI model configured
                </h2>
                <p className="text-sm font-medium text-slate-500">
                  All AI features use this provider and model.
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditing(true);
                setNotice(null);
              }}
              className="h-10 rounded-xl !border-blue-200 !text-blue-700 hover:!bg-blue-50"
            >
              <Pencil className="mr-2 h-4 w-4" />
              Change
            </Button>
          </div>

          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Provider
              </dt>
              <dd className="mt-1 text-sm font-bold text-slate-950">
                {view.providerLabel}
              </dd>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Model
              </dt>
              <dd className="mt-1 text-sm font-bold text-slate-950">{view.model}</dd>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">
                API Key
              </dt>
              <dd className="mt-1 font-mono text-sm font-bold text-slate-950">
                {view.apiKeyMasked}
              </dd>
              <p className="mt-1 text-xs font-medium text-slate-500">
                Stored encrypted (AES-256-GCM). Never shown again in full.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Last Updated
              </dt>
              <dd className="mt-1 text-sm font-bold text-slate-950">
                {formatDate(view.updatedAt)}
                {view.updatedBy ? (
                  <span className="ml-1 text-xs font-medium text-slate-500">
                    by {view.updatedBy}
                  </span>
                ) : null}
              </dd>
            </div>
          </dl>
        </section>
      ) : (
        <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <KeyRound className="h-5 w-5" />
            </span>

            <div>
              <h2 className="text-base font-bold text-slate-950">
                {view?.configured ? "Change AI model" : "Set up AI model"}
              </h2>
              <p className="text-sm font-medium text-slate-500">
                1. Choose provider · 2. Enter API key · 3. Search models · 4. Save
              </p>
            </div>
          </div>

          {view?.envFallbackActive && !view.configured ? (
            <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
              Currently running on the legacy OPENAI_API_KEY from .env. Save a
              configuration here to manage the AI model from this page instead.
            </div>
          ) : null}

          <label className="block max-w-sm space-y-2">
            <span className="text-sm font-semibold text-slate-800">AI Provider</span>

            <Select value={provider} onValueChange={switchProvider}>
              <SelectTrigger className="h-11 border-slate-200">
                <SelectValue placeholder="Choose provider" />
              </SelectTrigger>

              <SelectContent>
                {providers.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="block max-w-xl space-y-2">
            <span className="text-sm font-semibold text-slate-800">API Key</span>

            <Input
              type="password"
              autoComplete="off"
              placeholder={
                keyStoredForProvider
                  ? `Saved (${view?.apiKeyMasked}) — enter a new key only to replace it`
                  : "Paste the API key for this provider"
              }
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              className="h-11 border-slate-200 font-mono"
            />

            <span className="block text-xs font-medium text-slate-500">
              {PROVIDER_HINTS[provider] || ""} The key is stored encrypted and
              shown only masked after saving.
            </span>
          </label>

          <div>
            <Button
              type="button"
              onClick={searchModels}
              disabled={searchingModels || (!apiKey.trim() && !keyStoredForProvider)}
              className="h-11 rounded-xl !bg-blue-700 !text-white hover:!bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {searchingModels ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-2 h-4 w-4" />
              )}
              {searchingModels ? "Searching models..." : "Search Models"}
            </Button>
          </div>

          {models.length > 0 ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm font-semibold text-slate-800">
                  Available models ({filteredModels.length} of {models.length},
                  latest first)
                </span>

                <Input
                  placeholder="Filter models..."
                  value={modelSearch}
                  onChange={(event) => setModelSearch(event.target.value)}
                  className="h-9 w-56 border-slate-200"
                />
              </div>

              <div className="max-h-80 overflow-y-auto rounded-xl border border-slate-200">
                {filteredModels.map((model) => (
                  <label
                    key={model.id}
                    className={`flex cursor-pointer items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5 text-sm last:border-b-0 hover:bg-blue-50/50 ${
                      selectedModel === model.id ? "bg-blue-50" : ""
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="ai-model"
                        checked={selectedModel === model.id}
                        onChange={() => setSelectedModel(model.id)}
                        className="h-4 w-4"
                      />
                      <span className="font-mono font-medium text-slate-800">
                        {model.id}
                      </span>
                      {model.label && model.label !== model.id ? (
                        <span className="text-xs font-medium text-slate-500">
                          {model.label}
                        </span>
                      ) : null}
                    </span>

                    {model.releasedAt ? (
                      <span className="text-xs font-medium text-slate-400">
                        {model.releasedAt}
                      </span>
                    ) : null}
                  </label>
                ))}

                {filteredModels.length === 0 ? (
                  <p className="px-4 py-3 text-sm font-medium text-slate-500">
                    No models match this filter.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {selectedModel && models.length === 0 ? (
            <p className="text-sm font-medium text-slate-600">
              Current model: <span className="font-mono">{selectedModel}</span> —
              click Search Models to pick a different one.
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
            <Button
              type="button"
              onClick={saveSettings}
              disabled={saving || !selectedModel}
              className="h-11 rounded-xl !bg-emerald-600 !text-white hover:!bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Saving..." : "Save AI Settings"}
            </Button>

            {view?.configured ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  setNotice(null);
                  setApiKey("");
                  setModels([]);
                  switchProvider(view.provider);
                }}
                className="h-11 rounded-xl"
              >
                Cancel
              </Button>
            ) : null}

            <span className="text-xs font-medium text-slate-500">
              After saving, all AI features and the API Billing check use this
              provider and model.
            </span>
          </div>
        </section>
      )}
    </main>
  );
}
