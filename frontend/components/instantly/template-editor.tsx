"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Save } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataSection } from "@/components/shared/data-section";

type TemplateField = "subject" | "body" | "followUp1" | "followUp2";

type TemplateState = Record<TemplateField, string>;

const emptyTemplate: TemplateState = {
  subject: "",
  body: "",
  followUp1: "",
  followUp2: "",
};

const fieldLabels: Record<TemplateField, string> = {
  subject: "Subject",
  body: "Body",
  followUp1: "Follow Up 1",
  followUp2: "Follow Up 2",
};

function clean(value: any) {
  return String(value || "").trim();
}

function normalizeTemplateContent(value: any) {
  return String(value || "")
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<p[^>]*>/gi, "")
    .replace(/<div[^>]*>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .trim();
}

function normalizeFieldName(field: any): TemplateField | "" {
  const value = clean(field).toLowerCase().replace(/[^a-z0-9]/g, "");

  if (value === "subject") return "subject";
  if (value === "body" || value === "emailbody" || value === "mainbody") return "body";
  if (value === "followup1" || value === "followupone") return "followUp1";
  if (value === "followup2" || value === "followuptwo") return "followUp2";

  return "";
}

function rowsToTemplate(rows: any[]): TemplateState {
  const next = { ...emptyTemplate };

  for (const row of rows || []) {
    const key = normalizeFieldName(row.field || row.key || row.name);

    if (key) {
      next[key] = normalizeTemplateContent(row.content ?? row.value ?? row.text);
    }
  }

  return next;
}

function templateFromResponse(response: any): TemplateState {
  const data = response?.data || response?.template || response;

  if (Array.isArray(data)) {
    return rowsToTemplate(data);
  }

  return {
    subject: normalizeTemplateContent(data?.subject),
    body: normalizeTemplateContent(data?.body),
    followUp1: normalizeTemplateContent(data?.followUp1),
    followUp2: normalizeTemplateContent(data?.followUp2),
  };
}

function Textarea({
  value,
  onChange,
  rows = 10,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <textarea
      rows={rows}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className="w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
    />
  );
}

function FieldEditor({
  label,
  value,
  onChange,
  multiline = true,
  rows = 10,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  rows?: number;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-bold text-slate-800">{label}</label>

        <span className="text-xs font-semibold text-slate-400">
          {value.length.toLocaleString("en-IN")} chars
        </span>
      </div>

      {multiline ? (
        <Textarea
          value={value}
          onChange={onChange}
          rows={rows}
          placeholder={`Enter ${label.toLowerCase()}...`}
        />
      ) : (
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={`Enter ${label.toLowerCase()}...`}
          className="h-12 rounded-xl border-slate-200 text-sm font-medium shadow-none focus-visible:ring-4 focus-visible:ring-blue-50"
        />
      )}
    </div>
  );
}

export function TemplateEditor({
  title,
  description,
  channel,
  fetchEndpoint,
}: {
  title: string;
  description?: string;
  channel: "Enoylity Technology" | "MHD Tech";
  fetchEndpoint: string;
}) {
  const [template, setTemplate] = useState<TemplateState>(emptyTemplate);
  const [originalTemplate, setOriginalTemplate] =
    useState<TemplateState>(emptyTemplate);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"info" | "success" | "error">(
    "info"
  );

  const changed = useMemo(() => {
    return JSON.stringify(template) !== JSON.stringify(originalTemplate);
  }, [template, originalTemplate]);

  function updateField(field: TemplateField, value: string) {
    setTemplate((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function loadTemplate() {
    setLoading(true);
    setMessage("");

    try {
      const response = await apiGet(fetchEndpoint);
      const next = templateFromResponse(response);

      setTemplate(next);
      setOriginalTemplate(next);
    } catch (error: any) {
      setMessageType("error");
      setMessage(error?.message || "Failed to load template.");
      setTemplate(emptyTemplate);
      setOriginalTemplate(emptyTemplate);
    }

    setLoading(false);
  }

  async function saveTemplate() {
    setSaving(true);
    setMessageType("info");
    setMessage("Saving template...");

    try {
      const response = await apiPost("/instantly/templates", {
        channel,
        subject: template.subject,
        body: template.body,
        followUp1: template.followUp1,
        followUp2: template.followUp2,
      });

      if (!response?.success) {
        throw new Error(response?.message || "Template save failed.");
      }

      setOriginalTemplate(template);
      setMessageType("success");
      setMessage(`${title} saved successfully.`);
    } catch (error: any) {
      setMessageType("error");
      setMessage(error?.message || "Template save failed.");
    }

    setSaving(false);
  }

  useEffect(() => {
    loadTemplate();
  }, []);

  const messageClasses =
    messageType === "success"
      ? "border-emerald-100 bg-emerald-50 text-emerald-700"
      : messageType === "error"
        ? "border-rose-100 bg-rose-50 text-rose-700"
        : "border-blue-100 bg-blue-50 text-blue-700";

  return (
    <main className="w-full space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-950">
            {title}
          </h1>

          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
            {description ||
              "Edit campaign subject, body and follow-up templates."}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">

          <Button
            type="button"
            onClick={saveTemplate}
            disabled={loading || saving || !changed}
            className="h-11 rounded-xl !bg-blue-700 !text-white hover:!bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : changed ? "Save Changes" : "Saved"}
          </Button>
        </div>
      </div>

      {message ? (
        <div className={`rounded-2xl border px-4 py-3 text-sm font-bold ${messageClasses}`}>
          {message}
        </div>
      ) : null}

      <DataSection
        title={title}
        description={
          loading
            ? "Loading..."
            : changed
              ? "Unsaved changes"
              : "All changes saved"
        }
      >
        <div className="space-y-6 p-1">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm font-bold text-slate-500">
              Loading template...
            </div>
          ) : (
            <>
              <FieldEditor
                label={fieldLabels.subject}
                value={template.subject}
                onChange={(value) => updateField("subject", value)}
                multiline={false}
              />

              <FieldEditor
                label={fieldLabels.body}
                value={template.body}
                onChange={(value) => updateField("body", value)}
                rows={16}
              />

              <FieldEditor
                label={fieldLabels.followUp1}
                value={template.followUp1}
                onChange={(value) => updateField("followUp1", value)}
                rows={10}
              />

              <FieldEditor
                label={fieldLabels.followUp2}
                value={template.followUp2}
                onChange={(value) => updateField("followUp2", value)}
                rows={10}
              />

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold leading-5 text-slate-500">
                Supported variables: {"{{firstName}}"}, {"{{companyName}}"},{" "}
                {"{{productName}}"}, {"{{relatedVideo}}"}, {"{{competitor1}}"},{" "}
                {"{{competitor2}}"}, {"{{sendingAccountFirstName}}"},{" "}
                {"{{sendingAccountEmail}}"}
              </div>
            </>
          )}
        </div>
      </DataSection>
    </main>
  );
}
