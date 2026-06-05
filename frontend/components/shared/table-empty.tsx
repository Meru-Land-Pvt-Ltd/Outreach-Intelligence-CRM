import { TableCell, TableRow } from "@/components/ui/table";

type TableEmptyProps = {
  colSpan: number;
  title: string;
  description?: string;
};

export function TableEmpty({ colSpan, title, description }: TableEmptyProps) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="h-40 text-center">
        <div className="mx-auto max-w-sm">
          <p className="text-sm font-medium text-slate-900">{title}</p>
          {description ? (
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}