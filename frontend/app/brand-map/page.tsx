import { apiGet } from "@/lib/api";
import { formatDate } from "@/lib/format";
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

export default async function BrandMapPage() {
  const response = await apiGet("/brand-map");
  const brands = response?.data || [];

  return (
    <main className="w-full space-y-6">
      <PageHeader
        title="BrandMap"
        description="Review discovered brands."
      />

      <DataSection title="Brands" description={`${brands.length} records`}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Brand</TableHead>
              <TableHead>Domain</TableHead>
              <TableHead>Found Via</TableHead>
              <TableHead>Channels</TableHead>
              <TableHead>Recent Sponsor Date</TableHead>
              <TableHead>Recency</TableHead>
              <TableHead>Niche</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {brands.map((brand: any) => (
              <TableRow key={brand._id}>
                <TableCell className="min-w-[200px] font-semibold text-slate-950">
                  {brand.brandName || "-"}
                </TableCell>

                <TableCell className="min-w-[180px] text-slate-600">
                  {brand.domain || "-"}
                </TableCell>

                <TableCell className="min-w-[160px]">
                  {brand.foundVia || "-"}
                </TableCell>

                <TableCell className="min-w-[320px]">
                  <div className="space-y-1">
                    <Badge variant="secondary">{brand.channelCount || 0} channels</Badge>
                    <p className="max-w-md whitespace-normal text-sm leading-6 text-slate-500">
                      {(brand.channelNames || []).join(", ") || "-"}
                    </p>
                  </div>
                </TableCell>

                <TableCell className="min-w-[180px]">
                  {formatDate(brand.mostRecentSponsorshipDate)}
                </TableCell>

                <TableCell className="min-w-[130px]">
                  {brand.recencyTag ? (
                    <Badge variant="outline">{brand.recencyTag}</Badge>
                  ) : (
                    "-"
                  )}
                </TableCell>

                <TableCell className="min-w-[160px]">
                  {brand.niche || "-"}
                </TableCell>
              </TableRow>
            ))}

            {brands.length === 0 ? (
              <TableEmpty
                colSpan={7}
                title="No brands found."
                description="Run a crawl from a seed deal to build BrandMap."
              />
            ) : null}
          </TableBody>
        </Table>
      </DataSection>
    </main>
  );
}