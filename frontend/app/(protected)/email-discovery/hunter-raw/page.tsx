import { RawContactsTable } from "@/components/email-discovery/raw-contacts-table";

export default function HunterRawPage() {
  return (
    <RawContactsTable
      endpoint="/email-discovery/hunter-raw"
      title="Hunter Raw Contacts"
      description="Hunter contacts with names, domains, countries, and email status."
      provider="hunter"
      statusHeader="Email Status"
      includeCountry
    />
  );
}