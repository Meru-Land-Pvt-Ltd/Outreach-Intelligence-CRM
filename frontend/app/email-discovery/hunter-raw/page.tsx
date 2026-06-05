import { apiGet } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { DataSection } from "@/components/shared/data-section";
import { TableEmpty } from "@/components/shared/table-empty";
import { EmailDiscoveryTabs } from "@/components/email-discovery/email-discovery-tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";

export default async function HunterRawPage() {
  const response = await apiGet("/email-discovery/hunter-raw");
  const rows = response?.data || [];

  return (
    <main className="w-full space-y-6">
      <PageHeader title="Hunter Raw Contacts" description="Raw Hunter.io contacts." />
      <EmailDiscoveryTabs />

      <DataSection title="Hunter Raw Contacts" description={`${rows.length} records`}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Brand Name</TableHead>
              <TableHead>Domain</TableHead>
              <TableHead>Full Name</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Email Status</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {rows.map((row: any) => (
              <TableRow key={row._id}>
                <TableCell className="min-w-[180px] font-semibold">{row.brandName || "-"}</TableCell>
                <TableCell className="min-w-[180px]">{row.domain || "-"}</TableCell>
                <TableCell className="min-w-[220px]">{row.fullName || "-"}</TableCell>
                <TableCell className="min-w-[240px]">{row.title || "-"}</TableCell>
                <TableCell className="min-w-[120px]">{row.country || "-"}</TableCell>
                <TableCell className="min-w-[160px]">{row.emailStatus || "-"}</TableCell>
              </TableRow>
            ))}

            {rows.length === 0 ? (
              <TableEmpty
                colSpan={6}
                title="No Hunter raw contacts yet."
                description="Hunter contacts will appear after email discovery."
              />
            ) : null}
          </TableBody>
        </Table>
      </DataSection>
    </main>
  );
}
