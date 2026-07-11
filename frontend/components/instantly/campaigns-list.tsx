"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet } from "@/lib/api";
import { Badge } from "@/components/ui/badge";

type Channel = "Enoylity Technology" | "MHD Tech";

type CampaignCard = {
  _id?: string;
  campaignName?: string;
  status?: string;
  derivedStatus?: string;
  startDate?: string;
  endDate?: string;
  leadsPushed?: number;
  leadsInCampaign?: number;
  bouncedCount?: number;
  verifiedCount?: number;
  niche?: string;
  niches?: string[];
};

function statusClass(status: string) {
  const lower = status.toLowerCase();
  if (lower.includes("complete")) return "bg-slate-100 text-slate-600";
  if (lower.includes("active") || lower.includes("running") || lower.includes("launch"))
    return "bg-emerald-50 text-emerald-700";
  if (lower.includes("created") || lower.includes("scheduled"))
    return "bg-amber-50 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

export function CampaignsList({
  channel,
  heading,
  detailsBase,
}: {
  channel: Channel;
  heading: string;
  detailsBase: string;
}) {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<CampaignCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    (async () => {
      const response: any = await apiGet(
        `/instantly/campaigns?channel=${encodeURIComponent(channel)}`
      );

      if (active) {
        setCampaigns(response?.data || []);
        setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [channel]);

  return (
    <main className="w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950">
          {heading}
        </h1>
        <p className="mt-1 text-sm font-medium text-slate-500">
          Campaigns pushed to Instantly for this channel.
        </p>
      </div>

      {loading ? (
        <p className="text-sm font-medium text-slate-500">Loading campaigns…</p>
      ) : campaigns.length === 0 ? (
        <p className="text-sm font-medium text-slate-500">
          No campaigns yet. Create one from the Instantly leads page.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {campaigns.map((campaign) => {
            const status = campaign.derivedStatus || campaign.status || "Active";

            return (
              <button
                key={campaign._id}
                type="button"
                onClick={() => router.push(`${detailsBase}/${campaign._id}`)}
                className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-base font-bold text-slate-950">
                    {campaign.campaignName || "Untitled"}
                  </h2>
                  <span
                    className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(
                      status
                    )}`}
                  >
                    {status}
                  </span>
                </div>

                <p className="mt-2 text-xs font-medium text-slate-500">
                  {campaign.startDate || "-"} → {campaign.endDate || "-"}
                </p>

                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-slate-50 py-2">
                    <p className="text-sm font-bold text-slate-900">
                      {campaign.leadsInCampaign ?? campaign.leadsPushed ?? 0}
                    </p>
                    <p className="text-[11px] font-semibold uppercase text-slate-500">
                      Leads
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 py-2">
                    <p className="text-sm font-bold text-emerald-700">
                      {campaign.verifiedCount ?? 0}
                    </p>
                    <p className="text-[11px] font-semibold uppercase text-slate-500">
                      Verified
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 py-2">
                    <p className="text-sm font-bold text-rose-700">
                      {campaign.bouncedCount ?? 0}
                    </p>
                    <p className="text-[11px] font-semibold uppercase text-slate-500">
                      Bounced
                    </p>
                  </div>
                </div>

                {campaign.niches && campaign.niches.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {campaign.niches.slice(0, 4).map((niche) => (
                      <Badge key={niche} variant="secondary">
                        {niche}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </main>
  );
}
