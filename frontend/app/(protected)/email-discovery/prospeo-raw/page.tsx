import { RawContactsTable } from "@/components/email-discovery/raw-contacts-table";

export default function ProspeoRawPage() {
  return (
    <RawContactsTable
      endpoint="/email-discovery/prospeo-raw"
      title="Prospeo Raw Contacts"
      description="Prospeo contacts with names, domains, countries, and email status."
      provider="prospeo"
      statusHeader="Email Status"
      includeCountry
    />
  );
}