"use client";

import React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Pagination from "./paginationComp";

type TableAlign = "left" | "center" | "right";
type SortOrder = "asc" | "desc";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function getTextAlignClass(align: TableAlign = "left") {
  if (align === "center") return "text-center";
  if (align === "right") return "text-right";
  return "text-left";
}

function getJustifyClass(align: TableAlign = "left") {
  if (align === "center") return "justify-center";
  if (align === "right") return "justify-end";
  return "justify-start";
}

export interface AdminTableColumn<T> {
  id: string;
  header: React.ReactNode;
  render: (row: T, index: number) => React.ReactNode;
  sortable?: boolean;
  sortField?: string;
  align?: TableAlign;
  headerClassName?: string;
  cellClassName?: string;
  widthClassName?: string;
}

export interface AdminTablePaginationConfig {
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
}

export interface AdminTableExpandable<T> {
  expandedRowId: string | null;
  onToggle: (rowId: string, row: T) => void;
  renderExpandedRow: (row: T) => React.ReactNode;
  canExpand?: (row: T) => boolean;
  expandedRowClassName?: string;
  expandedCellClassName?: string;
}

export interface AdminTableActions<T> {
  header?: React.ReactNode;
  render: (row: T, index: number) => React.ReactNode;
  align?: TableAlign;
  headerClassName?: string;
  cellClassName?: string;
}

export interface AdminTableProps<T> {
  data: T[];
  columns: AdminTableColumn<T>[];
  rowKey: (row: T, index: number) => string;

  loading?: boolean;
  loadingRows?: number;
  error?: string | null;

  emptyTitle?: string;
  emptyDescription?: string;

  sortBy?: string;
  sortOrder?: SortOrder;
  onSort?: (field: string) => void;

  expandable?: AdminTableExpandable<T>;
  actions?: AdminTableActions<T>;
  pagination?: AdminTablePaginationConfig;

  onRowClick?: (row: T, rowId: string) => void;
  rowClassName?: (
    row: T,
    index: number,
    isExpanded: boolean
  ) => string;

  className?: string;
  containerClassName?: string;
  tableClassName?: string;
  bodyClassName?: string;
  headerRowClassName?: string;

  /**
   * Controls the scrollable table area's height.
   * You can override this from individual pages.
   */
  scrollAreaClassName?: string;
}

function SortHead({
  label,
  field,
  sortable,
  sortBy,
  sortOrder,
  align = "left",
  headerClassName,
  onSort,
}: {
  label: React.ReactNode;
  field: string;
  sortable?: boolean;
  sortBy?: string;
  sortOrder?: SortOrder;
  align?: TableAlign;
  headerClassName?: string;
  onSort?: (field: string) => void;
}) {
  const isActive = sortable && sortBy === field;

  return (
    <TableHead
      className={cx(
        "sticky top-0 z-20",
        "border-r border-b border-slate-200 last:border-r-0",
        "bg-slate-50",
        "px-4 py-4",
        "text-xs font-bold uppercase tracking-[0.14em] text-slate-600",
        getTextAlignClass(align),
        sortable && "cursor-pointer select-none hover:bg-slate-100",
        headerClassName
      )}
      onClick={sortable && onSort ? () => onSort(field) : undefined}
    >
      <div
        className={cx(
          "flex items-center gap-1 whitespace-nowrap",
          getJustifyClass(align)
        )}
      >
        {label}

        {isActive ? (
          <span className="text-slate-600">
            {sortOrder === "asc" ? "↑" : "↓"}
          </span>
        ) : null}
      </div>
    </TableHead>
  );
}

