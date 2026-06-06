"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Building2,
  ChevronDown,
  ChevronsLeft,
  FileText,
  Home,
  Menu,
  Megaphone,
  PlayCircle,
  Search,
  ShieldX,
  Sparkles,
  Workflow,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type NavItem = {
  title: string;
  href: string;
  activePath: string;
  icon: LucideIcon;
  exact?: boolean;
  children?: NavItem[];
};

const navItems: NavItem[] = [
  {
    title: "Control Panel",
    href: "/control-panel",
    activePath: "/control-panel",
    icon: Home,
  },
  {
    title: "Raw Data",
    href: "/raw-data",
    activePath: "/raw-data",
    icon: BarChart3,
  },
  {
    title: "Brand Map",
    href: "/brand-map",
    activePath: "/brand-map",
    icon: Building2,
  },
  {
    title: "Pipeline Tracker",
    href: "/pipeline-tracker",
    activePath: "/pipeline-tracker",
    icon: Workflow,
  },
  {
    title: "Email Discovery",
    href: "/email-discovery",
    activePath: "/email-discovery",
    icon: Search,
  },
  {
    title: "Enoylity Instantly",
    href: "/enoylity-instantly",
    activePath: "/enoylity-instantly",
    icon: Megaphone,
  },
  {
    title: "MHD Instantly",
    href: "/mhd-instantly",
    activePath: "/mhd-instantly",
    icon: Megaphone,
  },
  {
    title: "Instantly",
    href: "/instantly-campaigns",
    activePath: "/instantly-campaigns",
    icon: Megaphone,
    exact: true,
    children: [
      {
        title: "Control Panel",
        href: "/instantly-campaigns",
        activePath: "/instantly-campaigns",
        icon: Home,
        exact: true,
      },
      {
        title: "Enoylity Template",
        href: "/instantly-campaigns/templates/enoylity",
        activePath: "/instantly-campaigns/templates/enoylity",
        icon: FileText,
      },
      {
        title: "MHD Template",
        href: "/instantly-campaigns/templates/mhd",
        activePath: "/instantly-campaigns/templates/mhd",
        icon: FileText,
      },
      {
        title: "Push Log",
        href: "/instantly-campaigns/push-logs",
        activePath: "/instantly-campaigns/push-logs",
        icon: FileText,
      },
    ],
  },
  {
    title: "Reviews",
    href: "/reviews/enoylity",
    activePath: "/reviews",
    icon: PlayCircle,
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

function isActivePath(pathname: string, activePath: string, exact = false) {
  if (exact || activePath === "/") return pathname === activePath;
  return pathname === activePath || pathname.startsWith(`${activePath}/`);
}

function BrandLogo() {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-lg font-bold text-white shadow-sm">
      O
    </div>
  );
}

function SidebarBrand() {
  return (
    <Link href="/control-panel" className="flex items-center gap-3 px-6 py-6">
      <BrandLogo />

      <div className="min-w-0">
        <div className="truncate text-[15px] font-semibold text-slate-900">
          Outreach Intelligence CRM
        </div>
      </div>
    </Link>
  );
}

function SidebarItem({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const Icon = item.icon || FileText;

  const selfActive = isActivePath(pathname, item.activePath, item.exact);

  const childActive =
    item.children?.some((child) =>
      isActivePath(pathname, child.activePath, child.exact)
    ) ?? false;

  const active = selfActive || childActive;

  useEffect(() => {
    if (active) {
      setOpen(true);
    }
  }, [active]);

  if (!item.children?.length) {
    return (
      <Link
        href={item.href}
        onClick={onNavigate}
        className={cn(
          "mx-3 flex items-center gap-3 rounded-xl px-4 py-3 text-[15px] font-medium transition",
          active
            ? "bg-blue-50 text-blue-600"
            : "text-slate-700 hover:bg-slate-100"
        )}
      >
        <Icon className="h-5 w-5 shrink-0" />
        <span className="truncate">{item.title}</span>
      </Link>
    );
  }

  return (
    <div className="mx-3">
      <div
        className={cn(
          "flex w-full items-center rounded-xl transition",
          active
            ? "bg-blue-50 text-blue-600"
            : "text-slate-700 hover:bg-slate-100"
        )}
      >
        <Link
          href={item.href}
          onClick={onNavigate}
          className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-[15px] font-medium"
        >
          <Icon className="h-5 w-5 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{item.title}</span>
        </Link>

        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-label={`Toggle ${item.title}`}
          className="flex h-full items-center justify-center px-4 py-3"
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 transition-transform",
              open && "rotate-180"
            )}
          />
        </button>
      </div>

      {open ? (
        <div className="mt-1 space-y-1 pl-4">
          {item.children.map((child) => {
            const ChildIcon = child.icon || FileText;
            const activeChild = isActivePath(
              pathname,
              child.activePath,
              child.exact
            );

            return (
              <Link
                key={child.href}
                href={child.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm transition",
                  activeChild
                    ? "bg-blue-50 text-blue-600"
                    : "text-slate-600 hover:bg-slate-100"
                )}
              >
                <ChildIcon className="h-4 w-4 shrink-0" />
                <span className="truncate">{child.title}</span>
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function Sidebar({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col bg-white">
      <SidebarBrand />

      <div className="flex-1 space-y-1 overflow-y-auto pb-4">
        {navItems.map((item) => (
          <SidebarItem
            key={item.href}
            item={item}
            pathname={pathname}
            onNavigate={onNavigate}
          />
        ))}
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
    <div className="min-h-screen bg-[#f6f7fb] text-slate-900">
      <aside className="fixed inset-y-0 left-0 hidden w-[260px] border-r border-slate-200 bg-white lg:block">
        <Sidebar pathname={pathname} />
      </aside>

      <div className="border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <div className="flex items-center justify-between">
          <Link href="/control-panel" className="flex items-center gap-3">
            <BrandLogo />

            <div className="text-[15px] font-semibold text-slate-900">
              Outreach Intelligence CRM
            </div>
          </Link>

          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/30"
            onClick={() => setOpen(false)}
            aria-label="Close overlay"
          />

          <aside className="absolute inset-y-0 left-0 w-[88vw] max-w-[300px] border-r border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div className="text-sm font-semibold text-slate-900">Menu</div>

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

            <Sidebar pathname={pathname} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      ) : null}

      <main className="min-h-screen px-4 py-6 sm:px-6 lg:ml-[260px] lg:px-8 lg:py-8">
        {children}
      </main>
    </div>
  );
}