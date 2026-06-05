import { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

type DataSectionProps = {
  title?: string;
  description?: string;
  children: ReactNode;
};

export function DataSection({ title, description, children }: DataSectionProps) {
  return (
    <Card className="overflow-hidden border-slate-200/70 shadow-sm">
      {(title || description) ? (
        <CardHeader className="pb-3">
          {title ? <CardTitle className="text-base">{title}</CardTitle> : null}
          {description ? (
            <CardDescription className="text-sm">{description}</CardDescription>
          ) : null}
        </CardHeader>
      ) : null}

      <CardContent className="p-0">
        <ScrollArea className="w-full">
          <div className="min-w-max">{children}</div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  );
}