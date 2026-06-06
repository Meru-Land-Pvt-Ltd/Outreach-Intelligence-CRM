"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { apiGet } from "@/lib/api";
import { formatDate, formatNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import AdminTable, {
  type AdminTableColumn,
} from "@/components/ui/tableComp";
import { FilterSearchInput } from "@/components/shared/filter-search-input";
import { FilterSelect } from "@/components/shared/filter-select";
import { ReviewsTabs } from "@/components/reviews/reviews-tabs";
import { ThumbnailPreview } from "@/components/shared/thumbnail-preview";

type ReviewVideoRow = {
  _id?: string;
  videoTitle?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  publishedDate?: string;
  views?: number;
  likes?: number;
  comments?: number;
  engagementRate?: number | string;
  duration?: string;
  niche?: string;
  createdAt?: string;
  updatedAt?: string;
};

type ReviewsTableProps = {
  title: string;
  description: string;
  endpoint: string;
  emptyDescription?: string;
};

const PAGE_SIZE = 1000;
const ALL_VALUE = "All";

function clean(value: unknown) {
  return String(value || "").trim();
}

function getUniqueOptions(
  rows: ReviewVideoRow[],
  getter: (row: ReviewVideoRow) => string
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

function getSearchText(row: ReviewVideoRow) {
  return [
    row.videoTitle,
    row.videoUrl,
    row.publishedDate,
    row.views,
    row.likes,
    row.comments,
    row.engagementRate,
    row.duration,
    row.niche,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getEngagement(value?: number | string) {
  if (value === null || value === undefined || value === "") return "-";

  return `${value}%`;
}

export function ReviewsTable({
  title,
  description,
  endpoint,
  emptyDescription = "Run Refresh Latest Uploads.",
}: ReviewsTableProps) {
  const [rows, setRows] = useState<ReviewVideoRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [niche, setNiche] = useState(ALL_VALUE);

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
  }, [endpoint]);

  const nicheOptions = useMemo(
    () => getUniqueOptions(rows, (row) => row.niche || ""),
    [rows]
  );

  const hasActiveFilters = Boolean(search.trim()) || niche !== ALL_VALUE;

  useEffect(() => {
    setPage(1);
  }, [search, niche]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesSearch = !query || getSearchText(row).includes(query);
      const matchesNiche = niche === ALL_VALUE || clean(row.niche) === niche;

      return matchesSearch && matchesNiche;
    });
  }, [rows, search, niche]);

  const visibleRows = useMemo(() => {
    return filteredRows.slice(0, page * PAGE_SIZE);
  }, [filteredRows, page]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));

  const columns = useMemo<AdminTableColumn<ReviewVideoRow>[]>(
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
        id: "videoTitle",
        header: "Video Title",
        widthClassName: "min-w-[380px]",
        render: (row) => (
          <p className="whitespace-normal font-semibold leading-6 text-slate-950">
            {clean(row.videoTitle) || "-"}
          </p>
        ),
      },
      {
        id: "videoUrl",
        header: "Video",
        widthClassName: "min-w-[120px]",
        render: (row) =>
          row.videoUrl ? (
            <Button
              asChild
              size="sm"
              variant="ghost"
              className="h-auto px-0 !font-medium !text-blue-600 hover:!text-blue-700"
            >
              <a href={row.videoUrl} target="_blank" rel="noreferrer">
                Open
                <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
              </a>
            </Button>
          ) : (
            "-"
          ),
      },
      {
        id: "thumbnailUrl",
        header: "Thumbnail",
        widthClassName: "min-w-[220px]",
        render: (row) => (
          <ThumbnailPreview src={row.thumbnailUrl} title={row.videoTitle} />
        ),
      },
      {
        id: "publishedDate",
        header: "Published",
        widthClassName: "min-w-[150px]",
        render: (row) => formatDate(row.publishedDate),
      },
      {
        id: "views",
        header: "Views",
        align: "right",
        widthClassName: "min-w-[120px]",
        render: (row) => formatNumber(row.views),
      },
      {
        id: "likes",
        header: "Likes",
        align: "right",
        widthClassName: "min-w-[120px]",
        render: (row) => formatNumber(row.likes),
      },
      {
        id: "comments",
        header: "Comments",
        align: "right",
        widthClassName: "min-w-[130px]",
        render: (row) => formatNumber(row.comments),
      },
      {
        id: "engagementRate",
        header: "Engagement",
        align: "right",
        widthClassName: "min-w-[140px]",
        render: (row) => (
          <span className="font-semibold text-slate-700">
            {getEngagement(row.engagementRate)}
          </span>
        ),
      },
      {
        id: "duration",
        header: "Duration",
        widthClassName: "min-w-[120px]",
        render: (row) => clean(row.duration) || "-",
      },
      {
        id: "niche",
        header: "Niche",
        widthClassName: "min-w-[180px]",
        render: (row) => clean(row.niche) || "-",
      },
    ],
    []
  );

  return (
    <main className="w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950">
          {title}
        </h1>

        <p className="mt-1 text-sm font-medium text-slate-500">
          {description}
        </p>
      </div>

      <ReviewsTabs />

      <section className="space-y-3">
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[1.5fr_260px_auto] lg:items-end">
          <FilterSearchInput
            label="Search"
            value={search}
            onChange={setSearch}
            placeholder="Search video title, niche, URL..."
          />

          <FilterSelect
            label="Niche"
            value={niche}
            onChange={setNiche}
            options={toOptions(nicheOptions)}
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
        rowKey={(row, index) => row._id || `${row.videoUrl}-${index}`}
        loading={loading}
        loadingRows={8}
        emptyTitle={loading ? `Loading ${title}...` : "No review videos found."}
        emptyDescription={
          hasActiveFilters ? "No videos match your current filters." : emptyDescription
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