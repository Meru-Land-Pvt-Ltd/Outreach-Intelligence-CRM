"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { apiGet } from "@/lib/api";
import { Button } from "@/components/ui/button";
import AdminTable, {
  type AdminTableColumn,
} from "@/components/ui/tableComp";
import { FilterSearchInput } from "@/components/shared/filter-search-input";
import { cn } from "@/lib/utils";

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
  return clean(video.productNameWithModel) || clean(video.productName) || "-";
}

function getVideoUrlLabel(url?: string) {
  const value = clean(url);

  if (!value) return "-";
  if (value.length <= 24) return value;

  return `${value.slice(0, 20)}...`;
}

function getSearchText(video: RawYoutubeVideo) {
  return [
    video.seedBrandName,
    video.channelName,
    video.channelId,
    video.videoTitle,
    video.videoUrl,
    video.videoDescription,
    video.durationSec,
    video.viewCount,
    video.likeCount,
    video.commentCount,
    video.subscriberCount,
    video.channelCountry,
    video.channelCategory,
    video.sponsorBrand,
    video.promoCode,
    video.productNameWithModel,
    video.productName,
    video.sponsorshipType,
    video.analysisStatus,
    video.source,
    video.platform,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export default function RawDataPage() {
  const [videos, setVideos] = useState<RawYoutubeVideo[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [expandedDescriptionId, setExpandedDescriptionId] = useState<string | null>(
    null
  );

  async function loadVideos() {
    setLoading(true);

    try {
      const response = await apiGet("/raw-youtube?limit=max");
      setVideos(response?.data || []);
    } catch {
      setVideos([]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadVideos();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const filteredVideos = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return videos;

    return videos.filter((video) => getSearchText(video).includes(query));
  }, [videos, search]);

  const visibleVideos = useMemo(() => {
    return filteredVideos.slice(0, page * PAGE_SIZE);
  }, [filteredVideos, page]);

  const totalPages = Math.max(1, Math.ceil(filteredVideos.length / PAGE_SIZE));

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
              className="h-auto px-0 font-semibold !text-blue-600 !hover:text-blue-700"
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
        render: (video) => video.channelCategory || "-",
      },
      {
        id: "sponsorBrand",
        header: "Sponsor Brand",
        widthClassName: "min-w-[180px]",
        render: (video) => (
          <span className="font-semibold text-slate-950">
            {video.sponsorBrand || "-"}
          </span>
        ),
      },
      {
        id: "promoCode",
        header: "Promo Code",
        widthClassName: "min-w-[130px]",
        render: (video) => video.promoCode || "-",
      },
      {
        id: "productNameWithModel",
        header: "Product Name With Model",
        widthClassName: "min-w-[300px]",
        render: (video) => (
          <p className="whitespace-normal text-sm leading-6 text-slate-700">
            {getProductNameWithModel(video)}
          </p>
        ),
      },
      {
        id: "sponsorshipType",
        header: "Sponsorship Type",
        widthClassName: "min-w-[180px]",
        render: (video) => video.sponsorshipType || "-",
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
            All raw videos and extracted data from reviews.
          </p>
        </div>

        <div className="w-[50%] lg:max-w-[620px] xl:max-w-[720px]">
          <FilterSearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search raw videos, sponsor, channel, product..."
          />
        </div>
      </div>

      <AdminTable
        data={visibleVideos}
        columns={columns}
        rowKey={(video, index) => video._id || video.videoUrl || String(index)}
        loading={loading}
        loadingRows={8}
        emptyDescription={
          search.trim()
            ? "No videos match your current search."
            : "Crawled raw videos will appear here."
        }
        containerClassName="rounded-xl shadow-none"
        pagination={{
          page,
          totalPages,
          totalItems: filteredVideos.length,
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