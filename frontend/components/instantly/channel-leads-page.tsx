"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Send } from "lucide-react";
import { apiGet } from "@/lib/api";
import { Button } from "@/components/ui/button";
import AdminTable, {
  type AdminTableColumn,
} from "@/components/ui/tableComp";
import { FilterSearchInput } from "@/components/shared/filter-search-input";
import { FilterSelect } from "@/components/shared/filter-select";
import { CreateCampaignDialog } from "@/components/instantly/create-campaign-dialog";

type Channel = "Enoylity Technology" | "MHD Tech";

type InstantlyRow = {
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
  instantlyBounceStatus?: string;
  bouncedStatus?: string;
  bounceStatus?: string;
  gatewayBounced?: string;
  foundVia?: string;
  pgaScore?: number;
  campaignName?: string;
  isBounced?: boolean;
  bounceReason?: string;
  bouncedAt?: string;
  raw?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
};

const PAGE_SIZE = 1000;
const ALL_VALUE = "All";
const PUSHED_EMPTY_VALUE = "__PUSHED_EMPTY__";
const PUSHED_FILLED_VALUE = "__PUSHED_FILLED__";
const PUSHED_EMPTY_LABEL = "Show only empty";
const PUSHED_FILLED_LABEL = "Show all pushed only";

function clean(value: unknown) {
  const text = String(value || "").trim();

  if (!text) return "";

  const lower = text.toLowerCase();

  if (
    ["-", "n/a", "na", "none", "null", "undefined", "not found"].includes(lower)
  ) {
    return "";
  }

  return text;
}

function getInstantlyBouncedStatus(row: InstantlyRow) {
  const value =
    clean(row.instantlyBounced) ||
    clean(row.instantlyBounceStatus) ||
    clean(row.bouncedStatus) ||
    clean(row.bounceStatus) ||
    clean(row.raw?.instantlyBounced) ||
    clean(row.raw?.instantlyBounceStatus) ||
    clean(row.raw?.bouncedStatus) ||
    clean(row.raw?.bounceStatus);

  if (value) return value;

  if (row.isBounced || row.raw?.isBounced) {
    const reason = clean(row.bounceReason || row.raw?.bounceReason);
    return reason ? `Bounced - ${reason}` : "Bounced";
  }

  if (clean(row.bouncedAt || row.raw?.bouncedAt)) {
    return "Bounced";
  }

  return "Not bounced";
}

function getClickableUrl(value?: string) {
  const text = clean(value);

  if (!text) return "";

  if (text.startsWith("http://") || text.startsWith("https://")) return text;
  if (text.startsWith("www.")) return `https://${text}`;
  if (/^[a-z0-9.-]+\.[a-z]{2,}/i.test(text)) return `https://${text}`;

  return "";
}