function SkeletonRows({
  rows,
  colSpan,
}: {
  rows: number;
  colSpan: number;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <TableRow
          key={rowIndex}
          className="border-b border-slate-200 last:border-b-0"
        >
          {Array.from({ length: colSpan }).map((__, cellIndex) => (
            <TableCell
              key={cellIndex}
              className={cx(
                "border-r border-slate-200 px-4 py-4 last:border-r-0"
              )}
            >
              <div className="h-4 w-full animate-pulse rounded-full bg-slate-100" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

export default function AdminTable<T>({
  data,
  columns,
  rowKey,
  loading = false,
  loadingRows = 6,
  error = null,
  emptyTitle = "",
  emptyDescription = "Try adjusting filters or refreshing the data.",
  sortBy,
  sortOrder = "desc",
  onSort,
  expandable,
  actions,
  pagination,
  onRowClick,
  rowClassName,
  className,
  containerClassName,
  tableClassName,
  bodyClassName,
  headerRowClassName,
  scrollAreaClassName = "max-h-[calc(100vh-260px)]",
}: AdminTableProps<T>) {
  const hasExpandable = Boolean(expandable);
  const hasActions = Boolean(actions);

  const totalColumns =
    columns.length +
    (hasExpandable ? 1 : 0) +
    (hasActions ? 1 : 0);

  return (
    <div
      className={cx(
        "flex min-h-0 w-full flex-col overflow-hidden",
        className
      )}
    >
      {error ? (
        <div className="mx-4 mt-4 shrink-0 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 md:mx-5">
          {error}
        </div>
      ) : null}

      <div
        className={cx(
          "flex min-h-0 flex-1 flex-col overflow-hidden",
          "rounded-xl border border-slate-200 bg-white shadow-sm",
          containerClassName
        )}
      >
        <div
          className={cx(
            "min-h-0 w-full overflow-auto overscroll-contain",
            scrollAreaClassName
          )}
        >
          <Table
            className={cx(
              "min-w-max border-separate border-spacing-0",
              tableClassName
            )}
          >
            <TableHeader className="sticky top-0 z-20 bg-slate-50">
              <TableRow
                className={cx(
                  "border-0 hover:bg-transparent",
                  headerRowClassName
                )}
              >
                {hasExpandable ? (
                  <TableHead
                    className={cx(
                      "sticky top-0 z-20 w-10",
                      "border-r border-b border-slate-200",
                      "bg-slate-50 px-4 py-4"
                    )}
                  />
                ) : null}

                {columns.map((column) => (
                  <SortHead
                    key={column.id}
                    label={column.header}
                    field={column.sortField || column.id}
                    sortable={column.sortable}
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    align={column.align}
                    headerClassName={cx(
                      column.widthClassName,
                      column.headerClassName
                    )}
                    onSort={onSort}
                  />
                ))}

                {hasActions ? (
                  <TableHead
                    className={cx(
                      "sticky top-0 z-20",
                      "border-b border-l border-slate-200",
                      "bg-slate-50 px-4 py-4",
                      "text-xs font-bold uppercase tracking-[0.14em] text-slate-600",
                      getTextAlignClass(actions?.align || "right"),
                      actions?.headerClassName
                    )}
                  >
                    <div
                      className={cx(
                        "flex items-center whitespace-nowrap",
                        getJustifyClass(actions?.align || "right")
                      )}
                    >
                      {actions?.header || "Actions"}
                    </div>
                  </TableHead>
                ) : null}
              </TableRow>
            </TableHeader>

            <TableBody className={bodyClassName}>
              {loading ? (
                <SkeletonRows
                  rows={loadingRows}
                  colSpan={totalColumns}
                />
              ) : null}

              {!loading && data.length === 0 ? (
                <TableRow className="border-b border-slate-200">
                  <TableCell
                    colSpan={totalColumns}
                    className="border-r-0 px-6 py-12 text-center"
                  >
                    <div className="mx-auto max-w-md space-y-2">
                      {emptyTitle ? (
                        <p className="text-base font-semibold text-slate-800">
                          {emptyTitle}
                        </p>
                      ) : null}

                      <p className="text-sm font-medium text-slate-500">
                        {emptyDescription}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : null}

              {!loading &&
                data.map((row, index) => {
                  const id = rowKey(row, index);

                  const canExpand = expandable?.canExpand
                    ? expandable.canExpand(row)
                    : Boolean(expandable);

                  const isExpanded =
                    canExpand &&
                    expandable?.expandedRowId === id;

                  const isClickable = Boolean(
                    onRowClick || (expandable && canExpand)
                  );

                  return (
                    <React.Fragment key={id}>
                      <TableRow
                        className={cx(
                          "border-0 transition-colors",
                          "[&>td]:border-b [&>td]:border-slate-200",
                          isClickable && "cursor-pointer",
                          isExpanded
                            ? "bg-slate-50"
                            : isClickable
                              ? "hover:bg-slate-50/70"
                              : "hover:bg-slate-50/40",
                          rowClassName?.(
                            row,
                            index,
                            Boolean(isExpanded)
                          )
                        )}
                        onClick={() => {
                          if (onRowClick) {
                            onRowClick(row, id);
                            return;
                          }

                          if (expandable && canExpand) {
                            expandable.onToggle(id, row);
                          }
                        }}
                      >
                        {hasExpandable ? (
                          <TableCell
                            className={cx(
                              "border-r border-slate-200",
                              "px-4 py-4"
                            )}
                          >
                            {canExpand ? (
                              isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-slate-500" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-slate-400" />
                              )
                            ) : null}
                          </TableCell>
                        ) : null}

                        {columns.map((column) => (
                          <TableCell
                            key={column.id}
                            className={cx(
                              "border-r border-slate-200",
                              "px-4 py-4 last:border-r-0",
                              getTextAlignClass(column.align),
                              column.widthClassName,
                              column.cellClassName
                            )}
                          >
                            {column.render(row, index)}
                          </TableCell>
                        ))}

                        {hasActions ? (
                          <TableCell
                            className={cx(
                              "border-l border-slate-200",
                              "px-4 py-4",
                              getTextAlignClass(
                                actions?.align || "right"
                              ),
                              actions?.cellClassName
                            )}
                            onClick={(event) =>
                              event.stopPropagation()
                            }
                          >
                            {actions?.render(row, index)}
                          </TableCell>
                        ) : null}
                      </TableRow>

                      {isExpanded && expandable ? (
                        <TableRow className="border-0">
                          <TableCell
                            colSpan={totalColumns}
                            className={cx(
                              "border-b border-slate-200",
                              "bg-slate-50/70 px-6 py-5",
                              expandable.expandedCellClassName,
                              expandable.expandedRowClassName
                            )}
                          >
                            {expandable.renderExpandedRow(row)}
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </React.Fragment>
                  );
                })}
            </TableBody>
          </Table>
        </div>
      </div>

      {pagination ? (
        <div className="shrink-0">
          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            totalItems={pagination.totalItems}
            limit={pagination.limit}
            onPageChange={pagination.onPageChange}
            onLimitChange={pagination.onLimitChange}
            rowOptions={pagination.rowOptions}
            loading={pagination.loading ?? loading}
            className={pagination.className}
            showRowsSelector={pagination.showRowsSelector}
            showSummary={pagination.showSummary}
          />
        </div>
      ) : null}
    </div>
  );
}