"use client";

import { useEffect, useMemo, useState } from "react";
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
import Link from "next/dist/client/link";

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
  isSelected?: boolean;
  isExcluded?: boolean;
  intentScore?: number;
  pgaScore?: number;
  intentStatus?: string;
  intentReason?: string;
  lastIntentCheckedAt?: string;
  qualityScore?: number;
  qualityReason?: string;
  createdAt?: string;
  updatedAt?: string;
};

const PAGE_SIZE = 1000;
const ALL_VALUE = "All";

const HIDE_EXCLUDED_VALUE = "__HIDE_EXCLUDED__";

const SELECTION_FILTER_OPTIONS = [
  { label: "Hide excluded (default)", value: HIDE_EXCLUDED_VALUE },
  { label: "All (incl. excluded)", value: ALL_VALUE },
  { label: "Selected only", value: "__SELECTED__" },
  { label: "Excluded only", value: "__EXCLUDED__" },
];

const PGA_FILTER_OPTIONS = [
  { label: "All", value: ALL_VALUE },
  { label: "High (80+)", value: "__PGA_HIGH__" },
  { label: "Medium (50-79)", value: "__PGA_MEDIUM__" },
  { label: "Low (<50)", value: "__PGA_LOW__" },
  { label: "Not checked", value: "__PGA_UNCHECKED__" },
];

const SORT_OPTIONS = [
  { label: "Newest first", value: "default" },
  { label: "PGA high to low", value: "pga" },
];

const MAX_BULK_ACTION_ROWS = 300;

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api";

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

function getChannelNames(row: BrandMapRow) {
  const names = Array.isArray(row.channelNames)
    ? row.channelNames.filter(Boolean)
    : [];

  if (names.length === 0) return "-";
  if (names.length <= 3) return names.join(", ");

  return `${names.slice(0, 3).join(", ")}, +${names.length - 3}`;
}

function getDomainUrl(value?: string) {
  const domain = clean(value);

  if (!domain) return "";

  if (domain.startsWith("http://") || domain.startsWith("https://")) {
    return domain;
  }

  return `https://${domain}`;
}

function RecencyBadge({ value }: { value?: string }) {
  const tag = clean(value);

  if (!tag) return <span>-</span>;

  const lower = tag.toLowerCase();

  return (
    <Badge
      className={cn(
        "rounded-full px-2.5 py-1 text-xs font-semibold",
        lower === "new" && "bg-emerald-50 text-emerald-700 hover:bg-emerald-50",
        lower === "recent" && "bg-blue-50 text-blue-700 hover:bg-blue-50",
        lower === "mid" && "bg-amber-50 text-amber-700 hover:bg-amber-50",
        lower === "old" && "bg-slate-100 text-slate-600 hover:bg-slate-100",
        !["new", "recent", "mid", "old"].includes(lower) &&
        "bg-slate-100 text-slate-600 hover:bg-slate-100"
      )}
    >
      {tag}
    </Badge>
  );
}

