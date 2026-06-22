import type { StoreApi } from 'zustand';
import { type SupportedCurrency } from '../../utils/currencyConfig';
import { getDefaultDailyFilters } from './defaults';
import type { FilterState, FilterActions } from './types';

type FilterStore = FilterState & FilterActions;
type Set = StoreApi<FilterStore>['setState'];
type Get = StoreApi<FilterStore>['getState'];

export const createSelectorsSlice = (set: Set, get: Get) => ({
  // Utility actions
  getDailyFilterCount: () => {
    const state = get();
    let count = 0;

    // Check price range against the currency-aware defaults so a fresh, untouched
    // slider never inflates the badge count.
    const currency = (() => {
      try {
        return require('../settingsStore').useSettingsStore.getState()
          .currency as SupportedCurrency;
      } catch {
        return undefined;
      }
    })();
    const defaultPriceRange = getDefaultDailyFilters(currency).priceRange;
    if (
      state.daily.priceRange.min !== defaultPriceRange.min ||
      state.daily.priceRange.max !== defaultPriceRange.max
    ) {
      count++;
    }

    // Check cuisines
    if (state.daily.cuisineTypes.length > 0) {
      count++;
    }

    // Check meals/dishes (any selected)
    if (state.daily.meals.length > 0) {
      count++;
    }

    // Check diet preference (not 'all')
    if (state.daily.dietPreference !== 'all') {
      count++;
    }

    // Check protein types (any enabled)
    const hasProteinFilter = Object.values(state.daily.proteinTypes).some(Boolean);
    if (hasProteinFilter) {
      count++;
    }

    // Check spice level (not 'eitherWay')
    if (state.daily.spiceLevel !== 'eitherWay') {
      count++;
    }

    // Check calorie range (if enabled)
    if (state.daily.calorieRange.enabled) {
      count++;
    }

    // Check distance (not default)
    if (state.daily.maxDistance !== 5) {
      count++;
    }

    // Check open now
    if (state.daily.openNow) {
      count++;
    }

    // Check group/family meals
    if (state.daily.groupMeals) {
      count++;
    }

    // Check schedule type
    if (state.daily.scheduleType !== undefined) {
      count++;
    }

    // Check sort by (not default)
    if (state.daily.sortBy !== 'bestMatch') {
      count++;
    }

    return count;
  },

  getPermanentFilterCount: () => {
    const state = get();
    let count = 0;

    // Check diet preference (not 'all')
    if (state.permanent.dietPreference !== 'all') {
      count++;
    }

    // Check exclusions
    const activeExclusions = Object.values(state.permanent.exclude).filter(Boolean);
    if (activeExclusions.length > 0) {
      count++;
    }

    // Check default nutrition
    if (state.permanent.defaultNutrition.enabled) {
      count++;
    }

    return count;
  },

  hasDailyFilters: () => {
    return get().getDailyFilterCount() > 0;
  },

  hasPermanentFilters: () => {
    return get().getPermanentFilterCount() > 0;
  },
});
