"use client";

import { ChannelLeadsPage } from "@/components/instantly/channel-leads-page";

export default function EnoylityInstantlyPage() {
  return (
    <ChannelLeadsPage
      channel="Enoylity Technology"
      heading="Enoylity Instantly"
      description="Instantly export leads for Enoylity campaigns."
      endpoint="/instantly/enoylity"
      relatedVideoHeader="Enoylity Related"
      campaignsHref="/instantly-campaigns/campaigns/enoylity"
    />
  );
}
