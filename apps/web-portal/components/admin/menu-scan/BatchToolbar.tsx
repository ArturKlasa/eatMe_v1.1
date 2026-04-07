'use client';

import { useState } from 'react';
import { Check, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DISH_KINDS } from '@/lib/constants';
import type { EditableDish } from '@/lib/menu-scan';

interface BatchToolbarProps {
  totalGroups: number;
  reviewedCount: number;
  selectedIds: Set<string>;
  onAcceptAll: () => void;
  onAcceptHighConfidence: (threshold: number) => void;
  onAcceptSelected: () => void;
  onRejectSelected: () => void;
  filters: BatchFilters;
  onFiltersChange: (filters: BatchFilters) => void;
}

export interface BatchFilters {
  confidenceMin: number | null;
  dishKind: string | null;
  hasGrouping: boolean | null;
}

export function BatchToolbar({
  totalGroups,
  reviewedCount,
  selectedIds,
  onAcceptAll,
  onAcceptHighConfidence,
  onAcceptSelected,
  onRejectSelected,
  filters,
  onFiltersChange,
}: BatchToolbarProps) {
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="sticky top-0 z-10 bg-white border-b shadow-sm px-4 py-2 space-y-2">
      <div className="flex items-center justify-between gap-2">
        {/* Progress counter */}
        <span className="text-sm text-gray-600">
          <span className="font-medium">{reviewedCount}</span> of{' '}
          <span className="font-medium">{totalGroups}</span> groups reviewed
        </span>

        <div className="flex items-center gap-2">
          {/* Batch actions */}
          {selectedIds.size > 0 && (
            <>
              <Button size="sm" variant="outline" onClick={onAcceptSelected}>
                <Check className="h-3 w-3 mr-1" />
                Accept selected ({selectedIds.size})
              </Button>
              <Button size="sm" variant="outline" onClick={onRejectSelected} className="text-red-600">
                Reject selected ({selectedIds.size})
              </Button>
            </>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={() => onAcceptHighConfidence(0.85)}
          >
            Accept all high-confidence
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowFilters(!showFilters)}
            className={showFilters ? 'bg-gray-100' : ''}
          >
            <Filter className="h-3 w-3 mr-1" />
            Filter
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      {showFilters && (
        <div className="flex items-center gap-3 text-xs">
          <label className="flex items-center gap-1">
            Min confidence:
            <select
              value={filters.confidenceMin ?? ''}
              onChange={e =>
                onFiltersChange({
                  ...filters,
                  confidenceMin: e.target.value ? parseFloat(e.target.value) : null,
                })
              }
              className="border rounded px-1 py-0.5"
            >
              <option value="">All</option>
              <option value="0.3">30%+</option>
              <option value="0.5">50%+</option>
              <option value="0.6">60%+</option>
              <option value="0.85">85%+</option>
            </select>
          </label>

          <label className="flex items-center gap-1">
            Dish kind:
            <select
              value={filters.dishKind ?? ''}
              onChange={e =>
                onFiltersChange({
                  ...filters,
                  dishKind: e.target.value || null,
                })
              }
              className="border rounded px-1 py-0.5"
            >
              <option value="">All</option>
              {DISH_KINDS.map(k => (
                <option key={k.value} value={k.value}>
                  {k.icon} {k.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-1">
            Grouping:
            <select
              value={filters.hasGrouping === null ? '' : filters.hasGrouping ? 'grouped' : 'standalone'}
              onChange={e =>
                onFiltersChange({
                  ...filters,
                  hasGrouping:
                    e.target.value === '' ? null : e.target.value === 'grouped',
                })
              }
              className="border rounded px-1 py-0.5"
            >
              <option value="">All</option>
              <option value="grouped">Grouped</option>
              <option value="standalone">Standalone</option>
            </select>
          </label>

          <Button
            size="sm"
            variant="ghost"
            className="text-xs"
            onClick={() =>
              onFiltersChange({ confidenceMin: null, dishKind: null, hasGrouping: null })
            }
          >
            Clear filters
          </Button>
        </div>
      )}
    </div>
  );
}
