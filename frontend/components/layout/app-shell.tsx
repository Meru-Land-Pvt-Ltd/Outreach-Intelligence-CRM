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
  ChevronsRight,
  FileText,
  Home,
  LogOut,
  Menu,
  Megaphone,
  PlayCircle,
  Search,
  ShieldX,
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

const LOGO_SRC = "/logo1.png";

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
        href: "/instantly-campaigns/template/enoylity",
        activePath: "/instantly-campaigns/template/enoylity",
        icon: FileText,
      },
      {
        title: "MHD Template",
        href: "/instantly-campaigns/template/mhd",
        activePath: "/instantly-campaigns/template/mhd",
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

function BrandLogoMark({ className }: { className?: string }) {
  return (
    <img
      src={LOGO_SRC}
      alt="Outreach Intelligence CRM"
      width={56}
      height={56}
      className={cn("shrink-0 object-contain", className)}
    />
  );
}

function BrandLine({ side }: { side: "left" | "right" }) {
  return (
    <span
      className={cn(
        "h-[5px] flex-1 rounded-full opacity-90",
        side === "left"
          ? "bg-gradient-to-r from-transparent via-[#0d4de8]/55 to-[#0d4de8] [clip-path:polygon(0_46%,100%_16%,100%_84%,0_54%)]"
          : "bg-gradient-to-l from-transparent via-[#0d4de8]/55 to-[#0d4de8] [clip-path:polygon(0_16%,100%_46%,100%_54%,0_84%)]"
      )}
    />
  );
}

function BrandWordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        "shrink-0 text-center leading-none",
        compact ? "w-[156px]" : "w-[140px]"
      )}
    >
      <div
        className={cn(
          "w-full whitespace-nowrap font-black tracking-[-0.06em] text-[#061761]",
          compact ? "text-[32px]" : "text-[28px]"
        )}
      >
        Outreach
      </div>

      <div
        className={cn(
          "mt-1 w-full whitespace-nowrap font-light tracking-[-0.08em] text-[#0d4de8]",
          compact ? "text-[24px]" : "text-[21px]"
        )}
      >
        Intelligence
      </div>

      <div className="mx-auto mt-2 flex w-full items-center justify-center gap-2">
        <BrandLine side="left" />

        <span
          className={cn(
            "shrink-0 whitespace-nowrap pl-[0.36em] font-bold tracking-[0.36em] text-[#0d4de8]",
            compact ? "text-[15px]" : "text-[14px]"
          )}
        >
          CRM
        </span>

        <BrandLine side="right" />
      </div>
    </div>
  );
}

