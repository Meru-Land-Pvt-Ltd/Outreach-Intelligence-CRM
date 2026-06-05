import { apiGet } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
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

export default async function PipelineTrackerPage() {
  const response = await apiGet("/sheets/pipeline-tracker");
  const rows = response?.data || [];

  return (
    <main className="w-full space-y-6">
      <PageHeader
        title="Pipeline Tracker"
        description="Workflow activity logs."
      />

      <DataSection title="Activity" description={`${rows.length} records`}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Brand</TableHead>
              <TableHead>Domain</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Time</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {rows.map((row: any) => (
              <TableRow key={row._id}>
                <TableCell>
                  <Badge variant={row.type === "Seed" ? "default" : "secondary"}>
                    {row.type || "-"}
                  </Badge>
                </TableCell>

                <TableCell className="min-w-[220px] font-semibold text-slate-950">
                  {row.brandName || "-"}
                </TableCell>

                <TableCell className="min-w-[220px]">
                  {row.domain || "-"}
                </TableCell>

                <TableCell className="min-w-[180px]">
                  {row.status || "-"}
                </TableCell>

                <TableCell className="min-w-[200px]">
                  {formatDateTime(row.timestamp)}
                </TableCell>
              </TableRow>
            ))}

            {rows.length === 0 ? (
              <TableEmpty
                colSpan={5}
                title="No tracker rows yet."
                description="Worker activity will appear here."
              />
            ) : null}
          </TableBody>
        </Table>
      </DataSection>
    </main>
  );
}