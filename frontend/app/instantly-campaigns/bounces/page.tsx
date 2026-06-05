"use client";

import { useEffect, useState } from "react";
import { RefreshCcw } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";

export default function BouncesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState("");

  async function loadRows() {
    const response = await apiGet("/instantly/bounces");
    setRows(response?.data || []);
  }

  useEffect(() => {
    loadRows();
  }, []);

  async function pull(mode: "crm" | "all") {
    setLoading(mode);
    setMessage(mode === "crm" ? "Pulling CRM campaign bounces..." : "Pulling all Instantly bounces...");

    const response = await apiPost("/instantly/pull-bounced", { mode });

    if (response.success) {
      setMessage(
        "Done. Mode: " +
          response.mode +
          ". Campaigns scanned: " +
          response.campaignsScanned +
          ". Bounced emails: " +
          response.uniqueBouncedEmails
      );
      await loadRows();
    } else {
      setMessage(response.message || "Bounce pull failed.");
    }

    setLoading("");
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle>Bounces</CardTitle>

        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => pull("crm")} disabled={loading !== ""}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            {loading === "crm" ? "Pulling..." : "CRM Campaigns Only"}
          </Button>

          <Button variant="outline" onClick={() => pull("all")} disabled={loading !== ""}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            {loading === "all" ? "Pulling..." : "All Instantly Campaigns"}
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {message ? (
          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {message}
          </div>
        ) : null}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Campaign ID</TableHead>
              <TableHead>Event Type</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Timestamp</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {rows.map((row) => (
              <TableRow key={row._id}>
                <TableCell className="font-medium text-slate-950">{row.email || "-"}</TableCell>
                <TableCell>{row.campaignId || "-"}</TableCell>
                <TableCell>{row.eventType || "-"}</TableCell>
                <TableCell>{row.source || "-"}</TableCell>
                <TableCell>{row.reason || "-"}</TableCell>
                <TableCell>{row.createdAt ? new Date(row.createdAt).toLocaleString() : "-"}</TableCell>
              </TableRow>
            ))}

            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-slate-500">
                  No bounce events yet.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
