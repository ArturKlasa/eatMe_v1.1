/**
 * useFilters Hook
 *
 * Generic multi-filter hook with AND logic: returns items that satisfy every
 * active filter entry. A filter is "active" when its value is a non-empty string,
 * so inactive filters incur no runtime cost.
 */

import { useMemo } from "react";

type FilterFn<T> = (item: T, value: string) => boolean;

export interface FilterEntry<T> {
  value: string; // current filter value (empty string = inactive)
  fn: FilterFn<T>; // predicate — called only when value is non-empty
}

/**
 * Returns items passing ALL active filters (AND logic).
 * A filter is "active" when its value is a non-empty string.
 */
export function useFilters<T>(items: T[], filters: FilterEntry<T>[]): T[] {
  return useMemo(() => {
    const activeFilters = filters.filter((f) => f.value !== "");
    if (activeFilters.length === 0) return items;
    return items.filter((item) =>
      activeFilters.every((f) => f.fn(item, f.value))
    );
  }, [items, filters]);
}
