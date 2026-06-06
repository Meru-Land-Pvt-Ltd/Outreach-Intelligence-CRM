"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import AdminTable, {
  type AdminTableColumn,
} from "@/components/ui/tableComp";
import { FilterSearchInput } from "@/components/shared/filter-search-input";

type NicheAnalysisRow = {
  _id?: string;
  nicheName?: string;
  brandCount?: number;
  createdAt?: string;
  updatedAt?: string;
};

const PAGE_SIZE = 1000;

function clean(value: unknown) {
  return String(value || "").trim();
}

function getSearchText(row: NicheAnalysisRow) {
  return [row.nicheName, row.brandCount]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export default function NicheAnalysisPage() {
  const [rows, setRows] = useState<NicheAnalysisRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  async function loadRows() {
    setLoading(true);

    try {
      const response = await apiGet("/sheets/niche-analysis");
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
  }, [search]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return rows;

    return rows.filter((row) => getSearchText(row).includes(query));
  }, [rows, search]);

  const visibleRows = useMemo(() => {
    return filteredRows.slice(0, page * PAGE_SIZE);
  }, [filteredRows, page]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));

  const columns = useMemo<AdminTableColumn<NicheAnalysisRow>[]>(
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
        id: "nicheName",
        header: "Niche",
        widthClassName: "min-w-[320px]",
        render: (row) => (
          <span className="font-semibold text-slate-950">
            {clean(row.nicheName) || "-"}
          </span>
        ),
      },
      {
        id: "brandCount",
        header: "Brands",
        align: "right",
        widthClassName: "min-w-[140px]",
        render: (row) => (
          <span className="font-semibold text-slate-700">
            {formatNumber(row.brandCount)}
          </span>
        ),
      },
    ],
    []
  );

  return (
    <main className="w-full space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            Niche Analysis
          </h1>

          <p className="mt-1 text-sm font-medium text-slate-500">
            Brand count grouped by niche.
          </p>
        </div>
      </div>


      <div className="max-w-3xl">
        <AdminTable
          data={visibleRows}
          columns={columns}
          rowKey={(row, index) => row._id || `${row.nicheName}-${index}`}
          loading={loading}
          loadingRows={8}
          emptyTitle={loading ? "Loading niche rows..." : "No niche rows yet."}
          emptyDescription={
            search.trim()
              ? "No niches match your search."
              : "Niche grouping appears after Brand Map generation."
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
      </div>
    </main>
  );
}