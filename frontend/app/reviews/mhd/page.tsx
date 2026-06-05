import { ExternalLink } from "lucide-react";
import { apiGet } from "@/lib/api";
import { formatDate, formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { DataSection } from "@/components/shared/data-section";
import { TableEmpty } from "@/components/shared/table-empty";
import { ReviewsTabs } from "@/components/reviews/reviews-tabs";
import { ThumbnailPreview } from "../thumbnail-preview";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function MhdReviewsPage() {
  const response = await apiGet("/reviews/mhd");
  const rows = response?.data || [];

  return (
    <main className="w-full space-y-6">
      <PageHeader
        title="MHD Tech Reviews"
        description="Latest uploads from MHD Tech."
      />

      <ReviewsTabs />

      <DataSection title="MHD Tech Reviews" description={`${rows.length} videos`}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Video Title</TableHead>
              <TableHead>Video</TableHead>
              <TableHead>Thumbnail</TableHead>
              <TableHead>Published</TableHead>
              <TableHead>Views</TableHead>
              <TableHead>Likes</TableHead>
              <TableHead>Comments</TableHead>
              <TableHead>Engagement</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Niche</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {rows.map((row: any) => (
              <TableRow key={row._id}>
                <TableCell className="min-w-[360px] whitespace-normal font-semibold leading-6 text-slate-950">
                  {row.videoTitle || "-"}
                </TableCell>

                <TableCell className="min-w-[120px]">
                  {row.videoUrl ? (
                    <Button
                      asChild
                      size="sm"
                      variant="ghost"
                      className="h-auto px-0"
                    >
                      <a href={row.videoUrl} target="_blank" rel="noreferrer">
                        Open
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  ) : (
                    "-"
                  )}
                </TableCell>

                <TableCell className="min-w-[220px]">
                  <ThumbnailPreview
                    src={row.thumbnailUrl}
                    title={row.videoTitle}
                  />
                </TableCell>

                <TableCell className="min-w-[150px]">
                  {formatDate(row.publishedDate)}
                </TableCell>

                <TableCell>{formatNumber(row.views)}</TableCell>
                <TableCell>{formatNumber(row.likes)}</TableCell>
                <TableCell>{formatNumber(row.comments)}</TableCell>
                <TableCell>{row.engagementRate ?? "-"}%</TableCell>
                <TableCell>{row.duration || "-"}</TableCell>

                <TableCell className="min-w-[180px]">
                  {row.niche || "-"}
                </TableCell>
              </TableRow>
            ))}

            {rows.length === 0 ? (
              <TableEmpty
                colSpan={10}
                title="No review videos found."
                description="Run Refresh Latest Uploads."
              />
            ) : null}
          </TableBody>
        </Table>
      </DataSection>
    </main>
  );
}