"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CalendarDays,
  ChevronDown,
  Eye,
  Send,
  UploadCloud,
  Users,
  X,
} from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InstantlyTabs } from "@/components/instantly/instantly-tabs";

type Channel = "Enoylity Technology" | "MHD Tech";

type MessageType = "info" | "success" | "error";

type ImportedLead = {
  _id?: string;
  firstName?: string;
  email?: string;
  companyName?: string;
  productName?: string;
  relatedVideo?: string;
  competitor1?: string;
  competitor2?: string;
  pushedStatus?: string;
  verificationStatus?: string;
  instantlyBounced?: string;
  instantlyBounceStatus?: string;
  bouncedStatus?: string;
  bounceStatus?: string;
  gatewayBounced?: string;
  isBounced?: boolean;
  bounceReason?: string;
  bouncedAt?: string;
  raw?: Record<string, any>;
};

type TemplatePreview = {
  lead?: ImportedLead;
  subject?: string;
  body?: string;
  followUp1?: string;
  followUp2?: string;
};

type ExportResult = {
  success?: boolean;
  exported?: number;
  exportedRows?: number;
  updated?: number;
  updatedExistingUnpushed?: number;
  skippedAlreadyExported?: number;
  skippedPushedLeads?: number;
  contactsNormalized?: number;
  contactsFixed?: number;
  verifiedContacts?: number;
  skippedInvalidVerification?: number;
  competitorsUpdated?: number;
  pendingVerified?: number;
  pendingRejected?: number;
  bouncedRowsUpdated?: number;
};

type ExportStatusResponse = {
  success?: boolean;
  jobId?: string;
  status?: "running" | "completed" | "failed" | "unknown";
  message?: string;
  error?: string;
  result?: ExportResult;
  progress?: {
    totalBrands?: number;
    processedBrands?: number;
    processedContacts?: number;
    newRows?: number;
    updatedExistingUnpushed?: number;
    skippedAlreadyPushed?: number;
    verifiedContacts?: number;
    skippedInvalidVerification?: number;
    competitorsCompanies?: number;
    competitorsUpdated?: number;
    pendingVerified?: number;
    pendingRejected?: number;
    bouncedRowsUpdated?: number;
  };
};

const CHANNELS: Channel[] = ["Enoylity Technology", "MHD Tech"];

const FALLBACK_SENDERS: Record<Channel, string[]> = {
  "Enoylity Technology": [
    "ava@enoylity.com",
    "ella@enoylityteam.com",
    "grace@enoylitycreator.com",
    "julia@enoylitymedia.com",
    "sarah@enoylitypartner.com",
    "elon@enoylityteam.com",
    "jeff@enoylitypartner.com",
    "bill@enoylitymedia.com",
    "jacob@enoylitycreator.com",
    "emma@enoylityconnect.com",
  ],
  "MHD Tech": [
    "partnership@mhdtechpro.com",
    "baker@mhdtechstudio.com",
    "harris@mhdtechcollab.com",
    "nina@mhdtechcollaboration.com",
    "olivia@mhdtechreview.com",
    "barack@mhdtechreview.com",
    "larry@mhdtechcollab.com",
    "kate@mhdtechkol.com",
    "mark@mhdtechcollaboration.com",
    "michael@mhdtechstudio.com",
  ],
};

function today() {
  return new Date().toISOString().substring(0, 10);
}

function plusDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().substring(0, 10);
}

function clean(value: any) {
  return String(value || "").trim();
}

const NEGATIVE_BOUNCE_VALUES = [
  "not bounced",
  "not-bounced",
  "no",
  "false",
  "0",
  "-",
  "none",
  "safe",
  "ok",
];

function getInstantlyBouncedStatus(lead: ImportedLead) {
  const raw = lead.raw || {};

  const candidates = [
    lead.instantlyBounced,
    lead.instantlyBounceStatus,
    lead.bouncedStatus,
    lead.bounceStatus,
    raw.instantlyBounced,
    raw.instantlyBounceStatus,
    raw.bouncedStatus,
    raw.bounceStatus,
  ];

  let bounced = false;
  let reason = clean(lead.bounceReason || raw.bounceReason);

  for (const candidate of candidates) {
    const value = clean(candidate);

    if (!value) continue;

    const lower = value.toLowerCase();

    if (NEGATIVE_BOUNCE_VALUES.includes(lower)) continue;

    if (lower.includes("bounce") || ["yes", "true", "1"].includes(lower)) {
      bounced = true;

      if (!reason) {
        const embedded = value.match(/^bounced?\s*[-:]\s*(.+)$/i);
        if (embedded) reason = embedded[1].trim();
      }
    }
  }

  if (!bounced && (lead.isBounced === true || raw.isBounced === true)) {
    bounced = true;
  }

  if (!bounced && clean(lead.bouncedAt || raw.bouncedAt || raw.instantlyBouncedAt)) {
    bounced = true;
  }

  if (!bounced) return "Not bounced";

  return reason ? `Bounced - ${reason}` : "Bounced";
}

