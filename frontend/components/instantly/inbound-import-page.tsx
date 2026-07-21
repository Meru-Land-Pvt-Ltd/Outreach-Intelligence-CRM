"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileUp,
  PencilLine,
  Send,
  Upload,
} from "lucide-react";
import { apiPost } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/shared/notice";
import { CreateCampaignDialog } from "@/components/instantly/create-campaign-dialog";
import {
  buildParseResult,
  downloadSampleCsv,
  looksLikeEmail,
  FIELD_LABELS,
  IMPORT_CHUNK_SIZE,
  type ParseResult,
} from "@/lib/csv-import";

type Channel = "Enoylity Technology" | "MHD Tech";

type ImportedLead = {
  _id: string;
  firstName: string;
  email: string;
  companyName: string;
  productName: string;
};

type ImportResult = {
  inserted: number;
  duplicates: number;
  invalid: number;
  invalidSamples: Array<{ email: string; reason: string }>;
  leads: ImportedLead[];
};

const CHANNELS: Array<{ value: Channel; slug: string; label: string; blurb: string }> = [
  {
    value: "Enoylity Technology",
    slug: "enoylity",
    label: "Enoylity Technology",
    blurb: "1M+ subscribers · Las Vegas, NV",
  },
  {
    value: "MHD Tech",
    slug: "mhd",
    label: "MHD Tech",
    blurb: "580K subscribers · Torrance, CA",
  },
];

const STEPS = ["Upload CSV", "Review Leads", "Import", "Create Campaign"];

