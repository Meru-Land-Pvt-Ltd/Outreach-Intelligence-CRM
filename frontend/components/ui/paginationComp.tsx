"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PaginationProps = {
  page: number;
  totalPages: number;
  totalItems: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  rowOptions?: readonly number[];
  loading?: boolean;
  className?: string;
  showRowsSelector?: boolean;
  showSummary?: boolean;
};

const Pagination = ({
  page,
  totalPages,
  totalItems,
  limit,
  onPageChange,
  loading = false,
  className,
  showSummary = true,
}: PaginationProps) => {
  const safePage = Math.max(1, page);
  const safeTotalPages = Math.max(1, totalPages);

  const loadedItems = Math.min(safePage * limit, totalItems);
  const hasMore = safePage < safeTotalPages && loadedItems < totalItems;

  if (totalItems === 0) return null;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 border-t border-slate-200 px-5 py-5",
        className
      )}
    >

      <Button
        type="button"
        disabled={loading || !hasMore}
        onClick={() => onPageChange(safePage + 1)}
        className={cn(
          "min-w-[160px] rounded-full px-6 font-bold",
          hasMore
            ? "bg-slate-900 text-white hover:bg-slate-800"
            : "bg-slate-200 text-slate-500 hover:bg-slate-200"
        )}
      >
        {loading ? "Loading..." : hasMore ? "Load More" : "All Loaded"}
      </Button>
    </div>
  );
};

export default Pagination;