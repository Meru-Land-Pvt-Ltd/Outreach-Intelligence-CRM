"use client";

import { ChannelLeadsPage } from "@/components/instantly/channel-leads-page";

export default function MhdInstantlyPage() {
  return (
    <ChannelLeadsPage
      channel="MHD Tech"
      heading="MHD Instantly"
      description="Instantly export leads for MHD campaigns."
      endpoint="/instantly/mhd"
      relatedVideoHeader="MHD Related"
      campaignsHref="/instantly-campaigns/campaigns/mhd"
    />
  );
}
