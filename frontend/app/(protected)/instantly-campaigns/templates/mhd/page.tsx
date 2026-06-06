import { apiGet } from "@/lib/api";
import { DataSection } from "@/components/shared/data-section";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";

export default async function MhdTemplatePage() {
  const response = await apiGet("/instantly/templates/mhd");
  const rows = response?.data || [];

  return (
    <main className="w-full space-y-6">

      <DataSection title="MHD Template" description={`${rows.length} fields`}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Field</TableHead>
              <TableHead>Content</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {rows.map((row: any) => (
              <TableRow key={row.field}>
                <TableCell className="min-w-[180px] font-semibold">
                  {row.field}
                </TableCell>
                <TableCell className="min-w-[700px] whitespace-pre-wrap text-sm leading-6">
                  {row.content || "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataSection>
    </main>
  );
}
