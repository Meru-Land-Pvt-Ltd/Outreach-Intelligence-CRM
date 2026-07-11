"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { apiGet } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import AdminTable, {
  type AdminTableColumn,
} from "@/components/ui/tableComp";

type LeadRow = {
  _id?: string;
  firstName?: string;
  email?: string;
  companyName?: string;
  productName?: string;
  foundVia?: string;
  pgaScore?: number;
  verificationStatus?: string;
  instantlyBounced?: string;
  pushedStatus?: string;
  pushedAt?: string;
};

function clean(value: unknown) {
  return String(value || "").trim();
}

function StatusPill({ value }: { value?: string }) {
  const text = clean(value);
  if (!text) return <span className="text-slate-300">-</span>;

  const lower = text.toLowerCase();
  const cls =
    lower.includes("ok") || lower.includes("verified") || lower.startsWith("pushed")
      ? "bg-emerald-50 text-emerald-700"
      : lower.includes("bounce") || lower.includes("invalid")
        ? "bg-rose-50 text-rose-700"
        : "bg-slate-100 text-slate-600";

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>
      {text}
    </span>
  );
}

export function CampaignDetails({
  campaignId,
  backHref,
}: {
  campaignId: string;
  backHref: string;
}) {
  const router = useRouter();
  const [campaign, setCampaign] = useState<any>(null);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    (async () => {
      const response: any = await apiGet(
        `/instantly/campaigns/${campaignId}/leads`
      );

      if (active) {
        setCampaign(response?.campaign || null);
        setLeads(response?.data || []);
        setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [campaignId]);

  const columns = useMemo<AdminTableColumn<LeadRow>[]>(
    () => [
      {
        id: "index",
        header: "#",
        align: "center",
        widthClassName: "min-w-[60px]",
        render: (_row, index) => (
          <span className="text-sm font-semibold text-slate-500">
            {index + 1}
          </span>
        ),
      },
      {
        id: "firstName",
        header: "First Name",
        widthClassName: "min-w-[130px]",
        render: (row) => clean(row.firstName) || "-",
      },
      {
        id: "email",
        header: "Email",
        widthClassName: "min-w-[240px]",
        render: (row) => (
          <span className="break-all font-medium text-slate-700">
            {clean(row.email) || "-"}
          </span>
        ),
      },
      {
        id: "companyName",
        header: "Company",
        widthClassName: "min-w-[160px]",
        render: (row) => (
          <span className="font-semibold text-slate-950">
            {clean(row.companyName) || "-"}
          </span>
        ),
      },
      {
        id: "foundVia",
        header: "Found Via",
        widthClassName: "min-w-[130px]",
        render: (row) => clean(row.foundVia) || "-",
      },
      {
        id: "pgaScore",
        header: "PGA",
        align: "center",
        widthClassName: "min-w-[80px]",
        render: (row) =>
          typeof row.pgaScore === "number" ? row.pgaScore : "-",
      },
      {
        id: "verificationStatus",
        header: "Verification",
        widthClassName: "min-w-[150px]",
        render: (row) => <StatusPill value={row.verificationStatus} />,
      },
      {
        id: "instantlyBounced",
        header: "Bounced",
        widthClassName: "min-w-[140px]",
        render: (row) => <StatusPill value={row.instantlyBounced} />,
      },
      {
        id: "pushedAt",
        header: "Pushed",
        widthClassName: "min-w-[170px]",
        render: (row) =>
          row.pushedAt
            ? new Date(row.pushedAt).toLocaleString("en-IN", {
                dateStyle: "medium",
                timeStyle: "short",
              })
            : "-",
      },
    ],
    []
  );

  return (
    <main className="w-full space-y-6">
      <div>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push(backHref)}
          className="mb-2 h-9 rounded-md px-2 text-slate-600"
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back to campaigns
        </Button>

        <h1 className="text-2xl font-bold tracking-tight text-slate-950">
          {campaign?.campaignName || "Campaign"}
        </h1>

        {campaign ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-medium text-slate-500">
            <span>{campaign.channel}</span>
            <span>·</span>
            <span>
              {campaign.startDate} → {campaign.endDate}
            </span>
            <span>·</span>
            <span>{leads.length} lead(s)</span>
            {Array.isArray(campaign.niches)
              ? campaign.niches.map((niche: string) => (
                  <Badge key={niche} variant="secondary">
                    {niche}
                  </Badge>
                ))
              : null}
          </div>
        ) : null}
      </div>

      <AdminTable
        data={leads}
        columns={columns}
        rowKey={(row, index) => row._id || `${row.email}-${index}`}
        loading={loading}
        loadingRows={8}
        emptyDescription="No leads in this campaign yet."
        containerClassName="rounded-xl shadow-none"
      />
    </main>
  );
}
