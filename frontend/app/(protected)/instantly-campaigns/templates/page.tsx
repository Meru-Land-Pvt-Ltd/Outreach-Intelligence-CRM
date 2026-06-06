"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function Textarea({
  value,
  onChange,
  rows = 8
}: {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <textarea
      rows={rows}
      className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export default function InstantlyTemplatesPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [message, setMessage] = useState("");

  async function loadTemplates() {
    const response = await apiGet("/instantly/templates");
    setTemplates(response?.data || []);
  }

  useEffect(() => {
    loadTemplates();
  }, []);

  function updateTemplate(index: number, field: string, value: string) {
    const next = [...templates];
    next[index] = {
      ...next[index],
      [field]: value
    };
    setTemplates(next);
  }

  async function saveTemplate(template: any) {
    setMessage("Saving template...");

    const response = await apiPost("/instantly/templates", {
      channel: template.channel,
      subject: template.subject,
      body: template.body,
      followUp1: template.followUp1,
      followUp2: template.followUp2
    });

    if (response.success) {
      setMessage(template.channel + " template saved.");
      await loadTemplates();
    } else {
      setMessage(response.message || "Template save failed.");
    }
  }

  return (
    <div className="space-y-6">
      {message ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {message}
        </div>
      ) : null}

      {templates.map((template, index) => (
        <Card key={template._id || template.channel}>
          <CardHeader>
            <CardTitle>{template.channel}</CardTitle>
            <CardDescription>
              These replace the old Google Sheet template tabs.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-800">Subject</label>
              <Input
                value={template.subject || ""}
                onChange={(e) => updateTemplate(index, "subject", e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-800">Body</label>
              <Textarea
                value={template.body || ""}
                onChange={(value) => updateTemplate(index, "body", value)}
                rows={14}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-800">Follow Up 1</label>
              <Textarea
                value={template.followUp1 || ""}
                onChange={(value) => updateTemplate(index, "followUp1", value)}
                rows={8}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-800">Follow Up 2</label>
              <Textarea
                value={template.followUp2 || ""}
                onChange={(value) => updateTemplate(index, "followUp2", value)}
                rows={8}
              />
            </div>

            <Button onClick={() => saveTemplate(template)}>
              <Save className="mr-2 h-4 w-4" />
              Save Template
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
