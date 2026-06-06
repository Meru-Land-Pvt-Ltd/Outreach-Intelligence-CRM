"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/api";
import { cn } from "@/lib/utils";
import AdminTable, {
  type AdminTableColumn,
} from "@/components/ui/tableComp";
import { FilterSelect } from "@/components/shared/filter-select";
import { FilterSearchInput } from "@/components/shared/filter-search-input";

type PipelineTrackerRow = {
  _id?: string;
  type?: string;
  brandName?: string;
  domain?: string;
  status?: string;
  timestamp?: string;
  createdAt?: string;
  updatedAt?: string;
};

const PAGE_SIZE = 1000;
const ALL_VALUE = "All";
const ALL_TIME_VALUE = "All Time";

function clean(value: unknown) {
  return String(value || "").trim();
}

function formatDateTime(value?: string) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getRowTime(row: PipelineTrackerRow) {
  return row.timestamp || row.createdAt || row.updatedAt || "";
}

function getSearchText(row: PipelineTrackerRow) {
  return [
    row.type,
    row.brandName,
    row.domain,
    row.status,
    row.timestamp,
    row.createdAt,
    row.updatedAt,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getUniqueOptions(
  rows: PipelineTrackerRow[],
  getter: (row: PipelineTrackerRow) => string
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

function isWithinDateRange(row: PipelineTrackerRow, dateRange: string) {
  if (dateRange === ALL_TIME_VALUE) return true;

  const value = getRowTime(row);

  if (!value) return false;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return false;

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (dateRange === "Last 7 Days") return diffDays <= 7;
  if (dateRange === "Last 30 Days") return diffDays <= 30;
  if (dateRange === "Last 90 Days") return diffDays <= 90;

  return true;
}

function getDomainUrl(value?: string) {
  const domain = clean(value);

  if (!domain) return "";

  if (domain.startsWith("http://") || domain.startsWith("https://")) {
    return domain;
  }

  return `https://${domain}`;
}

function TypeBadge({ value }: { value?: string }) {
  const type = clean(value);

  if (!type) return <span>-</span>;

  const lower = type.toLowerCase();

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        lower === "seed" && "bg-blue-50 text-blue-700",
        lower !== "seed" && "bg-slate-100 text-slate-700"
      )}
    >
      {type}
    </span>
  );
}

function StatusBadge({ value }: { value?: string }) {
  const status = clean(value);

  if (!status) return <span>-</span>;

  const lower = status.toLowerCase();

  if (["done", "completed", "success", "ok"].includes(lower)) {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        {status}
      </span>
    );
  }

  if (["running", "active", "processing"].includes(lower)) {
    return (
      <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
        {status}
      </span>
    );
  }

  if (["failed", "error", "invalid"].includes(lower)) {
    return (
      <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
        {status}
      </span>
    );
  }

  if (["queued", "pending"].includes(lower)) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
        {status}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
      {status}
    </span>
  );
}