function SidebarBrand({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle?: () => void;
}) {
  if (collapsed) {
    return (
      <div className="flex items-center justify-center border-b border-slate-100 px-3 py-4">
        {onToggle ? (
          <button
            type="button"
            onClick={onToggle}
            aria-label="Expand sidebar"
            title="Expand sidebar"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm transition hover:bg-slate-100"
          >
            <BrandLogoMark className="h-full w-full" />
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-4">
      <Link
        href="/control-panel"
        title="Outreach Intelligence CRM"
        className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl px-1 py-2 transition hover:bg-slate-50"
      >
        <BrandLogoMark className="h-12 w-12" />
        <BrandWordmark />
      </Link>

      {onToggle ? (
        <button
          type="button"
          onClick={onToggle}
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
        >
          <ChevronsLeft className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

function clearBrowserCookies() {
  if (typeof document === "undefined" || typeof window === "undefined") return;

  const cookieList = document.cookie.split(";").filter(Boolean);
  const hostname = window.location.hostname;
  const hostnameParts = hostname.split(".");
  const baseDomain =
    hostnameParts.length >= 2 ? hostnameParts.slice(-2).join(".") : hostname;

  const domains = Array.from(
    new Set(["", hostname, `.${hostname}`, `.${baseDomain}`])
  );

  const paths = Array.from(new Set(["/", window.location.pathname || "/"]));

  for (const cookie of cookieList) {
    const name = cookie.split("=")[0]?.trim();

    if (!name) continue;

    for (const domain of domains) {
      for (const path of paths) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; path=${path}${
          domain ? `; domain=${domain}` : ""
        }`;
      }
    }
  }
}

function logoutUser() {
  try {
    localStorage.clear();
  } catch {}

  try {
    sessionStorage.clear();
  } catch {}

  clearBrowserCookies();

  window.location.replace("/login");
}

function SidebarItem({
  item,
  pathname,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
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
    if (active && !collapsed) {
      setOpen(true);
    }

    if (collapsed) {
      setOpen(false);
    }
  }, [active, collapsed]);

  if (!item.children?.length || collapsed) {
    return (
      <Link
        href={item.href}
        onClick={onNavigate}
        title={item.title}
        className={cn(
          "mx-3 flex items-center rounded-xl text-[15px] font-medium transition",
          collapsed ? "justify-center px-0 py-3" : "gap-3 px-4 py-3",
          active
            ? "bg-blue-50 text-blue-600"
            : "text-slate-700 hover:bg-slate-100"
        )}
      >
        <Icon className="h-5 w-5 shrink-0" />

        {!collapsed ? <span className="truncate">{item.title}</span> : null}
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

function SidebarLogout({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  function handleLogout() {
    onNavigate?.();
    logoutUser();
  }

  return (
    <div className="border-t border-slate-200 px-3 py-4">
      <button
        type="button"
        onClick={handleLogout}
        title="Logout"
        className={cn(
          "flex w-full items-center rounded-xl text-left text-[15px] font-semibold text-red-600 transition hover:bg-red-50 hover:text-red-700",
          collapsed ? "justify-center px-0 py-3" : "gap-3 px-4 py-3"
        )}
      >
        <LogOut className="h-5 w-5 shrink-0" />
        {!collapsed ? <span>Logout</span> : null}
      </button>
    </div>
  );
}

function Sidebar({
  pathname,
  collapsed,
  showBrand = true,
  onToggleCollapse,
  onNavigate,
}: {
  pathname: string;
  collapsed: boolean;
  showBrand?: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
}) {
  return (
    <div className="relative flex h-full flex-col bg-white">
      {showBrand ? (
        <SidebarBrand collapsed={collapsed} onToggle={onToggleCollapse} />
      ) : null}

      <div className="flex-1 space-y-1 overflow-y-auto py-4">
        {navItems.map((item) => (
          <SidebarItem
            key={item.href}
            item={item}
            pathname={pathname}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        ))}
      </div>

      <SidebarLogout collapsed={collapsed} onNavigate={onNavigate} />
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("outreach-sidebar-collapsed");
      setSidebarCollapsed(saved === "true");
    } catch {}
  }, []);

  function toggleSidebarCollapsed() {
    setSidebarCollapsed((current) => {
      const next = !current;

      try {
        localStorage.setItem("outreach-sidebar-collapsed", String(next));
      } catch {}

      return next;
    });
  }

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
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden border-r border-slate-200 bg-white transition-all duration-300 lg:block",
          sidebarCollapsed ? "w-[84px]" : "w-[280px]"
        )}
      >
        <Sidebar
          pathname={pathname}
          collapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebarCollapsed}
        />
      </aside>

      <div className="border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <div className="flex items-center justify-between">
          <Link
            href="/control-panel"
            className="flex min-w-0 items-center gap-3"
          >
            <BrandLogoMark className="h-12 w-12" />
            <BrandWordmark compact />
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

          <aside className="absolute inset-y-0 left-0 w-[88vw] max-w-[320px] border-r border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <Link
                href="/control-panel"
                className="flex min-w-0 items-center gap-3"
                onClick={() => setOpen(false)}
              >
                <BrandLogoMark className="h-12 w-12" />
                <BrandWordmark compact />
              </Link>

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

            <Sidebar
              pathname={pathname}
              collapsed={false}
              showBrand={false}
              onNavigate={() => setOpen(false)}
            />
          </aside>
        </div>
      ) : null}

      <main
        className={cn(
          "min-h-screen px-4 py-6 transition-all duration-300 sm:px-6 lg:px-8 lg:py-8",
          sidebarCollapsed ? "lg:ml-[84px]" : "lg:ml-[280px]"
        )}
      >
        {children}
      </main>
    </div>
  );
}