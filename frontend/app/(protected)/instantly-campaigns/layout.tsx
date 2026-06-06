import type { ReactNode } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { InstantlyTabs } from "@/components/instantly/instantly-tabs";
import { Info } from "lucide-react";

function HowToUseTooltip() {
  const steps = [
    "Select Channel.",
    "Enter Campaign Name.",
    "Enter Number of Leads to push.",
    "Pick Start Date and End Date.",
    "Pick Start Time and End Time.",
    "Set Daily Limit per email account.",
    "Click PUSH TO INSTANTLY.",
  ];

  return (
    <div className="group relative inline-flex">
      <button
        type="button"
        aria-label="How to use"
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-blue-700 transition hover:bg-blue-100"
      >
        <Info className="h-4 w-4" />
      </button>

      <div className="pointer-events-none absolute left-1/2 top-10 z-40 w-[340px] -translate-x-1/2 rounded-2xl border border-slate-200 bg-white p-4 text-left opacity-0 shadow-xl transition group-hover:pointer-events-auto group-hover:opacity-100">
        <div className="mb-3 flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white">
            <Info className="h-4 w-4" />
          </span>

          <div>
            <p className="text-sm font-bold text-slate-950">How to use</p>
            <p className="text-xs font-medium text-slate-500">
              Quick push workflow
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {steps.map((step, index) => (
            <div key={step} className="flex gap-2">
              <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">
                {index + 1}
              </span>

              <p className="text-xs font-semibold leading-5 text-slate-700">
                {step}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-800">
          Example: 40 daily limit × 5 selected emails = 200/day capacity.
        </div>
      </div>
    </div>
  );
}

export default function InstantlyCampaignsLayout({
  children
}: {
  children: ReactNode;
}) {
  return (
    <main className="w-full space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">
              Instantly Control Panel
            </h1>

            <HowToUseTooltip />
          </div>

          <p className="mt-1 text-sm font-medium text-slate-500">
            Export leads, choose sender emails, push campaigns, and preview
            templates directly from imported leads.
          </p>
        </div>
      </div>

      <InstantlyTabs />
      {children}
    </main>
  );
}
