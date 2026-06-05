"use client";

import { useState } from "react";
import { CalendarDays, Clock, Send, Users } from "lucide-react";
import { apiPost } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function today() {
  return new Date().toISOString().substring(0, 10);
}

function plusDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().substring(0, 10);
}

function Field({
  label,
  hint,
  children
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-slate-800">{label}</label>
      {children}
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export default function InstantlyPushPage() {
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "info">("info");
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    channel: "Enoylity Technology",
    campaignName: "Outreach Campaign " + today(),
    numLeads: "5",
    startDate: today(),
    endDate: plusDays(14),
    startTime: "09:00",
    endTime: "16:00",
    dailyLimit: "160"
  });

  async function pushCampaign(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    setMessageType("info");
    setMessage("Creating campaign and pushing leads...");

    const response = await apiPost("/instantly/push", {
      ...form,
      numLeads: Number(form.numLeads),
      dailyLimit: Number(form.dailyLimit)
    });

    if (response.success) {
      setMessageType("success");
      setMessage(
        "Campaign pushed successfully. Leads: " +
          response.totalPushed +
          ". Campaign ID: " +
          response.campaignId
      );
    } else {
      setMessageType("error");
      setMessage(response.message || "Push failed.");
    }

    setLoading(false);
  }

  const messageClass =
    messageType === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : messageType === "error"
        ? "border-red-200 bg-red-50 text-red-800"
        : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Push Campaign</CardTitle>
        <CardDescription>
          Creates one Instantly campaign and pushes verified leads.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={pushCampaign} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Channel" hint="Select sender group and template.">
              <select
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                value={form.channel}
                onChange={(e) => setForm({ ...form, channel: e.target.value })}
              >
                <option>Enoylity Technology</option>
                <option>MHD Tech</option>
              </select>
            </Field>

            <Field label="Campaign Name" hint="Must be unique in Instantly.">
              <Input
                value={form.campaignName}
                onChange={(e) => setForm({ ...form, campaignName: e.target.value })}
              />
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Number of Leads" hint="Start with 2-5 for testing.">
              <div className="relative">
                <Users className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="pl-9"
                  type="number"
                  min="1"
                  value={form.numLeads}
                  onChange={(e) => setForm({ ...form, numLeads: e.target.value })}
                />
              </div>
            </Field>

            <Field label="Daily Limit">
              <Input
                type="number"
                min="1"
                value={form.dailyLimit}
                onChange={(e) => setForm({ ...form, dailyLimit: e.target.value })}
              />
            </Field>

            <Field label="Schedule">
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                {form.startTime} - {form.endTime}
              </div>
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <Field label="Start Date">
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="pl-9"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                />
              </div>
            </Field>

            <Field label="End Date">
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="pl-9"
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                />
              </div>
            </Field>

            <Field label="Start Time">
              <div className="relative">
                <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="pl-9"
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                />
              </div>
            </Field>

            <Field label="End Time">
              <div className="relative">
                <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="pl-9"
                  type="time"
                  value={form.endTime}
                  onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                />
              </div>
            </Field>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-500">
              Leads are verified and gateway-checked before pushing.
            </div>

            <Button type="submit" disabled={loading}>
              <Send className="mr-2 h-4 w-4" />
              {loading ? "Pushing Campaign..." : "Push Campaign"}
            </Button>
          </div>
        </form>

        {message ? (
          <div className={`mt-5 rounded-lg border px-4 py-3 text-sm ${messageClass}`}>
            {message}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
