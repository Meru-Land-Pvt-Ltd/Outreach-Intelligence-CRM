"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/api";
import { formatDate } from "@/lib/format";
import AdminTable, {
  type AdminTableColumn,
} from "@/components/ui/tableComp";
import { FilterSearchInput } from "@/components/shared/filter-search-input";
import { FilterSelect } from "@/components/shared/filter-select";

type RunLogRow = {
  _id?: string;
  latestLog?: string;
  failedExecution?: string;
  createdAt?: string;
  updatedAt?: string;
};

const PAGE_SIZE = 1000;
const ALL_VALUE = "All";

function clean(value: unknown) {
  return String(value || "").trim();
}

function getRowDate(row: RunLogRow) {
  return row.createdAt || row.updatedAt || "";
}

function getSearchText(row: RunLogRow) {
  return [row.latestLog, row.failedExecution, row.createdAt, row.updatedAt]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function hasFailure(row: RunLogRow) {
  return Boolean(clean(row.failedExecution));
}

export default function RunLogPage() {
  const [rows, setRows] = useState<RunLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(ALL_VALUE);
  const [page, setPage] = useState(1);

  async function loadRows() {
    setLoading(true);

    try {
      const response = await apiGet("/run-log");
      setRows(response?.data || []);
    } catch {
      setRows([]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadRows();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, status]);

  const hasActiveFilters = Boolean(search.trim()) || status !== ALL_VALUE;

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesSearch = !query || getSearchText(row).includes(query);

      const matchesStatus =
        status === ALL_VALUE ||
        (status === "Failed" && hasFailure(row)) ||
        (status === "Success" && !hasFailure(row));

      return matchesSearch && matchesStatus;
    });
  }, [rows, search, status]);

  const visibleRows = useMemo(() => {
    return filteredRows.slice(0, page * PAGE_SIZE);
  }, [filteredRows, page]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));

  function clearFilters() {
    setSearch("");
    setStatus(ALL_VALUE);
    setPage(1);
  }

  const columns = useMemo<AdminTableColumn<RunLogRow>[]>(
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
        id: "timestamp",
        header: "Timestamp",
        widthClassName: "min-w-[180px]",
        render: (row) => (
          <span className="font-medium text-slate-700">
            {formatDate(getRowDate(row))}
          </span>
        ),
      },
      {
        id: "latestLog",
        header: "Latest Log",
        widthClassName: "min-w-[520px]",
        render: (row) => (
          <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
            {clean(row.latestLog) || "-"}
          </p>
        ),
      },
      {
        id: "failedExecution",
        header: "Failed Execution",
        widthClassName: "min-w-[520px]",
        render: (row) => {
          const failed = clean(row.failedExecution);

          if (!failed) {
            return <span className="text-slate-300">-</span>;
          }

          return (
            <p className="whitespace-pre-wrap text-sm font-medium leading-6 text-rose-600">
              {failed}
            </p>
          );
        },
      },
    ],
    []
  );

  return (
    <main className="w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950">
          Run Log
        </h1>

        <p className="mt-1 text-sm font-medium text-slate-500">
          Latest log and failed execution records from the old Apps Script flow.
        </p>
      </div>

      <section className="space-y-3">
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[1.5fr_220px_auto] lg:items-end">
          <FilterSearchInput
            label="Search"
            value={search}
            onChange={setSearch}
            placeholder="Search latest log or failed execution..."
          />

          <FilterSelect
            label="Status"
            value={status}
            onChange={setStatus}
            options={[
              { label: ALL_VALUE, value: ALL_VALUE },
              { label: "Success", value: "Success" },
              { label: "Failed", value: "Failed" },
            ]}
          />

          <button
            type="button"
            onClick={clearFilters}
            disabled={!hasActiveFilters}
            className="h-12 rounded-xl px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-40"
          >
            Clear
          </button>
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
        rowKey={(row, index) => row._id || `${row.createdAt}-${index}`}
        loading={loading}
        loadingRows={8}
        emptyTitle={loading ? "Loading run logs..." : "No run logs yet."}
        emptyDescription={
          hasActiveFilters
            ? "No run logs match your filters."
            : "Pipeline logs will appear here."
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