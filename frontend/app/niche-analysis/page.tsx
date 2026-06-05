import { apiGet } from "@/lib/api";
import { formatNumber } from "@/lib/format";
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

export default async function NicheAnalysisPage() {
  const response = await apiGet("/sheets/niche-analysis");
  const rows = response?.data || [];

  return (
    <main className="w-full space-y-6">
      <PageHeader
        title="Niche Analysis"
        description="Brand count by niche."
      />

      <DataSection title="Niches" description={`${rows.length} records`}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Niche</TableHead>
              <TableHead>Brands</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {rows.map((row: any) => (
              <TableRow key={row._id}>
                <TableCell className="min-w-[280px] font-semibold text-slate-950">
                  {row.nicheName || "-"}
                </TableCell>

                <TableCell className="min-w-[120px]">
                  {formatNumber(row.brandCount)}
                </TableCell>
              </TableRow>
            ))}

            {rows.length === 0 ? (
              <TableEmpty
                colSpan={2}
                title="No niche rows yet."
                description="Niche grouping appears after BrandMap generation."
              />
            ) : null}
          </TableBody>
        </Table>
      </DataSection>
    </main>
  );
}