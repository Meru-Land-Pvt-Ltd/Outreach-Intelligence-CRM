import { InboundImportPage } from "@/components/instantly/inbound-import-page";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ channel?: string }>;
}) {
  const params = await searchParams;

  return <InboundImportPage initialChannel={params.channel} />;
}
