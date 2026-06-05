import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { formatNumber } from "@/lib/format";

export function StatCard({
  title,
  value,
  description,
  className
}: {
  title: string;
  value: number | string;
  description?: string;
  className?: string;
}) {
  return (
    <Card className={cn("w-full max-w-full", className)}>
      <CardContent className="p-5">
        <div className="text-sm font-medium text-slate-500">{title}</div>
        <div className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
          {formatNumber(value)}
        </div>
        {description ? (
          <div className="mt-2 text-sm text-slate-500">{description}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}