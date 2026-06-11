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
  apolloPersonId?: string;
  raw?: any;
};

type PaginatedResponse<T> = {
  success?: boolean;
  count?: number;
  total?: number;
  data?: T[];
  pagination?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    hasMore?: boolean;
    nextPage?: number | null;
  };
};

const PAGE_SIZE = 1000;
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
      "unknown",
    ].includes(lower)
  ) {
    return "";
  }

  return text;
}

function cleanEmail(value: unknown) {
  return clean(value)
    .toLowerCase()
    .replace(/^mailto:/, "")
    .replace(/[<>"'(),;]+/g, "")
    .trim();
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
      cleanEmail(row.email),
      clean(row.fullName || row.name),
      clean(row.title),
      clean(row.apolloPersonId),
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
  const value = cleanEmail(email);

  if (!value) return true;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return true;
  if (value.endsWith(".css")) return true;
  if (value.endsWith(".js")) return true;
  if (value.includes("@11.")) return true;
  if (value.includes("email_not_unlocked")) return true;

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
  const local = cleanEmail(email).split("@")[0] || "";

  const parts = local
    .split(/[._-]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !/^\d+$/.test(part));

  if (parts.length < 2) return "";

  return titleCaseName(parts.join(" "));
}

function getFullName(row: RawContact) {
  const firstName = clean(row.firstName);
  const lastName = clean(row.lastName);
  const fullFromParts = [firstName, lastName].filter(Boolean).join(" ");

  const storedName = clean(row.fullName) || clean(row.name) || fullFromParts;
  const emailName = nameFromEmail(cleanEmail(row.email));

  if (emailName && (!storedName || storedName.split(/\s+/).length < 2)) {
    return emailName;
  }

  return storedName || emailName || "";
}


function normalizeHunterStatus(value: unknown, row?: RawContact) {
  const rawStatus = clean(value || "");
  const lower = rawStatus.toLowerCase().replace(/[\s_-]+/g, " ").trim();
  const email = cleanEmail(row?.email);

  if (
    !lower ||
    [
      "verified",
      "valid",
      "ok",
      "deliverable",
      "accepted",
      "accept all",
      "acceptall",
      "has email",
      "hasemail",
      "has emails",
      "true",
    ].includes(lower) ||
    /^\d+$/.test(lower)
  ) {
    return !isBadEmail(email) ? "Yes" : "No";
  }

  if (
    [
      "invalid",
      "failed",
      "error",
      "undeliverable",
      "rejected",
      "no email",
      "no emails",
      "no email found",
      "not found",
      "unavailable",
      "false",
    ].includes(lower)
  ) {
    return "No";
  }

  return !isBadEmail(email) ? "Yes" : "No";
}

function normalizeStatus(value: unknown, provider: Provider, row?: RawContact) {
  const rawStatus = clean(value || "");
  const lower = rawStatus.toLowerCase().replace(/[\s_-]+/g, " ").trim();
  const email = cleanEmail(row?.email);

  if (!lower) {
    if (provider === "apollo") {
      const hasEmailFlag = [
        row?.raw?.has_email,
        row?.raw?.hasEmail,
        row?.raw?.email_available,
      ].some((item) => item === true || String(item).toLowerCase() === "true");

      if (hasEmailFlag) return "Has Email";
    }

    return !isBadEmail(email)
      ? provider === "apollo"
        ? "Revealed"
        : provider === "prospeo"
          ? "Found"
          : "Verified"
      : "";
  }

  if (["verified", "valid", "ok", "deliverable", "accepted"].includes(lower)) {
    return "Verified";
  }

  if (["revealed", "found", "available"].includes(lower)) {
    return "Revealed";
  }

  if (["has email", "hasemail", "has emails", "true"].includes(lower)) {
    return "Has Email";
  }

  if (
    ["no email", "no emails", "no email found", "not found", "unavailable", "false"].includes(
      lower
    )
  ) {
    return "No Email";
  }

  if (["invalid", "failed", "error", "undeliverable", "rejected"].includes(lower)) {
    return "Invalid";
  }

  if (["unverified", "risky", "risky email", "accept all", "acceptall"].includes(lower)) {
    return rawStatus;
  }

  return rawStatus;
}

function getStatus(row: RawContact, provider: Provider) {
  if (provider === "hunter") {
    return normalizeHunterStatus(
      row.emailStatus ||
      row.emailVerified ||
      row.verificationStatus ||
      row.status ||
      row.raw?.email_status ||
      row.raw?.emailStatus ||
      row.raw?.verification?.status ||
      row.raw?.status ||
      row.raw?.confidence,
      row
    );
  }

  if (provider === "apollo") {
    return normalizeStatus(
      row.emailVerified ||
      row.emailStatus ||
      row.verificationStatus ||
      row.status ||
      row.raw?.email_status ||
      row.raw?.emailStatus ||
      row.raw?.status,
      provider,
      row
    );
  }

  return normalizeStatus(
    row.emailStatus ||
    row.emailVerified ||
    row.verificationStatus ||
    row.status ||
    row.raw?.email_status ||
    row.raw?.emailStatus ||
    row.raw?.verification?.status ||
    row.raw?.status,
    provider,
    row
  );
}

function getSearchText(row: RawContact, provider: Provider) {
  return [
    row.brandName,
    row.domain,
    getFullName(row),
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
  const email = cleanEmail(value);

  if (!email || isBadEmail(email)) {
    return <span className="text-slate-300">-</span>;
  }

  return <span className="break-all !font-medium !text-slate-700">{email}</span>;
}

function StatusBadge({ value }: { value: string }) {
  const status = clean(value);

  if (!status) return <span className="text-slate-300">-</span>;

  const lower = status.toLowerCase();

  if (["yes", "verified", "valid", "ok", "deliverable"].includes(lower)) {
    return (
      <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        {status}
      </span>
    );
  }

  if (["revealed", "has email", "has_email", "found", "accept all", "accept_all", "acceptall"].includes(lower)) {
    return (
      <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
        {status === "has_email" ? "Has Email" : status === "accept_all" ? "accept_all" : status}
      </span>
    );
  }

  if (["invalid", "failed", "error", "undeliverable"].includes(lower)) {
    return (
      <span className="inline-flex rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
        {status}
      </span>
    );
  }

  if (["no", "no email", "no_email", "unverified", "not found"].includes(lower)) {
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

function PlainCell({ value, strong = false }: { value?: string; strong?: boolean }) {
  const text = clean(value);

  if (!text) return <span className="text-slate-300">-</span>;

  return (
    <span className={strong ? "font-semibold text-slate-950" : "font-medium text-slate-700"}>
      {text}
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
        const response = await apiGet<PaginatedResponse<RawContact>>(
          buildPaginatedEndpoint(endpoint, pageToLoad, PAGE_SIZE)
        );

        const nextRows = response?.data || [];

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
      const email = cleanEmail(row.email);
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
        id: "brandName",
        header: "Brand Name",
        widthClassName: "min-w-[220px]",
        render: (row) => <PlainCell value={row.brandName} strong />,
      },
      {
        id: "domain",
        header: "Domain",
        widthClassName: "min-w-[220px]",
        render: (row) => <ClickableDomain value={row.domain} />,
      },
      {
        id: "fullName",
        header: "Full Name",
        widthClassName: "min-w-[240px]",
        render: (row) => {
          const fullName = getFullName(row);

          return fullName ? (
            <PlainCell value={fullName} />
          ) : (
            <span className="font-medium text-slate-700">Unknown</span>
          );
        },
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

    baseColumns.push(
      {
        id: "email",
        header: "Email",
        widthClassName: "min-w-[240px]",
        render: (row) => <ClickableEmail value={row.email} />,
      },
      {
        id: "status",
        header: statusHeader,
        widthClassName: "min-w-[170px]",
        render: (row) => <StatusBadge value={getStatus(row, provider)} />,
      }
    );

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
            placeholder="Search brand, domain, full name, email, title..."
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
          row._id || `${row.brandName}-${row.email}-${row.apolloPersonId}-${index}`
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
