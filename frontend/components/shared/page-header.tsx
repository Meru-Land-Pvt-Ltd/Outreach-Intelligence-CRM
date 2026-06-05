import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  children,
  className
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-6 flex w-full max-w-full flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:flex-row lg:items-center lg:justify-between",
        className
      )}
    >
      <div className="w-full max-w-full">
        <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
          {title}
        </h1>

        {description ? (
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {description}
          </p>
        ) : null}
      </div>

      {children ? (
        <div className="flex w-full max-w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          {children}
        </div>
      ) : null}
    </div>
  );
}