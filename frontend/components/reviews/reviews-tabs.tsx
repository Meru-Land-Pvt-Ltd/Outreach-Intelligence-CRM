"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  {
    label: "Enoylity Reviews",
    href: "/reviews/enoylity",
  },
  {
    label: "MHD Tech Reviews",
    href: "/reviews/mhd",
  },
];

export function ReviewsTabs() {
  const pathname = usePathname();

  return (
    <div className="w-full overflow-x-auto">
      <nav
        aria-label="Reviews navigation"
        className="inline-flex min-w-max items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 shadow-sm"
      >
        {tabs.map((tab) => {
          const active =
            pathname === tab.href || pathname.startsWith(`${tab.href}/`);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-medium transition-all",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2",
                active
                  ? "!bg-slate-950 !text-white shadow-sm hover:!bg-slate-800 [&_svg]:!text-white"
                  : "!text-slate-600 hover:!bg-white hover:!text-slate-950 [&_svg]:text-slate-500"
              )}
            >
              <PlayCircle className="h-4 w-4" />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}