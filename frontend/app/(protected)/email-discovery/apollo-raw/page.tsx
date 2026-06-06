import { RawContactsTable } from "@/components/email-discovery/raw-contacts-table";

export default function ApolloRawPage() {
  return (
    <RawContactsTable
      endpoint="/email-discovery/apollo-raw"
      title="Apollo Raw Contacts"
      description="Apollo contacts with revealed emails and verification status."
      provider="apollo"
      statusHeader="Email Verified"
      includeCountry={false}
    />
  );
}