function StepBar({ current }: { current: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-2">
      {STEPS.map((label, index) => {
        const done = index < current;
        const active = index === current;

        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
                done && "bg-emerald-100 text-emerald-700",
                active && "bg-blue-600 text-white",
                !done && !active && "bg-slate-100 text-slate-400"
              )}
            >
              {done ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
            </span>
            <span
              className={cn(
                "text-sm font-semibold",
                active ? "text-slate-950" : done ? "text-emerald-700" : "text-slate-400"
              )}
            >
              {label}
            </span>
            {index < STEPS.length - 1 ? (
              <span className="mx-1 h-px w-6 bg-slate-200" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

export function InboundImportPage({ initialChannel }: { initialChannel?: string }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [channel, setChannel] = useState<Channel>(
    initialChannel === "mhd" ? "MHD Tech" : "Enoylity Technology"
  );

  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [parseError, setParseError] = useState("");

  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState("");

  const [campaignOpen, setCampaignOpen] = useState(false);
  const [pushedNotice, setPushedNotice] = useState("");

  const step = result ? (campaignOpen ? 3 : 2) : parsed ? 1 : 0;
  const channelMeta = CHANNELS.find((c) => c.value === channel)!;

  const invalidPreviewCount = useMemo(
    () => (parsed ? parsed.leads.filter((l) => !looksLikeEmail(l.email)).length : 0),
    [parsed]
  );

  function resetAll() {
    setParsed(null);
    setParseError("");
    setImporting(false);
    setProgress({ done: 0, total: 0 });
    setResult(null);
    setImportError("");
    setPushedNotice("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleFile(file: File | undefined | null) {
    setParseError("");
    setResult(null);
    setImportError("");
    setParsed(null);

    if (!file) return;

    try {
      const text = await file.text();
      const outcome = buildParseResult(file.name, text);

      if (outcome.totalRows === 0) {
        setParseError("The file has no data rows.");
        return;
      }

      if (outcome.missingEmailHeader) {
        setParseError(
          'No email column found. The header row needs a column named "Email" (or "Email Address" / "POC Email").'
        );
        return;
      }

      if (outcome.leads.length === 0) {
        setParseError("Every row is missing an email value.");
        return;
      }

      setParsed(outcome);
    } catch {
      setParseError("Could not read the file. Please upload a .csv file.");
    }
  }

  async function runImport() {
    if (!parsed || parsed.leads.length === 0 || importing) return;

    setImporting(true);
    setImportError("");

    const chunks = [] as (typeof parsed.leads)[];

    for (let i = 0; i < parsed.leads.length; i += IMPORT_CHUNK_SIZE) {
      chunks.push(parsed.leads.slice(i, i + IMPORT_CHUNK_SIZE));
    }

    setProgress({ done: 0, total: chunks.length });

    const totals: ImportResult = {
      inserted: 0,
      duplicates: 0,
      invalid: 0,
      invalidSamples: [],
      leads: [],
    };

    for (let i = 0; i < chunks.length; i++) {
      const response: any = await apiPost("/instantly/import-leads", {
        channel,
        leads: chunks[i],
      });

      if (!response?.success) {
        setImportError(response?.message || "Import failed.");
        setImporting(false);
        return;
      }

      totals.inserted += Number(response.inserted || 0);
      totals.duplicates += Number(response.duplicates || 0);
      totals.invalid += Number(response.invalid || 0);

      for (const sample of response.invalidSamples || []) {
        if (totals.invalidSamples.length < 10) totals.invalidSamples.push(sample);
      }

      for (const lead of response.leads || []) {
        if (lead?._id) totals.leads.push(lead);
      }

      setProgress({ done: i + 1, total: chunks.length });
    }

    setImporting(false);
    setResult(totals);
  }

  const campaignsHref = `/instantly-campaigns/campaigns/${channelMeta.slug}`;
  const channelTableHref =
    channelMeta.slug === "mhd" ? "/mhd-instantly" : "/enoylity-instantly";

  return (
    <main className="w-full space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            Inbound Import
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Upload a CSV of inbound leads, review them, then push a campaign
            with the Inbound template — the same preview and safety checks as
            every other campaign.
          </p>
        </div>

        <StepBar current={step} />
      </div>

      {pushedNotice ? <Notice type="success" text={pushedNotice} /> : null}

      {/* Channel + upload */}
      <section className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-950">1 · Channel</h2>

          <div className="space-y-2">
            {CHANNELS.map((option) => (
              <button
                key={option.value}
                type="button"
                disabled={importing || Boolean(result)}
                onClick={() => setChannel(option.value)}
                className={cn(
                  "w-full rounded-xl border px-4 py-3 text-left transition",
                  channel === option.value
                    ? "border-blue-500 bg-blue-50/60 ring-1 ring-blue-500"
                    : "border-slate-200 bg-white hover:border-slate-300",
                  (importing || result) && "opacity-60"
                )}
              >
                <p className="text-sm font-bold text-slate-950">{option.label}</p>
                <p className="text-xs font-medium text-slate-500">{option.blurb}</p>
              </button>
            ))}
          </div>

          <div className="rounded-xl bg-slate-50 p-3 text-xs font-medium leading-5 text-slate-500">
            Campaigns from this page use the{" "}
            <span className="font-bold text-slate-700">Inbound template</span>{" "}
            (a warm reply for people who contacted you). Crawled-lead campaigns
            keep using the Outbound template.
            <button
              type="button"
              onClick={() =>
                router.push(`/instantly-campaigns/template/${channelMeta.slug}`)
              }
              className="ml-1 inline-flex items-center font-bold text-blue-600 hover:underline"
            >
              <PencilLine className="mr-0.5 h-3 w-3" />
              Edit templates
            </button>
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-950">2 · CSV file</h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={downloadSampleCsv}
              className="h-8 text-slate-600"
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Sample CSV
            </Button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />

          <button
            type="button"
            disabled={importing}
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/60 px-6 py-10 text-center transition hover:border-blue-400 hover:bg-blue-50/40"
          >
            <FileUp className="h-8 w-8 text-slate-400" />
            <span className="text-sm font-semibold text-slate-700">
              {parsed ? parsed.fileName : "Click to choose a CSV file"}
            </span>
            <span className="text-xs font-medium text-slate-500">
              Needs an Email column · optional: POC / First Name, Company,
              Product, Website, Niche
            </span>
          </button>

          {parseError ? <Notice type="error" text={parseError} /> : null}
        </div>
      </section>

      {/* Review */}
      {parsed && !result ? (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-950">3 · Review</h2>
              <p className="mt-0.5 text-xs font-medium text-slate-500">
                {parsed.totalRows} data row(s) · {parsed.leads.length} with an
                email
                {parsed.emptyEmailRows > 0
                  ? ` · ${parsed.emptyEmailRows} without email skipped`
                  : ""}
                {invalidPreviewCount > 0
                  ? ` · ${invalidPreviewCount} look invalid (skipped at import)`
                  : ""}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500">
                {importing
                  ? `Importing… batch ${progress.done}/${progress.total}`
                  : `${parsed.leads.length} lead(s) ready`}
              </span>
              <Button
                type="button"
                onClick={runImport}
                disabled={importing}
                className="h-10 bg-blue-600 text-white hover:bg-blue-700"
              >
                <Upload className="mr-2 h-4 w-4" />
                {importing ? "Importing…" : `Import into ${channelMeta.label}`}
              </Button>
            </div>
          </div>

          {importError ? <Notice type="error" text={importError} /> : null}

          <div className="flex flex-wrap gap-1.5">
            {parsed.mapping.map((entry) => (
              <span
                key={entry.field}
                className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600"
              >
                {FIELD_LABELS[entry.field] || entry.field} ← {entry.header}
              </span>
            ))}
            {parsed.unmappedHeaders.map((header) => (
              <span
                key={`skip-${header}`}
                title="Column ignored"
                className="rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-400 line-through"
              >
                {header}
              </span>
            ))}
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-semibold">#</th>
                  <th className="px-3 py-2 font-semibold">Email</th>
                  <th className="px-3 py-2 font-semibold">First Name</th>
                  <th className="px-3 py-2 font-semibold">Company</th>
                  <th className="px-3 py-2 font-semibold">Product</th>
                  <th className="px-3 py-2 font-semibold">Website</th>
                  <th className="px-3 py-2 font-semibold">Niche</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {parsed.leads.slice(0, 100).map((lead, index) => {
                  const bad = !looksLikeEmail(lead.email);

                  return (
                    <tr key={index} className={bad ? "bg-rose-50/60" : undefined}>
                      <td className="px-3 py-2 text-slate-400">{index + 1}</td>
                      <td className={cn("px-3 py-2", bad && "font-semibold text-rose-600")}>
                        {lead.email}
                      </td>
                      <td className="px-3 py-2">{lead.firstName || "-"}</td>
                      <td className="px-3 py-2">{lead.companyName || "-"}</td>
                      <td className="px-3 py-2">{lead.productName || "-"}</td>
                      <td className="px-3 py-2">{lead.website || "-"}</td>
                      <td className="px-3 py-2">{lead.niche || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {parsed.leads.length > 100 ? (
              <p className="border-t border-slate-100 px-3 py-1.5 text-[11px] font-medium text-slate-400">
                + {parsed.leads.length - 100} more row(s)
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* Import result + campaign */}
      {result ? (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-950">4 · Create Campaign</h2>

          <Notice
            type="success"
            text={`Import complete: ${result.inserted} imported, ${result.duplicates} already existed, ${result.invalid} invalid skipped. ${result.leads.length} lead(s) from this file are ready for a campaign.`}
          />

          {result.invalidSamples.length > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold text-amber-800">Skipped examples:</p>
              <ul className="mt-1 space-y-0.5 text-xs text-amber-700">
                {result.invalidSamples.map((sample, index) => (
                  <li key={index}>
                    {sample.email} — {sample.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              disabled={result.leads.length === 0}
              onClick={() => setCampaignOpen(true)}
              className="h-11 bg-blue-600 text-white hover:bg-blue-700"
            >
              <Send className="mr-2 h-4 w-4" />
              Create Inbound Campaign ({result.leads.length})
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(channelTableHref)}
              className="h-11"
            >
              View in {channelMeta.label} table
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={resetAll}
              className="h-11 text-slate-600"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Import another file
            </Button>
          </div>

          <p className="text-xs font-medium leading-5 text-slate-500">
            The campaign uses the <span className="font-bold">Inbound</span>{" "}
            template for {channelMeta.label}. You still get the full preview —
            eligible leads, rejections with reasons, and per-lead rendered
            emails — before anything is pushed.
          </p>
        </section>
      ) : null}

      <CreateCampaignDialog
        open={campaignOpen}
        channel={channel}
        templateType="inbound"
        leads={result?.leads || []}
        onClose={() => setCampaignOpen(false)}
        onPushed={(campaignId) => {
          setCampaignOpen(false);
          setPushedNotice(
            "Campaign pushed with the Inbound template. Redirecting to campaigns…"
          );
          if (campaignId) {
            router.push(campaignsHref);
          }
        }}
      />
    </main>
  );
}
