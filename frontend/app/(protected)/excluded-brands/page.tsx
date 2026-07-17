"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Plus, RotateCcw, Trash2 } from "lucide-react";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/shared/notice";
import { FilterSearchInput } from "@/components/shared/filter-search-input";
import AdminTable, {
  type AdminTableColumn,
} from "@/components/ui/tableComp";

type NoticeState = {
  type: "success" | "error";
  text: string;
};

type ExcludedBrandRow = {
  _id?: string;
  brandName?: string;
  domain?: string;
  pgaScore?: number | null;
  niche?: string;
  createdAt?: string;
  updatedAt?: string;
};

function PgaCell({ score }: { score?: number | null }) {
  if (typeof score !== "number") {
    return (
      <span className="text-sm font-medium text-slate-400" title="Never scored">
        —
      </span>
    );
  }

  return (
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
  );
}

const PAGE_SIZE = 1000;

function clean(value: unknown) {
  return String(value || "").trim();
}

function getClickableUrl(value?: string) {
  const text = clean(value);

  if (!text) return "";

  if (text.startsWith("http://") || text.startsWith("https://")) {
    return text;
  }

  if (text.startsWith("www.")) {
    return `https://${text}`;
  }

  if (/^[a-z0-9.-]+\.[a-z]{2,}/i.test(text)) {
    return `https://${text}`;
  }

  return "";
}

function getDomainLabel(domain?: string) {
  const value = clean(domain);

  if (!value) return "-";

  return value
    .replace("https://", "")
    .replace("http://", "")
    .replace("www.", "")
    .replace(/\/$/, "");
}

function getSearchText(row: ExcludedBrandRow) {
  return [row.brandName, row.domain].filter(Boolean).join(" ").toLowerCase();
}

function ClickableDomain({ value }: { value?: string }) {
  const domain = clean(value);
  const url = getClickableUrl(domain);

  if (!domain) return <span className="text-slate-300">-</span>;

  if (!url) {
    return <span className="!font-medium !text-slate-700">{domain}</span>;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex max-w-full items-center break-all !font-medium !text-blue-600 !underline !underline-offset-4 hover:!text-blue-700"
    >
      <span>{getDomainLabel(domain)}</span>
      <ExternalLink className="ml-1.5 h-3.5 w-3.5 shrink-0" />
    </a>
  );
}

