import { apiGet } from "@/lib/api";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
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

function normalizeStatus(status?: string) {
  return String(status || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
}

function statusVariant(status?: string): BadgeVariant {
  const value = normalizeStatus(status);

  if (
    value === "ok" ||
    value === "valid" ||
    value === "verified" ||
    value === "deliverable"
  ) {
    return "success";
  }

  if (
    value === "catch-all" ||
    value === "catchall" ||
    value === "risky" ||
    value === "unknown" ||
    value === "verification-error" ||
    value === "verification-pending" ||
    value === "not-verified"
  ) {
    return "warning";
  }

  if (
    value === "invalid" ||
    value === "bad" ||
    value === "undeliverable" ||
    value === "disposable" ||
    value === "bounced"
  ) {
    return "danger";
  }

  return "secondary";
}

function formatStatus(status?: string) {
  const value = String(status || "").trim();

  if (!value) return "-";

  const normalized = normalizeStatus(value);

  if (normalized === "ok") return "Ok";
  if (normalized === "valid") return "Valid";
  if (normalized === "verified") return "Verified";
  if (normalized === "catch-all" || normalized === "catchall") return "Catch-all";
  if (normalized === "not-verified") return "Not verified";
  if (normalized === "verification-error") return "Verification error";
  if (normalized === "verification-pending") return "Verification pending";

  return value;
}

export default async function ContactsPage() {
  const response = await apiGet("/contacts");
  const contacts = response?.data || [];

  return (
    <main className="w-full space-y-6">
      <PageHeader
        title="Contacts"
        description="Verify outreach leads before exporting them to Instantly."
      />

      <DataSection title="Leads" description={`${contacts.length} records`}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Brand</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Domain</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Verification</TableHead>
              <TableHead>Verifier Result</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {contacts.map((contact: any) => (
              <TableRow key={contact._id}>
                <TableCell className="min-w-[180px] font-semibold text-slate-950">
                  {contact.brandName || "-"}
                </TableCell>

                <TableCell className="min-w-[240px] font-medium text-slate-800">
                  {contact.email || "-"}
                </TableCell>

                <TableCell className="min-w-[180px]">
                  {contact.fullName || contact.firstName || "-"}
                </TableCell>

                <TableCell className="min-w-[180px]">
                  {contact.designation || contact.role || "-"}
                </TableCell>

                <TableCell className="min-w-[180px]">
                  {contact.domain || "-"}
                </TableCell>

                <TableCell className="min-w-[140px]">
                  {contact.source || "-"}
                </TableCell>

                <TableCell>
                  <Badge variant={statusVariant(contact.status)}>
                    {formatStatus(contact.status)}
                  </Badge>
                </TableCell>

                <TableCell>
                  <Badge variant={statusVariant(contact.verificationStatus)}>
                    {formatStatus(contact.verificationStatus)}
                  </Badge>
                </TableCell>

                <TableCell className="min-w-[180px]">
                  <Badge variant={statusVariant(contact.verifierResult)}>
                    {formatStatus(contact.verifierResult)}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}

            {contacts.length === 0 ? (
              <TableEmpty
                colSpan={9}
                title="No contacts found."
                description="Contacts will appear after discovery and verification."
              />
            ) : null}
          </TableBody>
        </Table>
      </DataSection>
    </main>
  );
}