function toChannel(value: string): Channel {
  return value === "MHD Tech" ? "MHD Tech" : "Enoylity Technology";
}

function stripHtml(value?: string) {
  return clean(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function getLeadKey(lead: ImportedLead, index: number) {
  return lead._id || lead.email || String(index);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getExportNumber(result: ExportResult | undefined, keys: string[]) {
  if (!result) return 0;

  for (const key of keys) {
    const value = Number((result as any)[key] || 0);

    if (Number.isFinite(value) && value > 0) {
      return value;
    }
  }

  return 0;
}

function buildExportSuccessMessage(result: ExportResult | undefined) {
  const newRows = getExportNumber(result, ["exported", "exportedRows"]);
  const updatedExistingUnpushed = getExportNumber(result, [
    "updatedExistingUnpushed",
    "updated",
  ]);
  const skippedAlreadyPushed = getExportNumber(result, [
    "skippedAlreadyExported",
    "skippedPushedLeads",
  ]);
  const contactsFixed = getExportNumber(result, [
    "contactsNormalized",
    "contactsFixed",
  ]);
  const verifiedContacts = getExportNumber(result, ["verifiedContacts"]);
  const skippedInvalid = getExportNumber(result, ["skippedInvalidVerification"]);
  const competitorsUpdated = getExportNumber(result, ["competitorsUpdated"]);
  const pendingVerified = getExportNumber(result, ["pendingVerified"]);
  const bouncedRowsUpdated = getExportNumber(result, ["bouncedRowsUpdated"]);

  return (
    "Export complete. Backend checks also ran automatically. New rows: " +
    newRows +
    ", updated existing unpushed: " +
    updatedExistingUnpushed +
    ", verified during export: " +
    verifiedContacts +
    ", pending verified: " +
    pendingVerified +
    ", skipped invalid: " +
    skippedInvalid +
    ", competitor rows updated: " +
    competitorsUpdated +
    ", bounced rows updated: " +
    bouncedRowsUpdated +
    ", skipped already pushed: " +
    skippedAlreadyPushed +
    ", contacts fixed: " +
    contactsFixed
  );
}

function buildExportProgressMessage(statusResponse: ExportStatusResponse) {
  const progress = statusResponse.progress || {};
  const processedBrands = Number(progress.processedBrands || 0);
  const totalBrands = Number(progress.totalBrands || 0);
  const processedContacts = Number(progress.processedContacts || 0);
  const newRows = Number(progress.newRows || 0);
  const updatedRows = Number(progress.updatedExistingUnpushed || 0);
  const verified = Number(progress.verifiedContacts || 0);
  const competitorRows = Number(progress.competitorsUpdated || 0);
  const bouncedRows = Number(progress.bouncedRowsUpdated || 0);

  const brandPart = totalBrands
    ? `Brands ${processedBrands}/${totalBrands}`
    : "Preparing brands";

  return `${statusResponse.message || "Export is running..."} ${brandPart}, contacts scanned ${processedContacts}, verified ${verified}, new rows ${newRows}, updated ${updatedRows}, competitors updated ${competitorRows}, bounced updated ${bouncedRows}.`;
}

function FieldLabel({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div>
      <h2 className="text-base font-bold text-slate-950">{title}</h2>

      {description ? (
        <p className="mt-1 text-sm font-medium text-slate-500">
          {description}
        </p>
      ) : null}
    </div>
  );
}

function ChannelSelect({
  value,
  onChange,
}: {
  value: Channel;
  onChange: (value: Channel) => void;
}) {
  return (
    <Select value={value} onValueChange={(item) => onChange(toChannel(item))}>
      <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white text-sm font-medium shadow-none focus:ring-4 focus:ring-blue-50">
        <SelectValue placeholder="Select channel" />
      </SelectTrigger>

      <SelectContent>
        {CHANNELS.map((channel) => (
          <SelectItem key={channel} value={channel}>
            {channel}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SenderDropdown({
  label,
  senders,
  selected,
  onChange,
}: {
  label: string;
  senders: string[];
  selected: string[];
  onChange: (value: string[]) => void;
}) {
  const [open, setOpen] = useState(false);

  function toggleSender(email: string) {
    if (selected.includes(email)) {
      onChange(selected.filter((item) => item !== email));
      return;
    }

    onChange([...selected, email]);
  }

  return (
    <div className="relative space-y-1.5">
      <span className="text-xs font-semibold text-slate-500">{label}</span>

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-10 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 text-left text-sm font-medium text-slate-800 transition focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-50"
      >
        <span className="truncate">
          {selected.length > 0
            ? `${selected.length} sender${selected.length > 1 ? "s" : ""
            } selected`
            : "Select sender emails"}
        </span>

        <ChevronDown className="h-4 w-4 text-slate-400" />
      </button>

      {open ? (
        <div className="absolute z-30 mt-2 max-h-72 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
          <div className="mb-2 grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onChange(senders)}
              className="h-8 rounded-lg text-xs"
            >
              Select All
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onChange([])}
              className="h-8 rounded-lg text-xs"
            >
              Clear
            </Button>
          </div>

          <div className="space-y-1">
            {senders.map((email) => (
              <label
                key={email}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-slate-700 hover:bg-blue-50"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(email)}
                  onChange={() => toggleSender(email)}
                  className="h-4 w-4 rounded border-slate-300"
                />

                <span className="truncate">{email}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ActionMessage({
  type,
  message,
}: {
  type: MessageType;
  message: string;
}) {
  if (!message) return null;

  const classes =
    type === "success"
      ? "border-emerald-100 bg-emerald-50 text-emerald-700"
      : type === "error"
        ? "border-rose-100 bg-rose-50 text-rose-700"
        : "border-blue-100 bg-blue-50 text-blue-700";

  return (
    <div
      className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${classes}`}
    >
      {message}
    </div>
  );
}

function TemplatePreviewSideModal({
  open,
  preview,
  loading,
  lead,
  onClose,
}: {
  open: boolean;
  preview: TemplatePreview | null;
  loading: boolean;
  lead: ImportedLead | null;
  onClose: () => void;
}) {
  if (!open) return null;

  const previewLead = preview?.lead || lead;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close preview overlay"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/35"
      />

      <aside className="absolute right-0 top-0 flex h-full w-full max-w-[620px] flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                <Eye className="h-4 w-4" />
              </span>

              <div>
                <h2 className="text-lg font-bold text-slate-950">
                  Template Preview
                </h2>

                <p className="text-sm font-medium text-slate-500">
                  Preview for selected imported lead
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm font-semibold text-slate-500">
              Loading preview...
            </div>
          ) : !preview ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm font-semibold text-slate-500">
              No preview found for this lead.
            </div>
          ) : (
            <div className="space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Matching Lead
                </p>

                <p className="mt-2 text-sm font-bold text-slate-950">
                  {previewLead?.firstName || "-"} · {previewLead?.email || "-"}
                </p>

                <p className="mt-1 text-sm font-medium text-slate-600">
                  {previewLead?.companyName || "-"} ·{" "}
                  {previewLead?.productName || "-"}
                </p>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Subject
                </p>

                <p className="mt-2 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-900">
                  {preview.subject || "-"}
                </p>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Body
                </p>

                <pre className="mt-2 max-h-[360px] overflow-auto whitespace-pre-wrap rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700">
                  {stripHtml(preview.body) || "-"}
                </pre>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Follow Up 1
                </p>

                <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700">
                  {stripHtml(preview.followUp1) || "-"}
                </pre>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Follow Up 2
                </p>

                <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700">
                  {stripHtml(preview.followUp2) || "-"}
                </pre>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function ImportedLeadsTable({
  leads,
  loading,
  loadingPreview,
  selectedPreviewKey,
  onRefresh,
  onCheckPreview,
}: {
  leads: ImportedLead[];
  loading: boolean;
  loadingPreview: boolean;
  selectedPreviewKey: string;
  onRefresh: () => void;
  onCheckPreview: (lead: ImportedLead, index: number) => void;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-950">
              Imported Leads
            </h2>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1150px] w-full border-separate border-spacing-0">
          <thead>
            <tr className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
              {[
                "First Name",
                "Email",
                "Company",
                "Product",
                "Verification",
                "Pushed",
                "Instantly Bounced",
                "Gateway",
                "Preview",
              ].map((head) => (
                <th
                  key={head}
                  className="border-b border-slate-200 px-4 py-3 whitespace-nowrap"
                >
                  {head}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-10 text-center text-sm font-semibold text-slate-500"
                >
                  Loading imported leads...
                </td>
              </tr>
            ) : leads.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-10 text-center text-sm font-semibold text-slate-500"
                >
                  No imported leads found. Click Export Leads first.
                </td>
              </tr>
            ) : (
              leads.map((lead, index) => {
                const leadKey = getLeadKey(lead, index);
                const isPreviewing =
                  selectedPreviewKey === leadKey && loadingPreview;

                return (
                  <tr
                    key={leadKey}
                    className={
                      selectedPreviewKey === leadKey
                        ? "bg-blue-50/40"
                        : "hover:bg-slate-50/70"
                    }
                  >
                    <td className="border-b border-slate-100 px-4 py-4 text-sm font-semibold text-slate-800">
                      {lead.firstName || "-"}
                    </td>

                    <td className="border-b border-slate-100 px-4 py-4 text-sm font-medium text-slate-700">
                      {lead.email || "-"}
                    </td>

                    <td className="border-b border-slate-100 px-4 py-4 text-sm text-slate-700">
                      {lead.companyName || "-"}
                    </td>

                    <td className="border-b border-slate-100 px-4 py-4 text-sm text-slate-700">
                      {lead.productName || "-"}
                    </td>

                    <td className="border-b border-slate-100 px-4 py-4 text-sm font-semibold text-slate-700">
                      {lead.verificationStatus || "-"}
                    </td>

                    <td className="border-b border-slate-100 px-4 py-4 text-sm text-slate-700">
                      {lead.pushedStatus || "-"}
                    </td>

                    <td className="border-b border-slate-100 px-4 py-4 text-sm text-slate-700">
                      {getInstantlyBouncedStatus(lead)}
                    </td>

                    <td className="border-b border-slate-100 px-4 py-4 text-sm text-slate-700">
                      {lead.gatewayBounced || "-"}
                    </td>

                    <td className="border-b border-slate-100 px-4 py-4">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!lead.email || isPreviewing}
                        onClick={() => onCheckPreview(lead, index)}
                        className="h-8 rounded-lg !border-blue-200 !text-blue-700 hover:!bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Eye className="mr-1.5 h-3.5 w-3.5" />
                        {isPreviewing ? "Checking..." : "Check Preview"}
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function InstantlyControlPanelPage() {
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<MessageType>("info");
  const [loadingAction, setLoadingAction] = useState("");
  const [leadsExported, setLeadsExported] = useState(false);
  const [resetArmed, setResetArmed] = useState(false);

  const [senderOptions, setSenderOptions] = useState<Record<Channel, string[]>>({
    "Enoylity Technology": FALLBACK_SENDERS["Enoylity Technology"],
    "MHD Tech": FALLBACK_SENDERS["MHD Tech"],
  });

  const [importedLeads, setImportedLeads] = useState<ImportedLead[]>([]);
  const [templatePreview, setTemplatePreview] =
    useState<TemplatePreview | null>(null);

  const [loadingLeads, setLoadingLeads] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [selectedPreviewKey, setSelectedPreviewKey] = useState("");
  const [selectedPreviewLead, setSelectedPreviewLead] =
    useState<ImportedLead | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const [pushForm, setPushForm] = useState({
    channel: "Enoylity Technology" as Channel,
    campaignName: "Outreach Campaign " + today(),
    numLeads: "160",
    startDate: today(),
    endDate: plusDays(14),
    startTime: "09:00",
    endTime: "16:00",
    dailyLimit: "160",
    selectedSenders: FALLBACK_SENDERS["Enoylity Technology"],
  });

  const [batchForm, setBatchForm] = useState({
    channel: "Enoylity Technology" as Channel,
    numLeads: "160",
    startDate: today(),
    startTime: "09:00",
    endTime: "16:00",
    dailyLimit: "160",
    numWeekdays: "3",
    selectedSenders: FALLBACK_SENDERS["Enoylity Technology"],
  });

  const busy = Boolean(loadingAction);
  const hasPreparedLeads = importedLeads.length > 0;

  const pushSenders = senderOptions[pushForm.channel] || [];
  const batchSenders = senderOptions[batchForm.channel] || [];

  const pushDisabled =
    busy || !hasPreparedLeads || pushForm.selectedSenders.length === 0;

  const batchDisabled =
    busy || !hasPreparedLeads || batchForm.selectedSenders.length === 0;

  const pushCapacity = useMemo(() => {
    return (
      Number(pushForm.dailyLimit || 0) *
      Math.max(pushForm.selectedSenders.length, 0)
    );
  }, [pushForm.dailyLimit, pushForm.selectedSenders.length]);

  const batchCapacity = useMemo(() => {
    return (
      Number(batchForm.dailyLimit || 0) *
      Math.max(batchForm.selectedSenders.length, 0)
    );
  }, [batchForm.dailyLimit, batchForm.selectedSenders.length]);


  async function loadSenders(channel: Channel) {
    try {
      const response = await apiGet(
        `/instantly/senders?channel=${encodeURIComponent(channel)}`
      );

      const senders = Array.isArray(response?.data)
        ? response.data
        : response?.senders || [];

      if (senders.length > 0) {
        setSenderOptions((current) => ({
          ...current,
          [channel]: senders,
        }));

        return senders;
      }
    } catch {
      // fallback senders remain available
    }

    return FALLBACK_SENDERS[channel];
  }

  async function loadImportedLeads(channel: Channel) {
    setLoadingLeads(true);

    try {
      const response = await apiGet(
        `/instantly/imported-leads?channel=${encodeURIComponent(
          channel
        )}&limit=5`
      );

      const rows = response?.data || response?.leads || [];
      const visibleRows = Array.isArray(rows) ? rows.slice(0, 5) : [];
      setImportedLeads(visibleRows);
      setLeadsExported(visibleRows.length > 0);
    } catch {
      setImportedLeads([]);
      setLeadsExported(false);
    }

    setLoadingLeads(false);
  }

  async function checkLeadPreview(lead: ImportedLead, index: number) {
    const leadKey = getLeadKey(lead, index);

    setSelectedPreviewKey(leadKey);
    setSelectedPreviewLead(lead);
    setTemplatePreview(null);
    setPreviewOpen(true);
    setLoadingPreview(true);

    try {
      const params = new URLSearchParams({
        channel: pushForm.channel,
      });

      if (lead._id) params.set("leadId", lead._id);
      if (lead.email) params.set("email", lead.email);

      const response = await apiGet(
        `/instantly/template-preview?${params.toString()}`
      );

      setTemplatePreview(response?.data || response?.preview || null);
    } catch {
      setTemplatePreview(null);
    }

    setLoadingPreview(false);
  }

  useEffect(() => {
    loadSenders("Enoylity Technology");
    loadSenders("MHD Tech");
    loadImportedLeads(pushForm.channel);
  }, []);

  async function runAction(
    actionName: string,
    handler: () => Promise<{ success?: boolean; message?: string }>
  ) {
    setLoadingAction(actionName);
    setMessageType("info");
    setMessage(actionName + " started...");

    try {
      const response = await handler();

      if (response?.success) {
        setMessageType("success");
        setMessage(response.message || actionName + " completed successfully.");
      } else {
        setMessageType("error");
        setMessage(response?.message || actionName + " failed.");
      }
    } catch (error: any) {
      setMessageType("error");
      setMessage(error?.message || actionName + " failed.");
    }

    setLoadingAction("");
  }

  const EXPORT_POLL_MAX_ATTEMPTS = 60;
  const EXPORT_POLL_INTERVAL_MS = 3000;
  const EXPORT_POLL_MAX_MISSES = 5;

  const EXPORT_BACKGROUND_MESSAGE =
    "Export started in background. Please refresh after some time.";

  type ExportWaitOutcome = {
    status: "completed" | "failed" | "background";
    result?: ExportResult;
    message?: string;
  };

  async function waitForExportJob(jobId: string): Promise<ExportWaitOutcome> {
    let consecutiveMisses = 0;

    for (let attempt = 0; attempt < EXPORT_POLL_MAX_ATTEMPTS; attempt += 1) {
      await sleep(EXPORT_POLL_INTERVAL_MS);

      const statusResponse = (await apiGet(
        `/instantly/export/status/${encodeURIComponent(jobId)}`
      )) as ExportStatusResponse | null;

      if (!statusResponse) {
        consecutiveMisses += 1;

        if (consecutiveMisses >= EXPORT_POLL_MAX_MISSES) {
          return {
            status: "background",
            message:
              "Export status is unavailable right now. " +
              EXPORT_BACKGROUND_MESSAGE,
          };
        }

        continue;
      }

      consecutiveMisses = 0;

      if (statusResponse.status === "running") {
        setMessageType("info");
        setMessage(buildExportProgressMessage(statusResponse));
        continue;
      }

      if (statusResponse.status === "failed") {
        return {
          status: "failed",
          message:
            statusResponse.error || statusResponse.message || "Export failed.",
        };
      }

      if (statusResponse.status === "completed") {
        return { status: "completed", result: statusResponse.result || {} };
      }

      // "unknown" or any unexpected status: stop polling gracefully.
      return {
        status: "background",
        message: statusResponse.message || EXPORT_BACKGROUND_MESSAGE,
      };
    }

    return {
      status: "background",
      message: "Export is still running. " + EXPORT_BACKGROUND_MESSAGE,
    };
  }

  async function exportLeads() {
    setLoadingAction("Export Leads");
    setMessageType("info");
    setMessage("Export Leads started...");

    try {
      const response: any = await apiPost("/instantly/export", {});

      let result: ExportResult | undefined;

      if (response?.jobId) {
        setMessageType("info");
        setMessage(response?.message || "Export is running in background...");

        const outcome = await waitForExportJob(response.jobId);

        if (outcome.status === "failed") {
          setMessageType("error");
          setMessage(outcome.message || "Export Leads failed.");
          setLoadingAction("");
          return;
        }

        if (outcome.status === "background") {
          await loadImportedLeads(pushForm.channel);
          setMessageType("info");
          setMessage(outcome.message || EXPORT_BACKGROUND_MESSAGE);
          setLoadingAction("");
          return;
        }

        result = outcome.result;
      } else if (response?.success) {
        result = response;
      } else {
        setMessageType("error");
        setMessage(response?.message || "Export Leads failed.");
        setLoadingAction("");
        return;
      }

      setLeadsExported(true);
      setSelectedPreviewKey("");
      setSelectedPreviewLead(null);
      setTemplatePreview(null);
      setPreviewOpen(false);

      await loadImportedLeads(pushForm.channel);

      setMessageType("success");
      setMessage(buildExportSuccessMessage(result));
    } catch (error: any) {
      setMessageType("error");
      setMessage(error?.message || "Export Leads failed.");
    }

    setLoadingAction("");
  }



  async function resetOldPushed() {
    setLoadingAction("Reset Pushed");
    setMessageType("info");
    setMessage("Checking leads pushed more than 3 months ago...");

    try {
      if (!resetArmed) {
        const response = (await apiPost("/instantly/reset-pushed", {
          olderThanMonths: 3,
        })) as {
          success?: boolean;
          message?: string;
          matched?: number;
        } | null;

        if (!response?.success) {
          setMessageType("error");
          setMessage(response?.message || "Failed to check old pushed leads.");
        } else if (!Number(response.matched || 0)) {
          setMessageType("info");
          setMessage("No leads were pushed more than 3 months ago. Nothing to reset.");
        } else {
          setResetArmed(true);
          setMessageType("info");
          setMessage(
            `${response.matched} lead(s) were pushed over 3 months ago. ` +
              "Click the reset button again to confirm."
          );
        }
      } else {
        const response = (await apiPost("/instantly/reset-pushed", {
          olderThanMonths: 3,
          confirm: true,
        })) as {
          success?: boolean;
          message?: string;
          modified?: number;
        } | null;

        setResetArmed(false);

        if (response?.success) {
          setMessageType("success");
          setMessage(
            response.message || `${response.modified || 0} lead(s) reset.`
          );
          await loadImportedLeads(pushForm.channel);
        } else {
          setMessageType("error");
          setMessage(response?.message || "Failed to reset old pushed leads.");
        }
      }
    } catch (error) {
      setResetArmed(false);
      setMessageType("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to reset old pushed leads."
      );
    }

    setLoadingAction("");
  }

  async function pushSingle() {
    if (!hasPreparedLeads) {
      setMessageType("error");
      setMessage(
        "No prepared leads found. Export leads first or refresh imported leads."
      );
      return;
    }

    if (pushForm.selectedSenders.length === 0) {
      setMessageType("error");
      setMessage("Select at least one sender email before pushing.");
      return;
    }

    await runAction("Push Campaign", async () => {
      const response: any = await apiPost("/instantly/push", {
        ...pushForm,
        numLeads: Number(pushForm.numLeads),
        dailyLimit: Number(pushForm.dailyLimit),
        selectedSenders: pushForm.selectedSenders,
      });

      if (response?.success) {
        await loadImportedLeads(pushForm.channel);

        return {
          success: true,
          message:
            "Campaign pushed. Leads: " +
            (response.totalPushed || 0) +
            ". Campaign ID: " +
            (response.campaignId || "-"),
        };
      }

      return response;
    });
  }

  async function pushBatch() {
    if (!hasPreparedLeads) {
      setMessageType("error");
      setMessage(
        "No prepared leads found. Export leads first or refresh imported leads."
      );
      return;
    }

    if (batchForm.selectedSenders.length === 0) {
      setMessageType("error");
      setMessage("Select at least one sender email before batch push.");
      return;
    }

    await runAction("Batch Push", async () => {
      const response: any = await apiPost("/instantly/batch-push", {
        ...batchForm,
        numLeads: Number(batchForm.numLeads),
        dailyLimit: Number(batchForm.dailyLimit),
        numWeekdays: Number(batchForm.numWeekdays),
        selectedSenders: batchForm.selectedSenders,
      });

      if (response?.success) {
        await loadImportedLeads(batchForm.channel);

        return {
          success: true,
          message:
            "Batch push complete. Campaigns: " +
            (response.createdCampaigns || 0) +
            ", leads pushed: " +
            (response.totalPushed || 0),
        };
      }

      return response;
    });
  }

  async function updatePushChannel(channel: Channel) {
    const senders = await loadSenders(channel);

    setPushForm((current) => ({
      ...current,
      channel,
      selectedSenders: senders,
    }));

    setSelectedPreviewKey("");
    setSelectedPreviewLead(null);
    setTemplatePreview(null);
    setPreviewOpen(false);

    await loadImportedLeads(channel);
  }

  async function updateBatchChannel(channel: Channel) {
    const senders = await loadSenders(channel);

    setBatchForm((current) => ({
      ...current,
      channel,
      selectedSenders: senders,
    }));

    setSelectedPreviewKey("");
    setSelectedPreviewLead(null);
    setTemplatePreview(null);
    setPreviewOpen(false);

    await loadImportedLeads(channel);
  }

  return (
    <main className="w-full space-y-6">

      <ActionMessage type={messageType} message={message} />

      <section className="space-y-4">
        <SectionHeader
          title="Quick Actions"
        />

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Button
            type="button"
            onClick={exportLeads}
            disabled={busy}
            className="h-12 rounded-xl !bg-blue-700 !text-white hover:!bg-blue-800 hover:!text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <UploadCloud className="mr-2 h-4 w-4" />
            {loadingAction === "Export Leads"
              ? "Exporting..."
              : hasPreparedLeads
                ? "Re-export Leads"
                : "Export Leads"}
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={resetOldPushed}
            disabled={busy}
            className="h-12 rounded-xl !border-amber-200 !text-amber-700 hover:!bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingAction === "Reset Pushed"
              ? "Working..."
              : resetArmed
                ? "Confirm Reset (3mo+)"
                : "Reset Old Pushed (3mo+)"}
          </Button>
        </div>

      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <SectionHeader
            title="Push Single Campaign"
          />

          <form
            onSubmit={(event) => {
              event.preventDefault();
              pushSingle();
            }}
            className="grid gap-4 md:grid-cols-2"
          >
            <FieldLabel label="Channel">
              <ChannelSelect
                value={pushForm.channel}
                onChange={updatePushChannel}
              />
            </FieldLabel>

            <FieldLabel label="Campaign Name">
              <Input
                value={pushForm.campaignName}
                onChange={(event) =>
                  setPushForm({
                    ...pushForm,
                    campaignName: event.target.value,
                  })
                }
                className="h-10 rounded-xl border-slate-200"
              />
            </FieldLabel>

            <FieldLabel label="Number of Leads">
              <Input
                type="number"
                min="1"
                value={pushForm.numLeads}
                onChange={(event) =>
                  setPushForm({ ...pushForm, numLeads: event.target.value })
                }
                className="h-10 rounded-xl border-slate-200"
              />
            </FieldLabel>

            <FieldLabel label="Daily Limit / Email Account">
              <Input
                type="number"
                min="1"
                value={pushForm.dailyLimit}
                onChange={(event) =>
                  setPushForm({ ...pushForm, dailyLimit: event.target.value })
                }
                className="h-10 rounded-xl border-slate-200"
              />
            </FieldLabel>

            <FieldLabel label="Start Date">
              <Input
                type="date"
                value={pushForm.startDate}
                onChange={(event) =>
                  setPushForm({ ...pushForm, startDate: event.target.value })
                }
                className="h-10 rounded-xl border-slate-200"
              />
            </FieldLabel>

            <FieldLabel label="End Date">
              <Input
                type="date"
                value={pushForm.endDate}
                onChange={(event) =>
                  setPushForm({ ...pushForm, endDate: event.target.value })
                }
                className="h-10 rounded-xl border-slate-200"
              />
            </FieldLabel>

            <FieldLabel label="Start Time">
              <Input
                type="time"
                value={pushForm.startTime}
                onChange={(event) =>
                  setPushForm({ ...pushForm, startTime: event.target.value })
                }
                className="h-10 rounded-xl border-slate-200"
              />
            </FieldLabel>

            <FieldLabel label="End Time">
              <Input
                type="time"
                value={pushForm.endTime}
                onChange={(event) =>
                  setPushForm({ ...pushForm, endTime: event.target.value })
                }
                className="h-10 rounded-xl border-slate-200"
              />
            </FieldLabel>

            <div className="md:col-span-2">
              <SenderDropdown
                label="Choose Sender Email(s)"
                senders={pushSenders}
                selected={pushForm.selectedSenders}
                onChange={(selectedSenders) =>
                  setPushForm({ ...pushForm, selectedSenders })
                }
              />
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 md:col-span-2">
              <Users className="mr-2 inline h-4 w-4 text-blue-600" />
              Selected senders: {pushForm.selectedSenders.length} · Estimated
              daily capacity: {pushCapacity || 0}/day
            </div>

            <div className="md:col-span-2">
              <Button
                type="submit"
                disabled={pushDisabled}
                title={
                  !hasPreparedLeads
                    ? "Export leads first before pushing campaign."
                    : pushForm.selectedSenders.length === 0
                      ? "Select at least one sender email."
                      : ""
                }
                className="h-12 w-full rounded-xl !bg-blue-700 !text-white hover:!bg-blue-800 hover:!text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="mr-2 h-4 w-4" />
                {loadingAction === "Push Campaign"
                  ? "Pushing..."
                  : !hasPreparedLeads
                    ? "Export Leads First"
                    : "PUSH TO INSTANTLY"}
              </Button>
            </div>
          </form>
        </div>

        <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <SectionHeader
            title="Batch Push"
          />

          <form
            onSubmit={(event) => {
              event.preventDefault();
              pushBatch();
            }}
            className="grid gap-4 md:grid-cols-2"
          >
            <FieldLabel label="Channel">
              <ChannelSelect
                value={batchForm.channel}
                onChange={updateBatchChannel}
              />
            </FieldLabel>

            <FieldLabel label="Leads Per Day">
              <Input
                type="number"
                min="1"
                value={batchForm.numLeads}
                onChange={(event) =>
                  setBatchForm({ ...batchForm, numLeads: event.target.value })
                }
                className="h-10 rounded-xl border-slate-200"
              />
            </FieldLabel>

            <FieldLabel label="Start Date">
              <Input
                type="date"
                value={batchForm.startDate}
                onChange={(event) =>
                  setBatchForm({ ...batchForm, startDate: event.target.value })
                }
                className="h-10 rounded-xl border-slate-200"
              />
            </FieldLabel>

            <FieldLabel label="Weekdays">
              <Input
                type="number"
                min="1"
                value={batchForm.numWeekdays}
                onChange={(event) =>
                  setBatchForm({
                    ...batchForm,
                    numWeekdays: event.target.value,
                  })
                }
                className="h-10 rounded-xl border-slate-200"
              />
            </FieldLabel>

            <FieldLabel label="Start Time">
              <Input
                type="time"
                value={batchForm.startTime}
                onChange={(event) =>
                  setBatchForm({ ...batchForm, startTime: event.target.value })
                }
                className="h-10 rounded-xl border-slate-200"
              />
            </FieldLabel>

            <FieldLabel label="End Time">
              <Input
                type="time"
                value={batchForm.endTime}
                onChange={(event) =>
                  setBatchForm({ ...batchForm, endTime: event.target.value })
                }
                className="h-10 rounded-xl border-slate-200"
              />
            </FieldLabel>

            <FieldLabel label="Daily Limit / Email Account">
              <Input
                type="number"
                min="1"
                value={batchForm.dailyLimit}
                onChange={(event) =>
                  setBatchForm({
                    ...batchForm,
                    dailyLimit: event.target.value,
                  })
                }
                className="h-10 rounded-xl border-slate-200"
              />
            </FieldLabel>

            <div className="md:col-span-2">
              <SenderDropdown
                label="Choose Sender Email(s)"
                senders={batchSenders}
                selected={batchForm.selectedSenders}
                onChange={(selectedSenders) =>
                  setBatchForm({ ...batchForm, selectedSenders })
                }
              />
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 md:col-span-2">
              <Users className="mr-2 inline h-4 w-4 text-blue-600" />
              Selected senders: {batchForm.selectedSenders.length} · Estimated
              daily capacity: {batchCapacity || 0}/day
            </div>

            <div className="md:col-span-2">
              <Button
                type="submit"
                disabled={batchDisabled}
                title={
                  !hasPreparedLeads
                    ? "Export leads first before batch push."
                    : batchForm.selectedSenders.length === 0
                      ? "Select at least one sender email."
                      : ""
                }
                className="h-12 w-full rounded-xl !border-blue-600 !bg-blue-600 !text-white hover:!bg-blue-700 hover:!text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CalendarDays className="mr-2 h-4 w-4" />
                {loadingAction === "Batch Push"
                  ? "Creating..."
                  : !hasPreparedLeads
                    ? "Export Leads First"
                    : "Create Batch Campaigns"}
              </Button>
            </div>
          </form>
        </div>
      </section>

      <ImportedLeadsTable
        leads={importedLeads}
        loading={loadingLeads}
        loadingPreview={loadingPreview}
        selectedPreviewKey={selectedPreviewKey}
        onRefresh={() => loadImportedLeads(pushForm.channel)}
        onCheckPreview={checkLeadPreview}
      />

      <TemplatePreviewSideModal
        open={previewOpen}
        preview={templatePreview}
        loading={loadingPreview}
        lead={selectedPreviewLead}
        onClose={() => setPreviewOpen(false)}
      />
    </main>
  );
}