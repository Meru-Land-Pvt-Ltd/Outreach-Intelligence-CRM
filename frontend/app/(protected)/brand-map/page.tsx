"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Ban, Globe, RotateCcw, Send, Sparkles, X } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/shared/notice";
import AdminTable, {
  type AdminTableColumn,
} from "@/components/ui/tableComp";
import { FilterSearchInput } from "@/components/shared/filter-search-input";
import { FilterSelect } from "@/components/shared/filter-select";

type BrandMapRow = {
  _id?: string;
  brandName?: string;
  foundVia?: string;
  channelCount?: number;
  channelNames?: string[];
  mostRecentSponsorshipDate?: string;
  recencyTag?: string;
  niche?: string;
  domain?: string;
  selectionStatus?: string;
  selectionUpdatedBy?: string;
  pgaScore?: number;
  pgaSubScores?: {
    productLaunch?: number;
    creatorCollab?: number;
    promoActivity?: number;
    usAvailability?: number;
  };
  pgaSummary?: string;
  pgaStatus?: string;
  pgaCheckedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

type NoticeState = {
  type: "success" | "error";
  text: string;
};

const PAGE_SIZE = 1000;
const ALL_VALUE = "All";
const BULK_CHUNK_SIZE = 400;
const PROCESS_CHUNK_SIZE = 150;

function clean(value: unknown) {
  return String(value || "").trim();
}

function formatDate(value?: string) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getSearchText(row: BrandMapRow) {
  return [
    row.brandName,
    row.foundVia,
    row.domain,
    row.niche,
    row.recencyTag,
    row.mostRecentSponsorshipDate,
    ...(Array.isArray(row.channelNames) ? row.channelNames : []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getUniqueOptions(
  rows: BrandMapRow[],
  getter: (row: BrandMapRow) => string
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
    ...items.map((item) => ({
      label: item,
      value: item,
    })),
  ];
}

function getDomainUrl(value?: string) {
  const domain = clean(value);

  if (!domain) return "";

  if (domain.startsWith("http://") || domain.startsWith("https://")) {
    return domain;
  }

  return `https://${domain}`;
}

function getSelectionStatus(row: BrandMapRow) {
  const value = clean(row.selectionStatus).toLowerCase();

  if (value === "approved" || value === "excluded") return value;

  return "pending";
}

function RecencyBadge({ value }: { value?: string }) {
  const tag = clean(value);

  if (!tag) return <span>-</span>;

  const lower = tag.toLowerCase();

  return (
    <Badge
      className={cn(
        "rounded-full px-2.5 py-1 text-xs font-semibold",
        lower.includes("30") && "bg-emerald-50 text-emerald-700 hover:bg-emerald-50",
        lower.includes("60") && "bg-blue-50 text-blue-700 hover:bg-blue-50",
        lower.includes("90") &&
          !lower.includes("+") &&
          "bg-amber-50 text-amber-700 hover:bg-amber-50",
        (lower.includes("90+") || lower.includes("old")) &&
          "bg-slate-100 text-slate-600 hover:bg-slate-100",
        !lower.includes("30") &&
          !lower.includes("60") &&
          !lower.includes("90") &&
          "bg-slate-100 text-slate-600 hover:bg-slate-100"
      )}
    >
      {tag}
    </Badge>
  );
}

function SelectionBadge({ row }: { row: BrandMapRow }) {
  const status = getSelectionStatus(row);
  const autoGated =
    status === "excluded" && clean(row.selectionUpdatedBy) === "pga-gate";

  return (
    <span
      title={
        autoGated
          ? `Auto-excluded by the PGA gate (score ${row.pgaScore ?? "?"}). Select the row and press Reset to bring it back.`
          : undefined
      }
    >
      <Badge
        className={cn(
          "rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
          status === "approved" &&
            "bg-emerald-50 text-emerald-700 hover:bg-emerald-50",
          status === "excluded" && "bg-rose-50 text-rose-700 hover:bg-rose-50",
          status === "pending" && "bg-slate-100 text-slate-600 hover:bg-slate-100"
        )}
      >
        {autoGated ? `auto-excluded (${row.pgaScore ?? "?"})` : status}
      </Badge>
    </span>
  );
}

function PgaBadge({ row }: { row: BrandMapRow }) {
  if (row.pgaStatus === "running") {
    return (
      <Badge className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50">
        Scoring…
      </Badge>
    );
  }

  const score = Number(row.pgaScore);

  if (!Number.isFinite(score)) {
    return (
      <span
        className="text-sm font-medium text-slate-400"
        title={row.pgaStatus === "failed" ? "Last PGA scan failed" : "Not scored yet"}
      >
        {row.pgaStatus === "failed" ? "failed" : "—"}
      </span>
    );
  }

  const sub = row.pgaSubScores || {};
  const tooltip = [
    `Launch: ${sub.productLaunch ?? "-"}`,
    `Creator collabs: ${sub.creatorCollab ?? "-"}`,
    `Promos: ${sub.promoActivity ?? "-"}`,
    `US availability: ${sub.usAvailability ?? "-"}`,
    "",
    row.pgaSummary || "",
  ].join("\n");

  return (
    <span title={tooltip}>
      <Badge
        className={cn(
          "rounded-full px-2.5 py-1 text-xs font-semibold",
          score >= 70 && "bg-emerald-50 text-emerald-700 hover:bg-emerald-50",
          score >= 35 && score < 70 && "bg-amber-50 text-amber-700 hover:bg-amber-50",
          score < 35 && "bg-rose-50 text-rose-700 hover:bg-rose-50"
        )}
      >
        PGA {score}
      </Badge>
    </span>
  );
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }

  return chunks;
}

export default function BrandMapPage() {
  const [brands, setBrands] = useState<BrandMapRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<NoticeState | null>(null);

  const [search, setSearch] = useState("");
  const [foundVia, setFoundVia] = useState(ALL_VALUE);
  const [niche, setNiche] = useState(ALL_VALUE);
  const [selection, setSelection] = useState(ALL_VALUE);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState("");
  const [scrapingId, setScrapingId] = useState("");
  const [pgaBusyId, setPgaBusyId] = useState("");
  const [pgaJob, setPgaJob] = useState<{
    jobId: string;
    total: number;
  } | null>(null);
  const [pgaProgress, setPgaProgress] = useState(0);

  const [page, setPage] = useState(1);

  const [sortBy, setSortBy] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const NUMERIC_SORT_FIELDS = useMemo(
    () => new Set(["pgaScore", "channelCount", "mostRecentSponsorshipDate"]),
    []
  );

  function handleSort(field: string) {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(field);
      // Numeric columns start highest-first (e.g. PGA 90, 89, 88…).
      setSortOrder(NUMERIC_SORT_FIELDS.has(field) ? "desc" : "asc");
    }
  }

  async function loadBrands() {
    setLoading(true);

    try {
      const response = await apiGet("/brand-map");
      setBrands(response?.data || []);
    } catch {
      setBrands([]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadBrands();
  }, []);

  const foundViaOptions = useMemo(
    () => getUniqueOptions(brands, (row) => row.foundVia || ""),
    [brands]
  );

  const nicheOptions = useMemo(
    () => getUniqueOptions(brands, (row) => row.niche || ""),
    [brands]
  );

  const hasActiveFilters =
    Boolean(search.trim()) ||
    foundVia !== ALL_VALUE ||
    niche !== ALL_VALUE ||
    selection !== ALL_VALUE;

  useEffect(() => {
    setPage(1);
  }, [search, foundVia, niche, selection]);

  const filteredBrands = useMemo(() => {
    const query = search.trim().toLowerCase();

    return brands.filter((brand) => {
      const matchesSearch = !query || getSearchText(brand).includes(query);

      const matchesFoundVia =
        foundVia === ALL_VALUE || clean(brand.foundVia) === foundVia;

      const matchesNiche = niche === ALL_VALUE || clean(brand.niche) === niche;

      const matchesSelection =
        selection === ALL_VALUE ||
        getSelectionStatus(brand) === selection.toLowerCase();

      return (
        matchesSearch && matchesFoundVia && matchesNiche && matchesSelection
      );
    });
  }, [brands, search, foundVia, niche, selection]);

  const sortedBrands = useMemo(() => {
    if (!sortBy) return filteredBrands;

    const numeric = NUMERIC_SORT_FIELDS.has(sortBy);
    const direction = sortOrder === "asc" ? 1 : -1;

    return [...filteredBrands].sort((a: any, b: any) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];

      if (sortBy === "mostRecentSponsorshipDate") {
        aValue = aValue ? new Date(aValue).getTime() : null;
        bValue = bValue ? new Date(bValue).getTime() : null;
      }

      const aMissing = aValue === undefined || aValue === null || aValue === "";
      const bMissing = bValue === undefined || bValue === null || bValue === "";

      // Rows without a value always sink to the bottom, either direction.
      if (aMissing && bMissing) return 0;
      if (aMissing) return 1;
      if (bMissing) return -1;

      if (numeric) {
        return (Number(aValue) - Number(bValue)) * direction;
      }

      return (
        String(aValue).localeCompare(String(bValue), undefined, {
          sensitivity: "base",
        }) * direction
      );
    });
  }, [filteredBrands, sortBy, sortOrder, NUMERIC_SORT_FIELDS]);

  const visibleBrands = useMemo(() => {
    return sortedBrands.slice(0, page * PAGE_SIZE);
  }, [sortedBrands, page]);

  const totalPages = Math.max(1, Math.ceil(filteredBrands.length / PAGE_SIZE));

  const filteredIds = useMemo(
    () => filteredBrands.map((row) => clean(row._id)).filter(Boolean),
    [filteredBrands]
  );

  const allFilteredSelected =
    filteredIds.length > 0 &&
    filteredIds.every((id) => selectedIds.has(id));

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  function toggleAllFiltered() {
    setSelectedIds((prev) => {
      if (allFilteredSelected) {
        const next = new Set(prev);
        filteredIds.forEach((id) => next.delete(id));
        return next;
      }

      return new Set([...prev, ...filteredIds]);
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function runBulkAction(action: "approve" | "exclude" | "reset") {
    const ids = Array.from(selectedIds);

    if (ids.length === 0) return;

    if (
      action === "exclude" &&
      !window.confirm(
        `Exclude ${ids.length} brand(s)? They move to the Exclude list and will be skipped in all future crawls.`
      )
    ) {
      return;
    }

    setBulkBusy(action);
    setNotice(null);

    let updated = 0;
    let removedExclusions = 0;
    let failed = "";

    for (const chunk of chunkArray(ids, BULK_CHUNK_SIZE)) {
      const response: any = await apiPost("/brand-map/bulk-select", {
        ids: chunk,
        action,
      });

      if (response?.success) {
        updated += Number(response.updated || 0);
        removedExclusions += Number(response.removedExclusions || 0);
      } else {
        failed = response?.message || "Bulk action failed.";
        break;
      }
    }

    if (failed) {
      setNotice({ type: "error", text: failed });
    } else {
      setNotice({
        type: "success",
        text:
          action === "exclude"
            ? `${updated} brand(s) excluded and added to the Exclude list.`
            : action === "approve"
              ? `${updated} brand(s) approved.`
              : `${updated} brand(s) reset to pending.` +
                (removedExclusions > 0
                  ? ` ${removedExclusions} entr${removedExclusions === 1 ? "y" : "ies"} removed from the Exclude list, so these brands are fully back in the pipeline.`
                  : ""),
      });
      clearSelection();
      await loadBrands();
    }

    setBulkBusy("");
  }

  async function sendSelectedToCampaign() {
    const ids = Array.from(selectedIds);

    if (ids.length === 0) return;

    if (
      !window.confirm(
        `Send ${ids.length} brand(s) to campaign? Email discovery, verification and Instantly export will run for these brands only.`
      )
    ) {
      return;
    }

    setBulkBusy("send");
    setNotice(null);

    let queued = 0;
    let rejected = 0;
    let failed = "";

    for (const chunk of chunkArray(ids, PROCESS_CHUNK_SIZE)) {
      const response: any = await apiPost("/brand-map/process-selected", {
        brandMapIds: chunk,
      });

      if (response?.success) {
        queued += Number(response.queued || 0);
        rejected += Array.isArray(response.rejected)
          ? response.rejected.length
          : 0;
      } else {
        failed = response?.message || "Failed to queue selected brands.";
        break;
      }
    }

    if (failed) {
      setNotice({ type: "error", text: failed });
    } else {
      setNotice({
        type: "success",
        text:
          `${queued} brand(s) queued for campaign processing.` +
          (rejected ? ` ${rejected} excluded brand(s) were skipped.` : "") +
          " Track progress on the Control Panel.",
      });
      clearSelection();
      await loadBrands();
    }

    setBulkBusy("");
  }

  async function findPga(row: BrandMapRow) {
    const id = clean(row._id);

    if (!id) return;

    setPgaBusyId(id);
    setNotice(null);

    setBrands((prev) =>
      prev.map((brand) =>
        clean(brand._id) === id ? { ...brand, pgaStatus: "running" } : brand
      )
    );

    const response: any = await apiPost(`/brand-map/${id}/pga`, {});

    if (response?.success && response.data) {
      setBrands((prev) =>
        prev.map((brand) =>
          clean(brand._id) === id ? { ...brand, ...response.data } : brand
        )
      );

      if (response.cached) {
        setNotice({
          type: "success",
          text: `${row.brandName || "Brand"}: using a recent PGA score (rescans are cached).`,
        });
      }
    } else {
      setBrands((prev) =>
        prev.map((brand) =>
          clean(brand._id) === id ? { ...brand, pgaStatus: "failed" } : brand
        )
      );
      setNotice({
        type: "error",
        text: response?.message || "PGA scan failed.",
      });
    }

    setPgaBusyId("");
  }

  async function findPgaForSelected() {
    const ids = Array.from(selectedIds).slice(0, 50);

    if (ids.length === 0) return;

    if (selectedIds.size > 50) {
      setNotice({
        type: "error",
        text: "PGA scans run at most 50 brands per batch — the first 50 selected will be scored.",
      });
    }

    setBulkBusy("pga");

    const response: any = await apiPost("/brand-map/pga-bulk", { ids });

    if (response?.success) {
      if (Number(response.queued || 0) === 0) {
        setNotice({
          type: "success",
          text: "All selected brands already have a recent PGA score.",
        });
        setBulkBusy("");
        return;
      }

      setPgaJob({ jobId: response.jobId, total: Number(response.queued) });
      setPgaProgress(0);
      setNotice({
        type: "success",
        text: `PGA scoring started for ${response.queued} brand(s)… this runs one brand at a time.`,
      });
    } else {
      setNotice({
        type: "error",
        text: response?.message || "Failed to start PGA scoring.",
      });
      setBulkBusy("");
    }
  }

  useEffect(() => {
    if (!pgaJob) return;

    const timer = window.setInterval(async () => {
      const status: any = await apiGet(`/brand-map/pga-bulk/${pgaJob.jobId}`);

      if (!status?.success) {
        window.clearInterval(timer);
        setPgaJob(null);
        setBulkBusy("");
        return;
      }

      setPgaProgress(Number(status.processed || 0) + Number(status.failed || 0));

      if (status.done) {
        window.clearInterval(timer);
        setPgaJob(null);
        setBulkBusy("");
        setNotice({
          type: "success",
          text: `PGA scoring finished: ${status.processed} scored${
            status.failed ? `, ${status.failed} failed` : ""
          }.`,
        });
        await loadBrands();
      }
    }, 3000);

    return () => window.clearInterval(timer);
  }, [pgaJob]);

  async function runScrape(row: BrandMapRow) {
    const id = clean(row._id);

    if (!id) return;

    setScrapingId(id);
    setNotice(null);

    const response: any = await apiPost(`/brand-map/${id}/scrape`, {});

    if (response?.success) {
      setNotice({
        type: "success",
        text: `Website scrape queued for ${row.brandName || "brand"}. Results appear in Email Discovery.`,
      });
    } else {
      setNotice({
        type: "error",
        text: response?.message || "Failed to queue website scrape.",
      });
    }

    setScrapingId("");
  }

  const columns = useMemo<AdminTableColumn<BrandMapRow>[]>(
    () => [
      {
        id: "select",
        header: (
          <input
            type="checkbox"
            checked={allFilteredSelected}
            onChange={toggleAllFiltered}
            className="h-4 w-4 rounded border-slate-300"
            title="Select all filtered brands"
          />
        ),
        align: "center",
        widthClassName: "w-[46px]",
        render: (brand) => {
          const id = clean(brand._id);

          return (
            <input
              type="checkbox"
              checked={selectedIds.has(id)}
              onChange={() => toggleRow(id)}
              className="h-4 w-4 rounded border-slate-300"
            />
          );
        },
      },
      {
        id: "index",
        header: "#",
        align: "center",
        widthClassName: "min-w-[60px]",
        render: (_brand, index) => (
          <span className="text-sm font-semibold text-slate-500">
            {index + 1}
          </span>
        ),
      },
      {
        id: "brandName",
        header: "Brand",
        sortable: true,
        widthClassName: "min-w-[230px]",
        render: (brand) => {
          const domain = clean(brand.domain);
          const domainUrl = getDomainUrl(domain);

          return (
            <div className="min-w-0 space-y-0.5">
              <p className="font-semibold text-slate-950">
                {brand.brandName || "-"}
              </p>

              {domain ? (
                <a
                  href={domainUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate text-xs font-medium !text-blue-600 hover:!text-blue-700"
                >
                  {domain}
                </a>
              ) : (
                <span className="block text-xs font-medium text-slate-400">
                  no domain
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: "selectionStatus",
        header: "Status",
        align: "center",
        widthClassName: "min-w-[110px]",
        render: (brand) => <SelectionBadge row={brand} />,
      },
      {
        id: "foundVia",
        header: "Found Via",
        widthClassName: "min-w-[140px]",
        render: (brand) => brand.foundVia || "-",
      },
      {
        id: "niche",
        header: "Niche",
        widthClassName: "min-w-[150px]",
        render: (brand) => brand.niche || "-",
      },
      {
        id: "channelCount",
        header: "Channels",
        align: "center",
        sortable: true,
        widthClassName: "min-w-[100px]",
        render: (brand) => {
          const names = Array.isArray(brand.channelNames)
            ? brand.channelNames.filter(Boolean)
            : [];

          return (
            <span title={names.join("\n") || "No channel details"}>
              <Badge variant="secondary">{brand.channelCount || 0}</Badge>
            </span>
          );
        },
      },
      {
        id: "mostRecentSponsorshipDate",
        header: "Last Sponsorship",
        sortable: true,
        widthClassName: "min-w-[150px]",
        render: (brand) => formatDate(brand.mostRecentSponsorshipDate),
      },
      {
        id: "recencyTag",
        header: "Recency",
        widthClassName: "min-w-[130px]",
        render: (brand) => <RecencyBadge value={brand.recencyTag} />,
      },
      {
        id: "pga",
        header: "PGA",
        align: "center",
        sortable: true,
        sortField: "pgaScore",
        widthClassName: "min-w-[120px]",
        render: (brand) => <PgaBadge row={brand} />,
      },
      {
        id: "actions",
        header: "Actions",
        align: "center",
        widthClassName: "min-w-[230px]",
        render: (brand) => {
          const id = clean(brand._id);
          const scrapeBusy = scrapingId === id;
          const pgaBusy = pgaBusyId === id || brand.pgaStatus === "running";

          return (
            <div className="flex items-center justify-center gap-1.5">
              <Button
                type="button"
                size="xs"
                variant="outline"
                disabled={scrapeBusy || !clean(brand.domain)}
                title={
                  clean(brand.domain)
                    ? "Scrape the brand website and socials for emails (free, no paid credits)"
                    : "No domain to scrape"
                }
                onClick={() => runScrape(brand)}
                className="h-8 rounded-md"
              >
                <Globe className="mr-1.5 h-3.5 w-3.5" />
                {scrapeBusy ? "Queuing..." : "Scrape"}
              </Button>

              <Button
                type="button"
                size="xs"
                variant="outline"
                disabled={pgaBusy}
                title="Rate the brand on product launches, creator collabs, promo activity and US availability (AI web search)"
                onClick={() => findPga(brand)}
                className="h-8 rounded-md !border-violet-200 !text-violet-700 hover:!bg-violet-50"
              >
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                {pgaBusy ? "Scoring..." : "PGA Score"}
              </Button>
            </div>
          );
        },
      },
    ],
    [allFilteredSelected, selectedIds, scrapingId, pgaBusyId, filteredIds]
  );

  return (
    <main className="w-full space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            Brand Map
          </h1>

          <p className="mt-1 text-sm font-medium text-slate-500">
            Review discovered brands, then send the good ones to campaign or
            exclude the noise.
          </p>
        </div>
        <Button
          asChild
          variant="outline"
          className="h-12 rounded-xl !border-blue-600 !bg-blue-600 !text-white hover:!bg-blue-700 hover:!text-white"
        >
          <Link
            href="/niche-analysis"
            className="!text-white hover:!text-white"
          >
            Go To Niche Analysis
          </Link>
        </Button>
      </div>

      {notice ? <Notice type={notice.type} text={notice.text} /> : null}

      <section className="space-y-3">
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:grid-cols-[1.5fr_1fr_1fr_1fr] xl:items-end">
          <FilterSearchInput
            label="Search"
            value={search}
            onChange={setSearch}
            placeholder="Search brand, channel, niche, domain..."
          />

          <FilterSelect
            label="Status"
            value={selection}
            onChange={setSelection}
            options={[
              { label: ALL_VALUE, value: ALL_VALUE },
              { label: "Pending", value: "pending" },
              { label: "Approved", value: "approved" },
              { label: "Excluded", value: "excluded" },
            ]}
          />

          <FilterSelect
            label="Niche"
            value={niche}
            onChange={setNiche}
            options={toOptions(nicheOptions)}
          />

          <FilterSelect
            label="Found Via"
            value={foundVia}
            onChange={setFoundVia}
            options={toOptions(foundViaOptions)}
          />
        </div>
      </section>

      {selectedIds.size > 0 ? (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50/95 px-4 py-3 shadow-sm backdrop-blur">
          <span className="text-sm font-semibold text-blue-900">
            {selectedIds.size} brand(s) selected
          </span>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={Boolean(bulkBusy)}
              onClick={sendSelectedToCampaign}
              className="h-9 rounded-md bg-blue-600 text-white hover:bg-blue-700"
            >
              <Send className="mr-1.5 h-3.5 w-3.5" />
              {bulkBusy === "send" ? "Queuing..." : "Send Selected to Campaign"}
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={Boolean(bulkBusy)}
              onClick={() => runBulkAction("exclude")}
              className="h-9 rounded-md !border-rose-200 !text-rose-700 hover:!bg-rose-50"
            >
              <Ban className="mr-1.5 h-3.5 w-3.5" />
              {bulkBusy === "exclude" ? "Excluding..." : "Exclude Selected"}
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={Boolean(bulkBusy)}
              onClick={() => runBulkAction("reset")}
              className="h-9 rounded-md"
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              {bulkBusy === "reset" ? "Resetting..." : "Reset to Pending"}
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={Boolean(bulkBusy)}
              onClick={findPgaForSelected}
              className="h-9 rounded-md !border-violet-200 !text-violet-700 hover:!bg-violet-50"
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              {bulkBusy === "pga"
                ? pgaJob
                  ? `Scoring ${pgaProgress}/${pgaJob.total}...`
                  : "Starting..."
                : "PGA Score"}
            </Button>

            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={Boolean(bulkBusy)}
              onClick={clearSelection}
              className="h-9 rounded-md text-slate-600"
            >
              <X className="mr-1.5 h-3.5 w-3.5" />
              Clear
            </Button>
          </div>
        </div>
      ) : null}

      <AdminTable
        data={visibleBrands}
        columns={columns}
        rowKey={(brand, index) => brand._id || `${brand.brandName}-${index}`}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        loading={loading}
        loadingRows={8}
        emptyDescription={
          hasActiveFilters
            ? "No records match your current filters."
            : "Discovered brands will appear here."
        }
        containerClassName="rounded-xl shadow-none"
        pagination={{
          page,
          totalPages,
          totalItems: filteredBrands.length,
          limit: PAGE_SIZE,
          onPageChange: setPage,
          loading,
          showSummary: true,
          showRowsSelector: false,
        }}
      />
    </main>
  );
}