function PgaBadge({
  score,
  status,
  reason,
}: {
  score?: number;
  status?: string;
  reason?: string;
}) {
  if (status === "insufficient_data") {
    return (
      <span
        title={reason || "Insufficient data"}
        className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500"
      >
        Insufficient data
      </span>
    );
  }

  if (typeof score !== "number") {
    return null;
  }

  const styles =
    score >= 80
      ? "bg-emerald-50 text-emerald-700"
      : score >= 50
        ? "bg-amber-50 text-amber-700"
        : "bg-rose-50 text-rose-700";

  const label = score >= 80 ? "High" : score >= 50 ? "Medium" : "Low";

  return (
    <span
      title={reason || ""}
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles}`}
    >
      PGA {score}% · {label}
    </span>
  );
}

export default function BrandMapPage() {
  const [brands, setBrands] = useState<BrandMapRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [foundVia, setFoundVia] = useState(ALL_VALUE);
  const [niche, setNiche] = useState(ALL_VALUE);
  const [domain, setDomain] = useState(ALL_VALUE);
  const [recencyTag, setRecencyTag] = useState(ALL_VALUE);

  const [page, setPage] = useState(1);

  const [selectionFilter, setSelectionFilter] = useState(HIDE_EXCLUDED_VALUE);
  const [pgaFilter, setPgaFilter] = useState(ALL_VALUE);
  const [sortMode, setSortMode] = useState("default");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState("");
  const [intentLoadingId, setIntentLoadingId] = useState("");
  const [notice, setNotice] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

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

  const domainOptions = useMemo(
    () => getUniqueOptions(brands, (row) => row.domain || ""),
    [brands]
  );

  const recencyOptions = useMemo(
    () => getUniqueOptions(brands, (row) => row.recencyTag || ""),
    [brands]
  );

  const hasActiveFilters =
    Boolean(search.trim()) ||
    foundVia !== ALL_VALUE ||
    niche !== ALL_VALUE ||
    domain !== ALL_VALUE ||
    recencyTag !== ALL_VALUE ||
    selectionFilter !== HIDE_EXCLUDED_VALUE ||
    pgaFilter !== ALL_VALUE ||
    sortMode !== "default";

  useEffect(() => {
    setPage(1);
  }, [search, foundVia, niche, domain, recencyTag, selectionFilter, pgaFilter, sortMode]);

  const filteredBrands = useMemo(() => {
    const query = search.trim().toLowerCase();

    return brands.filter((brand) => {
      const matchesSearch = !query || getSearchText(brand).includes(query);

      const matchesFoundVia =
        foundVia === ALL_VALUE || clean(brand.foundVia) === foundVia;

      const matchesNiche =
        niche === ALL_VALUE || clean(brand.niche) === niche;

      const matchesDomain =
        domain === ALL_VALUE || clean(brand.domain) === domain;

      const matchesRecency =
        recencyTag === ALL_VALUE || clean(brand.recencyTag) === recencyTag;

      const matchesSelection =
        selectionFilter === ALL_VALUE ||
        (selectionFilter === "__SELECTED__" && brand.isSelected === true) ||
        (selectionFilter === "__EXCLUDED__" && brand.isExcluded === true) ||
        (selectionFilter === HIDE_EXCLUDED_VALUE && brand.isExcluded !== true);

      const pga = typeof brand.pgaScore === "number" ? brand.pgaScore : null;
      const pgaChecked = pga !== null && brand.intentStatus !== "insufficient_data";

      const matchesPga =
        pgaFilter === ALL_VALUE ||
        (pgaFilter === "__PGA_HIGH__" && pgaChecked && pga! >= 80) ||
        (pgaFilter === "__PGA_MEDIUM__" && pgaChecked && pga! >= 50 && pga! < 80) ||
        (pgaFilter === "__PGA_LOW__" && pgaChecked && pga! < 50) ||
        (pgaFilter === "__PGA_UNCHECKED__" && !pgaChecked);

      return (
        matchesSearch &&
        matchesFoundVia &&
        matchesNiche &&
        matchesDomain &&
        matchesRecency &&
        matchesSelection &&
        matchesPga
      );
    });
  }, [brands, search, foundVia, niche, domain, recencyTag, selectionFilter, pgaFilter]);

  const sortedBrands = useMemo(() => {
    if (sortMode !== "pga") return filteredBrands;

    return [...filteredBrands].sort((a, b) => {
      const pgaA = typeof a.pgaScore === "number" ? a.pgaScore : -1;
      const pgaB = typeof b.pgaScore === "number" ? b.pgaScore : -1;
      return pgaB - pgaA;
    });
  }, [filteredBrands, sortMode]);

  const visibleBrands = useMemo(() => {
    return sortedBrands.slice(0, page * PAGE_SIZE);
  }, [sortedBrands, page]);

  const totalPages = Math.max(1, Math.ceil(filteredBrands.length / PAGE_SIZE));

  const visibleSelectableIds = useMemo(
    () =>
      visibleBrands
        .map((brand) => brand._id)
        .filter((id): id is string => Boolean(id)),
    [visibleBrands]
  );

  const allVisibleSelected =
    visibleSelectableIds.length > 0 &&
    visibleSelectableIds.every((id) => selectedIds.includes(id));

  function toggleSelected(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  function toggleSelectAllVisible() {
    setSelectedIds((current) => {
      if (
        visibleSelectableIds.length > 0 &&
        visibleSelectableIds.every((id) => current.includes(id))
      ) {
        return current.filter((id) => !visibleSelectableIds.includes(id));
      }

      return Array.from(new Set([...current, ...visibleSelectableIds]));
    });
  }

  async function runBulkAction(
    action: string,
    handler: (ids: string[]) => Promise<{ ok: boolean; text: string }>
  ) {
    if (selectedIds.length === 0 || bulkAction) return;

    if (selectedIds.length > MAX_BULK_ACTION_ROWS) {
      setNotice({
        type: "error",
        text: `Too many rows selected (${selectedIds.length}). Select at most ${MAX_BULK_ACTION_ROWS} rows per action.`,
      });
      return;
    }

    setBulkAction(action);
    setNotice(null);

    try {
      const outcome = await handler(selectedIds);
      setNotice({ type: outcome.ok ? "success" : "error", text: outcome.text });
    } catch (error) {
      setNotice({
        type: "error",
        text: error instanceof Error ? error.message : "Action failed.",
      });
    }

    setBulkAction("");
  }

  async function moveSelectedToExclude() {
    await runBulkAction("exclude", async (ids) => {
      const response = (await apiPost("/brand-map/exclude", { ids })) as {
        success?: boolean;
        message?: string;
        excludedCreated?: number;
        alreadyExcluded?: number;
        rowsMarked?: number;
      } | null;

      if (!response?.success) {
        return {
          ok: false,
          text:
            response?.message || "Failed to move brands to the Exclude List.",
        };
      }

      setSelectedIds([]);
      await loadBrands();

      return {
        ok: true,
        text:
          `Moved ${response.excludedCreated || 0} brand(s) to the Exclude List.` +
          (response.alreadyExcluded
            ? ` ${response.alreadyExcluded} already excluded.`
            : "") +
          ` ${response.rowsMarked || 0} Brand Map row(s) marked excluded.`,
      };
    });
  }

  async function pushSelectedToChannel(
    channel: "Enoylity Technology" | "MHD Tech"
  ) {
    await runBulkAction(`push:${channel}`, async (ids) => {
      const response = (await apiPost("/brand-map/push-instantly", {
        ids,
        channel,
      })) as {
        success?: boolean;
        message?: string;
        exported?: number;
        updatedExistingUnpushed?: number;
        skippedAlreadyPushed?: number;
        skippedExcludedBrands?: number;
        brandsWithoutContacts?: number;
      } | null;

      if (!response?.success) {
        return {
          ok: false,
          text: response?.message || `Push to ${channel} failed.`,
        };
      }

      await loadBrands();

      return {
        ok: true,
        text:
          `Pushed to ${channel}: ${response.exported || 0} new lead row(s), ` +
          `${response.updatedExistingUnpushed || 0} updated, ` +
          `${response.skippedAlreadyPushed || 0} skipped (already pushed).` +
          (response.skippedExcludedBrands
            ? ` ${response.skippedExcludedBrands} excluded brand(s) skipped.`
            : "") +
          (response.brandsWithoutContacts
            ? ` ${response.brandsWithoutContacts} brand(s) had no contacts yet (run email discovery first).`
            : ""),
      };
    });
  }

  async function discoverIntent(brand: BrandMapRow) {
    if (!brand._id || intentLoadingId) return;

    setIntentLoadingId(brand._id);

    try {
      const response = (await apiPost(
        `/brand-map/${brand._id}/discover-intent`,
        {}
      )) as {
        success?: boolean;
        message?: string;
        data?: Partial<BrandMapRow>;
      } | null;

      if (response?.success && response.data) {
        const data = response.data;
        setBrands((current) =>
          current.map((row) =>
            row._id === brand._id ? { ...row, ...data } : row
          )
        );
      } else {
        setNotice({
          type: "error",
          text: response?.message || "Intent discovery failed.",
        });
      }
    } catch (error) {
      setNotice({
        type: "error",
        text: error instanceof Error ? error.message : "Intent discovery failed.",
      });
    }

    setIntentLoadingId("");
  }

  async function discoverEmailsForSelected() {
    await runBulkAction("discover", async (ids) => {
      const response = (await apiPost("/brand-map/discover-emails", {
        ids,
      })) as {
        success?: boolean;
        message?: string;
        queued?: number;
      } | null;

      if (!response?.success) {
        return {
          ok: false,
          text: response?.message || "Failed to start email discovery.",
        };
      }

      return {
        ok: true,
        text:
          response.message ||
          `Email discovery started for ${response.queued || 0} brand(s).`,
      };
    });
  }

  async function saveSelection(selected: boolean) {
    await runBulkAction(selected ? "select" : "unselect", async (ids) => {
      const response = (await apiPost("/brand-map/select", {
        ids,
        selected,
      })) as {
        success?: boolean;
        message?: string;
        modified?: number;
      } | null;

      if (!response?.success) {
        return {
          ok: false,
          text: response?.message || "Failed to update selection.",
        };
      }

      if (!selected) setSelectedIds([]);
      await loadBrands();

      return {
        ok: true,
        text: `${response.modified || 0} row(s) ${
          selected ? "saved as selected for discovery/push" : "unselected"
        }.`,
      };
    });
  }

  function clearFilters() {
    setSearch("");
    setFoundVia(ALL_VALUE);
    setNiche(ALL_VALUE);
    setDomain(ALL_VALUE);
    setRecencyTag(ALL_VALUE);
    setSelectionFilter(HIDE_EXCLUDED_VALUE);
    setPgaFilter(ALL_VALUE);
    setSortMode("default");
    setPage(1);
  }

  const columns = useMemo<AdminTableColumn<BrandMapRow>[]>(
    () => [
      {
        id: "select",
        header: (
          <input
            type="checkbox"
            aria-label="Select all visible brands"
            checked={allVisibleSelected}
            onChange={toggleSelectAllVisible}
            className="h-4 w-4 cursor-pointer rounded border-slate-300"
          />
        ),
        align: "center",
        widthClassName: "min-w-[50px]",
        render: (brand) =>
          brand._id ? (
            <input
              type="checkbox"
              aria-label={`Select ${brand.brandName || "brand"}`}
              checked={selectedIds.includes(brand._id)}
              onChange={() => toggleSelected(brand._id!)}
              className="h-4 w-4 cursor-pointer rounded border-slate-300"
            />
          ) : null,
      },
      {
        id: "index",
        header: "#",
        align: "center",
        widthClassName: "min-w-[70px]",
        render: (_brand, index) => (
          <span className="text-sm font-semibold text-slate-500">
            {index + 1}
          </span>
        ),
      },
      {
        id: "brandName",
        header: "Brand Name",
        widthClassName: "min-w-[240px]",
        render: (brand) => (
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-semibold text-slate-950">
                {brand.brandName || "-"}
              </span>

              {brand.isSelected ? (
                <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700">
                  Selected
                </span>
              ) : null}

              {brand.isExcluded ? (
                <span className="inline-flex rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-700">
                  Excluded
                </span>
              ) : null}
            </div>

            {clean(brand.domain) ? (
              <p className="text-xs font-medium text-slate-500">
                {clean(brand.domain)}
              </p>
            ) : null}
          </div>
        ),
      },
      {
        id: "foundVia",
        header: "Found Via",
        widthClassName: "min-w-[160px]",
        render: (brand) => brand.foundVia || "-",
      },
      {
        id: "channelCount",
        header: "Channels",
        align: "center",
        widthClassName: "min-w-[110px]",
        render: (brand) => (
          <Badge variant="secondary">{brand.channelCount || 0}</Badge>
        ),
      },
      {
        id: "channelNames",
        header: "Channel Names",
        widthClassName: "min-w-[360px]",
        render: (brand) => (
          <p className="whitespace-normal text-sm leading-6 text-slate-600">
            {getChannelNames(brand)}
          </p>
        ),
      },
      {
        id: "mostRecentSponsorshipDate",
        header: "Recent Sponsorship",
        widthClassName: "min-w-[180px]",
        render: (brand) => formatDate(brand.mostRecentSponsorshipDate),
      },
      {
        id: "recencyTag",
        header: "Recency",
        widthClassName: "min-w-[130px]",
        render: (brand) => <RecencyBadge value={brand.recencyTag} />,
      },
      {
        id: "intent",
        header: "PGA / Intent",
        widthClassName: "min-w-[200px]",
        render: (brand) => {
          const checking = intentLoadingId === brand._id;

          return (
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <PgaBadge
                  score={brand.pgaScore}
                  status={brand.intentStatus}
                  reason={brand.intentReason}
                />

                {typeof brand.intentScore === "number" &&
                brand.intentStatus !== "insufficient_data" ? (
                  <span className="text-xs font-medium text-slate-500">
                    Intent {brand.intentScore}
                  </span>
                ) : null}
              </div>

              <button
                type="button"
                disabled={checking || !brand._id}
                onClick={() => discoverIntent(brand)}
                className="text-xs font-semibold text-blue-600 underline underline-offset-2 hover:text-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {checking
                  ? "Checking..."
                  : brand.lastIntentCheckedAt
                    ? "Refresh Intent"
                    : "Find Intent"}
              </button>
            </div>
          );
        },
      },
      {
        id: "niche",
        header: "Niche",
        widthClassName: "min-w-[180px]",
        render: (brand) => brand.niche || "-",
      },
      {
        id: "domain",
        header: "Domain",
        widthClassName: "min-w-[220px]",
        render: (brand) => {
          const domain = clean(brand.domain);
          const domainUrl = getDomainUrl(domain);

          if (!domain) return "-";

          return (
            <a
              href={domainUrl}
              target="_blank"
              rel="noreferrer"
              className="font-medium !text-blue-600 !underline !underline-offset-4 !hover:text-blue-700"
            >
              {domain}
            </a>
          );
        },
      },
    ],
    // Handlers (toggleSelected, toggleSelectAllVisible, discoverIntent) are
    // recreated per render; their behavior only depends on the states below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedIds, allVisibleSelected, visibleSelectableIds, intentLoadingId]
  );

  return (
    <main className="w-full space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            Brand Map
          </h1>

          <p className="mt-1 text-sm font-medium text-slate-500">
            Brand Map records discovered from raw video analysis.
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

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <span className="text-sm font-semibold text-slate-700">
          {selectedIds.length} selected
        </span>

        <Button
          type="button"
          variant="outline"
          disabled={selectedIds.length === 0 || Boolean(bulkAction)}
          onClick={() => saveSelection(true)}
          className="h-10 rounded-xl !border-blue-200 !text-blue-700 hover:!bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {bulkAction === "select" ? "Saving..." : "Save Selection"}
        </Button>

        <Button
          type="button"
          variant="outline"
          disabled={selectedIds.length === 0 || Boolean(bulkAction)}
          onClick={() => saveSelection(false)}
          className="h-10 rounded-xl !border-slate-200 !text-slate-600 hover:!bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {bulkAction === "unselect" ? "Removing..." : "Unselect"}
        </Button>

        <Button
          type="button"
          variant="outline"
          disabled={selectedIds.length === 0 || Boolean(bulkAction)}
          onClick={discoverEmailsForSelected}
          className="h-10 rounded-xl !border-violet-200 !text-violet-700 hover:!bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {bulkAction === "discover" ? "Starting..." : "Find Emails"}
        </Button>

        <Button
          type="button"
          variant="outline"
          disabled={selectedIds.length === 0 || Boolean(bulkAction)}
          onClick={() => pushSelectedToChannel("Enoylity Technology")}
          className="h-10 rounded-xl !border-emerald-200 !text-emerald-700 hover:!bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {bulkAction === "push:Enoylity Technology"
            ? "Pushing..."
            : "Push to Enoylity Instantly"}
        </Button>

        <Button
          type="button"
          variant="outline"
          disabled={selectedIds.length === 0 || Boolean(bulkAction)}
          onClick={() => pushSelectedToChannel("MHD Tech")}
          className="h-10 rounded-xl !border-emerald-200 !text-emerald-700 hover:!bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {bulkAction === "push:MHD Tech" ? "Pushing..." : "Push to MHD Instantly"}
        </Button>

        <Button
          type="button"
          variant="outline"
          disabled={selectedIds.length === 0 || Boolean(bulkAction)}
          onClick={moveSelectedToExclude}
          className="h-10 rounded-xl !border-rose-200 !text-rose-700 hover:!bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {bulkAction === "exclude" ? "Moving..." : "Move Selected to Exclude"}
        </Button>

        <Button
          asChild
          variant="outline"
          className="ml-auto h-10 rounded-xl !border-slate-200 !text-slate-700 hover:!bg-slate-50"
        >
          <a
            href={`${API_BASE_URL}/reports/conversion-export`}
            target="_blank"
            rel="noreferrer"
          >
            Export Conversion CSV
          </a>
        </Button>
      </div>

      {notice ? <Notice type={notice.type} text={notice.text} /> : null}

      <section className="space-y-3">
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:grid-cols-[1.5fr_1fr_1fr_1fr_1fr_auto] xl:items-end">
          <FilterSearchInput
            label="Search"
            value={search}
            onChange={setSearch}
            placeholder="Search brand, channel, niche, domain..."
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

          <FilterSelect
            label="Selection"
            value={selectionFilter}
            onChange={setSelectionFilter}
            options={SELECTION_FILTER_OPTIONS}
          />

          <FilterSelect
            label="PGA"
            value={pgaFilter}
            onChange={setPgaFilter}
            options={PGA_FILTER_OPTIONS}
          />

          <FilterSelect
            label="Sort"
            value={sortMode}
            onChange={setSortMode}
            options={SORT_OPTIONS}
          />
        </div>

      </section>

      <AdminTable
        data={visibleBrands}
        columns={columns}
        rowKey={(brand, index) => brand._id || `${brand.brandName}-${index}`}
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