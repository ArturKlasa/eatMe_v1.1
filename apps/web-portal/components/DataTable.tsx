'use client';

import { Fragment, ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
} from '@/components/ui/pagination';

export interface ColumnDef<T> {
  key: keyof T | string;
  header: string;
  render?: (value: unknown, row: T) => ReactNode;
  width?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  onRowClick?: (row: T) => void;
  actions?: (row: T) => ReactNode;
  emptyState?: ReactNode;
  loading?: boolean;
  pagination?: { page: number; totalPages: number; onPageChange: (p: number) => void };
  expandable?: {
    rowKey: (row: T) => string;
    expandedId: string | null;
    onToggle: (id: string) => void;
    renderContent: (row: T) => ReactNode;
  };
}

export function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  onRowClick,
  actions,
  emptyState,
  loading = false,
  pagination,
  expandable,
}: DataTableProps<T>) {
  if (loading) {
    return <LoadingSkeleton variant="table" />;
  }

  if (data.length === 0) {
    return (
      <>
        {emptyState ?? (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
            No items found.
          </div>
        )}
      </>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/30">
            {expandable && <th className="w-8" />}
            {columns.map(col => (
              <th
                key={String(col.key)}
                className="px-4 py-3 text-left font-medium text-muted-foreground"
                style={col.width ? { width: col.width } : undefined}
              >
                {col.header}
              </th>
            ))}
            {actions && (
              <th className="px-4 py-3 text-right font-medium text-muted-foreground w-24">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIdx) => {
            const rowId = expandable?.rowKey(row);
            const isExpanded = expandable ? expandable.expandedId === rowId : false;
            const colSpan = columns.length + (actions ? 1 : 0) + (expandable ? 1 : 0);
            return (
              <Fragment key={rowIdx}>
                <tr
                  className={cn(
                    'border-b transition-colors',
                    !isExpanded && 'last:border-b-0',
                    onRowClick && 'cursor-pointer hover:bg-accent/50'
                  )}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {expandable && rowId && (
                    <td className="pl-3 pr-1 align-middle">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          expandable.onToggle(rowId);
                        }}
                        className="p-1 text-muted-foreground hover:bg-accent rounded"
                        title={isExpanded ? 'Collapse' : 'Expand'}
                        aria-label={isExpanded ? 'Collapse row' : 'Expand row'}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                    </td>
                  )}
                  {columns.map(col => (
                    <td key={String(col.key)} className="px-4 py-3 text-foreground align-middle">
                      {col.render
                        ? col.render((row as Record<string, unknown>)[col.key as string], row)
                        : String((row as Record<string, unknown>)[col.key as string] ?? '')}
                    </td>
                  ))}
                  {actions && <td className="px-4 py-3 text-right align-middle">{actions(row)}</td>}
                </tr>
                {isExpanded && expandable && (
                  <tr className="border-b last:border-b-0 bg-muted/20">
                    <td colSpan={colSpan} className="px-4 py-4">
                      {expandable.renderContent(row)}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-end px-4 py-3 border-t">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => pagination.onPageChange(pagination.page - 1)}
                  aria-disabled={pagination.page <= 1}
                  className={
                    pagination.page <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'
                  }
                />
              </PaginationItem>
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                .filter(
                  p => p === 1 || p === pagination.totalPages || Math.abs(p - pagination.page) <= 1
                )
                .map((p, idx, arr) => (
                  <PaginationItem key={p}>
                    {idx > 0 && arr[idx - 1] !== p - 1 && (
                      <span className="px-2 text-muted-foreground">...</span>
                    )}
                    <PaginationLink
                      onClick={() => pagination.onPageChange(p)}
                      isActive={p === pagination.page}
                      className="cursor-pointer"
                    >
                      {p}
                    </PaginationLink>
                  </PaginationItem>
                ))}
              <PaginationItem>
                <PaginationNext
                  onClick={() => pagination.onPageChange(pagination.page + 1)}
                  aria-disabled={pagination.page >= pagination.totalPages}
                  className={
                    pagination.page >= pagination.totalPages
                      ? 'pointer-events-none opacity-50'
                      : 'cursor-pointer'
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
