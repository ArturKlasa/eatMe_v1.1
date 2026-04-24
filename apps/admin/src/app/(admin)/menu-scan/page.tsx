import Link from 'next/link';
import { verifyAdminSession } from '@/lib/auth/dal';
import { getAdminMenuScanJobs, getAdminRestaurantOptions } from '@/lib/auth/dal';
import { AdminBatchUploadForm } from './AdminBatchUploadForm';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  needs_review: 'bg-orange-100 text-orange-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-700';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {status}
    </span>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function MenuScanPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  await verifyAdminSession();

  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const status = sp.status ?? undefined;

  const [{ rows, total }, restaurantOptions] = await Promise.all([
    getAdminMenuScanJobs({ status, page }),
    getAdminRestaurantOptions(),
  ]);

  const totalPages = Math.ceil(total / 50);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Menu Scan Jobs</h1>
        <p className="text-sm text-muted-foreground">{total} total</p>
      </div>

      <AdminBatchUploadForm restaurantOptions={restaurantOptions} />

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {['', 'pending', 'processing', 'needs_review', 'completed', 'failed'].map(s => (
          <Link
            key={s}
            href={s ? `/menu-scan?status=${s}` : '/menu-scan'}
            className={[
              'rounded-full px-3 py-1 text-xs font-medium border transition-colors',
              status === s || (!status && s === '')
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border hover:bg-muted',
            ].join(' ')}
          >
            {s || 'All'}
          </Link>
        ))}
      </div>

      {/* Jobs table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Job ID</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Restaurant</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Attempts</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Created</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">
                  No scan jobs found.
                </td>
              </tr>
            )}
            {rows.map(job => (
              <tr key={job.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {job.id.slice(0, 8)}…
                </td>
                <td className="px-4 py-3">
                  {job.restaurant_name ? (
                    <Link
                      href={`/restaurants/${job.restaurant_id}`}
                      className="text-primary hover:underline"
                    >
                      {job.restaurant_name}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground text-xs font-mono">
                      {job.restaurant_id.slice(0, 8)}…
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={job.status} />
                </td>
                <td className="px-4 py-3 tabular-nums">{job.attempts}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {formatDate(job.created_at)}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/menu-scan/${job.id}`}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center gap-2 justify-end">
          {page > 1 && (
            <Link
              href={`/menu-scan?page=${page - 1}${status ? `&status=${status}` : ''}`}
              className="rounded border border-border px-3 py-1.5 text-xs hover:bg-muted"
            >
              Previous
            </Link>
          )}
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={`/menu-scan?page=${page + 1}${status ? `&status=${status}` : ''}`}
              className="rounded border border-border px-3 py-1.5 text-xs hover:bg-muted"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
