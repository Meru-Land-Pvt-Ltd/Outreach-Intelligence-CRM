"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function FilterSearchInput({
  label = "",
  value,
  onChange,
  placeholder,
  className = "",
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <label className={`flex min-w-0 flex-col gap-2 ${className}`}>
      <span className="h-4 text-xs font-semibold leading-4 text-slate-500">
        {label}
      </span>

      <div className="relative">
        <Search className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="!h-8 min-h-8 rounded-lg border border-slate-200 bg-white px-4 pr-12 text-sm font-medium text-slate-900 shadow-none outline-none placeholder:text-slate-500 focus-visible:ring-4 focus-visible:ring-blue-50 focus-visible:ring-offset-0"
        />
      </div>
    </label>
  );
}