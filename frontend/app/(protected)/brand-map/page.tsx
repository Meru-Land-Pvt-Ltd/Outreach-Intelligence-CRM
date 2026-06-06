"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  createdAt?: string;
  updatedAt?: string;
};

const PAGE_SIZE = 1000;
const ALL_VALUE = "All";

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

export default function BrandMapPage() {
  const [brands, setBrands] = useState<BrandMapRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [foundVia, setFoundVia] = useState(ALL_VALUE);
  const [niche, setNiche] = useState(ALL_VALUE);
  const [domain, setDomain] = useState(ALL_VALUE);
  const [recencyTag, setRecencyTag] = useState(ALL_VALUE);

  const [page, setPage] = useState(1);

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
    recencyTag !== ALL_VALUE;

  useEffect(() => {
    setPage(1);
  }, [search, foundVia, niche, domain, recencyTag]);

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

      return (
        matchesSearch &&
        matchesFoundVia &&
        matchesNiche &&
        matchesDomain &&
        matchesRecency
      );
    });
  }, [brands, search, foundVia, niche, domain, recencyTag]);

  const visibleBrands = useMemo(() => {
    return filteredBrands.slice(0, page * PAGE_SIZE);
  }, [filteredBrands, page]);

  const totalPages = Math.max(1, Math.ceil(filteredBrands.length / PAGE_SIZE));

  function clearFilters() {
    setSearch("");
    setFoundVia(ALL_VALUE);
    setNiche(ALL_VALUE);
    setDomain(ALL_VALUE);
    setRecencyTag(ALL_VALUE);
    setPage(1);
  }

  const columns = useMemo<AdminTableColumn<BrandMapRow>[]>(
    () => [
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
        widthClassName: "min-w-[220px]",
        render: (brand) => (
          <span className="font-semibold text-slate-950">
            {brand.brandName || "-"}
          </span>
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
    []
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
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          {hasActiveFilters ? (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              Filters applied
            </span>
          ) : null}
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