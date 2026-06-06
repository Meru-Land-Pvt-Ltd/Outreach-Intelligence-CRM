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

export default async function PushLogsPage() {
  const response = await apiGet("/instantly/push-logs");
  const rows = response?.data || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Push Logs</CardTitle>
      </CardHeader>

      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Channel</TableHead>
              <TableHead>Campaign</TableHead>
              <TableHead>Total Pushed</TableHead>
              <TableHead>Daily Limit</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Message</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {rows.map((row: any) => (
              <TableRow key={row._id}>
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
                <TableCell colSpan={6} className="py-10 text-center text-slate-500">
                  No push logs yet.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
