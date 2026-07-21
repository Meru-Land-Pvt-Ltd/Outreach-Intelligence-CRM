"use client";

import { useRef, useState } from "react";
import { Download, FileUp, Upload, X } from "lucide-react";
import { apiPost } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/shared/notice";

type Channel = "Enoylity Technology" | "MHD Tech";

type ParsedLead = {
  email: string;
  firstName: string;
  companyName: string;
  productName: string;
  website: string;
  niche: string;
};

type ParseResult = {
  fileName: string;
  totalRows: number;
  leads: ParsedLead[];
  mapping: Array<{ field: string; header: string }>;
  missingEmailHeader: boolean;
  emptyEmailRows: number;
};

type ImportResult = {
  inserted: number;
  duplicates: number;
  invalid: number;
  invalidSamples: Array<{ email: string; reason: string }>;
};

const IMPORT_CHUNK_SIZE = 200;

// header aliases → lead field (all compared lowercased, spaces collapsed)
const HEADER_ALIASES: Record<string, string[]> = {
  email: [
    "email",
    "e-mail",
    "email address",
    "e-mail address",
    "mail",
    "work email",
    "contact email",
  ],
  firstName: [
    "first name",
    "firstname",
    "first",
    "name",
    "full name",
    "contact name",
    "contact",
  ],
  companyName: [
    "company",
    "company name",
    "brand",
    "brand name",
    "organization",
    "organisation",
    "account",
  ],
  productName: ["product", "product name"],
  website: ["website", "domain", "url", "company website", "site"],
  niche: ["niche", "category", "industry", "vertical"],
};

// Full-name style headers: keep only the first word for {{firstName}}.
const FULL_NAME_HEADERS = new Set(["name", "full name", "contact name", "contact"]);

const FIELD_LABELS: Record<string, string> = {
  email: "Email",
  firstName: "First Name",
  companyName: "Company",
  productName: "Product",
  website: "Website",
  niche: "Niche",
};

function normalizeHeader(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

// Minimal RFC 4180 parser: quoted fields, escaped quotes, CR/LF/CRLF, BOM.
function parseCsv(text: string): string[][] {
  const src = String(text || "").replace(/^\uFEFF/, "");
  const rows: string[][] = [];

  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];

    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => String(cell).trim() !== ""));
}

function buildParseResult(fileName: string, text: string): ParseResult {
  const grid = parseCsv(text);

  if (grid.length === 0) {
    return {
      fileName,
      totalRows: 0,
      leads: [],
      mapping: [],
      missingEmailHeader: true,
      emptyEmailRows: 0,
    };
  }

  const headers = grid[0].map(normalizeHeader);
  const columnField: Array<string | null> = headers.map((header) => {
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.includes(header)) return field;
    }
    return null;
  });

  const mapping: Array<{ field: string; header: string }> = [];
  const mappedFields = new Set<string>();

  columnField.forEach((field, index) => {
    // first matching column per field wins
    if (field && !mappedFields.has(field)) {
      mappedFields.add(field);
      mapping.push({ field, header: String(grid[0][index] || "").trim() });
    } else {
      columnField[index] = field && mappedFields.has(field) ? null : field;
    }
  });

  const missingEmailHeader = !mappedFields.has("email");
  const leads: ParsedLead[] = [];
  let emptyEmailRows = 0;

  for (let r = 1; r < grid.length; r++) {
    const lead: ParsedLead = {
      email: "",
      firstName: "",
      companyName: "",
      productName: "",
      website: "",
      niche: "",
    };

    columnField.forEach((field, index) => {
      if (!field) return;

      let value = String(grid[r][index] ?? "").trim();

      if (field === "firstName" && value) {
        const header = headers[index];
        if (FULL_NAME_HEADERS.has(header)) {
          value = value.split(/\s+/)[0];
        }
      }

      (lead as any)[field] = value;
    });

    if (!lead.email) {
      emptyEmailRows += 1;
      continue;
    }

    leads.push(lead);
  }

  return {
    fileName,
    totalRows: grid.length - 1,
    leads,
    mapping,
    missingEmailHeader,
    emptyEmailRows,
  };
}

