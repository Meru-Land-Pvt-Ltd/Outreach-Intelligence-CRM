"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { apiPost } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function today() {
  return new Date().toISOString().substring(0, 10);
}

export default function BatchPushPage() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    channel: "Enoylity Technology",
    numLeads: "5",
    startDate: today(),
    startTime: "09:00",
    endTime: "16:00",
    dailyLimit: "160",
    numWeekdays: "3"
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    setMessage("Creating batch campaigns...");

    const response = await apiPost("/instantly/batch-push", {
      ...form,
      numLeads: Number(form.numLeads),
      dailyLimit: Number(form.dailyLimit),
      numWeekdays: Number(form.numWeekdays)
    });

    if (response.success) {
      setMessage(
        "Batch complete. Campaigns: " +
          response.createdCampaigns +
          ". Total pushed: " +
          response.totalPushed
      );
    } else {
      setMessage(response.message || "Batch push failed.");
    }

    setLoading(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Batch Push</CardTitle>
        <CardDescription>
          Creates one campaign per weekday, skipping weekends.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-800">Channel</label>
            <select
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
              value={form.channel}
              onChange={(e) => setForm({ ...form, channel: e.target.value })}
            >
              <option>Enoylity Technology</option>
              <option>MHD Tech</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-800">Leads Per Campaign</label>
            <Input
              type="number"
              min="1"
              value={form.numLeads}
              onChange={(e) => setForm({ ...form, numLeads: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-800">Number of Weekdays</label>
            <Input
              type="number"
              min="1"
              value={form.numWeekdays}
              onChange={(e) => setForm({ ...form, numWeekdays: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-800">Start Date</label>
            <Input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-800">Start Time</label>
            <Input
              type="time"
              value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-800">End Time</label>
            <Input
              type="time"
              value={form.endTime}
              onChange={(e) => setForm({ ...form, endTime: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-800">Daily Limit</label>
            <Input
              type="number"
              min="1"
              value={form.dailyLimit}
              onChange={(e) => setForm({ ...form, dailyLimit: e.target.value })}
            />
          </div>

          <div className="flex items-end md:col-span-2">
            <Button type="submit" disabled={loading}>
              <Send className="mr-2 h-4 w-4" />
              {loading ? "Creating..." : "Run Batch Push"}
            </Button>
          </div>
        </form>

        {message ? (
          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {message}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
