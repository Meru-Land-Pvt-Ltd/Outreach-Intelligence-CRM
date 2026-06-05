import { apiGet } from "@/lib/api";
import { formatDate } from "@/lib/format";
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

export default async function RunLogPage() {
  const response = await apiGet("/run-log");
  const rows = response?.data || [];

  return (
    <main className="w-full space-y-6">
      <PageHeader
        title="Run Log"
        description="Latest Log and Failed Execution from the old Apps Script flow."
      />

      <DataSection title="Run Log" description={`${rows.length} records`}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Latest Log</TableHead>
              <TableHead>Failed Execution</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {rows.map((row: any) => (
              <TableRow key={row._id}>
                <TableCell className="min-w-[180px]">
                  {formatDate(row.createdAt)}
                </TableCell>

                <TableCell className="min-w-[520px] whitespace-pre-wrap">
                  {row.latestLog || "-"}
                </TableCell>

                <TableCell className="min-w-[520px] whitespace-pre-wrap text-red-600">
                  {row.failedExecution || "-"}
                </TableCell>
              </TableRow>
            ))}

            {rows.length === 0 ? (
              <TableEmpty
                colSpan={3}
                title="No run logs yet."
                description="Pipeline logs will appear here."
              />
            ) : null}
          </TableBody>
        </Table>
      </DataSection>
    </main>
  );
}