function downloadSampleCsv() {
  const sample =
    "Email,First Name,Company Name,Product Name,Website,Niche\n" +
    "jane@acme.com,Jane,Acme Corp,Acme Smart Lamp,acme.com,Smart Home\n" +
    "mark@brightco.io,Mark,BrightCo,,brightco.io,AI Software / AI Tools\n";
  const blob = new Blob([sample], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "inbound-leads-sample.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function ImportLeadsDialog({
  open,
  channel,
  onClose,
  onImported,
}: {
  open: boolean;
  channel: Channel;
  onClose: () => void;
  onImported: (summary: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [parseError, setParseError] = useState("");
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState("");

  if (!open) return null;

  function resetState() {
    setParsed(null);
    setParseError("");
    setImporting(false);
    setProgress({ done: 0, total: 0 });
    setResult(null);
    setImportError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function close() {
    if (importing) return;
    resetState();
    onClose();
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
          'No email column found. The header row needs a column named "Email" (or "Email Address").'
        );
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

    const chunks: ParsedLead[][] = [];

    for (let i = 0; i < parsed.leads.length; i += IMPORT_CHUNK_SIZE) {
      chunks.push(parsed.leads.slice(i, i + IMPORT_CHUNK_SIZE));
    }

    setProgress({ done: 0, total: chunks.length });

    const totals: ImportResult = {
      inserted: 0,
      duplicates: 0,
      invalid: 0,
      invalidSamples: [],
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

      setProgress({ done: i + 1, total: chunks.length });
    }

    setImporting(false);
    setResult(totals);
  }

  function finish() {
    const summary = result
      ? `${result.inserted} lead(s) imported` +
        (result.duplicates ? `, ${result.duplicates} already existed` : "") +
        (result.invalid ? `, ${result.invalid} invalid skipped` : "") +
        "."
      : "";

    resetState();
    onImported(summary);
  }

  const previewRows = parsed ? parsed.leads.slice(0, 5) : [];

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close"
        onClick={close}
        className="absolute inset-0 bg-slate-950/40"
      />

      <aside className="absolute right-0 top-0 flex h-full w-full max-w-[640px] flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-lg font-bold text-slate-950">
              Import Inbound Leads — {channel}
            </h2>
            <p className="text-sm font-medium text-slate-500">
              Upload a CSV; leads land unpushed and go through the normal
              campaign flow (select → Create Campaign → preview → push).
            </p>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={close}
            disabled={importing}
            className="text-slate-500"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {result ? (
            <div className="space-y-4">
              <Notice
                type="success"
                text={`Import complete: ${result.inserted} imported, ${result.duplicates} already existed, ${result.invalid} invalid skipped.`}
              />

              {result.invalidSamples.length > 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-semibold text-amber-800">
                    Skipped examples:
                  </p>
                  <ul className="mt-1 space-y-0.5 text-xs text-amber-700">
                    {result.invalidSamples.map((sample, index) => (
                      <li key={index}>
                        {sample.email} — {sample.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <p className="text-sm text-slate-600">
                The imported leads are in the table with Found Via{" "}
                <span className="font-semibold">“CSV Import”</span>. Filter by
                it, select the leads, and hit Create Campaign — the preview and
                all push safety checks work exactly as usual.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0])}
                />

                <Button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                  className="h-10"
                >
                  <FileUp className="mr-2 h-4 w-4" />
                  {parsed ? "Choose a different file" : "Choose CSV file"}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={downloadSampleCsv}
                  disabled={importing}
                  className="h-10 text-slate-600"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Sample CSV
                </Button>
              </div>

              <p className="text-xs font-medium text-slate-500">
                Needs an <span className="font-semibold">Email</span> column.
                Optional: First Name, Company Name, Product Name, Website,
                Niche — other columns are ignored. Product falls back to
                “(Company) products”.
              </p>

              {parseError ? <Notice type="error" text={parseError} /> : null}
              {importError ? <Notice type="error" text={importError} /> : null}

              {parsed ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-sm font-semibold text-slate-900">
                      {parsed.fileName}
                    </p>
                    <p className="mt-0.5 text-xs font-medium text-slate-500">
                      {parsed.totalRows} data row(s) · {parsed.leads.length}{" "}
                      with an email
                      {parsed.emptyEmailRows > 0
                        ? ` · ${parsed.emptyEmailRows} without email skipped`
                        : ""}
                    </p>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {parsed.mapping.map((entry) => (
                        <span
                          key={entry.field}
                          className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200"
                        >
                          {FIELD_LABELS[entry.field] || entry.field} ←{" "}
                          {entry.header}
                        </span>
                      ))}
                    </div>
                  </div>

                  {previewRows.length > 0 ? (
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500">
                          <tr>
                            <th className="px-3 py-2 font-semibold">Email</th>
                            <th className="px-3 py-2 font-semibold">First</th>
                            <th className="px-3 py-2 font-semibold">Company</th>
                            <th className="px-3 py-2 font-semibold">Product</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {previewRows.map((lead, index) => (
                            <tr key={index}>
                              <td className="px-3 py-2">{lead.email}</td>
                              <td className="px-3 py-2">
                                {lead.firstName || "-"}
                              </td>
                              <td className="px-3 py-2">
                                {lead.companyName || "-"}
                              </td>
                              <td className="px-3 py-2">
                                {lead.productName || "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {parsed.leads.length > previewRows.length ? (
                        <p className="border-t border-slate-100 px-3 py-1.5 text-[11px] font-medium text-slate-400">
                          + {parsed.leads.length - previewRows.length} more
                          row(s)
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-6 py-4">
          {result ? (
            <Button type="button" onClick={finish} className="h-10 w-full">
              Done — show my leads
            </Button>
          ) : (
            <>
              <span className="text-xs font-medium text-slate-500">
                {importing
                  ? `Importing… batch ${progress.done}/${progress.total}`
                  : parsed
                    ? `${parsed.leads.length} lead(s) ready to import`
                    : "Pick a CSV file to begin"}
              </span>

              <Button
                type="button"
                onClick={runImport}
                disabled={!parsed || parsed.leads.length === 0 || importing}
                className="h-10 bg-blue-600 text-white hover:bg-blue-700"
              >
                <Upload className="mr-2 h-4 w-4" />
                {importing ? "Importing…" : "Import Leads"}
              </Button>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
