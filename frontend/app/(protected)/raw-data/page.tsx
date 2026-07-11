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
import { cn } from "@/lib/utils";

const ALL_VALUE = "All";

type RawYoutubeVideo = {
  _id?: string;

  seedBrandId?: string;
  seedBrandName?: string;

  channelName?: string;
  channelId?: string;
  videoTitle?: string;
  videoUrl?: string;
  videoDescription?: string;

  publishedDate?: string;
  addedOn?: string;
  createdAt?: string;
  updatedAt?: string;

  durationSec?: number;
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
  subscriberCount?: number;

  channelCountry?: string;
  channelCategory?: string;
  category?: string;

  sponsorBrand?: string;
  promoCode?: string;
  productNameWithModel?: string;
  productName?: string;
  sponsorshipType?: string;

  processed?: boolean;
  aiProcessed?: boolean;
  analysisStatus?: string;

  source?: string;
  platform?: string;
};

type RawYoutubePagination = {
  page?: number;
  limit?: number;
  totalItems?: number;
  totalPages?: number;
};

type RawYoutubeResponse = {
  success?: boolean;
  count?: number;
  data?: RawYoutubeVideo[];
  pagination?: RawYoutubePagination;
  message?: string;
};

const PAGE_SIZE = 1000;

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

function formatNumber(value?: number) {
  const number = Number(value || 0);

  if (!number) return "-";

  return number.toLocaleString("en-IN");
}

function formatDurationSec(value?: number) {
  const seconds = Number(value || 0);

  if (!seconds) return "-";

  return seconds.toLocaleString("en-IN");
}

function getAddedOn(video: RawYoutubeVideo) {
  return video.addedOn || video.createdAt || video.updatedAt || "";
}

function getProductNameWithModel(video: RawYoutubeVideo) {
  return clean(video.productNameWithModel) || clean(video.productName) || "";
}

function getChannelCategory(video: RawYoutubeVideo) {
  return clean(video.channelCategory) || clean(video.category) || "";
}

function getAiFieldValue(video: RawYoutubeVideo, value?: string) {
  const cleaned = clean(value);

  if (cleaned) return cleaned;

  if (
    video.analysisStatus === "pending" ||
    video.analysisStatus === "pending_retry" ||
    !video.aiProcessed
  ) {
    return "Pending AI analysis";
  }

  return "-";
}

function getVideoUrlLabel(url?: string) {
  const value = clean(url);

  if (!value) return "-";
  if (value.length <= 24) return value;

  return `${value.slice(0, 20)}...`;
}

function getVideoUniqueKey(video: RawYoutubeVideo, fallbackIndex: number) {
  return video._id || video.videoUrl || `${video.channelId || "row"}-${fallbackIndex}`;
}

function mergeUniqueVideos(
  previousVideos: RawYoutubeVideo[],
  nextVideos: RawYoutubeVideo[]
) {
  const seen = new Set<string>();
  const merged: RawYoutubeVideo[] = [];

  [...previousVideos, ...nextVideos].forEach((video, index) => {
    const key = getVideoUniqueKey(video, index);

    if (seen.has(key)) return;

    seen.add(key);
    merged.push(video);
  });

  return merged;
}

