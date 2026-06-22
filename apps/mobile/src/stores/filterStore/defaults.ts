import { getPriceRangeForCurrency, type SupportedCurrency } from '../../utils/currencyConfig';
import type { DailyFilters, PermanentFilters, FilterState } from './types';

// Default daily filters (USD baseline — see getDefaultDailyFilters() for currency-aware defaults)
export const defaultDailyFilters: DailyFilters = {
  priceRange: {
    min: 10, // 10 USD: cheapest street food / quick-service item
    max: 50, // 50 USD: casual sit-down restaurant meal
  },
  cuisineTypes: [],
  meals: [],
  dietPreference: 'all',
  proteinTypes: {
    meat: false,
    fish: false,
    seafood: false,
    egg: false,
  },
  meatTypes: {
    chicken: false,
    beef: false,
    pork: false,
    lamb: false,
    goat: false,
    other: false,
  },
  spiceLevel: 'eitherWay',
  calorieRange: {
    min: 200, // 200 kcal: small snack or side dish
    max: 800, // 800 kcal: full restaurant entrée
    enabled: false,
  },
  maxDistance: 5, // 5km default
  openNow: false,
  sortBy: 'bestMatch',
  groupMeals: false,
  scheduleType: undefined,
};

/**
 * Returns a fresh DailyFilters object with the price range initialised
 * for the given currency code. Falls back to USD defaults.
 *
 * Call this instead of spreading `defaultDailyFilters` whenever you want
 * currency-aware price range defaults (e.g., on reset or first load).
 */
export function getDefaultDailyFilters(currency?: SupportedCurrency): DailyFilters {
  const priceRange = currency ? getPriceRangeForCurrency(currency) : defaultDailyFilters.priceRange;
  return {
    ...defaultDailyFilters,
    priceRange,
  };
}

// Default permanent filters
export const defaultPermanentFilters: PermanentFilters = {
  dietPreference: 'all',
  exclude: {
    noMeat: false,
    noFish: false,
    noSeafood: false,
    noEggs: false,
    noSpicy: false,
  },
  defaultPriceRange: {
    min: 10,
    max: 50,
  },
  cuisinePreferences: [],
  defaultNutrition: {
    maxCalories: 2000,
    lowSodium: false,
    highProtein: false,
    enabled: false,
  },
  notifications: {
    dailyMenuAlerts: true,
    nearbyPromos: true,
    newRestaurants: false,
  },
};

// Default filter state
export const defaultFilterState: FilterState = {
  daily: defaultDailyFilters,
  permanent: defaultPermanentFilters,
  activePreset: null,
};

// Quick filter presets for daily filters
export const DAILY_FILTER_PRESETS = {
  nearby: {
    name: 'Nearby',
    filters: {
      maxDistance: 2,
      sortBy: 'closest' as const,
    },
  },
  cheapEats: {
    name: 'Cheap Eats',
    filters: {
      priceRange: { min: 10, max: 20 },
      maxDistance: 5,
    },
  },
  healthy: {
    name: 'Healthy',
    filters: {
      calorieRange: { min: 200, max: 600, enabled: true },
      dietToggle: {
        meat: false,
        fish: true,
        vegetarian: true,
        vegan: true,
      },
    },
  },
  openNow: {
    name: 'Open Now',
    filters: {
      openNow: true,
      sortBy: 'closest' as const,
    },
  },
};

// Storage keys
export const DAILY_STORAGE_KEY = '@eatme_daily_filters';
export const PERMANENT_STORAGE_KEY = '@eatme_permanent_filters';
export const LAST_SYNCED_STORAGE_KEY = '@eatme_last_synced_at';
