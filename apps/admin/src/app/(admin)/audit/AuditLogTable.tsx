'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { AdminAuditLogRow } from '@/lib/auth/dal';

interface Filters {
  actor: string;
  action: string;
  date_from: string;
  date_to: string;
}

interface Props {
  rows: AdminAuditLogRow[];
  total: number;
  page: number;
  filters: Filters;
}

const PAGE_SIZE = 50;

export function AuditLogTable({ rows, total, page, filters }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [localFilters, setLocalFilters] = useState(filters);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function navigate(patch: Partial<Filters & { page: string }>) {
    const merged = { ...localFilters, page: String(page), ...patch };
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) {
      if (v) sp.set(k, v);
    }
    startTransition(() => {
      router.replace(`/audit?${sp.toString()}`);
    });
  }

  function handleFilterChange(field: keyof Filters, value: string) {
    const updated = { ...localFilters, [field]: value };
    setLocalFilters(updated);
  }

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    navigate({ ...localFilters, page: '1' });
  }

  return (
    <div className={`space-y-4 ${isPending ? 'opacity-60 pointer-events-none' : ''}`}>
      <form onSubmit={applyFilters} className="flex flex-wrap gap-2 items-end">
        <div>
          <label htmlFor="audit-actor" className="block text-xs text-muted-foreground mb-1">
            Actor email
          </label>
          <input
            id="audit-actor"
            type="text"
            value={localFilters.actor}
            onChange={e => handleFilterChange('actor', e.target.value)}
            placeholder="admin@example.com"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm w-52"
          />
        </div>

        <div>
          <label htmlFor="audit-action" className="block text-xs text-muted-foreground mb-1">
            Action
          </label>
          <input
            id="audit-action"
            type="text"
            value={localFilters.action}
            onChange={e => handleFilterChange('action', e.target.value)}
            placeholder="csv_import"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm w-40"
          />
        </div>

        <div>
          <label htmlFor="audit-from" className="block text-xs text-muted-foreground mb-1">
            From date
          </label>
          <input
            id="audit-from"
            type="date"
            value={localFilters.date_from}
            onChange={e => handleFilterChange('date_from', e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>

        <div>
          <label htmlFor="audit-to" className="block text-xs text-muted-foreground mb-1">
            To date
          </label>
          <input
            id="audit-to"
            type="date"
            value={localFilters.date_to}
            onChange={e => handleFilterChange('date_to', e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>

        <button
          type="submit"
          className="h-9 rounded-md bg-primary text-primary-foreground px-4 text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Filter
        </button>

        {(filters.actor || filters.action || filters.date_from || filters.date_to) && (
          <button
            type="button"
            onClick={() => {
              const cleared = { actor: '', action: '', date_from: '', date_to: '' };
              setLocalFilters(cleared);
              navigate({ ...cleared, page: '1' });
            }}
            className="h-9 rounded-md border border-border px-4 text-sm hover:bg-muted transition-colors"
          >
            Clear
          </button>
        )}
      </form>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Timestamp</th>
              <th className="px-4 py-2 text-left font-medium">Actor</th>
              <th className="px-4 py-2 text-left font-medium">Action</th>
              <th className="px-4 py-2 text-left font-medium">Resource</th>
              <th className="px-4 py-2 text-left font-medium w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(row => (
              <tr key={row.id} className="hover:bg-muted/30">
                <td className="px-4 py-2 text-muted-foreground text-xs whitespace-nowrap">
                  {new Date(row.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-2 text-xs truncate max-w-48">{row.admin_email}</td>
                <td className="px-4 py-2">
                  <span className="inline-block rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                    {row.action}
                  </span>
                </td>
                <td className="px-4 py-2 text-xs text-muted-foreground">
                  {row.resource_type}
                  {row.resource_id && (
                    <span className="ml-1 font-mono text-[11px]">
                      {row.resource_id.slice(0, 8)}…
                    </span>
                  )}
                </td>
                <td className="px-4 py-2">
                  {(row.new_data != null || row.old_data != null) && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        data
                      </summary>
                      <pre className="mt-1 text-[11px] bg-muted p-2 rounded max-w-sm overflow-x-auto">
                        {JSON.stringify(
                          { old: row.old_data as unknown, new: row.new_data as unknown },
                          null,
                          2
                        )}
                      </pre>
                    </details>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No audit log entries found.
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
              disabled={page <= 1}
              className="rounded border border-border px-3 py-1 hover:bg-muted disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => navigate({ page: String(page + 1) })}
              disabled={page >= totalPages}
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
