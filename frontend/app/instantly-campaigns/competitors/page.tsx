"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";

export default function CompetitorsPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadLeads() {
    const response = await apiGet("/instantly/leads");
    setLeads(response?.data || []);
  }

  useEffect(() => {
    loadLeads();
  }, []);

  async function fillCompetitors() {
    setLoading(true);
    setMessage("Finding competitors...");

    const response = await apiPost("/instantly/competitors/fill", {});

    if (response.success) {
      setMessage(
        "Competitors filled. Companies checked: " +
          response.companies +
          ". Rows updated: " +
          response.updated
      );
      await loadLeads();
    } else {
      setMessage(response.message || "Competitor fill failed.");
    }

    setLoading(false);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>Competitor Fill</CardTitle>
          <CardDescription>
            Fills Competitor 1 and Competitor 2 for Instantly leads.
          </CardDescription>
        </div>

        <Button onClick={fillCompetitors} disabled={loading}>
          <Sparkles className="mr-2 h-4 w-4" />
          {loading ? "Filling..." : "Fill Competitors"}
        </Button>
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
              <TableHead>Company</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Competitor 1</TableHead>
              <TableHead>Competitor 2</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {leads.map((lead) => (
              <TableRow key={lead._id}>
                <TableCell className="font-medium text-slate-950">{lead.companyName || "-"}</TableCell>
                <TableCell>{lead.productName || "-"}</TableCell>
                <TableCell>{lead.competitor1 || "-"}</TableCell>
                <TableCell>{lead.competitor2 || "-"}</TableCell>
              </TableRow>
            ))}

            {leads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-slate-500">
                  No leads exported yet.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
