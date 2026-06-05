"use client";

import { useEffect, useState } from "react";
import { Play, Plus } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
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

export default function ClosedDealsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    month: "",
    influencerHandle: "",
    brandName: "",
    productName: "",
    email: "",
    totalDealAmount: ""
  });

  async function loadRows() {
    setLoading(true);
    const response = await apiGet("/sheets/closed-deals");
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

    const response: any = await apiPost("/sheets/closed-deals", {
      ...form,
      totalDealAmount: Number(form.totalDealAmount || 0)
    });

    if (response.success) {
      setNotice({ type: "success", text: "Seed deal added." });

      setForm({
        month: "",
        influencerHandle: "",
        brandName: "",
        productName: "",
        email: "",
        totalDealAmount: ""
      });

      await loadRows();
    } else {
      setNotice({
        type: "error",
        text: response.message || "Failed to add deal."
      });
    }

    setSubmitting(false);
  }

  async function runCrawl(seedBrandId: string) {
    setNotice(null);

    const response: any = await apiPost(
      `/jobs/run-intelligence/${seedBrandId}`,
      {}
    );

    if (response.success) {
      setNotice({
        type: "success",
        text: `Crawl queued. Job ID: ${response.jobId || "-"}`
      });
    } else {
      setNotice({
        type: "error",
        text: response.message || "Failed to queue crawl."
      });
    }
  }

  return (
    <main className="w-full space-y-6">
      <PageHeader
        title="Closed Deals"
        description="Add seed deals."
      />

      <Card className="border-slate-200/70 shadow-sm">
        <CardHeader>
          <CardTitle>Add seed deal</CardTitle>
          <CardDescription>Brand, creator, product, and value.</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={submit} className="grid gap-3 md:grid-cols-3">
            <Input
              placeholder="Month"
              value={form.month}
              onChange={(e) => setForm({ ...form, month: e.target.value })}
            />

            <Input
              placeholder="Influencer handle"
              value={form.influencerHandle}
              onChange={(e) =>
                setForm({ ...form, influencerHandle: e.target.value })
              }
            />

            <Input
              placeholder="Brand name"
              value={form.brandName}
              onChange={(e) => setForm({ ...form, brandName: e.target.value })}
              required
            />

            <Input
              placeholder="Product name"
              value={form.productName}
              onChange={(e) => setForm({ ...form, productName: e.target.value })}
              required
            />

            <Input
              placeholder="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />

            <Input
              placeholder="Deal amount"
              type="number"
              value={form.totalDealAmount}
              onChange={(e) =>
                setForm({ ...form, totalDealAmount: e.target.value })
              }
            />

            <div className="md:col-span-3">
              <Button type="submit" disabled={submitting}>
                <Plus className="mr-2 h-4 w-4" />
                {submitting ? "Adding..." : "Add deal"}
              </Button>
            </div>
          </form>

          {notice ? <Notice type={notice.type} text={notice.text} /> : null}
        </CardContent>
      </Card>

      <DataSection title="Deals" description={`${rows.length} records`}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Month</TableHead>
              <TableHead>Influencer</TableHead>
              <TableHead>Brand</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Crawls</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {rows.map((row) => (
              <TableRow key={row._id}>
                <TableCell className="min-w-[120px]">{row.month || "-"}</TableCell>

                <TableCell className="min-w-[180px]">
                  {row.influencerHandle || "-"}
                </TableCell>

                <TableCell className="min-w-[180px] font-semibold text-slate-950">
                  {row.brandName || "-"}
                </TableCell>

                <TableCell className="min-w-[220px]">
                  {row.productName || "-"}
                </TableCell>

                <TableCell className="min-w-[220px]">
                  {row.email || "-"}
                </TableCell>

                <TableCell className="min-w-[140px]">
                  {formatMoney(row.totalDealAmount)}
                </TableCell>

                <TableCell>
                  <Badge variant="secondary">{row.crawlCount || 0}</Badge>
                </TableCell>

                <TableCell className="min-w-[140px]">
                  {row.seedBrandId ? (
                    <Button size="sm" onClick={() => runCrawl(row.seedBrandId)}>
                      <Play className="mr-2 h-3.5 w-3.5" />
                      Crawl
                    </Button>
                  ) : (
                    "-"
                  )}
                </TableCell>
              </TableRow>
            ))}

            {rows.length === 0 ? (
              <TableEmpty
                colSpan={8}
                title={loading ? "Loading deals..." : "No deals yet."}
                description="Add your first seed deal to start crawling."
              />
            ) : null}
          </TableBody>
        </Table>
      </DataSection>
    </main>
  );
}