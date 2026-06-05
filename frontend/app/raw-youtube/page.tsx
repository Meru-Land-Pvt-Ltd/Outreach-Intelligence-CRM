import { ExternalLink } from "lucide-react";
import { apiGet } from "@/lib/api";
import { formatDate, formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { DataSection } from "@/components/shared/data-section";
import { TableEmpty } from "@/components/shared/table-empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";

function getAddedOn(video: any) {
  return video.addedOn || video.createdAt || video.updatedAt || null;
}

export default async function RawYoutubePage() {
  const response = await apiGet("/raw-youtube");
  const videos = response?.data || [];

  return (
    <main className="w-full space-y-6">
      <PageHeader
        title="Raw Video Data"
        description="Sponsor videos found during crawl."
      />

      <DataSection title="Videos" description={`${videos.length} records`}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Channel</TableHead>
              <TableHead>Channel ID</TableHead>
              <TableHead>Video Title</TableHead>
              <TableHead>Video URL</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Published</TableHead>
              <TableHead>Added On</TableHead>
              <TableHead>View Count</TableHead>
              <TableHead>Like Count</TableHead>
              <TableHead>Comment Count</TableHead>
              <TableHead>Subscriber Count</TableHead>
              <TableHead>Channel Country</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Sponsor</TableHead>
              <TableHead>Promo</TableHead>
              <TableHead>Product Name (with Model)</TableHead>
              <TableHead>Sponsorship Type</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {videos.map((video: any) => (
              <TableRow key={video._id}>
                <TableCell className="min-w-[200px] font-medium text-slate-900">
                  {video.channelName || "-"}
                </TableCell>

                <TableCell className="min-w-[240px] font-mono text-xs text-slate-600">
                  {video.channelId || "-"}
                </TableCell>

                <TableCell className="min-w-[360px] whitespace-normal">
                  <p className="font-semibold leading-6 text-slate-950">
                    {video.videoTitle || "-"}
                  </p>
                </TableCell>

                <TableCell className="min-w-[140px]">
                  {video.videoUrl ? (
                    <Button
                      asChild
                      size="sm"
                      variant="ghost"
                      className="h-auto px-0"
                    >
                      <a href={video.videoUrl} target="_blank" rel="noreferrer">
                        Open video
                        <ExternalLink className="ml-2 h-3.5 w-3.5" />
                      </a>
                    </Button>
                  ) : (
                    "-"
                  )}
                </TableCell>

                <TableCell className="min-w-[420px] max-w-[520px] whitespace-normal">
                  <p className="line-clamp-6 text-sm leading-6 text-slate-600">
                    {video.videoDescription || "-"}
                  </p>
                </TableCell>

                <TableCell className="min-w-[150px]">
                  {formatDate(video.publishedDate)}
                </TableCell>

                <TableCell className="min-w-[150px]">
                  {formatDate(getAddedOn(video))}
                </TableCell>

                <TableCell className="min-w-[120px]">
                  {formatNumber(video.viewCount)}
                </TableCell>

                <TableCell className="min-w-[120px]">
                  {formatNumber(video.likeCount)}
                </TableCell>

                <TableCell className="min-w-[140px]">
                  {formatNumber(video.commentCount)}
                </TableCell>

                <TableCell className="min-w-[150px]">
                  {formatNumber(video.subscriberCount)}
                </TableCell>

                <TableCell className="min-w-[150px]">
                  {video.channelCountry || "-"}
                </TableCell>

                <TableCell className="min-w-[180px]">
                  {video.channelCategory || "-"}
                </TableCell>

                <TableCell className="min-w-[180px] font-semibold text-slate-950">
                  {video.sponsorBrand || "-"}
                </TableCell>

                <TableCell className="min-w-[120px]">
                  {video.promoCode || "-"}
                </TableCell>

                <TableCell className="min-w-[280px] whitespace-normal leading-6">
                  {video.productNameWithModel || video.productName || "-"}
                </TableCell>

                <TableCell className="min-w-[180px]">
                  {video.sponsorshipType || "-"}
                </TableCell>
              </TableRow>
            ))}

            {videos.length === 0 ? (
              <TableEmpty
                colSpan={17}
                title="No raw videos found."
                description="Crawled sponsorship videos will appear here."
              />
            ) : null}
          </TableBody>
        </Table>
      </DataSection>
    </main>
  );
}