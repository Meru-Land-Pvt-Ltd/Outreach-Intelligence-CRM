import type { ReactNode } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { InstantlyTabs } from "@/components/instantly/instantly-tabs";

export default function InstantlyCampaignsLayout({
  children
}: {
  children: ReactNode;
}) {
  return (
    <main className="w-full space-y-6">
      <PageHeader
        title="Instantly"
        description="Export leads, push campaigns, check logs, and track bounces."
      />

      <InstantlyTabs />

      {children}
    </main>
  );
}
