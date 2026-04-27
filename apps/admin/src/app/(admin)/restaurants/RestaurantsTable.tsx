'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SearchFilterBar } from '@eatme/ui';
import type { AdminRestaurantRow } from '@/lib/auth/dal';

interface Filters {
  q: string;
  status: string;
  is_active: string;
  city: string;
}

interface Props {
  rows: AdminRestaurantRow[];
  total: number;
  page: number;
  filters: Filters;
}

const PAGE_SIZE = 50;

function statusBadgeClass(status: string) {
  if (status === 'published') return 'bg-green-100 text-green-800';
  if (status === 'draft') return 'bg-yellow-100 text-yellow-800';
  return 'bg-gray-100 text-gray-600';
}

export function RestaurantsTable({ rows, total, page, filters }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [inputValue, setInputValue] = useState(filters.q);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function navigate(patch: Partial<Filters & { page: string }>) {
    const merged = { ...filters, page: String(page), ...patch };
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) {
      if (v) sp.set(k, v);
    }
    startTransition(() => {
      router.replace(`/restaurants?${sp.toString()}`);
    });
  }

  // Debounce search navigation 400 ms
  useEffect(() => {
    if (inputValue === filters.q) return;
    const t = setTimeout(() => navigate({ q: inputValue, page: '1' }), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputValue]);

  // Sync input when RSC-driven filters change (e.g. browser back)
  useEffect(() => {
    setInputValue(filters.q);
  }, [filters.q]);

  return (
    <div className="space-y-4">
      <SearchFilterBar
        search={inputValue}
        onSearchChange={setInputValue}
        placeholder="Search restaurants…"
        className={isPending ? 'opacity-60 pointer-events-none' : ''}
      >
        <select
          value={filters.status}
          onChange={e => navigate({ status: e.target.value, page: '1' })}
          aria-label="Filter by status"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>

        <select
          value={filters.is_active}
          onChange={e => navigate({ is_active: e.target.value, page: '1' })}
          aria-label="Filter by suspension"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Active + suspended</option>
          <option value="true">Active only</option>
          <option value="false">Suspended only</option>
        </select>
      </SearchFilterBar>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Name</th>
              <th className="px-4 py-2 text-left font-medium w-32">City</th>
              <th className="px-4 py-2 text-left font-medium w-24">Status</th>
              <th className="px-4 py-2 text-left font-medium w-24">Active</th>
              <th className="px-4 py-2 text-left font-medium">Owner</th>
              <th className="px-4 py-2 text-left font-medium w-28">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(row => (
              <tr key={row.id} className="hover:bg-muted/30">
                <td className="px-4 py-2">
                  <Link href={`/restaurants/${row.id}`} className="font-medium hover:underline">
                    {row.name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-muted-foreground">{row.city ?? '—'}</td>
                <td className="px-4 py-2">
                  <span
                    className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${statusBadgeClass(row.status)}`}
                  >
                    {row.status}
                  </span>
                </td>
                <td className="px-4 py-2">
                  {row.is_active ? (
                    <span className="text-green-600 text-xs">Active</span>
                  ) : (
                    <span className="text-destructive text-xs font-medium">Suspended</span>
                  )}
                </td>
                <td className="px-4 py-2 text-muted-foreground text-xs truncate max-w-48">
                  {row.owner_email || row.owner_id || '—'}
                </td>
                <td className="px-4 py-2 text-muted-foreground text-xs" suppressHydrationWarning>
                  {row.created_at ? new Date(row.created_at).toLocaleDateString() : '—'}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No restaurants found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            Page {page} of {totalPages} ({total} total)
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => navigate({ page: String(page - 1) })}
              disabled={page <= 1 || isPending}
              className="rounded border border-border px-3 py-1 hover:bg-muted disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => navigate({ page: String(page + 1) })}
              disabled={page >= totalPages || isPending}
              className="rounded border border-border px-3 py-1 hover:bg-muted disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
