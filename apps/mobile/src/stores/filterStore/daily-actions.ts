import type { StoreApi } from 'zustand';
import { debugLog } from '../../config/environment';
import { getPriceRangeForCurrency, type SupportedCurrency } from '../../utils/currencyConfig';
import { getDefaultDailyFilters, DAILY_FILTER_PRESETS } from './defaults';
import type { DailyFilters, DietPreference, FilterState, FilterActions } from './types';

type FilterStore = FilterState & FilterActions;
type Set = StoreApi<FilterStore>['setState'];
type Get = StoreApi<FilterStore>['getState'];

export const createDailyActionsSlice = (set: Set, get: Get) => ({
  // Daily filter actions
  setDailyPriceRange: (min: number, max: number) => {
    set(state => ({
      daily: {
        ...state.daily,
        priceRange: { min, max },
      },
      activePreset: null,
    }));
    get().saveFilters();
  },

  toggleDailyCuisine: (cuisine: string) => {
    set(state => ({
      daily: {
        ...state.daily,
        cuisineTypes: state.daily.cuisineTypes.includes(cuisine)
          ? state.daily.cuisineTypes.filter(c => c !== cuisine)
          : [...state.daily.cuisineTypes, cuisine],
      },
      activePreset: null,
    }));
    get().saveFilters();
  },

  setDailyCuisines: (cuisines: string[]) => {
    set(state => ({
      daily: {
        ...state.daily,
        cuisineTypes: cuisines,
      },
      activePreset: null,
    }));
    get().saveFilters();
  },

  toggleDailyMeal: (meal: string) => {
    set(state => ({
      daily: {
        ...state.daily,
        meals: state.daily.meals.includes(meal)
          ? state.daily.meals.filter(m => m !== meal)
          : [...state.daily.meals, meal],
      },
      activePreset: null,
    }));
    get().saveFilters();
  },

  setDailyMeals: (meals: string[]) => {
    set(state => ({
      daily: {
        ...state.daily,
        meals,
      },
      activePreset: null,
    }));
    get().saveFilters();
  },

  setDietPreference: (preference: DietPreference) => {
    set(state => ({
      daily: {
        ...state.daily,
        dietPreference: preference,
      },
      activePreset: null,
    }));
    get().saveFilters();
  },

  toggleProteinType: (protein: keyof DailyFilters['proteinTypes']) => {
    set(state => ({
      daily: {
        ...state.daily,
        proteinTypes: {
          ...state.daily.proteinTypes,
          [protein]: !state.daily.proteinTypes[protein],
        },
      },
      activePreset: null,
    }));
    get().saveFilters();
  },

  toggleMeatType: (meatType: keyof DailyFilters['meatTypes']) => {
    set(state => ({
      daily: {
        ...state.daily,
        meatTypes: {
          ...state.daily.meatTypes,
          [meatType]: !state.daily.meatTypes[meatType],
        },
      },
      activePreset: null,
    }));
    get().saveFilters();
  },

  setSpiceLevel: (level: DailyFilters['spiceLevel']) => {
    set(state => ({
      daily: {
        ...state.daily,
        spiceLevel: level,
      },
      activePreset: null,
    }));
    get().saveFilters();
  },

  setDailyCalorieRange: (min: number, max: number, enabled = true) => {
    set(state => ({
      daily: {
        ...state.daily,
        calorieRange: { min, max, enabled },
      },
      activePreset: null,
    }));
    get().saveFilters();
  },

  setDailyMaxDistance: (distance: number) => {
    set(state => ({
      daily: {
        ...state.daily,
        maxDistance: distance,
      },
      activePreset: null,
    }));
    get().saveFilters();
  },

  toggleOpenNow: () => {
    set(state => ({
      daily: {
        ...state.daily,
        openNow: !state.daily.openNow,
      },
      activePreset: null,
    }));
    get().saveFilters();
  },

  toggleGroupMeals: () => {
    set(state => ({
      daily: {
        ...state.daily,
        groupMeals: !state.daily.groupMeals,
      },
      activePreset: null,
    }));
    get().saveFilters();
  },

  setSortBy: (sortBy: DailyFilters['sortBy']) => {
    set(state => ({
      daily: {
        ...state.daily,
        sortBy,
      },
      activePreset: null,
    }));
    get().saveFilters();
  },

  replaceDailyFilters: (filters: DailyFilters) => {
    // Atomically replace all daily filters (called when user presses Apply in the modal).
    // Intentionally NOT saved to AsyncStorage — daily filters are session-only and
    // reset to defaults the next time the modal is opened.
    set({ daily: { ...filters }, activePreset: null });
  },

  // Preset actions
  applyPreset: (presetKey: string) => {
    const preset = DAILY_FILTER_PRESETS[presetKey as keyof typeof DAILY_FILTER_PRESETS];
    if (!preset) {
      debugLog('Unknown preset:', presetKey);
      return;
    }

    debugLog('Applying preset:', preset.name);

    set(state => ({
      daily: {
        ...state.daily,
        ...preset.filters,
      },
      activePreset: presetKey,
    }));
    get().saveFilters();
  },

  clearActivePreset: () => {
    set({ activePreset: null });
    get().saveFilters();
  },

  // Reset actions
  resetDailyFilters: () => {
    // Use the current currency from settingsStore for sensible price range defaults
    const currency = (() => {
      try {
        return require('../settingsStore').useSettingsStore.getState()
          .currency as SupportedCurrency;
      } catch {
        return undefined;
      }
    })();
    set(() => ({
      daily: getDefaultDailyFilters(currency),
      activePreset: null,
    }));
    get().saveFilters();
  },

  setCurrencyPriceRange: (currency: SupportedCurrency) => {
    const priceRange = getPriceRangeForCurrency(currency);
    set(state => ({
      daily: { ...state.daily, priceRange },
    }));
    debugLog('[FilterStore] Price range updated for currency:', currency, priceRange);
    get().saveFilters();
  },
});
