"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { Play, Plus } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/shared/notice";
import AdminTable, {
  type AdminTableColumn,
} from "@/components/ui/tableComp";

type NoticeState = {
  type: "success" | "error";
  text: string;
};

type SeedDeal = {
  _id?: string;
  seedBrandId?: any;
  month?: string;
  productName?: string;
  influencerHandle?: string;
  brandName?: string;
  email?: string;
  totalDealAmount?: number;
  crawlCount?: number;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  raw?: any;
};

type CrawlJob = {
  _id?: string;
  jobId?: string;
  seedBrandId?: string;
  month?: string;
  productName?: string;
  influencerHandle?: string;
  brandName?: string;
  email?: string;
  totalDealAmount?: number;
  crawlCount?: number;
  status?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt?: string;
  currentStep?: string;
  message?: string;
  progress?: number;
  totalFound?: number;
  brandsFound?: number;
  contactsFound?: number;
  raw?: any;
};

const PAGE_SIZE = 10;

function clean(value: unknown) {
  return String(value || "").trim();
}

function formatDate(value?: string) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMoney(value?: number) {
  const amount = Number(value || 0);

  if (!amount) return "-";

  return `$${amount.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

function normalizeStatus(status?: string) {
  const value = clean(status).toLowerCase();

  if (["completed", "success", "done"].includes(value)) return "completed";
  if (["running", "active", "processing"].includes(value)) return "running";
  if (["failed", "error"].includes(value)) return "failed";
  if (["paused"].includes(value)) return "paused";
  if (["stopped", "cancelled", "canceled"].includes(value)) return "stopped";

  return "queued";
}

function StatusBadge({ status }: { status?: string }) {
  const normalized = normalizeStatus(status);

  if (normalized === "completed") {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        Completed
      </span>
    );
  }

  if (normalized === "running") {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        Running
      </span>
    );
  }

  if (normalized === "failed") {
    return (
      <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
        Failed
      </span>
    );
  }

  if (normalized === "paused") {
    return (
      <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
        Paused
      </span>
    );
  }

  if (normalized === "stopped") {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
        Stopped
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
      Queued
    </span>
  );
}

function getSeedBrandId(row: SeedDeal) {
  if (!row.seedBrandId) return "";

  if (typeof row.seedBrandId === "string") {
    return row.seedBrandId;
  }

  if (row.seedBrandId?._id) {
    return String(row.seedBrandId._id);
  }

  return String(row.seedBrandId);
}

function getJobStep(row: CrawlJob) {
  return (
    clean(row.currentStep) ||
    clean(row.message) ||
    (normalizeStatus(row.status) === "completed"
      ? "Completed"
      : normalizeStatus(row.status) === "running"
        ? "In Progress"
        : normalizeStatus(row.status) === "failed"
          ? "Failed"
          : "Queued")
  );
}

function getMatchedSeedDeal(row: CrawlJob, seedDeals: SeedDeal[]) {
  return seedDeals.find(
    (deal) => getSeedBrandId(deal) && getSeedBrandId(deal) === clean(row.seedBrandId)
  );
}

function getActiveProductName(row: CrawlJob, seedDeals: SeedDeal[]) {
  const matched = getMatchedSeedDeal(row, seedDeals);

  return (
    clean(row.productName) ||
    clean(row.raw?.seedBrand?.productName) ||
    matched?.productName ||
    "-"
  );
}

function getActiveMonth(row: CrawlJob, seedDeals: SeedDeal[]) {
  const matched = getMatchedSeedDeal(row, seedDeals);

  return clean(row.month) || clean(row.raw?.seedBrand?.month) || matched?.month || "-";
}

function getActiveInfluencer(row: CrawlJob, seedDeals: SeedDeal[]) {
  const matched = getMatchedSeedDeal(row, seedDeals);

  return (
    clean(row.influencerHandle) ||
    clean(row.raw?.seedBrand?.influencerHandle) ||
    matched?.influencerHandle ||
    "-"
  );
}

function getActiveEmail(row: CrawlJob, seedDeals: SeedDeal[]) {
  const matched = getMatchedSeedDeal(row, seedDeals);

  return clean(row.email) || clean(row.raw?.seedBrand?.email) || matched?.email || "-";
}

function getActiveAmount(row: CrawlJob, seedDeals: SeedDeal[]) {
  const matched = getMatchedSeedDeal(row, seedDeals);

  return Number(
    row.totalDealAmount ||
      row.raw?.seedBrand?.totalDealAmount ||
      matched?.totalDealAmount ||
      0
  );
}

function getActiveCrawlCount(row: CrawlJob, seedDeals: SeedDeal[]) {
  const matched = getMatchedSeedDeal(row, seedDeals);

  return Number(row.crawlCount || row.raw?.seedBrand?.crawlCount || matched?.crawlCount || 0);
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-base font-bold text-slate-950">{title}</h2>
      {children}
    </section>
  );
}

export default function ControlPanelPage() {
  const [seedDeals, setSeedDeals] = useState<SeedDeal[]>([]);
  const [activeCrawls, setActiveCrawls] = useState<CrawlJob[]>([]);
  const [historyCrawls, setHistoryCrawls] = useState<CrawlJob[]>([]);

  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [loading, setLoading] = useState(true);
  const [addingSeedDeal, setAddingSeedDeal] = useState(false);
  const [runningSeedBrandId, setRunningSeedBrandId] = useState("");

  const [recentPage, setRecentPage] = useState(1);
  const [activePage, setActivePage] = useState(1);

  const [form, setForm] = useState({
    month: "",
    productName: "",
    influencerHandle: "",
    brandName: "",
    email: "",
    totalDealAmount: "",
  });

  async function loadSeedDeals() {
    try {
      const response = await apiGet("/sheets/closed-deals");
      setSeedDeals(response?.data || []);
    } catch {
      setSeedDeals([]);
    }
  }

  async function loadActiveCrawls() {
    try {
      const response = await apiGet("/jobs/intelligence/active");
      setActiveCrawls(response?.data || []);
    } catch {
      setActiveCrawls([]);
    }
  }

  async function loadHistoryCrawls() {
    try {
      const response = await apiGet("/jobs/intelligence/history");
      setHistoryCrawls(response?.data || []);
    } catch {
      setHistoryCrawls([]);
    }
  }

  async function refreshAll() {
    setLoading(true);

    await Promise.all([
      loadSeedDeals(),
      loadActiveCrawls(),
      loadHistoryCrawls(),
    ]);

    setLoading(false);
  }

  useEffect(() => {
    refreshAll();
  }, []);

  async function handleAddSeedDeal(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAddingSeedDeal(true);
    setNotice(null);

    try {
      const response: any = await apiPost("/sheets/closed-deals", {
        month: form.month,
        productName: form.productName,
        influencerHandle: form.influencerHandle,
        brandName: form.brandName,
        email: form.email,
        totalDealAmount: Number(form.totalDealAmount || 0),
      });

      if (!response?.success) {
        setNotice({
          type: "error",
          text: response?.message || "Failed to add seed deal.",
        });
        setAddingSeedDeal(false);
        return;
      }

      setForm({
        month: "",
        productName: "",
        influencerHandle: "",
        brandName: "",
        email: "",
        totalDealAmount: "",
      });

      setNotice({
        type: "success",
        text: "Seed deal added successfully.",
      });

      setRecentPage(1);
      await refreshAll();
    } catch {
      setNotice({
        type: "error",
        text: "Failed to add seed deal.",
      });
    }

    setAddingSeedDeal(false);
  }

  async function handleRunCrawl(seedDeal: SeedDeal) {
    const seedBrandId = getSeedBrandId(seedDeal);

    if (!seedBrandId) {
      setNotice({
        type: "error",
        text: "Seed brand ID missing. Please check backend response for this seed deal.",
      });
      return;
    }

    setRunningSeedBrandId(seedBrandId);
    setNotice(null);

    try {
      const response: any = await apiPost(
        `/jobs/run-intelligence/${seedBrandId}`,
        {}
      );

      if (!response?.success) {
        setNotice({
          type: "error",
          text: response?.message || "Failed to start crawl.",
        });
        setRunningSeedBrandId("");
        return;
      }

      setNotice({
        type: "success",
        text: "Crawl started and moved to Active.",
      });

      setActivePage(1);
      await refreshAll();
    } catch {
      setNotice({
        type: "error",
        text: "Failed to start crawl.",
      });
    }

    setRunningSeedBrandId("");
  }

  const visibleSeedDeals = useMemo(() => {
    return seedDeals.slice(0, recentPage * PAGE_SIZE);
  }, [seedDeals, recentPage]);

  const visibleActiveCrawls = useMemo(() => {
    return activeCrawls.slice(0, activePage * PAGE_SIZE);
  }, [activeCrawls, activePage]);

  const recentTotalPages = Math.max(1, Math.ceil(seedDeals.length / PAGE_SIZE));
  const activeTotalPages = Math.max(1, Math.ceil(activeCrawls.length / PAGE_SIZE));

  const activeColumns = useMemo<AdminTableColumn<CrawlJob>[]>(
    () => [
      {
        id: "index",
        header: "#",
        align: "center",
        widthClassName: "min-w-[70px]",
        render: (_row, index) => (
          <span className="text-sm font-semibold text-slate-500">
            {index + 1}
          </span>
        ),
      },
      {
        id: "month",
        header: "Month",
        widthClassName: "min-w-[130px]",
        render: (row) => getActiveMonth(row, seedDeals),
      },
      {
        id: "influencerHandle",
        header: "Influencer Handle",
        widthClassName: "min-w-[180px]",
        render: (row) => getActiveInfluencer(row, seedDeals),
      },
      {
        id: "brandName",
        header: "Brand Name",
        widthClassName: "min-w-[190px]",
        render: (row) => (
          <span className="font-semibold text-slate-950">
            {row.brandName || row.raw?.seedBrand?.brandName || "-"}
          </span>
        ),
      },
      {
        id: "productName",
        header: "Product Name",
        widthClassName: "min-w-[220px]",
        render: (row) => (
          <span className="font-semibold text-slate-800">
            {getActiveProductName(row, seedDeals)}
          </span>
        ),
      },
      {
        id: "email",
        header: "Email",
        widthClassName: "min-w-[220px]",
        render: (row) => getActiveEmail(row, seedDeals),
      },
      {
        id: "totalDealAmount",
        header: "Amount",
        widthClassName: "min-w-[140px]",
        render: (row) => formatMoney(getActiveAmount(row, seedDeals)),
      },
      {
        id: "crawlCount",
        header: "Crawls",
        align: "center",
        widthClassName: "min-w-[100px]",
        render: (row) => getActiveCrawlCount(row, seedDeals),
      },
      {
        id: "currentStep",
        header: "Current Step",
        widthClassName: "min-w-[180px]",
        render: (row) => getJobStep(row),
      },
      {
        id: "status",
        header: "Status",
        widthClassName: "min-w-[130px]",
        render: (row) => <StatusBadge status={row.status} />,
      },
      {
        id: "startedAt",
        header: "Started At",
        widthClassName: "min-w-[190px]",
        render: (row) => formatDate(row.startedAt || row.createdAt),
      },
    ],
    [seedDeals]
  );

  const seedDealColumns = useMemo<AdminTableColumn<SeedDeal>[]>(
    () => [
      {
        id: "index",
        header: "#",
        align: "center",
        widthClassName: "min-w-[70px]",
        render: (_row, index) => (
          <span className="text-sm font-semibold text-slate-500">
            {index + 1}
          </span>
        ),
      },
      {
        id: "month",
        header: "Month",
        widthClassName: "min-w-[130px]",
        render: (row) => row.month || "-",
      },
      {
        id: "influencerHandle",
        header: "Influencer Handle",
        widthClassName: "min-w-[180px]",
        render: (row) => row.influencerHandle || "-",
      },
      {
        id: "brandName",
        header: "Brand Name",
        widthClassName: "min-w-[190px]",
        render: (row) => (
          <span className="font-semibold text-slate-950">
            {row.brandName || "-"}
          </span>
        ),
      },
      {
        id: "productName",
        header: "Product Name",
        widthClassName: "min-w-[220px]",
        render: (row) => (
          <span className="font-semibold text-slate-800">
            {row.productName || "-"}
          </span>
        ),
      },
      {
        id: "email",
        header: "Email",
        widthClassName: "min-w-[220px]",
        render: (row) => row.email || "-",
      },
      {
        id: "totalDealAmount",
        header: "Amount",
        widthClassName: "min-w-[140px]",
        render: (row) => formatMoney(row.totalDealAmount),
      },
      {
        id: "crawlCount",
        header: "Crawls",
        align: "center",
        widthClassName: "min-w-[100px]",
        render: (row) => Number(row.crawlCount || 0),
      },
      {
        id: "status",
        header: "Status",
        widthClassName: "min-w-[130px]",
        render: (row) => <StatusBadge status={row.status} />,
      },
      {
        id: "createdAt",
        header: "Added At",
        widthClassName: "min-w-[190px]",
        render: (row) => formatDate(row.createdAt || row.updatedAt),
      },
    ],
    []
  );

  return (
    <main className="w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950">
          Control Panel
        </h1>

        <p className="mt-1 text-sm font-medium text-slate-500">
          Add seed deals and run crawls.
        </p>
      </div>

      {notice ? <Notice type={notice.type} text={notice.text} /> : null}

      <Section title="Create New Run">
        <form
          onSubmit={handleAddSeedDeal}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-800">
                Month <span className="text-rose-500">*</span>
              </span>
              <Input
                placeholder="e.g. Jan"
                value={form.month}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, month: e.target.value }))
                }
                required
                className="h-12 border-slate-200"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-800">
                Influencer Handle <span className="text-rose-500">*</span>
              </span>
              <Input
                placeholder="creatorhandle"
                value={form.influencerHandle}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    influencerHandle: e.target.value,
                  }))
                }
                required
                className="h-12 border-slate-200"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-800">
                Brand Name <span className="text-rose-500">*</span>
              </span>
              <Input
                placeholder="Enter brand name"
                value={form.brandName}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, brandName: e.target.value }))
                }
                required
                className="h-12 border-slate-200"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-800">
                Product Name <span className="text-rose-500">*</span>
              </span>
              <Input
                placeholder="Enter product name"
                value={form.productName}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    productName: e.target.value,
                  }))
                }
                required
                className="h-12 border-slate-200"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-800">
                Email
              </span>
              <Input
                placeholder="brand@example.com"
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, email: e.target.value }))
                }
                className="h-12 border-slate-200"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-800">
                Total Deal Amount ($)
              </span>
              <Input
                placeholder="0"
                type="number"
                min="0"
                step="0.01"
                value={form.totalDealAmount}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    totalDealAmount: e.target.value,
                  }))
                }
                className="h-12 border-slate-200"
              />
            </label>
          </div>

          <div className="mt-5">
            <Button
              type="submit"
              disabled={addingSeedDeal}
              className="h-11 rounded-md bg-blue-600 px-5 text-white hover:bg-blue-700"
            >
              <Plus className="mr-2 h-4 w-4" />
              {addingSeedDeal ? "Adding..." : "Add Seed Deals"}
            </Button>
          </div>
        </form>
      </Section>

      <Section title="Active">
        <AdminTable
          data={visibleActiveCrawls}
          columns={activeColumns}
          rowKey={(row, index) => row.jobId || row._id || String(index)}
          loading={loading}
          loadingRows={8}
          emptyTitle={loading ? "Loading active crawls..." : "No active crawls found."}
          emptyDescription="Started crawls will appear here."
          containerClassName="rounded-xl shadow-none"
          pagination={{
            page: activePage,
            totalPages: activeTotalPages,
            totalItems: activeCrawls.length,
            limit: PAGE_SIZE,
            onPageChange: setActivePage,
            loading,
            showSummary: true,
            showRowsSelector: false,
          }}
        />
      </Section>

      <Section title="Recent Runs">
        <AdminTable
          data={visibleSeedDeals}
          columns={seedDealColumns}
          rowKey={(row, index) => row._id || getSeedBrandId(row) || String(index)}
          loading={loading}
          loadingRows={8}
          emptyTitle={loading ? "Loading seed deals..." : "No seed deals found."}
          emptyDescription="Seed deals will appear here."
          containerClassName="rounded-xl shadow-none"
          actions={{
            header: "Action",
            align: "right",
            render: (row) => {
              const seedBrandId = getSeedBrandId(row);
              const isRunning = runningSeedBrandId === seedBrandId;

              return (
                <Button
                  type="button"
                  size="sm"
                  disabled={isRunning}
                  onClick={() => handleRunCrawl(row)}
                  className="h-9 rounded-md bg-blue-600 px-4 text-white hover:bg-blue-700"
                >
                  <Play className="mr-2 h-3.5 w-3.5 fill-current" />
                  {isRunning ? "Running..." : "Run Crawl"}
                </Button>
              );
            },
          }}
          pagination={{
            page: recentPage,
            totalPages: recentTotalPages,
            totalItems: seedDeals.length,
            limit: PAGE_SIZE,
            onPageChange: setRecentPage,
            loading,
            showSummary: true,
            showRowsSelector: false,
          }}
        />
      </Section>
    </main>
  );
}