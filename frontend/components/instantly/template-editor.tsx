"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Save, Trash2, Wand2 } from "lucide-react";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataSection } from "@/components/shared/data-section";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type TemplateField = "subject" | "body" | "followUp1" | "followUp2";

type TemplateState = Record<TemplateField, string>;

type CursorState = {
  field: TemplateField;
  start: number;
  end: number;
};

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

const supportedVariables = [
  "{{firstName}}",
  "{{companyName}}",
  "{{productName}}",
  "{{relatedVideo}}",
  "{{competitor1}}",
  "{{competitor2}}",
  "{{sendingAccountFirstName}}",
  "{{sendingAccountEmail}}",
];

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

function Textarea({
  value,
  onChange,
  rows = 10,
  placeholder,
  onFocus,
  onCursorChange,
  inputRef,
}: {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  onFocus?: () => void;
  onCursorChange?: (start: number, end: number) => void;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
}) {
  function updateCursor(event: React.SyntheticEvent<HTMLTextAreaElement>) {
    const target = event.currentTarget;
    onCursorChange?.(target.selectionStart || 0, target.selectionEnd || 0);
  }

  return (
    <textarea
      ref={inputRef}
      rows={rows}
      value={value}
      placeholder={placeholder}
      onFocus={(event) => {
        onFocus?.();
        updateCursor(event);
      }}
      onClick={updateCursor}
      onKeyUp={updateCursor}
      onSelect={updateCursor}
      onChange={(event) => {
        onChange(event.target.value);
        onCursorChange?.(
          event.target.selectionStart || 0,
          event.target.selectionEnd || 0
        );
      }}
      className="w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
    />
  );
}

function FieldEditor({
  field,
  label,
  value,
  onChange,
  multiline = true,
  rows = 10,
  onFocus,
  onCursorChange,
  inputRef,
  textareaRef,
}: {
  field: TemplateField;
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  rows?: number;
  onFocus?: () => void;
  onCursorChange?: (field: TemplateField, start: number, end: number) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
}) {
  function updateInputCursor(event: React.SyntheticEvent<HTMLInputElement>) {
    const target = event.currentTarget;
    onCursorChange?.(field, target.selectionStart || 0, target.selectionEnd || 0);
  }

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
          onFocus={onFocus}
          inputRef={textareaRef}
          onCursorChange={(start, end) => onCursorChange?.(field, start, end)}
          placeholder={`Enter ${label.toLowerCase()}...`}
        />
      ) : (
        <Input
          ref={inputRef}
          value={value}
          onFocus={(event) => {
            onFocus?.();
            updateInputCursor(event);
          }}
          onClick={updateInputCursor}
          onKeyUp={updateInputCursor}
          onSelect={updateInputCursor}
          onChange={(event) => {
            onChange(event.target.value);
            onCursorChange?.(
              field,
              event.target.selectionStart || 0,
              event.target.selectionEnd || 0
            );
          }}
          placeholder={`Enter ${label.toLowerCase()}...`}
          className="h-12 rounded-xl border-slate-200 text-sm font-medium shadow-none focus-visible:ring-4 focus-visible:ring-blue-50"
        />
      )}
    </div>
  );
}

type TemplateRow = {
  _id: string;
  name: string;
} & TemplateState;

