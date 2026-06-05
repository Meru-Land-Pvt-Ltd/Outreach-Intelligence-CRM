"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Plus } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import { DataSection } from "@/components/shared/data-section";
import { TableEmpty } from "@/components/shared/table-empty";
import { Notice } from "@/components/shared/notice";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";

type NoticeState = {
  type: "success" | "error";
  text: string;
};

function getDomainHref(domain?: string) {
  if (!domain) return "";

  const cleanDomain = domain.trim();

  if (!cleanDomain) return "";

  if (cleanDomain.startsWith("http://") || cleanDomain.startsWith("https://")) {
    return cleanDomain;
  }

  return `https://${cleanDomain}`;
}

function getDomainLabel(domain?: string) {
  if (!domain) return "-";

  return domain
    .replace("https://", "")
    .replace("http://", "")
    .replace("www.", "")
    .replace(/\/$/, "");
}

export default function ExcludedBrandsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    brandName: "",
    domain: ""
  });

  async function loadRows() {
    setLoading(true);
    const response = await apiGet("/sheets/excluded-brands");
    setRows(response?.data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadRows();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setNotice(null);

    const response: any = await apiPost("/sheets/excluded-brands", form);

    if (response.success) {
      setNotice({ type: "success", text: "Brand excluded." });
      setForm({ brandName: "", domain: "" });
      await loadRows();
    } else {
      setNotice({
        type: "error",
        text: response.message || "Failed to add excluded brand."
      });
    }

    setSubmitting(false);
  }

  return (
    <main className="w-full space-y-6">
      <PageHeader
        title="Excluded Brands"
        description="Brands skipped by the worker."
      />

      <Card className="border-slate-200/70 shadow-sm">
        <CardHeader>
          <CardTitle>Add exclusion</CardTitle>
          <CardDescription>Use brand name, domain, or both.</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={submit} className="grid gap-3 md:grid-cols-3">
            <Input
              placeholder="Brand name"
              value={form.brandName}
              onChange={(e) => setForm({ ...form, brandName: e.target.value })}
            />

            <Input
              placeholder="Domain"
              value={form.domain}
              onChange={(e) => setForm({ ...form, domain: e.target.value })}
            />

            <Button type="submit" disabled={submitting}>
              <Plus className="h-4 w-4" />
              {submitting ? "Adding..." : "Add exclusion"}
            </Button>
          </form>

          {notice ? <Notice type={notice.type} text={notice.text} /> : null}
        </CardContent>
      </Card>

      <DataSection title="Exclusions" description={`${rows.length} records`}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Brand</TableHead>
              <TableHead>Domain</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {rows.map((row) => {
              const domainHref = getDomainHref(row.domain);

              return (
                <TableRow key={row._id}>
                  <TableCell className="min-w-[240px] font-semibold text-slate-950">
                    {row.brandName || "-"}
                  </TableCell>

                  <TableCell className="min-w-[240px]">
                    {domainHref ? (
                      <a
                        href={domainHref}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 font-medium text-slate-700 underline-offset-4 hover:text-slate-950 hover:underline"
                      >
                        {getDomainLabel(row.domain)}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                </TableRow>
              );
            })}

            {rows.length === 0 ? (
              <TableEmpty
                colSpan={2}
                title={loading ? "Loading exclusions..." : "No exclusions yet."}
                description="Excluded brands will be skipped during discovery."
              />
            ) : null}
          </TableBody>
        </Table>
      </DataSection>
    </main>
  );
}