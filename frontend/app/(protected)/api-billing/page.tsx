"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { apiGet } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type ProviderReport = {
  provider: string;
  label: string;
  status:
    | "ok"
    | "low"
    | "exhausted"
    | "invalid_key"
    | "not_configured"
    | "error";
  detail: string;
  credits?: Record<string, any>;
  checkedAt: string;
};

const STATUS_META: Record<
  ProviderReport["status"],
  { label: string; className: string; dot: string }
> = {
  ok: {
    label: "OK — recharged",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
  },
  low: {
    label: "Low credits",
    className: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
  },
  exhausted: {
    label: "Out of credits",
    className: "bg-rose-50 text-rose-700 border-rose-200",
    dot: "bg-rose-500",
  },
  invalid_key: {
    label: "Invalid API key",
    className: "bg-rose-50 text-rose-700 border-rose-200",
    dot: "bg-rose-500",
  },
  not_configured: {
    label: "Not configured",
    className: "bg-slate-100 text-slate-600 border-slate-200",
    dot: "bg-slate-400",
  },
  error: {
    label: "Check failed",
    className: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
  },
};

function formatTime(value?: string) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function CreditRows({ credits }: { credits?: Record<string, any> }) {
  if (!credits) return null;

  const rows: Array<[string, string]> = [];

  if (typeof credits.credits === "number") {
    rows.push(["Credits remaining", String(credits.credits)]);
  }
  if (credits.plan) rows.push(["Plan", String(credits.plan)]);
  if (credits.searchesAvailable !== undefined) {
    rows.push([
      "Searches",
      `${credits.searchesUsed || 0} used / ${credits.searchesAvailable || 0}`,
    ]);
  }
  if (credits.verificationsAvailable !== undefined) {
    rows.push([
      "Verifications",
      `${credits.verificationsUsed || 0} used / ${credits.verificationsAvailable || 0}`,
    ]);
  }
  if (typeof credits.remaining_credits === "number") {
    rows.push(["Credits remaining", String(credits.remaining_credits)]);
  }
  if (credits.resetDate) rows.push(["Resets", String(credits.resetDate)]);

  if (Array.isArray(credits.keys)) {
    for (const item of credits.keys) {
      rows.push([`Key ${item.key}`, item.status]);
    }
  }

  if (rows.length === 0) return null;

  return (
    <dl className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-center justify-between gap-3">
          <dt className="text-xs font-semibold text-slate-500">{label}</dt>
          <dd className="text-xs font-bold text-slate-800">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function ApiBillingPage() {
  const [reports, setReports] = useState<ProviderReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cachedAt, setCachedAt] = useState("");

  async function load(refresh = false) {
    if (refresh) setRefreshing(true);
    else setLoading(true);

    const response: any = await apiGet(
      `/billing/status${refresh ? "?refresh=1" : ""}`
    );

    setReports(response?.data || []);
    setCachedAt(response?.cachedAt || "");
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    load();
  }, []);

  const problems = reports.filter((r) =>
    ["exhausted", "invalid_key"].includes(r.status)
  );

  return (
    <main className="w-full space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            API Billing &amp; Credits
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Live recharge status for every external API the pipeline uses.
            {cachedAt ? ` Last checked ${formatTime(cachedAt)}.` : ""}
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          disabled={refreshing || loading}
          onClick={() => load(true)}
          className="h-11 rounded-xl"
        >
          <RefreshCw
            className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")}
          />
          {refreshing ? "Checking…" : "Re-check now"}
        </Button>
      </div>

      {problems.length > 0 ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
          {problems.length} provider(s) need attention:{" "}
          {problems.map((p) => p.label).join(", ")} — crawls and discovery that
          depend on them will fail until recharged.
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm font-medium text-slate-500">
          Checking every provider… this fires live probes and can take ~10
          seconds.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {reports.map((r) => {
            const meta = STATUS_META[r.status] || STATUS_META.error;

            return (
              <div
                key={r.provider}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-base font-bold text-slate-950">
                    {r.label}
                  </h2>
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
                      meta.className
                    )}
                  >
                    <span className={cn("h-2 w-2 rounded-full", meta.dot)} />
                    {meta.label}
                  </span>
                </div>

                <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
                  {r.detail}
                </p>

                <CreditRows credits={r.credits} />

                <p className="mt-3 text-[11px] font-medium text-slate-400">
                  Checked {formatTime(r.checkedAt)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
