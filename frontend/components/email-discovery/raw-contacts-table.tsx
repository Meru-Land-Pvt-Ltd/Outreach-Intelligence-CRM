"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import { apiGet } from "@/lib/api";
import { Button } from "@/components/ui/button";
import AdminTable, {
  type AdminTableColumn,
} from "@/components/ui/tableComp";
import { FilterSearchInput } from "@/components/shared/filter-search-input";
import { FilterSelect } from "@/components/shared/filter-select";
import { EmailDiscoveryTabs } from "@/components/email-discovery/email-discovery-tabs";

type Provider = "apollo" | "hunter" | "prospeo";

type RawContact = {
  _id?: string;
  brandName?: string;
  domain?: string;
  fullName?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  email?: string;
  emailVerified?: string;
  emailStatus?: string;
  verificationStatus?: string;
  status?: string;
  country?: string;
  raw?: any;
};

const PAGE_SIZE = 1000;
const ALL_VALUE = "All";

function clean(value: unknown) {
  const text = String(value || "").trim();

  if (!text) return "";

  const lower = text.toLowerCase();

  if (
    ["-", "n/a", "na", "none", "null", "undefined", "not found"].includes(lower)
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

function getRowIdentity(row: RawContact) {
  return (
    row._id ||
    [
      clean(row.brandName),
      clean(row.domain),
      clean(row.email),
      clean(row.fullName || row.name),
      clean(row.title),
    ]
      .filter(Boolean)
      .join("-")
  );
}

function mergeUniqueRows(previousRows: RawContact[], nextRows: RawContact[]) {
  const map = new Map<string, RawContact>();

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

function isBadEmail(email: string) {
  const value = clean(email).toLowerCase();

  if (!value) return true;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return true;
  if (value.endsWith(".css")) return true;
  if (value.endsWith(".js")) return true;
  if (value.includes("@11.")) return true;

  return [
    "your@email.com",
    "name@domain.com",
    "example@gmail.com",
    "test@test.com",
  ].includes(value);
}

function titleCaseName(value: string) {
  return clean(value)
    .split(/[\s._-]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function nameFromEmail(email: string) {
  const local = clean(email).split("@")[0] || "";

  const parts = local
    .split(/[._-]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !/^\d+$/.test(part));

  if (parts.length < 2) return "";

  return titleCaseName(parts.join(" "));
}

function bestName(row: RawContact) {
  const firstName = clean(row.firstName);
  const lastName = clean(row.lastName);
  const fullFromParts = [firstName, lastName].filter(Boolean).join(" ");

  const storedName = clean(row.fullName) || clean(row.name) || fullFromParts;
  const emailName = nameFromEmail(clean(row.email));

  if (emailName && (!storedName || storedName.split(/\s+/).length < 2)) {
    return emailName;
  }

  return storedName || emailName || "";
}

function pocNameEmail(row: RawContact) {
  const email = clean(row.email).toLowerCase();
  const name = bestName(row);

  if (isBadEmail(email)) return name || "";

  return name ? `${name} (${email})` : email;
}

function apolloStatus(row: RawContact) {
  const email = clean(row.email).toLowerCase();

  const rawText = [
    row.emailVerified,
    row.emailStatus,
    row.verificationStatus,
    row.status,
    row.raw?.email_status,
    row.raw?.emailStatus,
    row.raw?.status,
  ]
    .map((value) => clean(value).toLowerCase())
    .filter(Boolean)
    .join(" ");

  if (!rawText && !email) return "";

  if (rawText.includes("verified")) return "Verified";

  if (
    rawText.includes("revealed") ||
    rawText.includes("found") ||
    rawText.includes("available") ||
    rawText.includes("valid") ||
    (!isBadEmail(email) && email)
  ) {
    return "Revealed";
  }

  if (
    rawText.includes("has email") ||
    rawText.includes("has_email") ||
    rawText === "true"
  ) {
    return "Has Email";
  }

  if (
    rawText.includes("no email") ||
    rawText.includes("no_email") ||
    rawText.includes("not found") ||
    rawText.includes("unavailable") ||
    rawText === "false"
  ) {
    return "No Email";
  }

  return clean(
    row.emailVerified ||
    row.emailStatus ||
    row.verificationStatus ||
    row.status
  );
}

function regularStatus(row: RawContact) {
  return clean(
    row.emailStatus ||
    row.emailVerified ||
    row.verificationStatus ||
    row.status
  );
}

function getStatus(row: RawContact, provider: Provider) {
  if (provider === "apollo") return apolloStatus(row);

  return regularStatus(row);
}

function getSearchText(row: RawContact, provider: Provider) {
  return [
    row.brandName,
    row.domain,
    bestName(row),
    pocNameEmail(row),
    row.email,
    row.title,
    row.country,
    getStatus(row, provider),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getUniqueOptions(
  rows: RawContact[],
  getter: (row: RawContact) => string
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

function ClickableDomain({ value }: { value?: string }) {
  const domain = clean(value);
  const url = getClickableUrl(domain);

  if (!domain) return <span className="text-slate-300">-</span>;

  if (!url) {
    return <span className="!font-medium !text-slate-700">{domain}</span>;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex max-w-full items-center break-all !font-medium !text-blue-600 !underline !underline-offset-4 hover:!text-blue-700"
    >
      <span>{domain}</span>
      <ExternalLink className="ml-1.5 h-3.5 w-3.5 shrink-0" />
    </a>
  );
}

function ClickableEmail({ value }: { value?: string }) {
  const email = clean(value).toLowerCase();

  if (!email || isBadEmail(email)) {
    return <span className="text-slate-300">-</span>;
  }

  return <span className="break-all !font-medium !text-slate-700">{email}</span>;
}

function StatusBadge({ value }: { value: string }) {
  const status = clean(value);

  if (!status) return <span className="text-slate-300">-</span>;

  const lower = status.toLowerCase();

  if (["verified", "valid", "ok", "deliverable"].includes(lower)) {
    return (
      <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        {status}
      </span>
    );
  }

  if (["revealed", "has email", "has_email"].includes(lower)) {
    return (
      <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
        {status === "has_email" ? "Has Email" : status}
      </span>
    );
  }

  if (["invalid", "failed", "error"].includes(lower)) {
    return (
      <span className="inline-flex rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
        {status}
      </span>
    );
  }

  if (["no email", "no_email", "unverified", "not found"].includes(lower)) {
    return (
      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
        {status === "no_email" ? "No Email" : status}
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
      {status}
    </span>
  );
}

export function RawContactsTable({
  endpoint,
  title,
  description,
  provider,
  statusHeader,
  includeCountry = true,
}: {
  endpoint: string;
  title: string;
  description: string;
  provider: Provider;
  statusHeader: string;
  includeCountry?: boolean;
}) {
  const [rows, setRows] = useState<RawContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [nextPage, setNextPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalRows, setTotalRows] = useState(0);

  const [search, setSearch] = useState("");
  const [domain, setDomain] = useState(ALL_VALUE);
  const [status, setStatus] = useState(ALL_VALUE);
  const [emailFilter, setEmailFilter] = useState(ALL_VALUE);
  const [country, setCountry] = useState(ALL_VALUE);

  const loadRows = useCallback(
    async (pageToLoad = 1, append = false) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      try {
        const response = await apiGet(
          buildPaginatedEndpoint(endpoint, pageToLoad, PAGE_SIZE)
        );

        const nextRows: RawContact[] = response?.data || [];

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
        setNextPage(
          pagination?.nextPage || (more ? pageToLoad + 1 : pageToLoad)
        );
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
    },
    [endpoint]
  );

  useEffect(() => {
    setRows([]);
    setNextPage(1);
    setHasMore(true);
    setTotalRows(0);
    loadRows(1, false);
  }, [endpoint, loadRows]);

  function handleLoadMore() {
    if (loading || loadingMore || !hasMore) return;

    loadRows(nextPage, true);
  }

  function clearFilters() {
    setSearch("");
    setDomain(ALL_VALUE);
    setStatus(ALL_VALUE);
    setEmailFilter(ALL_VALUE);
    setCountry(ALL_VALUE);
  }

  const domainOptions = useMemo(
    () => getUniqueOptions(rows, (row) => row.domain || ""),
    [rows]
  );

  const statusOptions = useMemo(
    () => getUniqueOptions(rows, (row) => getStatus(row, provider)),
    [rows, provider]
  );

  const countryOptions = useMemo(
    () => getUniqueOptions(rows, (row) => row.country || ""),
    [rows]
  );

  const hasActiveFilters =
    Boolean(search.trim()) ||
    domain !== ALL_VALUE ||
    status !== ALL_VALUE ||
    emailFilter !== ALL_VALUE ||
    country !== ALL_VALUE;

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return rows.filter((row) => {
      const email = clean(row.email).toLowerCase();
      const rowStatus = getStatus(row, provider);

      const matchesSearch =
        !query || getSearchText(row, provider).includes(query);

      const matchesDomain = domain === ALL_VALUE || clean(row.domain) === domain;
      const matchesStatus = status === ALL_VALUE || rowStatus === status;

      const matchesEmail =
        emailFilter === ALL_VALUE ||
        (emailFilter === "Has Email" && !isBadEmail(email)) ||
        (emailFilter === "No Email" && isBadEmail(email));

      const matchesCountry =
        !includeCountry ||
        country === ALL_VALUE ||
        clean(row.country) === country;

      return (
        matchesSearch &&
        matchesDomain &&
        matchesStatus &&
        matchesEmail &&
        matchesCountry
      );
    });
  }, [
    rows,
    search,
    domain,
    status,
    emailFilter,
    country,
    provider,
    includeCountry,
  ]);

  const columns = useMemo<AdminTableColumn<RawContact>[]>(() => {
    const baseColumns: AdminTableColumn<RawContact>[] = [
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
        render: (row) => <ClickableDomain value={row.domain} />,
      },
      {
        id: "pocNameEmail",
        header: "PoC Name (Email)",
        widthClassName: "min-w-[280px]",
        render: (row) => (
          <span className="font-semibold text-slate-800">
            {pocNameEmail(row) || "-"}
          </span>
        ),
      },
      {
        id: "email",
        header: "Email",
        widthClassName: "min-w-[240px]",
        render: (row) => <ClickableEmail value={row.email} />,
      },
      {
        id: "title",
        header: "Title",
        widthClassName: "min-w-[260px]",
        render: (row) => clean(row.title) || "-",
      },
    ];

    if (includeCountry) {
      baseColumns.push({
        id: "country",
        header: "Country",
        widthClassName: "min-w-[150px]",
        render: (row) => clean(row.country) || "-",
      });
    }

    baseColumns.push({
      id: "status",
      header: statusHeader,
      widthClassName: "min-w-[160px]",
      render: (row) => <StatusBadge value={getStatus(row, provider)} />,
    });

    return baseColumns;
  }, [includeCountry, provider, statusHeader]);

  return (
    <main className="w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950">
          {title}
        </h1>

        <p className="mt-1 text-sm font-medium text-slate-500">
          {description}
        </p>
      </div>

      <EmailDiscoveryTabs />

      <section className="space-y-3">
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:grid-cols-[1.6fr_1fr_1fr_1fr_1fr_auto] xl:items-end">
          <FilterSearchInput
            label="Search"
            value={search}
            onChange={setSearch}
            placeholder="Search brand, domain, PoC, email, title..."
          />

          <FilterSelect
            label="Domain"
            value={domain}
            onChange={setDomain}
            options={toOptions(domainOptions)}
          />

          <FilterSelect
            label="Email"
            value={emailFilter}
            onChange={setEmailFilter}
            options={[
              { label: ALL_VALUE, value: ALL_VALUE },
              { label: "Has Email", value: "Has Email" },
              { label: "No Email", value: "No Email" },
            ]}
          />

          <FilterSelect
            label={statusHeader}
            value={status}
            onChange={setStatus}
            options={toOptions(statusOptions)}
          />

          {includeCountry ? (
            <FilterSelect
              label="Country"
              value={country}
              onChange={setCountry}
              options={toOptions(countryOptions)}
            />
          ) : (
            <div />
          )}

          <Button
            type="button"
            variant="ghost"
            onClick={clearFilters}
            disabled={!hasActiveFilters}
            className="h-12 rounded-xl"
          >
            <X className="mr-2 h-4 w-4" />
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
          row._id || `${row.brandName}-${row.email}-${index}`
        }
        loading={loading}
        loadingRows={8}
        emptyTitle={
          loading ? `Loading ${title}...` : `No ${title} records found.`
        }
        emptyDescription={
          hasActiveFilters
            ? "No records match your current filters."
            : `${title} records will appear here.`
        }
        containerClassName="rounded-xl shadow-none"
      />

      <div className="flex flex-col items-center justify-center p-4">
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