export function TemplateEditor({
  title,
  description,
  channel,
}: {
  title: string;
  description?: string;
  channel: "Enoylity Technology" | "MHD Tech";
  fetchEndpoint?: string;
}) {
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  // A template's Mongo id, or "new" while creating a fresh one.
  const [selectedId, setSelectedId] = useState<string>("");
  const [templateName, setTemplateName] = useState("");
  const [originalName, setOriginalName] = useState("");

  const [template, setTemplate] = useState<TemplateState>(emptyTemplate);
  const [originalTemplate, setOriginalTemplate] =
    useState<TemplateState>(emptyTemplate);

  // outbound = cold outreach to crawled leads; inbound = replies to leads
  // who contacted us (CSV imports).
  const [templateType, setTemplateType] = useState<"outbound" | "inbound">(
    "outbound"
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"info" | "success" | "error">(
    "info"
  );

  const [activeField, setActiveField] = useState<TemplateField>("body");
  const [selectedVariable, setSelectedVariable] = useState<string | undefined>();

  const [cursor, setCursor] = useState<CursorState>({
    field: "body",
    start: 0,
    end: 0,
  });

  const subjectRef = useRef<HTMLInputElement | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const followUp1Ref = useRef<HTMLTextAreaElement | null>(null);
  const followUp2Ref = useRef<HTMLTextAreaElement | null>(null);

  const changed = useMemo(() => {
    return (
      JSON.stringify(template) !== JSON.stringify(originalTemplate) ||
      templateName.trim() !== originalName
    );
  }, [template, originalTemplate, templateName, originalName]);

  function getActiveElement(field: TemplateField) {
    if (field === "subject") return subjectRef.current;
    if (field === "body") return bodyRef.current;
    if (field === "followUp1") return followUp1Ref.current;
    return followUp2Ref.current;
  }

  function updateField(field: TemplateField, value: string) {
    setTemplate((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateCursor(field: TemplateField, start: number, end: number) {
    setActiveField(field);
    setCursor({ field, start, end });
  }

  function insertVariable(variable: string) {
    const field = cursor.field || activeField;
    const currentValue = template[field] || "";
    const fallbackCursor = currentValue.length;

    const start =
      cursor.field === field && Number.isFinite(cursor.start)
        ? cursor.start
        : fallbackCursor;

    const end =
      cursor.field === field && Number.isFinite(cursor.end)
        ? cursor.end
        : start;

    const nextValue =
      currentValue.slice(0, start) + variable + currentValue.slice(end);

    const nextCursor = start + variable.length;

    setTemplate((current) => ({
      ...current,
      [field]: nextValue,
    }));

    setActiveField(field);
    setCursor({
      field,
      start: nextCursor,
      end: nextCursor,
    });

    requestAnimationFrame(() => {
      const element = getActiveElement(field);

      element?.focus({ preventScroll: true });
      element?.setSelectionRange(nextCursor, nextCursor);
    });

    setSelectedVariable(undefined);
  }

  function switchTemplateType(nextType: "outbound" | "inbound") {
    if (nextType === templateType) return;

    if (
      changed &&
      !window.confirm("Discard unsaved changes and switch template type?")
    ) {
      return;
    }

    setTemplateType(nextType);
  }

  function rowToState(row: TemplateRow | undefined): TemplateState {
    return {
      subject: normalizeTemplateContent(row?.subject),
      body: normalizeTemplateContent(row?.body),
      followUp1: normalizeTemplateContent(row?.followUp1),
      followUp2: normalizeTemplateContent(row?.followUp2),
    };
  }

  function applySelection(rows: TemplateRow[], id: string) {
    if (id === "new") {
      setSelectedId("new");
      setTemplateName("");
      setOriginalName("");
      setTemplate(emptyTemplate);
      setOriginalTemplate(emptyTemplate);
      return;
    }

    const row = rows.find((item) => item._id === id) || rows[0];

    if (!row) {
      applySelection(rows, "new");
      return;
    }

    const state = rowToState(row);

    setSelectedId(row._id);
    setTemplateName(row.name || "Default");
    setOriginalName((row.name || "Default").trim());
    setTemplate(state);
    setOriginalTemplate(state);
  }

  function selectTemplate(id: string) {
    if (id === selectedId) return;

    if (
      changed &&
      !window.confirm("Discard unsaved changes and switch template?")
    ) {
      return;
    }

    applySelection(templates, id);
  }

  async function loadTemplates(preferId?: string) {
    setLoading(true);
    setMessage("");

    try {
      const response: any = await apiGet(
        `/instantly/templates?channel=${encodeURIComponent(
          channel
        )}&type=${encodeURIComponent(templateType)}`
      );

      const rows: TemplateRow[] = ((response?.data || []) as any[]).map(
        (row) => ({
          _id: String(row._id),
          name: String(row.name || "Default"),
          subject: String(row.subject || ""),
          body: String(row.body || ""),
          followUp1: String(row.followUp1 || ""),
          followUp2: String(row.followUp2 || ""),
        })
      );

      setTemplates(rows);

      const preferred =
        (preferId && rows.find((row) => row._id === preferId)?._id) ||
        rows.find((row) => row.name === "Default")?._id ||
        rows[0]?._id ||
        "new";

      applySelection(rows, preferred);
    } catch (error: any) {
      setMessageType("error");
      setMessage(error?.message || "Failed to load templates.");
      setTemplates([]);
      applySelection([], "new");
    }

    setLoading(false);
  }

  async function saveTemplate() {
    const name = templateName.trim();

    if (!name) {
      setMessageType("error");
      setMessage("Give this template a name (e.g. Sample 1) before saving.");
      return;
    }

    setSaving(true);
    setMessageType("info");
    setMessage("Saving template...");

    try {
      const response: any = await apiPost("/instantly/templates", {
        channel,
        templateType,
        templateId: selectedId !== "new" ? selectedId : "",
        name,
        subject: template.subject,
        body: template.body,
        followUp1: template.followUp1,
        followUp2: template.followUp2,
      });

      if (!response?.success) {
        throw new Error(response?.message || "Template save failed.");
      }

      const savedId = String(response?.data?._id || "");

      await loadTemplates(savedId);

      setMessageType("success");
      setMessage(
        `Template "${name}" (${
          templateType === "inbound" ? "Inbound" : "Outbound"
        }) saved. It now appears in the template list when pushing campaigns.`
      );
    } catch (error: any) {
      setMessageType("error");
      setMessage(error?.message || "Template save failed.");
    }

    setSaving(false);
  }

  async function deleteSelectedTemplate() {
    if (selectedId === "new" || !selectedId) return;

    if (
      !window.confirm(
        `Delete template "${templateName || "Default"}"? Campaign pushes can no longer select it.`
      )
    ) {
      return;
    }

    setDeleting(true);
    setMessage("");

    try {
      const response: any = await apiDelete(
        `/instantly/templates/${encodeURIComponent(selectedId)}`
      );

      if (!response?.success) {
        throw new Error(response?.message || "Delete failed.");
      }

      await loadTemplates();

      setMessageType("success");
      setMessage(response?.message || "Template deleted.");
    } catch (error: any) {
      setMessageType("error");
      setMessage(error?.message || "Delete failed.");
    }

    setDeleting(false);
  }

  useEffect(() => {
    loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateType]);

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

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <Select
            value={selectedVariable}
            onValueChange={(value) => {
              setSelectedVariable(value);
              insertVariable(value);
            }}
            disabled={loading}
          >
            <SelectTrigger className="h-11 w-full rounded-xl border-slate-200 bg-white px-4 text-sm font-bold shadow-none focus:ring-4 focus:ring-blue-50 sm:w-[310px]">
              <div className="flex min-w-0 items-center gap-2">
                <Wand2 className="h-4 w-4 shrink-0 text-blue-600" />
                <SelectValue
                  placeholder={`Insert variable into ${fieldLabels[activeField]}`}
                />
              </div>
            </SelectTrigger>

            <SelectContent align="end" className="max-h-[320px] rounded-xl">
              {supportedVariables.map((variable) => (
                <SelectItem
                  key={variable}
                  value={variable}
                  className="font-mono text-xs"
                >
                  {variable}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            type="button"
            onClick={saveTemplate}
            disabled={loading || saving || (!changed && selectedId !== "new")}
            className="h-11 rounded-xl !bg-blue-700 !text-white hover:!bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="mr-2 h-4 w-4" />
            {saving
              ? "Saving..."
              : selectedId === "new"
                ? "Create Template"
                : changed
                  ? "Save Changes"
                  : "Saved"}
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={deleteSelectedTemplate}
            disabled={
              loading ||
              deleting ||
              selectedId === "new" ||
              templates.length <= 1
            }
            title={
              templates.length <= 1
                ? "Cannot delete the last template — create another one first."
                : "Delete this template"
            }
            className="h-11 rounded-xl !border-rose-200 !text-rose-700 hover:!bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </div>

      <div className="flex w-fit items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {(
          [
            { value: "outbound", label: "Outbound", hint: "Crawled leads (cold outreach)" },
            { value: "inbound", label: "Inbound", hint: "CSV imports (they contacted you)" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => switchTemplateType(tab.value)}
            title={tab.hint}
            className={
              templateType === tab.value
                ? "rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white"
                : "rounded-lg px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-50"
            }
          >
            {tab.label}
          </button>
        ))}
        <span className="px-3 text-xs font-medium text-slate-400">
          {templateType === "inbound"
            ? "Used by Inbound Import campaigns"
            : "Used by crawled-lead campaigns"}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <span className="px-1 text-xs font-bold uppercase tracking-wide text-slate-500">
          Templates
        </span>

        {templates.map((row) => (
          <button
            key={row._id}
            type="button"
            onClick={() => selectTemplate(row._id)}
            className={
              selectedId === row._id
                ? "rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-bold text-white"
                : "rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            }
          >
            {row.name}
          </button>
        ))}

        <button
          type="button"
          onClick={() => selectTemplate("new")}
          className={
            selectedId === "new"
              ? "inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-bold text-white"
              : "inline-flex items-center gap-1 rounded-lg border border-dashed border-emerald-300 px-3 py-1.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
          }
        >
          <Plus className="h-3.5 w-3.5" />
          New Template
        </button>

        <span className="ml-auto px-1 text-xs font-medium text-slate-400">
          Each template has Main + Follow Up 1 + Follow Up 2. Pick one when
          pushing a campaign.
        </span>
      </div>

      {message ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm font-bold ${messageClasses}`}
        >
          {message}
        </div>
      ) : null}

      <DataSection
        title={title}
        description={
          loading ? "Loading..." : changed ? "Unsaved changes" : "All changes saved"
        }
      >
        <div className="space-y-6 p-1">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm font-bold text-slate-500">
              Loading template...
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm font-bold text-slate-800">
                    Template Name
                  </label>
                </div>
                <Input
                  value={templateName}
                  onChange={(event) => setTemplateName(event.target.value)}
                  placeholder='e.g. "Sample 1"'
                  className="h-12 max-w-md rounded-xl border-slate-200 text-sm font-medium shadow-none focus-visible:ring-4 focus-visible:ring-blue-50"
                />
                <p className="text-xs font-medium text-slate-500">
                  This name appears in the template list when creating a
                  campaign push.
                </p>
              </div>

              <FieldEditor
                field="subject"
                label={fieldLabels.subject}
                value={template.subject}
                onChange={(value) => updateField("subject", value)}
                onFocus={() => setActiveField("subject")}
                onCursorChange={updateCursor}
                inputRef={subjectRef}
                multiline={false}
              />

              <FieldEditor
                field="body"
                label={fieldLabels.body}
                value={template.body}
                onChange={(value) => updateField("body", value)}
                onFocus={() => setActiveField("body")}
                onCursorChange={updateCursor}
                textareaRef={bodyRef}
                rows={16}
              />

              <FieldEditor
                field="followUp1"
                label={fieldLabels.followUp1}
                value={template.followUp1}
                onChange={(value) => updateField("followUp1", value)}
                onFocus={() => setActiveField("followUp1")}
                onCursorChange={updateCursor}
                textareaRef={followUp1Ref}
                rows={10}
              />

              <FieldEditor
                field="followUp2"
                label={fieldLabels.followUp2}
                value={template.followUp2}
                onChange={(value) => updateField("followUp2", value)}
                onFocus={() => setActiveField("followUp2")}
                onCursorChange={updateCursor}
                textareaRef={followUp2Ref}
                rows={10}
              />
            </>
          )}
        </div>
      </DataSection>
    </main>
  );
}