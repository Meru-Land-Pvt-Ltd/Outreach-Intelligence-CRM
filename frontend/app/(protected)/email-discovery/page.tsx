"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { apiGet } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import AdminTable, {
  type AdminTableColumn,
} from "@/components/ui/tableComp";
import { FilterSearchInput } from "@/components/shared/filter-search-input";
import { FilterSelect } from "@/components/shared/filter-select";
import { EmailDiscoveryTabs } from "@/components/email-discovery/email-discovery-tabs";

type EmailDiscoveryRow = {
  _id?: string;
  brandName?: string;
  domain?: string;
  instagram?: string;
  twitter?: string;
  facebook?: string;
  linkedin?: string;
  youtube?: string;
  website?: string;
  totalEmails?: string;
  hunter?: string;
  apollo?: string;
  prospeo?: string;
  createdAt?: string;
  updatedAt?: string;
};

const PAGE_SIZE = 100;
const ALL_VALUE = "All";

function clean(value: unknown) {
  const text = String(value || "").trim();

  if (!text) return "";

  const lower = text.toLowerCase();

  if (
    [
      "-",
      "n/a",
      "na",
      "none",
      "null",
      "undefined",
      "not found",
      "no emails found",
      "(no emails found)",
      "(no hunter emails found)",
      "(no apollo emails found)",
      "(no prospeo emails found)",
    ].includes(lower)
  ) {
    return "";
  }

  return text;
}

function buildPaginatedEndpoint(endpoint: string, page: number, limit: number) {
  const separator = endpoint.includes("?") ? "&" : "?";

  return `${endpoint}${separator}${new URLSearchParams({
    page: String(page),
    limit: String(limit),
  }).toString()}`;
}

function getRowIdentity(row: EmailDiscoveryRow) {
  return (
    row._id ||
    [
      clean(row.brandName),
      clean(row.domain),
      clean(row.totalEmails),
      clean(row.hunter),
      clean(row.apollo),
      clean(row.prospeo),
    ]
      .filter(Boolean)
      .join("-")
  );
}

function mergeUniqueRows(
  previousRows: EmailDiscoveryRow[],
  nextRows: EmailDiscoveryRow[]
) {
  const map = new Map<string, EmailDiscoveryRow>();

  previousRows.forEach((row, index) => {
    const key = getRowIdentity(row) || `previous-row-${index}`;
    map.set(key, row);
  });

  nextRows.forEach((row, index) => {
    const key = getRowIdentity(row) || `next-row-${index}`;
    map.set(key, row);
  });

  return Array.from(map.values());
}

function extractEmail(value: string) {
  const match = clean(value).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0]?.toLowerCase() || "";
}

function isBadEmail(value: string) {
  const email = extractEmail(value);

  if (!email) return false;

  if (email.endsWith(".css")) return true;
  if (email.endsWith(".js")) return true;
  if (email.includes("@11.")) return true;

  return [
    "your@email.com",
    "name@domain.com",
    "example@gmail.com",
    "test@test.com",
  ].includes(email);
}

function isNoEmailText(value: string) {
  const lower = String(value || "").trim().toLowerCase();

  return (
    !lower ||
    lower.includes("no emails found") ||
    lower.includes("no hunter emails found") ||
    lower.includes("no apollo emails found") ||
    lower.includes("no prospeo emails found")
  );
}

function splitLines(value: unknown) {
  return String(value || "")
    .split(/\n|,/)
    .map((item) => clean(item))
    .filter(Boolean)
    .filter((item) => !isNoEmailText(item));
}

function displayGeneral(value: unknown) {
  return splitLines(value).join("\n");
}

function displayEmailValue(value: unknown) {
  return splitLines(value)
    .filter((line) => !isBadEmail(line))
    .join("\n");
}

function getClickableUrl(value?: string) {
  const text = clean(value);

  if (!text) return "";

  if (text.startsWith("http://") || text.startsWith("https://")) {
    return text;
  }

  if (text.startsWith("www.")) {
    return `https://${text}`;
  }

  if (/^[a-z0-9.-]+\.[a-z]{2,}/i.test(text)) {
    return `https://${text}`;
  }

  return "";
}

function hasProviderValue(row: EmailDiscoveryRow, provider: string) {
  if (provider === "Total Emails") {
    return Boolean(displayEmailValue(row.totalEmails));
  }

  if (provider === "Hunter") {
    return Boolean(displayEmailValue(row.hunter));
  }

  if (provider === "Apollo") {
    return Boolean(displayEmailValue(row.apollo));
  }

  if (provider === "Prospeo") {
    return Boolean(displayEmailValue(row.prospeo));
  }

  return true;
}

function hasAnyEmail(row: EmailDiscoveryRow) {
  return Boolean(
    displayEmailValue(row.website) ||
      displayEmailValue(row.totalEmails) ||
      displayEmailValue(row.hunter) ||
      displayEmailValue(row.apollo) ||
      displayEmailValue(row.prospeo)
  );
}