export default function PipelineTrackerPage() {
  const [rows, setRows] = useState<PipelineTrackerRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [type, setType] = useState(ALL_VALUE);
  const [status, setStatus] = useState(ALL_VALUE);
  const [domain, setDomain] = useState(ALL_VALUE);
  const [dateRange, setDateRange] = useState(ALL_TIME_VALUE);

  const [page, setPage] = useState(1);

  async function loadRows() {
    setLoading(true);

    try {
      const response = await apiGet("/sheets/pipeline-tracker");
      setRows(response?.data || []);
    } catch {
      setRows([]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadRows();
  }, []);

  const typeOptions = useMemo(
    () => getUniqueOptions(rows, (row) => row.type || ""),
    [rows]
  );

  const statusOptions = useMemo(
    () => getUniqueOptions(rows, (row) => row.status || ""),
    [rows]
  );

  const domainOptions = useMemo(
    () => getUniqueOptions(rows, (row) => row.domain || ""),
    [rows]
  );

  const hasActiveFilters =
    Boolean(search.trim()) ||
    type !== ALL_VALUE ||
    status !== ALL_VALUE ||
    domain !== ALL_VALUE ||
    dateRange !== ALL_TIME_VALUE;

  useEffect(() => {
    setPage(1);
  }, [search, type, status, domain, dateRange]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesSearch = !query || getSearchText(row).includes(query);
      const matchesType = type === ALL_VALUE || clean(row.type) === type;
      const matchesStatus = status === ALL_VALUE || clean(row.status) === status;
      const matchesDomain = domain === ALL_VALUE || clean(row.domain) === domain;
      const matchesDateRange = isWithinDateRange(row, dateRange);

      return (
        matchesSearch &&
        matchesType &&
        matchesStatus &&
        matchesDomain &&
        matchesDateRange
      );
    });
  }, [rows, search, type, status, domain, dateRange]);

  const visibleRows = useMemo(() => {
    return filteredRows.slice(0, page * PAGE_SIZE);
  }, [filteredRows, page]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));

  function clearFilters() {
    setSearch("");
    setType(ALL_VALUE);
    setStatus(ALL_VALUE);
    setDomain(ALL_VALUE);
    setDateRange(ALL_TIME_VALUE);
    setPage(1);
  }

  const columns = useMemo<AdminTableColumn<PipelineTrackerRow>[]>(
    () => [
      {
        id: "index",
        header: "#",
        align: "center",
        widthClassName: "min-w-[70px]",
        render: (_row, index) => (
          <span className="text-sm font-semibold text-slate-500">
            {index + 1}
          </span>
        ),
      },
      {
        id: "type",
        header: "Type",
        widthClassName: "min-w-[120px]",
        render: (row) => <TypeBadge value={row.type} />,
      },
      {
        id: "brandName",
        header: "Brand Name",
        widthClassName: "min-w-[220px]",
        render: (row) => (
          <span className="font-semibold text-slate-950">
            {row.brandName || "-"}
          </span>
        ),
      },
      {
        id: "domain",
        header: "Domain",
        widthClassName: "min-w-[220px]",
        render: (row) => {
          const rowDomain = clean(row.domain);
          const domainUrl = getDomainUrl(rowDomain);

          if (!rowDomain) return "-";

          return (
            <a
              href={domainUrl}
              target="_blank"
              rel="noreferrer"
              className="font-medium !text-blue-600 !underline !underline-offset-4 !hover:text-blue-700"
            >
              {rowDomain}
            </a>
          );
        },
      },
      {
        id: "status",
        header: "Status",
        widthClassName: "min-w-[140px]",
        render: (row) => <StatusBadge value={row.status} />,
      },
      {
        id: "time",
        header: "Time",
        widthClassName: "min-w-[220px]",
        render: (row) => (
          <span className="font-medium text-slate-700">
            {formatDateTime(getRowTime(row))}
          </span>
        ),
      },
    ],
    []
  );

  return (
    <main className="w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950">
          Pipeline Tracker
        </h1>

        <p className="mt-1 text-sm font-medium text-slate-500">
          Workflow activity logs from the pipeline tracker.
        </p>
      </div>

      <section className="space-y-3">
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:grid-cols-[1.5fr_1fr_1fr_1fr_1fr_auto] xl:items-end">
          <FilterSearchInput
            label="Search"
            value={search}
            onChange={setSearch}
            placeholder="Search brand, domain, status..."
          />

          <FilterSelect
            label="Type"
            value={type}
            onChange={setType}
            options={toOptions(typeOptions)}
          />

          <FilterSelect
            label="Status"
            value={status}
            onChange={setStatus}
            options={toOptions(statusOptions)}
          />

          <FilterSelect
            label="Domain"
            value={domain}
            onChange={setDomain}
            options={toOptions(domainOptions)}
          />

        </div>

        {hasActiveFilters ? (
          <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            Filters applied
          </span>
        ) : null}
      </section>

      <AdminTable
        data={visibleRows}
        columns={columns}
        rowKey={(row, index) => row._id || `${row.brandName}-${row.timestamp}-${index}`}
        loading={loading}
        loadingRows={8}
        emptyTitle={
          loading ? "Loading Pipeline Tracker..." : "No Pipeline Tracker records found."
        }
        emptyDescription={
          hasActiveFilters
            ? "No records match your current filters."
            : "Pipeline activity will appear here."
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
    </main>
  );
}