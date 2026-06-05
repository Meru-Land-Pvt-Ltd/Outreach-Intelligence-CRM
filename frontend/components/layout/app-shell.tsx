"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Building2,
  CircleDollarSign,
  FileText,
  Home,
  Megaphone,
  Menu,
  PlayCircle,
  Search,
  ShieldX,
  Sparkles,
  Users,
  Workflow,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navItems = [
  {
    title: "Dashboard",
    href: "/",
    activePath: "/",
    icon: Home,
  },
  {
    title: "Closed Deals",
    href: "/closed-deals",
    activePath: "/closed-deals",
    icon: CircleDollarSign,
  },
  {
    title: "Raw Video Data",
    href: "/raw-youtube",
    activePath: "/raw-youtube",
    icon: PlayCircle,
  },
  {
    title: "BrandMap",
    href: "/brand-map",
    activePath: "/brand-map",
    icon: Building2,
  },
  {
    title: "Email Discovery",
    href: "/email-discovery",
    activePath: "/email-discovery",
    icon: Search,
  },
  {
    title: "Contacts",
    href: "/contacts",
    activePath: "/contacts",
    icon: Users,
  },
  {
    title: "Instantly",
    href: "/instantly-campaigns",
    activePath: "/instantly-campaigns",
    icon: Megaphone,
  },
  {
    title: "Reviews",
    href: "/reviews/enoylity",
    activePath: "/reviews",
    icon: PlayCircle,
  },
  {
    title: "Pipeline Tracker",
    href: "/pipeline-tracker",
    activePath: "/pipeline-tracker",
    icon: Workflow,
  },
  {
    title: "Niche Analysis",
    href: "/niche-analysis",
    activePath: "/niche-analysis",
    icon: BarChart3,
  },
  {
    title: "Excluded Brands",
    href: "/excluded-brands",
    activePath: "/excluded-brands",
    icon: ShieldX,
  },
  {
    title: "Run Log",
    href: "/run-log",
    activePath: "/run-log",
    icon: FileText,
  },
];

function isActivePath(pathname: string, activePath: string) {
  if (activePath === "/") return pathname === "/";

  return pathname === activePath || pathname.startsWith(`${activePath}/`);
}

function SidebarBrand() {
  return (
    <Link
      href="/"
      className="flex w-full items-center gap-3 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300 hover:shadow-md"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm">
        <Sparkles className="h-5 w-5" />
      </div>

      <div className="min-w-0">
        <div className="truncate text-base font-bold tracking-tight text-slate-950">
          Outreach CRM
        </div>
        <div className="truncate text-xs font-semibold text-slate-500">
          Google Sheet Aligned
        </div>
      </div>
    </Link>
  );
}

function NavLink({
  item,
  onClick,
}: {
  item: (typeof navItems)[number];
  onClick?: () => void;
}) {
  const pathname = usePathname();
  const Icon = item.icon || FileText;
  const active = isActivePath(pathname, item.activePath);

  return (
    <Link
      href={item.href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-sm font-semibold transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2",
        active
          ? "!border-slate-200 !bg-white !text-slate-950 shadow-sm"
          : "!border-transparent !text-slate-600 hover:!border-slate-200 hover:!bg-white hover:!text-slate-950 hover:shadow-sm"
      )}
    >
      {active ? (
        <span className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-slate-950" />
      ) : null}

      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors",
          active
            ? "!bg-slate-950 !text-white [&_svg]:!text-white"
            : "bg-slate-100 !text-slate-500 group-hover:!bg-slate-950 group-hover:!text-white group-hover:[&_svg]:!text-white"
        )}
      >
        <Icon className="h-4 w-4" />
      </span>

      <span
        className={cn(
          "min-w-0 flex-1 truncate",
          active ? "!text-slate-950" : "!text-inherit"
        )}
      >
        {item.title}
      </span>
    </Link>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full w-full flex-col">
      <div className="p-4">
        <SidebarBrand />
      </div>

      <nav className="clean-scrollbar flex flex-1 flex-col gap-2 overflow-y-auto px-4 pb-4">
        {navItems.map((item) => (
          <NavLink key={item.href} item={item} onClick={onNavigate} />
        ))}
      </nav>

      <div className="p-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />
            <span className="truncate text-sm font-bold text-slate-950">
              Local worker mode
            </span>
          </div>

          <p className="mt-2 text-xs leading-5 text-slate-500">
            Sheet tabs are mapped to CRM pages.
          </p>
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-slate-50 text-slate-950">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-slate-200 bg-slate-100/80 backdrop-blur-xl xl:block">
        <SidebarContent />
      </aside>

      <header className="sticky top-0 z-30 w-full border-b border-slate-200 bg-white/90 backdrop-blur-xl xl:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm">
              <Sparkles className="h-4 w-4" />
            </div>

            <div className="min-w-0">
              <div className="truncate text-base font-bold tracking-tight text-slate-950">
                Outreach CRM
              </div>
              <div className="truncate text-xs font-semibold text-slate-500">
                Google Sheet Aligned
              </div>
            </div>
          </Link>

          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="shrink-0"
          >
            <Menu className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {open ? (
        <div className="fixed inset-0 z-50 xl:hidden">
          <button
            type="button"
            aria-label="Close menu overlay"
            className="absolute inset-0 h-full w-full bg-slate-950/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          <aside className="absolute inset-y-0 left-0 flex w-[86vw] max-w-full flex-col border-r border-slate-200 bg-slate-100 shadow-2xl sm:w-80">
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-slate-950">
                  Menu
                </div>
                <div className="truncate text-xs font-medium text-slate-500">
                  Outreach Intelligence CRM
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <SidebarContent onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="w-full xl:pl-72">
        <main className="w-full px-4 py-4 sm:px-5 sm:py-5 lg:px-8 lg:py-6">
          {children}
        </main>
      </div>
    </div>
  );
}