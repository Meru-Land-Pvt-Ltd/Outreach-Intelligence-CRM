"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/shared/notice";

type Channel = "Enoylity Technology" | "MHD Tech";

type DialogLead = {
  _id: string;
  firstName: string;
  email: string;
  companyName: string;
  productName: string;
};

type PreviewResponse = {
  success?: boolean;
  message?: string;
  nameConflict?: boolean;
  eligibleCount?: number;
  rejected?: Array<{ id: string; email: string; reason: string }>;
  payloadSummary?: any;
  leads?: Array<{
    _id: string;
    firstName?: string;
    email?: string;
    companyName?: string;
    productName?: string;
  }>;
};

function today() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function plusDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// The template body/follow-ups are HTML (with entities like &#39;). Render
// them so paragraphs, links and apostrophes display as the real email, rather
// than tag-stripping into an unstructured wall of text.
function EmailHtmlBlock({ html }: { html?: string }) {
  const content = String(html || "").trim();

  if (!content) {
    return <p className="text-sm text-slate-400">—</p>;
  }

  return (
    <div
      className="max-h-72 overflow-auto rounded-lg border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700 [&_a]:break-all [&_a]:text-blue-600 [&_a]:underline [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}

export function CreateCampaignDialog({
  open,
  channel,
  leads,
  templateType = "outbound",
  onClose,
  onPushed,
}: {
  open: boolean;
  channel: Channel;
  leads: DialogLead[];
  templateType?: "outbound" | "inbound";
  onClose: () => void;
  onPushed: (campaignId?: string) => void;
}) {
  const [step, setStep] = useState<"form" | "preview">("form");
  const [existingCampaigns, setExistingCampaigns] = useState<any[]>([]);
  const [senders, setSenders] = useState<string[]>([]);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);

  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [form, setForm] = useState({
    campaignName: "",
    startDate: today(),
    endDate: plusDays(14),
    startTime: "09:00",
    endTime: "16:00",
    dailyLimit: "160",
  });

  const [leadPreview, setLeadPreview] = useState<{
    email: string;
    subject: string;
    body: string;
    followUp1: string;
    followUp2: string;
  } | null>(null);
  const [leadPreviewLoading, setLeadPreviewLoading] = useState(false);

  useEffect(() => {
    if (!open) return;

    setStep("form");
    setPreview(null);
    setNotice(null);
    setForm((prev) => ({
      ...prev,
      campaignName: `${channel === "Enoylity Technology" ? "Enoylity" : "MHD"} ${today()}`,
    }));

    (async () => {
      const [campaignsResp, sendersResp] = await Promise.all([
        apiGet(`/instantly/campaigns?channel=${encodeURIComponent(channel)}`),
        apiGet(`/instantly/senders?channel=${encodeURIComponent(channel)}`),
      ]);

      setExistingCampaigns((campaignsResp as any)?.data || []);
      const s = (sendersResp as any)?.data || (sendersResp as any)?.senders || [];
      setSenders(Array.isArray(s) ? s : []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, channel]);

  const leadIds = useMemo(() => leads.map((lead) => lead._id), [leads]);

  // Group rejected leads by reason so the preview reads as a summary, not a dump.
  const rejectedGroups = useMemo(() => {
    const byReason = new Map<string, string[]>();

    for (const r of preview?.rejected || []) {
      const reason = r.reason || "Not eligible";
      const label = r.email || r.id;
      if (!byReason.has(reason)) byReason.set(reason, []);
      byReason.get(reason)!.push(label);
    }

    return Array.from(byReason.entries())
      .map(([reason, emails]) => ({ reason, emails }))
      .sort((a, b) => b.emails.length - a.emails.length);
  }, [preview]);

  async function runPreview() {
    setBusy("preview");
    setNotice(null);

    const response = (await apiPost("/instantly/push-preview", {
      channel,
      campaignName: form.campaignName,
      startDate: form.startDate,
      endDate: form.endDate,
      startTime: form.startTime,
      endTime: form.endTime,
      dailyLimit: Number(form.dailyLimit),
      selectedSenders: senders,
      templateType,
      leadIds,
    })) as PreviewResponse;

    if (response?.success) {
      setPreview(response);
      setStep("preview");

      if (response.nameConflict) {
        setNotice({
          type: "error",
          text: "A campaign with this name already exists — change the name before pushing.",
        });
      }
    } else {
      setNotice({
        type: "error",
        text: response?.message || "Preview failed.",
      });
    }

    setBusy("");
  }

  async function checkLeadPreview(email: string, leadId: string) {
    setLeadPreviewLoading(true);
    setLeadPreview(null);

    const response: any = await apiGet(
      `/instantly/template-preview?channel=${encodeURIComponent(
        channel
      )}&leadId=${encodeURIComponent(leadId)}&email=${encodeURIComponent(
        email
      )}&type=${encodeURIComponent(templateType)}`
    );

    const data = response?.data || response?.preview;

    if (data) {
      setLeadPreview({
        email,
        subject: data.subject || "",
        body: data.body || "",
        followUp1: data.followUp1 || "",
        followUp2: data.followUp2 || "",
      });
    }

    setLeadPreviewLoading(false);
  }

  async function runPush() {
    if (!preview || (preview.eligibleCount || 0) === 0) return;

    setBusy("push");
    setNotice(null);

    const response: any = await apiPost("/instantly/push-selected", {
      channel,
      campaignName: form.campaignName,
      startDate: form.startDate,
      endDate: form.endDate,
      startTime: form.startTime,
      endTime: form.endTime,
      dailyLimit: Number(form.dailyLimit),
      selectedSenders: senders,
      templateType,
      leadIds,
    });

    if (response?.success) {
      onPushed(response.campaignId);
    } else {
      setNotice({
        type: "error",
        text: response?.message || "Push failed.",
      });
      setBusy("");
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/40"
      />

      <aside className="absolute right-0 top-0 flex h-full w-full max-w-[720px] flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-lg font-bold text-slate-950">
              Create Campaign — {channel}
            </h2>
            <p className="text-sm font-medium text-slate-500">
              {leads.length} lead(s) selected ·{" "}
              <span
                className={
                  templateType === "inbound"
                    ? "font-semibold text-emerald-700"
                    : "font-semibold text-slate-600"
                }
              >
                {templateType === "inbound" ? "Inbound" : "Outbound"} template
              </span>{" "}
              · {step === "form" ? "Configure" : "Preview & push"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {notice ? <Notice type={notice.type} text={notice.text} /> : null}

          {step === "form" ? (
            <div className="mt-3 space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="space-y-1.5 sm:col-span-2">
                  <span className="text-xs font-semibold text-slate-600">
                    Campaign Name (creates the Instantly folder)
                  </span>
                  <Input
                    value={form.campaignName}
                    onChange={(e) =>
                      setForm({ ...form, campaignName: e.target.value })
                    }
                    className="h-10 border-slate-200"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-semibold text-slate-600">
                    Start Date
                  </span>
                  <Input
                    type="date"
                    value={form.startDate}
                    onChange={(e) =>
                      setForm({ ...form, startDate: e.target.value })
                    }
                    className="h-10 border-slate-200"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-semibold text-slate-600">
                    End Date
                  </span>
                  <Input
                    type="date"
                    value={form.endDate}
                    onChange={(e) =>
                      setForm({ ...form, endDate: e.target.value })
                    }
                    className="h-10 border-slate-200"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-semibold text-slate-600">
                    Start Time
                  </span>
                  <Input
                    type="time"
                    value={form.startTime}
                    onChange={(e) =>
                      setForm({ ...form, startTime: e.target.value })
                    }
                    className="h-10 border-slate-200"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-semibold text-slate-600">
                    End Time
                  </span>
                  <Input
                    type="time"
                    value={form.endTime}
                    onChange={(e) =>
                      setForm({ ...form, endTime: e.target.value })
                    }
                    className="h-10 border-slate-200"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-semibold text-slate-600">
                    Daily Limit / Account
                  </span>
                  <Input
                    type="number"
                    value={form.dailyLimit}
                    onChange={(e) =>
                      setForm({ ...form, dailyLimit: e.target.value })
                    }
                    className="h-10 border-slate-200"
                  />
                </label>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Existing folders on this channel
                </p>
                {existingCampaigns.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">None yet.</p>
                ) : (
                  <ul className="mt-2 max-h-32 space-y-1 overflow-auto text-sm text-slate-600">
                    {existingCampaigns.slice(0, 30).map((c: any) => (
                      <li key={c._id}>{c.campaignName}</li>
                    ))}
                  </ul>
                )}
              </div>

              <p className="text-xs font-medium text-slate-500">
                {senders.length} sender email(s) will be used.
              </p>
            </div>
          ) : (
            <div className="mt-3 space-y-5">
              {(() => {
                const eligible = preview?.eligibleCount || 0;
                const rejectedCount = preview?.rejected?.length || 0;
                const total = eligible + rejectedCount;

                return (
                  <div
                    className={cn(
                      "rounded-xl border p-4",
                      eligible > 0
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-amber-200 bg-amber-50"
                    )}
                  >
                    <p
                      className={cn(
                        "text-sm font-bold",
                        eligible > 0 ? "text-emerald-800" : "text-amber-800"
                      )}
                    >
                      {eligible} of {total} selected lead(s) will be pushed
                    </p>
                    {preview?.payloadSummary ? (
                      <p className="mt-1 text-xs font-medium text-slate-600">
                        {preview.payloadSummary.name} · daily limit{" "}
                        {preview.payloadSummary.daily_limit} ·{" "}
                        {(preview.payloadSummary.email_list || []).length} senders
                      </p>
                    ) : null}
                    {eligible === 0 ? (
                      <p className="mt-2 text-xs font-medium text-amber-700">
                        None of the selected leads can be pushed right now — see
                        the reasons below. The most common one is that the brand
                        already reached its per-brand email cap (raise it in
                        Pipeline Settings, or release older pushes via
                        Cooling-off to re-pitch).
                      </p>
                    ) : null}
                  </div>
                );
              })()}

              {rejectedGroups.length > 0 ? (
                <div className="rounded-xl border border-slate-200">
                  <p className="border-b border-slate-200 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-500">
                    Rejected · {preview?.rejected?.length || 0}
                  </p>
                  <div className="max-h-56 divide-y divide-slate-100 overflow-auto">
                    {rejectedGroups.map((group) => (
                      <div key={group.reason} className="px-4 py-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-slate-800">
                            {group.reason}
                          </span>
                          <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                            {group.emails.length}
                          </span>
                        </div>
                        <ul className="mt-1.5 space-y-0.5">
                          {group.emails.map((email, i) => (
                            <li
                              key={`${email}-${i}`}
                              className="truncate text-xs text-slate-500"
                            >
                              {email}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Eligible leads · {preview?.eligibleCount || 0}
                </p>
                {(preview?.leads || []).length === 0 ? (
                  <p className="mt-2 rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm font-medium text-slate-400">
                    No leads are eligible to push.
                  </p>
                ) : null}
                <div className="mt-2 max-h-64 space-y-2 overflow-auto">
                  {(preview?.leads || []).map((lead) => (
                    <div
                      key={lead._id}
                      className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-800">
                          {lead.firstName || "-"} · {lead.email}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {lead.companyName} · {lead.productName}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        onClick={() =>
                          checkLeadPreview(lead.email || "", lead._id)
                        }
                        className="h-8 shrink-0 rounded-md"
                      >
                        Preview email
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {leadPreviewLoading ? (
                <p className="text-sm font-medium text-slate-500">
                  Loading email preview…
                </p>
              ) : leadPreview ? (
                <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Email preview
                    </p>
                    <p className="mt-0.5 text-xs font-medium text-slate-500">
                      To: {leadPreview.email}
                    </p>
                  </div>

                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                      Subject
                    </p>
                    <p className="mt-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900">
                      {leadPreview.subject || "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                      Body
                    </p>
                    <div className="mt-1">
                      <EmailHtmlBlock html={leadPreview.body} />
                    </div>
                  </div>

                  {leadPreview.followUp1 ? (
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                        Follow-up 1
                      </p>
                      <div className="mt-1">
                        <EmailHtmlBlock html={leadPreview.followUp1} />
                      </div>
                    </div>
                  ) : null}

                  {leadPreview.followUp2 ? (
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                        Follow-up 2
                      </p>
                      <div className="mt-1">
                        <EmailHtmlBlock html={leadPreview.followUp2} />
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-6 py-4">
          {step === "preview" ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep("form")}
              disabled={Boolean(busy)}
            >
              Back
            </Button>
          ) : (
            <span />
          )}

          {step === "form" ? (
            <Button
              type="button"
              onClick={runPreview}
              disabled={Boolean(busy) || !form.campaignName.trim()}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              {busy === "preview" ? "Building preview…" : "Preview"}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={runPush}
              disabled={
                Boolean(busy) ||
                (preview?.eligibleCount || 0) === 0 ||
                preview?.nameConflict
              }
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              {busy === "push"
                ? "Pushing…"
                : `Push ${preview?.eligibleCount || 0} lead(s)`}
            </Button>
          )}
        </div>
      </aside>
    </div>
  );
}
