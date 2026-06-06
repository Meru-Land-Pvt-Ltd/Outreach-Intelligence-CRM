"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { apiGet } from "@/lib/api";
import { Button } from "@/components/ui/button";
import AdminTable, {
  type AdminTableColumn,
} from "@/components/ui/tableComp";
import { FilterSearchInput } from "@/components/shared/filter-search-input";
import { FilterSelect } from "@/components/shared/filter-select";

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
  gatewayBounced?: string;
  createdAt?: string;
  updatedAt?: string;
};

const PAGE_SIZE = 1000;
const ALL_VALUE = "All";

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
    ...items.map((item) => ({
      label: item,
      value: item,
    })),
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
    row.instantlyBounced,
    row.gatewayBounced,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function StatusBadge({ value }: { value?: string }) {
  const text = clean(value);

  if (!text) return <span className="text-slate-300">-</span>;

  const lower = text.toLowerCase();

  if (
    ["done", "completed", "success", "pushed", "verified", "valid", "no", "false"].includes(
      lower
    )
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

  if (lines.length === 0) {
    return <span className="text-slate-300">-</span>;
  }

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

export default function MhdInstantlyPage() {
  const [rows, setRows] = useState<InstantlyRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [pushedStatus, setPushedStatus] = useState(ALL_VALUE);
  const [verificationStatus, setVerificationStatus] = useState(ALL_VALUE);
  const [instantlyBounced, setInstantlyBounced] = useState(ALL_VALUE);
  const [gatewayBounced, setGatewayBounced] = useState(ALL_VALUE);

  const [page, setPage] = useState(1);

  async function loadRows() {
    setLoading(true);

    try {
      const response = await apiGet("/instantly/mhd");
      setRows(response?.data || []);
    } catch {
      setRows([]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadRows();
  }, []);

  const pushedStatusOptions = useMemo(
    () => getUniqueOptions(rows, (row) => row.pushedStatus || ""),
    [rows]
  );

  const verificationStatusOptions = useMemo(
    () => getUniqueOptions(rows, (row) => row.verificationStatus || ""),
    [rows]
  );

  const instantlyBouncedOptions = useMemo(
    () => getUniqueOptions(rows, (row) => row.instantlyBounced || ""),
    [rows]
  );

  const gatewayBouncedOptions = useMemo(
    () => getUniqueOptions(rows, (row) => row.gatewayBounced || ""),
    [rows]
  );

  const hasActiveFilters =
    Boolean(search.trim()) ||
    pushedStatus !== ALL_VALUE ||
    verificationStatus !== ALL_VALUE ||
    instantlyBounced !== ALL_VALUE ||
    gatewayBounced !== ALL_VALUE;

  useEffect(() => {
    setPage(1);
  }, [
    search,
    pushedStatus,
    verificationStatus,
    instantlyBounced,
    gatewayBounced,
  ]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesSearch = !query || getSearchText(row).includes(query);

      const matchesPushedStatus =
        pushedStatus === ALL_VALUE || clean(row.pushedStatus) === pushedStatus;

      const matchesVerificationStatus =
        verificationStatus === ALL_VALUE ||
        clean(row.verificationStatus) === verificationStatus;

      const matchesInstantlyBounced =
        instantlyBounced === ALL_VALUE ||
        clean(row.instantlyBounced) === instantlyBounced;

      const matchesGatewayBounced =
        gatewayBounced === ALL_VALUE ||
        clean(row.gatewayBounced) === gatewayBounced;

      return (
        matchesSearch &&
        matchesPushedStatus &&
        matchesVerificationStatus &&
        matchesInstantlyBounced &&
        matchesGatewayBounced
      );
    });
  }, [
    rows,
    search,
    pushedStatus,
    verificationStatus,
    instantlyBounced,
    gatewayBounced,
  ]);

  const visibleRows = useMemo(() => {
    return filteredRows.slice(0, page * PAGE_SIZE);
  }, [filteredRows, page]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));

  function clearFilters() {
    setSearch("");
    setPushedStatus(ALL_VALUE);
    setVerificationStatus(ALL_VALUE);
    setInstantlyBounced(ALL_VALUE);
    setGatewayBounced(ALL_VALUE);
    setPage(1);
  }

  const columns = useMemo<AdminTableColumn<InstantlyRow>[]>(
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
        id: "firstName",
        header: "First Name",
        widthClassName: "min-w-[160px]",
        render: (row) => clean(row.firstName) || "-",
      },
      {
        id: "email",
        header: "Email",
        widthClassName: "min-w-[260px]",
        render: (row) => (
          <span className="break-all !font-medium !text-slate-700">
            {clean(row.email) || "-"}
          </span>
        ),
      },
      {
        id: "companyName",
        header: "Company Name",
        widthClassName: "min-w-[200px]",
        render: (row) => (
          <span className="font-semibold text-slate-950">
            {clean(row.companyName) || "-"}
          </span>
        ),
      },
      {
        id: "productName",
        header: "Product Name",
        widthClassName: "min-w-[260px]",
        render: (row) => clean(row.productName) || "-",
      },
      {
        id: "relatedVideo",
        header: "MHD Related",
        widthClassName: "min-w-[320px]",
        render: (row) => <MultilineClickableCell value={row.relatedVideo} />,
      },
      {
        id: "competitor1",
        header: "Competitor 1",
        widthClassName: "min-w-[180px]",
        render: (row) => <ClickableValue value={row.competitor1} />,
      },
      {
        id: "competitor2",
        header: "Competitor 2",
        widthClassName: "min-w-[180px]",
        render: (row) => <ClickableValue value={row.competitor2} />,
      },
      {
        id: "pushedStatus",
        header: "Pushed Status",
        widthClassName: "min-w-[220px]",
        render: (row) => <StatusBadge value={row.pushedStatus} />,
      },
      {
        id: "verificationStatus",
        header: "Verification Status",
        widthClassName: "min-w-[180px]",
        render: (row) => <StatusBadge value={row.verificationStatus} />,
      },
      {
        id: "instantlyBounced",
        header: "Instantly Bounced",
        widthClassName: "min-w-[180px]",
        render: (row) => <StatusBadge value={row.instantlyBounced} />,
      },
      {
        id: "gatewayBounced",
        header: "Gateway Bounced",
        widthClassName: "min-w-[180px]",
        render: (row) => <StatusBadge value={row.gatewayBounced} />,
      },
    ],
    []
  );

  return (
    <main className="w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950">
          MHD Instantly
        </h1>

        <p className="mt-1 text-sm font-medium text-slate-500">
          Instantly export leads for MHD campaigns.
        </p>
      </div>

      <section className="space-y-3">
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:grid-cols-[1.5fr_1fr_1fr_1fr_1fr_auto] xl:items-end">
          <FilterSearchInput
            label="Search"
            value={search}
            onChange={setSearch}
            placeholder="Search name, email, company, product..."
          />

          <FilterSelect
            label="Pushed Status"
            value={pushedStatus}
            onChange={setPushedStatus}
            options={toOptions(pushedStatusOptions)}
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

          <FilterSelect
            label="Gateway Bounced"
            value={gatewayBounced}
            onChange={setGatewayBounced}
            options={toOptions(gatewayBouncedOptions)}
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

        {hasActiveFilters ? (
          <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            Filters applied
          </span>
        ) : null}
      </section>

      <AdminTable
        data={visibleRows}
        columns={columns}
        rowKey={(row, index) => row._id || `${row.email}-${index}`}
        loading={loading}
        loadingRows={8}
        emptyTitle={
          loading ? "Loading MHD Instantly..." : "No MHD Instantly rows yet."
        }
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
    </main>
  );
}