function getUniqueOptions(
  rows: InstantlyRow[],
  getter: (row: InstantlyRow) => string
) {
  const values = rows
    .map(getter)
    .map(clean)
    .filter(Boolean)
    .filter((value) => value !== "-");

  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function toOptions(items: string[]) {
  return [
    { label: ALL_VALUE, value: ALL_VALUE },
    ...items.map((item) => ({ label: item, value: item })),
  ];
}

function toPushedStatusOptions(items: string[]) {
  return [
    { label: ALL_VALUE, value: ALL_VALUE },
    { label: PUSHED_EMPTY_LABEL, value: PUSHED_EMPTY_VALUE },
    { label: PUSHED_FILLED_LABEL, value: PUSHED_FILLED_VALUE },
    ...items.map((item) => ({ label: item, value: item })),
  ];
}

function getSearchText(row: InstantlyRow) {
  return [
    row.firstName,
    row.email,
    row.companyName,
    row.productName,
    row.relatedVideo,
    row.competitor1,
    row.competitor2,
    row.pushedStatus,
    row.verificationStatus,
    row.foundVia,
    row.campaignName,
    getInstantlyBouncedStatus(row),
    row.gatewayBounced,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function StatusBadge({
  value,
  emptyLabel = "-",
}: {
  value?: string;
  emptyLabel?: string;
}) {
  const text = clean(value);

  if (!text) {
    if (emptyLabel !== "-") {
      return (
        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
          {emptyLabel}
        </span>
      );
    }

    return <span className="text-slate-300">-</span>;
  }

  const lower = text.toLowerCase();

  if (
    [
      "done",
      "completed",
      "success",
      "pushed",
      "verified",
      "valid",
      "no",
      "false",
      "safe",
      "not bounced",
    ].includes(lower) ||
    lower.startsWith("pushed")
  ) {
    return (
      <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        {text}
      </span>
    );
  }

  if (["pending", "queued", "processing", "running"].includes(lower)) {
    return (
      <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
        {text}
      </span>
    );
  }

  if (["failed", "error", "invalid", "bounced", "yes", "true"].includes(lower)) {
    return (
      <span className="inline-flex rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
        {text}
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
      {text}
    </span>
  );
}

function ClickableValue({ value }: { value?: string }) {
  const text = clean(value);

  if (!text) return <span className="text-slate-300">-</span>;

  const url = getClickableUrl(text);

  if (!url) {
    return (
      <span className="whitespace-normal break-words !font-medium !text-slate-700">
        {text}
      </span>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex max-w-full items-center break-all !font-medium !text-blue-600 !underline !underline-offset-4 hover:!text-blue-700"
    >
      <span>{text}</span>
      <ExternalLink className="ml-1.5 h-3.5 w-3.5 shrink-0" />
    </a>
  );
}

function MultilineClickableCell({ value }: { value?: string }) {
  const lines = String(value || "")
    .split(/\n|,/)
    .map((item) => clean(item))
    .filter(Boolean);

  if (lines.length === 0) return <span className="text-slate-300">-</span>;

  return (
    <div className="space-y-1">
      {lines.map((line, index) => (
        <div key={`${line}-${index}`}>
          <ClickableValue value={line} />
        </div>
      ))}
    </div>
  );
}

export function ChannelLeadsPage({
  channel,
  heading,
  description,
  endpoint,
  relatedVideoHeader,
  campaignsHref,
}: {
  channel: Channel;
  heading: string;
  description: string;
  endpoint: string;
  relatedVideoHeader: string;
  campaignsHref: string;
}) {
  const router = useRouter();

  const [rows, setRows] = useState<InstantlyRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [pushedStatus, setPushedStatus] = useState(ALL_VALUE);
  const [verificationStatus, setVerificationStatus] = useState(ALL_VALUE);
  const [instantlyBounced, setInstantlyBounced] = useState(ALL_VALUE);
  const [foundVia, setFoundVia] = useState(ALL_VALUE);
  const [campaignFilter, setCampaignFilter] = useState(ALL_VALUE);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);

  const [page, setPage] = useState(1);

  async function loadRows() {
    setLoading(true);

    try {
      const response = await apiGet(endpoint);
      setRows(response?.data || []);
    } catch {
      setRows([]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);

  const pushedStatusOptions = useMemo(
    () => getUniqueOptions(rows, (row) => row.pushedStatus || ""),
    [rows]
  );
  const verificationStatusOptions = useMemo(
    () => getUniqueOptions(rows, (row) => row.verificationStatus || ""),
    [rows]
  );
  const instantlyBouncedOptions = useMemo(
    () => getUniqueOptions(rows, (row) => getInstantlyBouncedStatus(row)),
    [rows]
  );
  const foundViaOptions = useMemo(
    () => getUniqueOptions(rows, (row) => row.foundVia || ""),
    [rows]
  );
  const campaignOptions = useMemo(
    () => getUniqueOptions(rows, (row) => row.campaignName || ""),
    [rows]
  );

  const hasActiveFilters =
    Boolean(search.trim()) ||
    pushedStatus !== ALL_VALUE ||
    verificationStatus !== ALL_VALUE ||
    instantlyBounced !== ALL_VALUE ||
    foundVia !== ALL_VALUE ||
    campaignFilter !== ALL_VALUE;

  useEffect(() => {
    setPage(1);
  }, [
    search,
    pushedStatus,
    verificationStatus,
    instantlyBounced,
    foundVia,
    campaignFilter,
  ]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return rows.filter((row) => {
      const cleanedPushedStatus = clean(row.pushedStatus);

      const matchesSearch = !query || getSearchText(row).includes(query);

      const matchesPushedStatus =
        pushedStatus === ALL_VALUE ||
        (pushedStatus === PUSHED_EMPTY_VALUE && !cleanedPushedStatus) ||
        (pushedStatus === PUSHED_FILLED_VALUE && Boolean(cleanedPushedStatus)) ||
        cleanedPushedStatus === pushedStatus;

      const matchesVerificationStatus =
        verificationStatus === ALL_VALUE ||
        clean(row.verificationStatus) === verificationStatus;

      const matchesInstantlyBounced =
        instantlyBounced === ALL_VALUE ||
        clean(getInstantlyBouncedStatus(row)) === instantlyBounced;

      const matchesFoundVia =
        foundVia === ALL_VALUE || clean(row.foundVia) === foundVia;

      const matchesCampaign =
        campaignFilter === ALL_VALUE ||
        clean(row.campaignName) === campaignFilter;

      return (
        matchesSearch &&
        matchesPushedStatus &&
        matchesVerificationStatus &&
        matchesInstantlyBounced &&
        matchesFoundVia &&
        matchesCampaign
      );
    });
  }, [
    rows,
    search,
    pushedStatus,
    verificationStatus,
    instantlyBounced,
    foundVia,
    campaignFilter,
  ]);

  const visibleRows = useMemo(
    () => filteredRows.slice(0, page * PAGE_SIZE),
    [filteredRows, page]
  );

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));

  // Only unpushed, non-bounced leads are eligible for a new campaign.
  const selectableIds = useMemo(
    () =>
      filteredRows
        .filter(
          (row) =>
            !clean(row.pushedStatus) &&
            clean(getInstantlyBouncedStatus(row)).toLowerCase() !== "bounced"
        )
        .map((row) => clean(row._id))
        .filter(Boolean),
    [filteredRows]
  );

  const allSelectableSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id));

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds((prev) => {
      if (allSelectableSelected) {
        const next = new Set(prev);
        selectableIds.forEach((id) => next.delete(id));
        return next;
      }
      return new Set([...prev, ...selectableIds]);
    });
  }

  function clearFilters() {
    setSearch("");
    setPushedStatus(ALL_VALUE);
    setVerificationStatus(ALL_VALUE);
    setInstantlyBounced(ALL_VALUE);
    setFoundVia(ALL_VALUE);
    setCampaignFilter(ALL_VALUE);
    setPage(1);
  }

  const columns = useMemo<AdminTableColumn<InstantlyRow>[]>(
    () => [
      {
        id: "select",
        header: (
          <input
            type="checkbox"
            checked={allSelectableSelected}
            onChange={toggleAll}
            className="h-4 w-4 rounded border-slate-300"
            title="Select all eligible (unpushed, not bounced) leads"
          />
        ),
        align: "center",
        widthClassName: "w-[46px]",
        render: (row) => {
          const id = clean(row._id);
          const eligible =
            !clean(row.pushedStatus) &&
            clean(getInstantlyBouncedStatus(row)).toLowerCase() !== "bounced";

          return (
            <input
              type="checkbox"
              disabled={!eligible}
              checked={selectedIds.has(id)}
              onChange={() => toggleRow(id)}
              className="h-4 w-4 rounded border-slate-300 disabled:opacity-30"
            />
          );
        },
      },
      {
        id: "firstName",
        header: "First Name",
        widthClassName: "min-w-[140px]",
        render: (row) => clean(row.firstName) || "-",
      },
      {
        id: "email",
        header: "Email",
        widthClassName: "min-w-[240px]",
        render: (row) => (
          <span className="break-all !font-medium !text-slate-700">
            {clean(row.email) || "-"}
          </span>
        ),
      },
      {
        id: "companyName",
        header: "Company",
        widthClassName: "min-w-[170px]",
        render: (row) => (
          <span className="font-semibold text-slate-950">
            {clean(row.companyName) || "-"}
          </span>
        ),
      },
      {
        id: "foundVia",
        header: "Found Via",
        widthClassName: "min-w-[140px]",
        render: (row) => clean(row.foundVia) || "-",
      },
      {
        id: "pgaScore",
        header: "PGA",
        align: "center",
        widthClassName: "min-w-[90px]",
        render: (row) =>
          typeof row.pgaScore === "number" ? (
            <span className="font-semibold text-slate-700">{row.pgaScore}</span>
          ) : (
            <span className="text-slate-300">-</span>
          ),
      },
      {
        id: "productName",
        header: "Product Name",
        widthClassName: "min-w-[220px]",
        render: (row) => clean(row.productName) || "-",
      },
      {
        id: "relatedVideo",
        header: relatedVideoHeader,
        widthClassName: "min-w-[300px]",
        render: (row) => <MultilineClickableCell value={row.relatedVideo} />,
      },
      {
        id: "campaignName",
        header: "Added to Campaign",
        widthClassName: "min-w-[200px]",
        render: (row) =>
          clean(row.campaignName) ? (
            <StatusBadge value={row.campaignName} />
          ) : (
            <span className="text-slate-300">-</span>
          ),
      },
      {
        id: "pushedStatus",
        header: "Pushed Status",
        widthClassName: "min-w-[200px]",
        render: (row) => <StatusBadge value={row.pushedStatus} emptyLabel="" />,
      },
      {
        id: "verificationStatus",
        header: "Verification",
        widthClassName: "min-w-[160px]",
        render: (row) => <StatusBadge value={row.verificationStatus} />,
      },
      {
        id: "instantlyBounced",
        header: "Instantly Bounced",
        widthClassName: "min-w-[170px]",
        render: (row) => <StatusBadge value={getInstantlyBouncedStatus(row)} />,
      },
      {
        id: "gatewayBounced",
        header: "Gateway",
        widthClassName: "min-w-[150px]",
        render: (row) => <StatusBadge value={row.gatewayBounced} />,
      },
    ],
    [allSelectableSelected, selectedIds, relatedVideoHeader]
  );

  const selectedLeads = useMemo(
    () => rows.filter((row) => selectedIds.has(clean(row._id))),
    [rows, selectedIds]
  );

  return (
    <main className="w-full space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            {heading}
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            {description}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => router.push(campaignsHref)}
          className="h-11 rounded-xl"
        >
          View Campaigns
        </Button>
      </div>

      <section className="space-y-3">
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_1fr_auto] xl:items-end">
          <FilterSearchInput
            label="Search"
            value={search}
            onChange={setSearch}
            placeholder="Search name, email, company, product..."
          />
          <FilterSelect
            label="Found Via"
            value={foundVia}
            onChange={setFoundVia}
            options={toOptions(foundViaOptions)}
          />
          <FilterSelect
            label="Campaign"
            value={campaignFilter}
            onChange={setCampaignFilter}
            options={toOptions(campaignOptions)}
          />
          <FilterSelect
            label="Pushed Status"
            value={pushedStatus}
            onChange={setPushedStatus}
            options={toPushedStatusOptions(pushedStatusOptions)}
          />
          <FilterSelect
            label="Verification"
            value={verificationStatus}
            onChange={setVerificationStatus}
            options={toOptions(verificationStatusOptions)}
          />
          <FilterSelect
            label="Instantly Bounced"
            value={instantlyBounced}
            onChange={setInstantlyBounced}
            options={toOptions(instantlyBouncedOptions)}
          />
          <Button
            type="button"
            variant="ghost"
            onClick={clearFilters}
            disabled={!hasActiveFilters}
            className="h-12 rounded-xl"
          >
            Clear
          </Button>
        </div>
      </section>

      {selectedIds.size > 0 ? (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50/95 px-4 py-3 shadow-sm backdrop-blur">
          <span className="text-sm font-semibold text-blue-900">
            {selectedIds.size} lead(s) selected
          </span>
          <Button
            type="button"
            size="sm"
            onClick={() => setDialogOpen(true)}
            className="h-9 rounded-md bg-blue-600 text-white hover:bg-blue-700"
          >
            <Send className="mr-1.5 h-3.5 w-3.5" />
            Create Campaign
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setSelectedIds(new Set())}
            className="h-9 rounded-md text-slate-600"
          >
            Clear selection
          </Button>
        </div>
      ) : null}

      <AdminTable
        data={visibleRows}
        columns={columns}
        rowKey={(row, index) => row._id || `${row.email}-${index}`}
        loading={loading}
        loadingRows={8}
        emptyTitle={loading ? `Loading ${heading}...` : `No ${heading} rows yet.`}
        emptyDescription={
          hasActiveFilters
            ? "No records match your current filters."
            : "Export leads first."
        }
        containerClassName="rounded-xl shadow-none"
        pagination={{
          page,
          totalPages,
          totalItems: filteredRows.length,
          limit: PAGE_SIZE,
          onPageChange: setPage,
          loading,
          showSummary: true,
          showRowsSelector: false,
        }}
      />

      <CreateCampaignDialog
        open={dialogOpen}
        channel={channel}
        leads={selectedLeads.map((row) => ({
          _id: clean(row._id),
          firstName: clean(row.firstName),
          email: clean(row.email),
          companyName: clean(row.companyName),
          productName: clean(row.productName),
        }))}
        onClose={() => setDialogOpen(false)}
        onPushed={(campaignId) => {
          setDialogOpen(false);
          setSelectedIds(new Set());
          loadRows();
          if (campaignId) {
            router.push(campaignsHref);
          }
        }}
      />
    </main>
  );
}