export default function ExcludedBrandsPage() {
  const [rows, setRows] = useState<ExcludedBrandRow[]>([]);
  const [notice, setNotice] = useState<NoticeState | null>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [restoringId, setRestoringId] = useState("");

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [sortBy, setSortBy] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  function handleSort(field: string) {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(field);
      // PGA starts highest-first; text columns start A→Z.
      setSortOrder(field === "pgaScore" ? "desc" : "asc");
    }
  }

  const [form, setForm] = useState({
    brandName: "",
    domain: "",
  });

  async function loadRows() {
    setLoading(true);

    try {
      const response = await apiGet("/sheets/excluded-brands");
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

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const brandName = clean(form.brandName);
    const domain = clean(form.domain);

    if (!brandName && !domain) {
      setNotice({
        type: "error",
        text: "Please enter brand name or domain.",
      });
      return;
    }

    setSubmitting(true);
    setNotice(null);

    const response: any = await apiPost("/sheets/excluded-brands", {
      brandName,
      domain,
    });

    if (response.success) {
      setNotice({ type: "success", text: "Brand excluded." });
      setForm({ brandName: "", domain: "" });
      await loadRows();
    } else {
      setNotice({
        type: "error",
        text: response.message || "Failed to add excluded brand.",
      });
    }

    setSubmitting(false);
  }

async function deleteRow(row: ExcludedBrandRow) {
  const id = clean(row._id);
  const brandName = clean(row.brandName);
  const domain = clean(row.domain);

  if (!id) {
    setNotice({
      type: "error",
      text: "Missing excluded brand ID. Please refresh and try again.",
    });
    return;
  }

  const confirmed = window.confirm(
    `Delete excluded brand "${brandName || domain || "this row"}"?`
  );

  if (!confirmed) return;

  setDeletingId(id);
  setNotice(null);

  const response: any = await apiDelete(`/sheets/excluded-brands/${id}`);

  if (response.success) {
    setNotice({ type: "success", text: "Excluded brand deleted." });

    setRows((currentRows) => currentRows.filter((item) => item._id !== id));

    await loadRows();
  } else {
    setNotice({
      type: "error",
      text: response.message || "Failed to delete excluded brand.",
    });
  }

  setDeletingId("");
}

  async function restoreRow(row: ExcludedBrandRow) {
    const id = clean(row._id);
    const label = clean(row.brandName) || clean(row.domain) || "this brand";

    if (!id) return;

    const confirmed = window.confirm(
      `Restore "${label}"? It is removed from the exclude list and its Brand Map rows return to pending, so future crawls and campaigns include it again.`
    );

    if (!confirmed) return;

    setRestoringId(id);
    setNotice(null);

    const response: any = await apiPost(
      `/sheets/excluded-brands/${id}/restore`,
      {}
    );

    if (response.success) {
      setNotice({
        type: "success",
        text:
          `"${label}" restored.` +
          (response.restoredBrandMaps
            ? ` ${response.restoredBrandMaps} Brand Map row(s) set back to pending.`
            : " No Brand Map rows needed changes."),
      });
      await loadRows();
    } else {
      setNotice({
        type: "error",
        text: response.message || "Failed to restore brand.",
      });
    }

    setRestoringId("");
  }

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return rows;

    return rows.filter((row) => getSearchText(row).includes(query));
  }, [rows, search]);

  const sortedRows = useMemo(() => {
    if (!sortBy) return filteredRows;

    const numeric = sortBy === "pgaScore";
    const direction = sortOrder === "asc" ? 1 : -1;

    return [...filteredRows].sort((a: any, b: any) => {
      const aValue = a[sortBy];
      const bValue = b[sortBy];

      const aMissing = aValue === undefined || aValue === null || aValue === "";
      const bMissing = bValue === undefined || bValue === null || bValue === "";

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
  }, [filteredRows, sortBy, sortOrder]);

  const visibleRows = useMemo(() => {
    return sortedRows.slice(0, page * PAGE_SIZE);
  }, [sortedRows, page]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));

  const columns = useMemo<AdminTableColumn<ExcludedBrandRow>[]>(
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
        id: "brandName",
        header: "Brand",
        sortable: true,
        widthClassName: "min-w-[220px]",
        render: (row) => (
          <span className="font-semibold text-slate-950">
            {clean(row.brandName) || "-"}
          </span>
        ),
      },
      {
        id: "pgaScore",
        header: "PGA",
        align: "center",
        sortable: true,
        widthClassName: "min-w-[110px]",
        render: (row) => <PgaCell score={row.pgaScore} />,
      },
      {
        id: "niche",
        header: "Niche",
        widthClassName: "min-w-[150px]",
        render: (row) => clean(row.niche) || "-",
      },
      {
        id: "domain",
        header: "Domain",
        widthClassName: "min-w-[220px]",
        render: (row) => <ClickableDomain value={row.domain} />,
      },
      {
        id: "actions",
        header: "Action",
        align: "right",
        widthClassName: "min-w-[240px]",
        render: (row) => {
          const id = clean(row._id);
          const isDeleting = deletingId === id;
          const isRestoring = restoringId === id;
          const busy = isDeleting || isRestoring;

          return (
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => restoreRow(row)}
                title="Remove from the exclude list and set its Brand Map rows back to pending"
                className="h-9 !border-emerald-300 px-3 !text-emerald-700 hover:!bg-emerald-50"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                {isRestoring ? "Restoring..." : "Restore"}
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => deleteRow(row)}
                title="Remove only the exclude-list entry (Brand Map rows stay excluded)"
                className="h-9 border-red-200 px-3 text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          );
        },
      },
    ],
    [deletingId, restoringId]
  );

  return (
    <main className="w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950">
          Excluded Brands
        </h1>

        <p className="mt-1 text-sm font-medium text-slate-500">
          Brands skipped by the worker during discovery.
        </p>
      </div>

      {notice ? <Notice type={notice.type} text={notice.text} /> : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <form
          onSubmit={submit}
          className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end"
        >
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-500">
              Brand Name
            </span>
            <Input
              placeholder="Brand name"
              value={form.brandName}
              onChange={(e) =>
                setForm({ ...form, brandName: e.target.value })
              }
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-500">
              Domain
            </span>
            <Input
              placeholder="example.com"
              value={form.domain}
              onChange={(e) => setForm({ ...form, domain: e.target.value })}
            />
          </label>

          <Button type="submit" disabled={submitting} className="h-10">
            <Plus className="mr-2 h-4 w-4" />
            {submitting ? "Adding..." : "Add Exclusion"}
          </Button>
        </form>
      </section>

      <section className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="w-full lg:max-w-[620px] xl:max-w-[720px]">
          <FilterSearchInput
            label="Search"
            value={search}
            onChange={setSearch}
            placeholder="Search brand or domain..."
          />
        </div>

        {search.trim() ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setSearch("")}
            className="w-fit"
          >
            Clear search
          </Button>
        ) : null}
      </section>

      <AdminTable
        data={visibleRows}
        columns={columns}
        rowKey={(row, index) =>
          row._id || `${row.brandName}-${row.domain}-${index}`
        }
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        loading={loading}
        loadingRows={8}
        emptyTitle={loading ? "Loading exclusions..." : "No exclusions yet."}
        emptyDescription={
          search.trim()
            ? "No excluded brands match your search."
            : "Excluded brands will be skipped during discovery."
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