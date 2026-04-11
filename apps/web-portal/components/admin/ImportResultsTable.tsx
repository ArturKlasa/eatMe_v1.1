import Link from 'next/link';
import { ScanLine, ExternalLink } from 'lucide-react';
import type { ImportedRestaurantSummary } from '@/lib/import-types';
import { RestaurantWarningBadge } from '@/components/admin/RestaurantWarningBadge';

interface ImportResultsTableProps {
  restaurants: ImportedRestaurantSummary[];
}

function statusOrder(r: ImportedRestaurantSummary): number {
  if (r.error) return 0;            // errors first
  if (r.warnings.length > 0) return 1; // flagged second
  if (r.skipped) return 3;          // skipped last
  return 2;                          // clean imported third
}

export function ImportResultsTable({ restaurants }: ImportResultsTableProps) {
  if (restaurants.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        No restaurants to display.
      </p>
    );
  }

  const sorted = [...restaurants].sort((a, b) => statusOrder(a) - statusOrder(b));

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">
              Address
            </th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Warnings</th>
            <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sorted.map((r, idx) => (
            <tr key={`${r.id}-${idx}`} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 font-medium text-gray-900 max-w-[200px] truncate">
                {r.name}
              </td>
              <td className="px-4 py-3 text-gray-600 hidden md:table-cell max-w-[220px] truncate">
                {r.address || '—'}
              </td>
              <td className="px-4 py-3">
                {r.error ? (
                  <span
                    title={r.error}
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 cursor-help"
                  >
                    Error
                  </span>
                ) : r.skipped ? (
                  <span
                    title={r.skipReason ?? 'Skipped'}
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 cursor-help"
                  >
                    Skipped
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                    Imported
                  </span>
                )}
              </td>
              <td className="px-4 py-3">
                <RestaurantWarningBadge warnings={r.warnings} />
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-2">
                  {!r.skipped && r.id && (
                    <>
                      <Link
                        href={`/admin/menu-scan?restaurant_id=${r.id}`}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-orange-700 bg-orange-50 hover:bg-orange-100 rounded transition-colors"
                        title="Scan menu for this restaurant"
                      >
                        <ScanLine className="h-3 w-3" />
                        Scan Menu
                      </Link>
                      <Link
                        href={`/admin/restaurants/${r.id}/edit`}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                        title="View restaurant details"
                      >
                        <ExternalLink className="h-3 w-3" />
                        View
                      </Link>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
