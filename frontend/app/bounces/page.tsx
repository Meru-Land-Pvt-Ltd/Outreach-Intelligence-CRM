import { apiGet } from "@/lib/api";
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

export default async function BouncesPage() {
  const response = await apiGet("/instantly/bounces");
  const rows = response?.data || [];

  return (
    <main className="w-full space-y-6">
      <PageHeader
        title="Bounce Tracking"
        description="Instantly bounce events."
      />

      <DataSection title="Events" description={`${rows.length} records`}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Campaign ID</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Time</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {rows.map((row: any) => (
              <TableRow key={row._id}>
                <TableCell className="min-w-[220px] font-medium text-slate-950">
                  {row.email || "-"}
                </TableCell>

                <TableCell className="min-w-[180px]">
                  {row.campaignId || "-"}
                </TableCell>

                <TableCell className="min-w-[140px]">
                  {row.eventType || "-"}
                </TableCell>

                <TableCell className="min-w-[260px] whitespace-normal">
                  {row.reason || "-"}
                </TableCell>

                <TableCell className="min-w-[200px]">
                  {row.createdAt ? new Date(row.createdAt).toLocaleString() : "-"}
                </TableCell>
              </TableRow>
            ))}

            {rows.length === 0 ? (
              <TableEmpty
                colSpan={5}
                title="No bounce events yet."
                description="Bounce webhooks will appear here."
              />
            ) : null}
          </TableBody>
        </Table>
      </DataSection>
    </main>
  );
}