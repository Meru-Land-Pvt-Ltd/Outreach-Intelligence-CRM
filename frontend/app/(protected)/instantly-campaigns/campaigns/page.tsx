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

export default async function CampaignsPage() {
  const response = await apiGet("/instantly/campaigns");
  const rows = response?.data || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Campaigns</CardTitle>
      </CardHeader>

      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Channel</TableHead>
              <TableHead>Campaign</TableHead>
              <TableHead>Campaign ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Leads</TableHead>
              <TableHead>Pushed At</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {rows.map((row: any) => (
              <TableRow key={row._id}>
                <TableCell>{row.channel || "-"}</TableCell>
                <TableCell className="font-medium text-slate-950">{row.campaignName || "-"}</TableCell>
                <TableCell>{row.instantlyCampaignId || "-"}</TableCell>
                <TableCell><Badge variant="secondary">{row.status || "-"}</Badge></TableCell>
                <TableCell>{row.leadsPushed || 0}</TableCell>
                <TableCell>{row.pushedAt ? new Date(row.pushedAt).toLocaleString() : "-"}</TableCell>
              </TableRow>
            ))}

            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-slate-500">
                  No campaigns pushed yet.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
