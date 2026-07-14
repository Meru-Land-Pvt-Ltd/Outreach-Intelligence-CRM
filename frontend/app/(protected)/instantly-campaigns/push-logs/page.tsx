"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";

export default function PushLogsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadLogs() {
      const response = await apiGet("/instantly/push-logs");

      if (!active) {
        return;
      }

      setRows(response?.data || []);
      setLoading(false);
    }

    loadLogs();

    return () => {
      active = false;
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Push Logs</CardTitle>
      </CardHeader>

      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px] text-center">#</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Campaign</TableHead>
              <TableHead>Total Pushed</TableHead>
              <TableHead>Daily Limit</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Message</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {rows.map((row: any, index: number) => (
              <TableRow key={row._id}>
                <TableCell className="text-center font-semibold text-slate-500">
                  {index + 1}
                </TableCell>
                <TableCell>{row.channel || "-"}</TableCell>
                <TableCell>{row.campaignName || "-"}</TableCell>
                <TableCell>{row.totalPushed || 0}</TableCell>
                <TableCell>{row.dailyLimit || 0}</TableCell>
                <TableCell>
                  <Badge variant={row.status === "Success" ? "success" : "danger"}>
                    {row.status || "-"}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-lg whitespace-normal">{row.message || "-"}</TableCell>
              </TableRow>
            ))}

            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-slate-500">
                  {loading ? "Loading push logs…" : "No push logs yet."}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
