"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  {
    label: "Enoylity Reviews",
    href: "/reviews/enoylity",
    icon: PlayCircle,
    exact: true,
  },
  {
    label: "MHD Tech Reviews",
    href: "/reviews/mhd",
    icon: PlayCircle,
  },
];

export function ReviewsTabs() {
  const pathname = usePathname();

  return (
    <div className="w-full overflow-x-auto pb-1">
      <nav
        aria-label="Reviews navigation"
        className="inline-flex min-w-max items-center gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;

          const active = tab.exact
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group inline-flex h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-semibold transition-all duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
                active
                  ? "bg-blue-700 text-white shadow-md shadow-blue-700/20 hover:bg-blue-800 [&_svg]:text-white"
                  : "bg-transparent text-slate-800 hover:bg-blue-50 hover:text-blue-700 [&_svg]:text-slate-500"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 transition-colors",
                  active
                    ? "text-white"
                    : "text-slate-500 group-hover:text-blue-700"
                )}
              />

              <span className={active ? "text-white" : ""}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}