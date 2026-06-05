import { apiGet } from "@/lib/api";
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

export default async function MhdInstantlyPage() {
  const response = await apiGet("/instantly/mhd");
  const rows = response?.data || [];

  return (
    <DataSection title="MHD Instantly" description={`${rows.length} records`}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>First Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Company Name</TableHead>
            <TableHead>Product Name</TableHead>
            <TableHead>MHD Related</TableHead>
            <TableHead>Competitor 1</TableHead>
            <TableHead>Competitor 2</TableHead>
            <TableHead>Pushed Status</TableHead>
            <TableHead>Verification Status</TableHead>
            <TableHead>Instantly Bounced</TableHead>
            <TableHead>Gateway Bounced</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {rows.map((row: any) => (
            <TableRow key={row._id}>
              <TableCell className="min-w-[160px]">{row.firstName || "-"}</TableCell>
              <TableCell className="min-w-[260px]">{row.email || "-"}</TableCell>
              <TableCell className="min-w-[200px] font-semibold">{row.companyName || "-"}</TableCell>
              <TableCell className="min-w-[260px]">{row.productName || "-"}</TableCell>
              <TableCell className="min-w-[320px] whitespace-normal text-xs">{row.relatedVideo || "-"}</TableCell>
              <TableCell className="min-w-[180px]">{row.competitor1 || "-"}</TableCell>
              <TableCell className="min-w-[180px]">{row.competitor2 || "-"}</TableCell>
              <TableCell className="min-w-[260px]">{row.pushedStatus || "-"}</TableCell>
              <TableCell className="min-w-[180px]">{row.verificationStatus || "-"}</TableCell>
              <TableCell className="min-w-[180px]">{row.instantlyBounced || "-"}</TableCell>
              <TableCell className="min-w-[180px]">{row.gatewayBounced || "-"}</TableCell>
            </TableRow>
          ))}

          {rows.length === 0 ? (
            <TableEmpty
              colSpan={11}
              title="No MHD Instantly rows yet."
              description="Export leads first."
            />
          ) : null}
        </TableBody>
      </Table>
    </DataSection>
  );
}
