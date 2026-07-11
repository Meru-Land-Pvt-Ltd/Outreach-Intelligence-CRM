"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { CampaignDetails } from "@/components/instantly/campaign-details";

export default function CampaignDetailsPage({
  params,
}: {
  params: Promise<{ channel: string; id: string }>;
}) {
  const { channel, id } = use(params);

  if (channel !== "enoylity" && channel !== "mhd") {
    notFound();
  }

  return (
    <CampaignDetails
      campaignId={id}
      backHref={`/instantly-campaigns/campaigns/${channel}`}
    />
  );
}
