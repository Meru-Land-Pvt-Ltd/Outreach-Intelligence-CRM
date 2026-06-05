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

function cell(value: any) {
  const text = String(value || "").trim();
  return text || "-";
}

export default async function EmailDiscoveryPage() {
  const response = await apiGet("/email-discovery");
  const rows = response?.data || [];

  return (
    <main className="w-full space-y-6">
      <PageHeader
        title="Email Discovery"
        description="Matches the old Email Discovery sheet: social URLs, website emails, and provider results."
      />

      <EmailDiscoveryTabs />

      <DataSection title="Email Discovery" description={`${rows.length} records`}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Brand Name</TableHead>
              <TableHead>Domain</TableHead>
              <TableHead>Instagram</TableHead>
              <TableHead>Twitter/X</TableHead>
              <TableHead>Facebook</TableHead>
              <TableHead>LinkedIn</TableHead>
              <TableHead>YouTube</TableHead>
              <TableHead>Website</TableHead>
              <TableHead>Total Emails</TableHead>
              <TableHead>Hunter</TableHead>
              <TableHead>Apollo</TableHead>
              <TableHead>Prospeo</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {rows.map((row: any) => (
              <TableRow key={row._id}>
                <TableCell className="min-w-[180px] font-semibold text-slate-950">
                  {cell(row.brandName)}
                </TableCell>
                <TableCell className="min-w-[180px]">{cell(row.domain)}</TableCell>
                <TableCell className="min-w-[260px] whitespace-pre-wrap text-xs leading-5">
                  {cell(row.instagram)}
                </TableCell>
                <TableCell className="min-w-[260px] whitespace-pre-wrap text-xs leading-5">
                  {cell(row.twitter)}
                </TableCell>
                <TableCell className="min-w-[260px] whitespace-pre-wrap text-xs leading-5">
                  {cell(row.facebook)}
                </TableCell>
                <TableCell className="min-w-[260px] whitespace-pre-wrap text-xs leading-5">
                  {cell(row.linkedin)}
                </TableCell>
                <TableCell className="min-w-[260px] whitespace-pre-wrap text-xs leading-5">
                  {cell(row.youtube)}
                </TableCell>
                <TableCell className="min-w-[260px] whitespace-pre-wrap text-xs leading-5">
                  {cell(row.website)}
                </TableCell>
                <TableCell className="min-w-[260px] whitespace-pre-wrap text-xs font-medium leading-5">
                  {cell(row.totalEmails)}
                </TableCell>
                <TableCell className="min-w-[240px] whitespace-pre-wrap text-xs leading-5">
                  {cell(row.hunter)}
                </TableCell>
                <TableCell className="min-w-[240px] whitespace-pre-wrap text-xs leading-5">
                  {cell(row.apollo)}
                </TableCell>
                <TableCell className="min-w-[240px] whitespace-pre-wrap text-xs leading-5">
                  {cell(row.prospeo)}
                </TableCell>
              </TableRow>
            ))}

            {rows.length === 0 ? (
              <TableEmpty
                colSpan={12}
                title="No email discovery rows yet."
                description="Rows will appear after domain and email discovery."
              />
            ) : null}
          </TableBody>
        </Table>
      </DataSection>
    </main>
  );
}
