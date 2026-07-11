"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { CampaignsList } from "@/components/instantly/campaigns-list";

const CHANNEL_MAP: Record<
  string,
  { channel: "Enoylity Technology" | "MHD Tech"; heading: string }
> = {
  enoylity: { channel: "Enoylity Technology", heading: "Enoylity Campaigns" },
  mhd: { channel: "MHD Tech", heading: "MHD Campaigns" },
};

export default function ChannelCampaignsPage({
  params,
}: {
  params: Promise<{ channel: string }>;
}) {
  const { channel } = use(params);
  const config = CHANNEL_MAP[channel];

  if (!config) {
    notFound();
  }

  return (
    <CampaignsList
      channel={config.channel}
      heading={config.heading}
      detailsBase={`/instantly-campaigns/campaigns/${channel}`}
    />
  );
}
