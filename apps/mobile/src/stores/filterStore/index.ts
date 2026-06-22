/**
 * Filter Store - Zustand-based state management for food filters
 *
 * Two-tier filter system:
 * - Daily Filters: Quick, session-based choices (reset often)
 * - Permanent Filters: Profile-level settings (hard constraints, rarely changed)
 */

import { create } from 'zustand';
import { defaultFilterState } from './defaults';
import { createDailyActionsSlice } from './daily-actions';
import { createPermanentActionsSlice } from './permanent-actions';
import { createDbSyncSlice } from './db-sync';
import { createPersistenceSlice } from './persistence';
import { createSelectorsSlice } from './selectors';
import type { FilterState, FilterActions } from './types';

/**
 * Filter Store using Zustand
 *
 * Two-tier filter system with separate daily and permanent filters
 */
export const useFilterStore = create<FilterState & FilterActions>((set, get) => ({
  // Initial state
  ...defaultFilterState,
  ...createDailyActionsSlice(set, get),
  ...createPermanentActionsSlice(set, get),
  ...createDbSyncSlice(set, get),
  ...createPersistenceSlice(set, get),
  ...createSelectorsSlice(set, get),
}));

// Re-export barrel — every symbol consumers import from `filterStore` (D-09)
export { defaultDailyFilters, getDefaultDailyFilters, DAILY_FILTER_PRESETS } from './defaults';
export type { DailyFilters, PermanentFilters, DietPreference, FilterState } from './types';
