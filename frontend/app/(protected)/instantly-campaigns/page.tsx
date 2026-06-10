"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Eye,
  Info,
  Sparkles,
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
  gatewayBounced?: string;
};

type TemplatePreview = {
  lead?: ImportedLead;
  subject?: string;
  body?: string;
  followUp1?: string;
  followUp2?: string;
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
                      {lead.instantlyBounced || "-"}
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
    numLeads: "5",
    startDate: today(),
    endDate: plusDays(14),
    startTime: "09:00",
    endTime: "16:00",
    dailyLimit: "40",
    selectedSenders: FALLBACK_SENDERS["Enoylity Technology"],
  });

  const [batchForm, setBatchForm] = useState({
    channel: "Enoylity Technology" as Channel,
    numLeads: "5",
    startDate: today(),
    startTime: "09:00",
    endTime: "16:00",
    dailyLimit: "40",
    numWeekdays: "3",
    selectedSenders: FALLBACK_SENDERS["Enoylity Technology"],
  });

  const busy = Boolean(loadingAction);

  const pushSenders = senderOptions[pushForm.channel] || [];
  const batchSenders = senderOptions[batchForm.channel] || [];

  const pushDisabled =
    busy || !leadsExported || pushForm.selectedSenders.length === 0;

  const batchDisabled =
    busy || !leadsExported || batchForm.selectedSenders.length === 0;

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

    const competitorsReady = useMemo(() => {
    return importedLeads.some(
      (lead) => clean(lead.competitor1) || clean(lead.competitor2)
    );
  }, [importedLeads]);

  const fillCompetitorsDisabled =
    busy || (!leadsExported && importedLeads.length === 0);
    
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
        )}&limit=`
      );

      setImportedLeads(response?.data || response?.leads || []);
    } catch {
      setImportedLeads([]);
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

  async function exportLeads() {
    await runAction("Export Leads", async () => {
      const response: any = await apiPost("/instantly/export", {});

      if (response?.success) {
        setLeadsExported(true);
        setSelectedPreviewKey("");
        setSelectedPreviewLead(null);
        setTemplatePreview(null);
        setPreviewOpen(false);

        await loadImportedLeads(pushForm.channel);

        return {
          success: true,
          message:
            "Export complete. New rows: " +
            (response.exported || 0) +
            ", skipped existing emails: " +
            (response.skippedAlreadyExported || 0) +
            ", contacts fixed: " +
            (response.contactsNormalized || 0),
        };
      }

      setLeadsExported(false);
      return response;
    });
  }

  async function pushSingle() {
    if (!leadsExported) {
      setMessageType("error");
      setMessage("Export leads first before pushing a campaign.");
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
    if (!leadsExported) {
      setMessageType("error");
      setMessage("Export leads first before creating batch campaigns.");
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
              : leadsExported
                ? "Re-export Leads"
                : "Export Leads"}
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
                  !leadsExported
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
                  : !leadsExported
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
                  !leadsExported
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
                  : !leadsExported
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