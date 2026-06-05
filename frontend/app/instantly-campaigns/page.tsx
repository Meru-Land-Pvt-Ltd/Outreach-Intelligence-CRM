"use client";

import { useState } from "react";
import Link from "next/link";
import { apiPost } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
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

export default function InstantlyControlPanelPage() {
  const [message, setMessage] = useState("");
  const [loadingAction, setLoadingAction] = useState("");

  const [pushForm, setPushForm] = useState({
    channel: "Enoylity Technology",
    campaignName: "Outreach Campaign " + today(),
    numLeads: "5",
    startDate: today(),
    endDate: plusDays(14),
    startTime: "09:00",
    endTime: "16:00",
    dailyLimit: "160"
  });

  const [batchForm, setBatchForm] = useState({
    channel: "Enoylity Technology",
    numLeads: "5",
    startDate: today(),
    startTime: "09:00",
    endTime: "16:00",
    dailyLimit: "160",
    numWeekdays: "3"
  });

  async function runAction(
    actionName: string,
    handler: () => Promise<{ success?: boolean; message?: string }>
  ) {
    setLoadingAction(actionName);
    setMessage(actionName + " started...");

    try {
      const response = await handler();

      if (response?.success) {
        setMessage(response.message || actionName + " completed successfully.");
      } else {
        setMessage(response?.message || actionName + " failed.");
      }
    } catch (error: any) {
      setMessage(error?.message || actionName + " failed.");
    }

    setLoadingAction("");
  }

  async function exportLeads() {
    await runAction("Export Leads", async () => {
      const response: any = await apiPost("/instantly/export", {});

      if (response?.success) {
        return {
          success: true,
          message:
            "Export complete. New rows: " +
            response.exported +
            ", skipped existing emails: " +
            response.skippedAlreadyExported +
            ", contacts fixed: " +
            response.contactsNormalized
        };
      }

      return response;
    });
  }

  async function fillCompetitors() {
    await runAction("Fill Competitors", async () => {
      const response: any = await apiPost("/instantly/competitors/fill", {});

      if (response?.success) {
        return {
          success: true,
          message:
            "Competitors filled. Companies: " +
            response.companies +
            ", rows updated: " +
            response.updated
        };
      }

      return response;
    });
  }

  async function refreshLatestUploads() {
    await runAction("Refresh Latest Uploads", async () => {
      const response: any = await apiPost("/jobs/refresh-latest-reviews", {});

      if (response?.success) {
        return {
          success: true,
          message: "Refresh latest uploads queued. Job ID: " + response.jobId
        };
      }

      return response;
    });
  }

  async function pushSingle() {
    await runAction("Push Campaign", async () => {
      const response: any = await apiPost("/instantly/push", {
        ...pushForm,
        numLeads: Number(pushForm.numLeads),
        dailyLimit: Number(pushForm.dailyLimit)
      });

      if (response?.success) {
        return {
          success: true,
          message:
            "Campaign pushed. Leads: " +
            response.totalPushed +
            ". Campaign ID: " +
            response.campaignId
        };
      }

      return response;
    });
  }

  async function pushBatch() {
    await runAction("Batch Push", async () => {
      const response: any = await apiPost("/instantly/batch-push", {
        ...batchForm,
        numLeads: Number(batchForm.numLeads),
        dailyLimit: Number(batchForm.dailyLimit),
        numWeekdays: Number(batchForm.numWeekdays)
      });

      if (response?.success) {
        return {
          success: true,
          message:
            "Batch push complete. Campaigns: " +
            response.createdCampaigns +
            ", leads pushed: " +
            response.totalPushed
        };
      }

      return response;
    });
  }

  async function pullBounces(mode: "crm" | "all") {
    await runAction("Pull Bounces", async () => {
      const response: any = await apiPost("/instantly/pull-bounced", {
        mode
      });

      if (response?.success) {
        return {
          success: true,
          message:
            "Bounces pulled. Campaigns scanned: " +
            response.campaignsScanned +
            ", bounced emails: " +
            response.uniqueBouncedEmails +
            ", rows updated: " +
            response.totalUpdated
        };
      }

      return response;
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Control Panel</CardTitle>
          <CardDescription>
            Same as old Google Sheet control panel. Export first, fill competitors, then push.
          </CardDescription>
        </CardHeader>

        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <Button
            type="button"
            onClick={exportLeads}
            disabled={Boolean(loadingAction)}
          >
            {loadingAction === "Export Leads" ? "Exporting..." : "Export Leads"}
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={fillCompetitors}
            disabled={Boolean(loadingAction)}
          >
            {loadingAction === "Fill Competitors"
              ? "Filling..."
              : "Fill Competitors"}
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={refreshLatestUploads}
            disabled={Boolean(loadingAction)}
          >
            {loadingAction === "Refresh Latest Uploads"
              ? "Queuing..."
              : "Refresh Latest Uploads"}
          </Button>

          <Button asChild variant="outline">
            <Link href="/instantly-campaigns/enoylity">Enoylity Rows</Link>
          </Button>

          <Button asChild variant="outline">
            <Link href="/instantly-campaigns/mhd">MHD Rows</Link>
          </Button>

          <Button asChild variant="outline">
            <Link href="/instantly-campaigns/push-logs">Push Log</Link>
          </Button>
        </CardContent>
      </Card>

      {message ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {message}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Push Single Campaign</CardTitle>
            <CardDescription>
              Test with 2–5 leads first.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                pushSingle();
              }}
              className="grid gap-4 md:grid-cols-2"
            >
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  Channel
                </span>
                <select
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                  value={pushForm.channel}
                  onChange={(event) =>
                    setPushForm({ ...pushForm, channel: event.target.value })
                  }
                >
                  <option>Enoylity Technology</option>
                  <option>MHD Tech</option>
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  Campaign Name
                </span>
                <Input
                  value={pushForm.campaignName}
                  onChange={(event) =>
                    setPushForm({
                      ...pushForm,
                      campaignName: event.target.value
                    })
                  }
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  Number of Leads
                </span>
                <Input
                  type="number"
                  value={pushForm.numLeads}
                  onChange={(event) =>
                    setPushForm({ ...pushForm, numLeads: event.target.value })
                  }
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  Daily Limit
                </span>
                <Input
                  type="number"
                  value={pushForm.dailyLimit}
                  onChange={(event) =>
                    setPushForm({ ...pushForm, dailyLimit: event.target.value })
                  }
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  Start Date
                </span>
                <Input
                  type="date"
                  value={pushForm.startDate}
                  onChange={(event) =>
                    setPushForm({ ...pushForm, startDate: event.target.value })
                  }
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  End Date
                </span>
                <Input
                  type="date"
                  value={pushForm.endDate}
                  onChange={(event) =>
                    setPushForm({ ...pushForm, endDate: event.target.value })
                  }
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  Start Time
                </span>
                <Input
                  type="time"
                  value={pushForm.startTime}
                  onChange={(event) =>
                    setPushForm({ ...pushForm, startTime: event.target.value })
                  }
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  End Time
                </span>
                <Input
                  type="time"
                  value={pushForm.endTime}
                  onChange={(event) =>
                    setPushForm({ ...pushForm, endTime: event.target.value })
                  }
                />
              </label>

              <div className="md:col-span-2">
                <Button
                  type="submit"
                  className="w-full"
                  disabled={Boolean(loadingAction)}
                >
                  {loadingAction === "Push Campaign"
                    ? "Pushing..."
                    : "Push Campaign"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Batch Push</CardTitle>
            <CardDescription>
              Creates weekday campaigns.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                pushBatch();
              }}
              className="grid gap-4 md:grid-cols-2"
            >
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  Channel
                </span>
                <select
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                  value={batchForm.channel}
                  onChange={(event) =>
                    setBatchForm({ ...batchForm, channel: event.target.value })
                  }
                >
                  <option>Enoylity Technology</option>
                  <option>MHD Tech</option>
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  Leads Per Day
                </span>
                <Input
                  type="number"
                  value={batchForm.numLeads}
                  onChange={(event) =>
                    setBatchForm({ ...batchForm, numLeads: event.target.value })
                  }
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  Start Date
                </span>
                <Input
                  type="date"
                  value={batchForm.startDate}
                  onChange={(event) =>
                    setBatchForm({ ...batchForm, startDate: event.target.value })
                  }
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  Weekdays
                </span>
                <Input
                  type="number"
                  value={batchForm.numWeekdays}
                  onChange={(event) =>
                    setBatchForm({
                      ...batchForm,
                      numWeekdays: event.target.value
                    })
                  }
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  Start Time
                </span>
                <Input
                  type="time"
                  value={batchForm.startTime}
                  onChange={(event) =>
                    setBatchForm({ ...batchForm, startTime: event.target.value })
                  }
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  End Time
                </span>
                <Input
                  type="time"
                  value={batchForm.endTime}
                  onChange={(event) =>
                    setBatchForm({ ...batchForm, endTime: event.target.value })
                  }
                />
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-slate-700">
                  Daily Limit
                </span>
                <Input
                  type="number"
                  value={batchForm.dailyLimit}
                  onChange={(event) =>
                    setBatchForm({
                      ...batchForm,
                      dailyLimit: event.target.value
                    })
                  }
                />
              </label>

              <div className="md:col-span-2">
                <Button
                  type="submit"
                  className="w-full"
                  variant="outline"
                  disabled={Boolean(loadingAction)}
                >
                  {loadingAction === "Batch Push"
                    ? "Creating..."
                    : "Create Batch Campaigns"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bounce Tracking</CardTitle>
          <CardDescription>
            Use CRM campaigns while testing. Use all campaigns only when you want old sheet behavior.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => pullBounces("crm")}
            disabled={Boolean(loadingAction)}
          >
            Pull CRM Campaign Bounces
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => pullBounces("all")}
            disabled={Boolean(loadingAction)}
          >
            Pull All Instantly Bounces
          </Button>

          <Button asChild variant="outline">
            <Link href="/instantly-campaigns/bounces">Open Bounces</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