function getSearchText(row: EmailDiscoveryRow) {
  return [
    row.brandName,
    row.domain,
    displayGeneral(row.instagram),
    displayGeneral(row.twitter),
    displayGeneral(row.facebook),
    displayGeneral(row.linkedin),
    displayGeneral(row.youtube),
    displayEmailValue(row.website),
    displayEmailValue(row.totalEmails),
    displayEmailValue(row.hunter),
    displayEmailValue(row.apollo),
    displayEmailValue(row.prospeo),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getUniqueOptions(
  rows: EmailDiscoveryRow[],
  getter: (row: EmailDiscoveryRow) => string
) {
  const values = rows
    .map(getter)
    .map(clean)
    .filter(Boolean)
    .filter((value) => value !== "-");

  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function toOptions(items: string[]) {
  return [
    { label: ALL_VALUE, value: ALL_VALUE },
    ...items.map((item) => ({
      label: item,
      value: item,
    })),
  ];
}

function ClickableValue({
  value,
  strong = false,
}: {
  value: string;
  strong?: boolean;
}) {
  const text = clean(value);

  if (!text) {
    return <span className="text-slate-300">-</span>;
  }

  const url = getClickableUrl(text);

  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className={cn(
          "inline-flex max-w-full items-center break-all !underline !underline-offset-4 hover:!text-blue-700",
          strong
            ? "!font-semibold !text-blue-600"
            : "!font-medium !text-blue-600"
        )}
      >
        <span>{text}</span>
        <ExternalLink className="ml-1.5 h-3.5 w-3.5 shrink-0" />
      </a>
    );
  }

  return (
    <span
      className={cn(
        "whitespace-pre-wrap break-words text-xs leading-5",
        strong
          ? "!font-semibold !text-slate-900"
          : "!font-medium !text-slate-600"
      )}
    >
      {text}
    </span>
  );
}

function ClickableMultilineCell({
  value,
  strong = false,
}: {
  value: string;
  strong?: boolean;
}) {
  const lines = splitLines(value);

  if (lines.length === 0) {
    return <span className="text-slate-300">-</span>;
  }

  return (
    <div className="space-y-1">
      {lines.map((line, index) => (
        <div key={`${line}-${index}`}>
          <ClickableValue value={line} strong={strong} />
        </div>
      ))}
    </div>
  );
}

export default function EmailDiscoveryPage() {
  const [rows, setRows] = useState<EmailDiscoveryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [nextPage, setNextPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalRows, setTotalRows] = useState(0);

  const [search, setSearch] = useState("");
  const [domain, setDomain] = useState(ALL_VALUE);
  const [provider, setProvider] = useState(ALL_VALUE);
  const [emailStatus, setEmailStatus] = useState(ALL_VALUE);

  const loadRows = useCallback(async (pageToLoad = 1, append = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await apiGet(
        buildPaginatedEndpoint("/email-discovery", pageToLoad, PAGE_SIZE)
      );

      const nextRows: EmailDiscoveryRow[] = response?.data || [];

      setRows((previousRows) =>
        append ? mergeUniqueRows(previousRows, nextRows) : nextRows
      );

      setTotalRows(response?.total || nextRows.length);

      const pagination = response?.pagination;
      const more =
        typeof pagination?.hasMore === "boolean"
          ? pagination.hasMore
          : nextRows.length === PAGE_SIZE;

      setHasMore(more);
      setNextPage(pagination?.nextPage || (more ? pageToLoad + 1 : pageToLoad));
    } catch {
      if (!append) {
        setRows([]);
        setTotalRows(0);
      }

      setHasMore(false);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    setRows([]);
    setNextPage(1);
    setHasMore(true);
    setTotalRows(0);
    loadRows(1, false);
  }, [loadRows]);

  function handleLoadMore() {
    if (loading || loadingMore || !hasMore) return;

    loadRows(nextPage, true);
  }

  function clearFilters() {
    setSearch("");
    setDomain(ALL_VALUE);
    setProvider(ALL_VALUE);
    setEmailStatus(ALL_VALUE);
  }

  const domainOptions = useMemo(
    () => getUniqueOptions(rows, (row) => row.domain || ""),
    [rows]
  );

  const hasActiveFilters =
    Boolean(search.trim()) ||
    domain !== ALL_VALUE ||
    provider !== ALL_VALUE ||
    emailStatus !== ALL_VALUE;

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesSearch = !query || getSearchText(row).includes(query);
      const matchesDomain = domain === ALL_VALUE || clean(row.domain) === domain;
      const matchesProvider =
        provider === ALL_VALUE || hasProviderValue(row, provider);

      const matchesEmailStatus =
        emailStatus === ALL_VALUE ||
        (emailStatus === "Has Emails" && hasAnyEmail(row)) ||
        (emailStatus === "No Emails" && !hasAnyEmail(row));

      return (
        matchesSearch &&
        matchesDomain &&
        matchesProvider &&
        matchesEmailStatus
      );
    });
  }, [rows, search, domain, provider, emailStatus]);

  const columns = useMemo<AdminTableColumn<EmailDiscoveryRow>[]>(
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
        id: "brandName",
        header: "Brand Name",
        widthClassName: "min-w-[220px]",
        render: (row) => (
          <span className="font-semibold text-slate-950">
            {clean(row.brandName) || "-"}
          </span>
        ),
      },
      {
        id: "domain",
        header: "Domain",
        widthClassName: "min-w-[220px]",
        render: (row) => <ClickableValue value={clean(row.domain)} strong />,
      },
      {
        id: "instagram",
        header: "Instagram",
        widthClassName: "min-w-[240px]",
        render: (row) => (
          <ClickableMultilineCell value={displayGeneral(row.instagram)} />
        ),
      },
      {
        id: "twitter",
        header: "Twitter/X",
        widthClassName: "min-w-[240px]",
        render: (row) => (
          <ClickableMultilineCell value={displayGeneral(row.twitter)} />
        ),
      },
      {
        id: "facebook",
        header: "Facebook",
        widthClassName: "min-w-[240px]",
        render: (row) => (
          <ClickableMultilineCell value={displayGeneral(row.facebook)} />
        ),
      },
      {
        id: "linkedin",
        header: "LinkedIn",
        widthClassName: "min-w-[240px]",
        render: (row) => (
          <ClickableMultilineCell value={displayGeneral(row.linkedin)} />
        ),
      },
      {
        id: "youtube",
        header: "YouTube",
        widthClassName: "min-w-[240px]",
        render: (row) => (
          <ClickableMultilineCell value={displayGeneral(row.youtube)} />
        ),
      },
      {
        id: "website",
        header: "Website",
        widthClassName: "min-w-[260px]",
        render: (row) => (
          <ClickableMultilineCell value={displayEmailValue(row.website)} />
        ),
      },
      {
        id: "totalEmails",
        header: "Total Emails",
        widthClassName: "min-w-[260px]",
        render: (row) => (
          <ClickableMultilineCell
            value={displayEmailValue(row.totalEmails)}
            strong
          />
        ),
      },
      {
        id: "hunter",
        header: "Hunter",
        widthClassName: "min-w-[240px]",
        render: (row) => (
          <ClickableMultilineCell value={displayEmailValue(row.hunter)} />
        ),
      },
      {
        id: "apollo",
        header: "Apollo",
        widthClassName: "min-w-[240px]",
        render: (row) => (
          <ClickableMultilineCell value={displayEmailValue(row.apollo)} />
        ),
      },
      {
        id: "prospeo",
        header: "Prospeo",
        widthClassName: "min-w-[240px]",
        render: (row) => (
          <ClickableMultilineCell value={displayEmailValue(row.prospeo)} />
        ),
      },
    ],
    []
  );

  return (
    <main className="w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950">
          Email Discovery
        </h1>

        <p className="mt-1 text-sm font-medium text-slate-500">
          Email discovery records, social URLs, website emails, and provider
          results.
        </p>
      </div>

      <EmailDiscoveryTabs />

      <section className="space-y-3">
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:grid-cols-[1.5fr_1fr_1fr_1fr_auto] xl:items-end">
          <FilterSearchInput
            label="Search"
            value={search}
            onChange={setSearch}
            placeholder="Search brand, domain, social URL, email..."
          />

          <FilterSelect
            label="Domain"
            value={domain}
            onChange={setDomain}
            options={toOptions(domainOptions)}
          />

          <FilterSelect
            label="Provider"
            value={provider}
            onChange={setProvider}
            options={[
              { label: ALL_VALUE, value: ALL_VALUE },
              { label: "Total Emails", value: "Total Emails" },
              { label: "Hunter", value: "Hunter" },
              { label: "Apollo", value: "Apollo" },
              { label: "Prospeo", value: "Prospeo" },
            ]}
          />

          <FilterSelect
            label="Email Status"
            value={emailStatus}
            onChange={setEmailStatus}
            options={[
              { label: ALL_VALUE, value: ALL_VALUE },
              { label: "Has Emails", value: "Has Emails" },
              { label: "No Emails", value: "No Emails" },
            ]}
          />

          <Button
            type="button"
            variant="ghost"
            onClick={clearFilters}
            disabled={!hasActiveFilters}
            className="h-12 rounded-xl"
          >
            Clear
          </Button>
        </div>

        {hasActiveFilters ? (
          <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            Filters applied
          </span>
        ) : null}
      </section>

      <AdminTable
        data={filteredRows}
        columns={columns}
        rowKey={(row, index) =>
          row._id || `${row.brandName}-${row.domain}-${index}`
        }
        loading={loading}
        loadingRows={8}
        emptyTitle={
          loading
            ? "Loading Email Discovery..."
            : "No Email Discovery records found."
        }
        emptyDescription={
          hasActiveFilters
            ? "No records match your current filters."
            : "Email discovery records will appear here."
        }
        containerClassName="rounded-xl shadow-none"
      />

      <div className="flex flex-col items-center justify-center">

        <Button
          type="button"
          onClick={handleLoadMore}
          disabled={loading || loadingMore || !hasMore}
          className="rounded-xl"
        >
          {loadingMore
            ? "Loading more..."
            : hasMore
              ? `Load more ${PAGE_SIZE}`
              : "All rows loaded"}
        </Button>
      </div>
    </main>
  );
}