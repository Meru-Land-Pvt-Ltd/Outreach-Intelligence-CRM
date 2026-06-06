"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type FilterSelectOption = {
  label: string;
  value: string;
};

export function FilterSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "All",
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: FilterSelectOption[];
  placeholder?: string;
  className?: string;
}) {
  return (
    <label className={`flex min-w-0 flex-col gap-2 ${className}`}>
      <span className="h-4 text-xs font-semibold leading-4 text-slate-500">
        {label}
      </span>

      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="!h-8 min-h-8 w-full rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 shadow-none outline-none focus:ring-4 focus:ring-blue-50 focus:ring-offset-0 data-[placeholder]:text-slate-500">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>

        <SelectContent className="rounded-xl border-slate-200 bg-white shadow-lg">
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              className="cursor-pointer text-sm font-medium"
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}