export default function RawDataPage() {
  const [videos, setVideos] = useState<RawYoutubeVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [foundVia, setFoundVia] = useState(ALL_VALUE);
  const [foundViaOptions, setFoundViaOptions] = useState<string[]>([]);

  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [expandedDescriptionId, setExpandedDescriptionId] = useState<
    string | null
  >(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setVideos([]);
      setPage(1);
      setDebouncedSearch(search.trim());
      setExpandedDescriptionId(null);
    }, 400);

    return () => clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    let active = true;

    (async () => {
      const response: any = await apiGet("/raw-youtube/found-via");

      if (active && Array.isArray(response?.data)) {
        setFoundViaOptions(response.data);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  function handleFoundViaChange(value: string) {
    setFoundVia(value);
    setVideos([]);
    setPage(1);
    setExpandedDescriptionId(null);
  }

  useEffect(() => {
    let active = true;

    async function loadVideos() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(PAGE_SIZE),
        });

        if (debouncedSearch) {
          params.set("search", debouncedSearch);
        }

        if (foundVia !== ALL_VALUE) {
          params.set("foundVia", foundVia);
        }

        const response = (await apiGet(
          `/raw-youtube?${params.toString()}`
        )) as RawYoutubeResponse | null;

        if (!active) return;

        if (!response || response.success === false) {
          setVideos([]);
          setTotalItems(0);
          setTotalPages(1);
          setError(response?.message || "Failed to load raw YouTube videos.");
          return;
        }

        const receivedVideos = Array.isArray(response.data)
          ? response.data
          : [];

        const pagination = response.pagination;

        setVideos((previousVideos) => {
          if (page === 1) {
            return receivedVideos;
          }

          return mergeUniqueVideos(previousVideos, receivedVideos);
        });

        setTotalItems(
          Number(
            pagination?.totalItems ||
              response.count ||
              receivedVideos.length
          )
        );

        setTotalPages(Number(pagination?.totalPages || 1));
      } catch (err: any) {
        if (!active) return;

        setVideos([]);
        setTotalItems(0);
        setTotalPages(1);
        setError(err?.message || "Failed to load raw YouTube videos.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadVideos();

    return () => {
      active = false;
    };
  }, [page, debouncedSearch, foundVia]);

  const columns = useMemo<AdminTableColumn<RawYoutubeVideo>[]>(
    () => [
      {
        id: "index",
        header: "#",
        align: "center",
        widthClassName: "min-w-[70px]",
        render: (_video, index) => (
          <span className="text-sm font-semibold text-slate-500">
            {index + 1}
          </span>
        ),
      },
      {
        id: "foundVia",
        header: "Found Via",
        widthClassName: "min-w-[150px]",
        render: (video) => video.seedBrandName || "-",
      },
      {
        id: "channelName",
        header: "Channel Name",
        widthClassName: "min-w-[220px]",
        render: (video) => (
          <span className="font-semibold text-slate-950">
            {video.channelName || "-"}
          </span>
        ),
      },
      {
        id: "channelId",
        header: "Channel ID",
        widthClassName: "min-w-[230px]",
        render: (video) => (
          <span className="font-mono text-xs text-slate-500">
            {video.channelId || "-"}
          </span>
        ),
      },
      {
        id: "videoTitle",
        header: "Video Title",
        widthClassName: "min-w-[340px]",
        render: (video) => (
          <p className="whitespace-normal text-sm font-semibold leading-6 text-slate-900">
            {video.videoTitle || "-"}
          </p>
        ),
      },
      {
        id: "videoUrl",
        header: "Video URL",
        widthClassName: "min-w-[150px]",
        render: (video) =>
          video.videoUrl ? (
            <Button
              asChild
              size="sm"
              variant="ghost"
              className="h-auto px-0 font-semibold !text-blue-600 hover:!text-blue-700"
            >
              <a href={video.videoUrl} target="_blank" rel="noreferrer">
                {getVideoUrlLabel(video.videoUrl)}
                <ExternalLink className="ml-2 h-3.5 w-3.5" />
              </a>
            </Button>
          ) : (
            "-"
          ),
      },
      {
        id: "videoDescription",
        header: "Description",
        widthClassName: "min-w-[420px]",
        render: (video, index) => {
          const rowId = video._id || video.videoUrl || String(index);
          const description = video.videoDescription || "-";
          const expanded = expandedDescriptionId === rowId;
          const canExpand = description !== "-" && description.length > 120;

          return (
            <button
              type="button"
              disabled={!canExpand}
              onClick={() =>
                setExpandedDescriptionId((current) =>
                  current === rowId ? null : rowId
                )
              }
              className="block w-full max-w-[520px] text-left disabled:cursor-default"
            >
              <p
                className={cn(
                  "whitespace-normal text-sm leading-6 text-slate-500",
                  !expanded && "line-clamp-3",
                  canExpand && "cursor-pointer hover:text-slate-700"
                )}
              >
                {description}
              </p>
            </button>
          );
        },
      },
      {
        id: "publishedDate",
        header: "Published Date",
        widthClassName: "min-w-[160px]",
        render: (video) => formatDate(video.publishedDate),
      },
      {
        id: "addedOn",
        header: "Added On",
        widthClassName: "min-w-[150px]",
        render: (video) => formatDate(getAddedOn(video)),
      },
      {
        id: "durationSec",
        header: "Duration",
        align: "right",
        widthClassName: "min-w-[120px]",
        render: (video) => formatDurationSec(video.durationSec),
      },
      {
        id: "viewCount",
        header: "Views",
        align: "right",
        widthClassName: "min-w-[120px]",
        render: (video) => formatNumber(video.viewCount),
      },
      {
        id: "likeCount",
        header: "Likes",
        align: "right",
        widthClassName: "min-w-[120px]",
        render: (video) => formatNumber(video.likeCount),
      },
      {
        id: "commentCount",
        header: "Comments",
        align: "right",
        widthClassName: "min-w-[130px]",
        render: (video) => formatNumber(video.commentCount),
      },
      {
        id: "subscriberCount",
        header: "Subscribers",
        align: "right",
        widthClassName: "min-w-[150px]",
        render: (video) => formatNumber(video.subscriberCount),
      },
      {
        id: "channelCountry",
        header: "Country",
        align: "center",
        widthClassName: "min-w-[130px]",
        render: (video) => video.channelCountry || "-",
      },
      {
        id: "channelCategory",
        header: "Category",
        widthClassName: "min-w-[180px]",
        render: (video) => getChannelCategory(video) || "-",
      },
      {
        id: "sponsorBrand",
        header: "Sponsor Brand",
        widthClassName: "min-w-[180px]",
        render: (video) => (
          <span className="font-semibold text-slate-950">
            {getAiFieldValue(video, video.sponsorBrand)}
          </span>
        ),
      },
      {
        id: "promoCode",
        header: "Promo Code",
        widthClassName: "min-w-[130px]",
        render: (video) => getAiFieldValue(video, video.promoCode),
      },
      {
        id: "productNameWithModel",
        header: "Product Name With Model",
        widthClassName: "min-w-[300px]",
        render: (video) => (
          <p className="whitespace-normal text-sm leading-6 text-slate-700">
            {getAiFieldValue(video, getProductNameWithModel(video))}
          </p>
        ),
      },
      {
        id: "sponsorshipType",
        header: "Sponsorship Type",
        widthClassName: "min-w-[180px]",
        render: (video) => getAiFieldValue(video, video.sponsorshipType),
      },
    ],
    [expandedDescriptionId]
  );

  return (
    <main className="w-full space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            Raw Data
          </h1>

          <p className="mt-1 text-sm font-medium text-slate-500">
            Showing {videos.length.toLocaleString("en-IN")} of{" "}
            {totalItems.toLocaleString("en-IN")} raw videos.
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:flex-row lg:max-w-[820px]">
          <div className="min-w-0 flex-1">
            <FilterSearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search raw videos, sponsor, channel, product..."
            />
          </div>

          <div className="w-full sm:w-56">
            <FilterSelect
              label="Found Via"
              value={foundVia}
              onChange={handleFoundViaChange}
              options={[
                { label: ALL_VALUE, value: ALL_VALUE },
                ...foundViaOptions.map((name) => ({
                  label: name,
                  value: name,
                })),
              ]}
            />
          </div>
        </div>
      </div>

      <AdminTable
        data={videos}
        columns={columns}
        rowKey={(video, index) =>
          video._id || video.videoUrl || String(index)
        }
        loading={loading && videos.length === 0}
        loadingRows={8}
        error={error}
        emptyDescription={
          debouncedSearch
            ? "No videos match your current search."
            : "Crawled raw videos will appear here."
        }
        containerClassName="rounded-xl shadow-none"
        pagination={{
          page,
          totalPages,
          totalItems,
          limit: PAGE_SIZE,
          onPageChange: (nextPage) => {
            if (nextPage <= page) return;

            setPage(nextPage);
            setExpandedDescriptionId(null);
          },
          loading,
          showSummary: true,
          showRowsSelector: false,
        }}
      />
    </main>
  );
}