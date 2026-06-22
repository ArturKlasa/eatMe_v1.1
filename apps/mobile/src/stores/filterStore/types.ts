import { type SupportedCurrency } from '../../utils/currencyConfig';

/**
 * Vegetarian/vegan diet selector, shared by the daily (soft) and permanent (hard) layers.
 * 'all' means no diet constraint. Vegetarian/vegan are resolved against `primary_protein`
 * now that dish-level dietary_tags/allergens are retired.
 * See docs/plans/abandon-allergens-dietary.md §3.5.
 */
export type DietPreference = 'all' | 'vegetarian' | 'vegan';

/**
 * Daily (session-scoped) filter state.
 *
 * These are the quick-pick filters visible in the map filter sheet.
 * They reset on each app session (not persisted to the database) and
 * represent the user's mood for today's meal, as opposed to the hard
 * dietary constraints stored in `PermanentFilters`.
 */
export interface DailyFilters {
  // Price range filter ($10 - $50 slider)
  priceRange: {
    min: number;
    max: number;
  };

  // Cuisine types selection (multiple choice)
  cuisineTypes: string[];

  // Dish/meal selection (multiple choice)
  meals: string[];

  // Diet preference (single-select SOFT signal — re-ranks the feed, never excludes).
  // 'all' = no daily diet boost. See §3.5 hard/soft contract.
  dietPreference: DietPreference;

  // Protein types (multiple choice: meat, fish, seafood, egg)
  proteinTypes: {
    meat: boolean;
    fish: boolean;
    seafood: boolean;
    egg: boolean;
  };

  // Meat sub-types (only relevant when proteinTypes.meat is true)
  meatTypes: {
    chicken: boolean;
    beef: boolean;
    pork: boolean;
    lamb: boolean;
    goat: boolean;
    other: boolean;
  };

  // Spice level (single choice: no spicy, either way, i like spicy)
  spiceLevel: 'noSpicy' | 'eitherWay' | 'iLikeSpicy';

  // Calorie range (optional slider)
  calorieRange: {
    min: number;
    max: number;
    enabled: boolean;
  };

  // Distance/radius (how far willing to go)
  maxDistance: number;

  // Open now toggle
  openNow: boolean;

  // Sort by preference
  sortBy: 'closest' | 'bestMatch' | 'highestRated';

  // Group / Family Meals — show only dishes with serves >= 2
  groupMeals: boolean;

  // Schedule type filter — show only daily/rotating menus, or all (undefined)
  scheduleType: 'daily' | 'rotating' | undefined;
}

// Permanent Filters - Profile-level, stored in user settings
export interface PermanentFilters {
  // 1. Diet preference (HARD filter — excludes non-matching dishes from the feed).
  dietPreference: DietPreference;

  // 2. Exclude (multiple selection). Protein-family exclusions + spice. HARD filter.
  exclude: {
    noMeat: boolean;
    noFish: boolean;
    noSeafood: boolean;
    noEggs: boolean;
    noSpicy: boolean;
  };

  defaultPriceRange: {
    min: number;
    max: number;
  };
  cuisinePreferences: string[];
  defaultNutrition: {
    maxCalories: number;
    lowSodium: boolean;
    highProtein: boolean;
    enabled: boolean;
  };
  notifications: {
    dailyMenuAlerts: boolean;
    nearbyPromos: boolean;
    newRestaurants: boolean;
  };
}

// Combined filter state
export interface FilterState {
  daily: DailyFilters;
  permanent: PermanentFilters;
  activePreset: string | null;
}

// Actions interface
export interface FilterActions {
  // Daily filter actions
  setDailyPriceRange: (min: number, max: number) => void;
  toggleDailyCuisine: (cuisine: string) => void;
  setDailyCuisines: (cuisines: string[]) => void;
  toggleDailyMeal: (meal: string) => void;
  setDailyMeals: (meals: string[]) => void;
  setDietPreference: (preference: DietPreference) => void;
  toggleProteinType: (protein: keyof DailyFilters['proteinTypes']) => void;
  toggleMeatType: (meatType: keyof DailyFilters['meatTypes']) => void;
  setSpiceLevel: (level: DailyFilters['spiceLevel']) => void;
  setDailyCalorieRange: (min: number, max: number, enabled?: boolean) => void;
  setDailyMaxDistance: (distance: number) => void;
  toggleOpenNow: () => void;
  toggleGroupMeals: () => void;
  setSortBy: (sortBy: DailyFilters['sortBy']) => void;
  /** Replaces the entire daily filter state atomically (used by the daily filter modal on Apply). */
  replaceDailyFilters: (filters: DailyFilters) => void;

  // Permanent filter actions
  setPermanentDietPreference: (preference: PermanentFilters['dietPreference']) => void;
  toggleExclude: (exclusion: keyof PermanentFilters['exclude']) => void;
  setPermanentPriceRange: (min: number, max: number) => void;
  setCuisinePreferences: (cuisines: string[]) => void;
  setDefaultNutrition: (nutrition: Partial<PermanentFilters['defaultNutrition']>) => void;
  toggleNotification: (notification: keyof PermanentFilters['notifications']) => void;

  // Preset actions
  applyPreset: (preset: string) => void;
  clearActivePreset: () => void;

  // Reset actions
  resetDailyFilters: () => void;
  resetPermanentFilters: () => void;
  resetAllFilters: () => void;

  /**
   * Re-initialises the daily price range slider to the correct defaults for
   * the given currency. Call this when GPS detection updates the currency so
   * the slider immediately reflects local prices.
   */
  setCurrencyPriceRange: (currency: SupportedCurrency) => void;

  // Persistence actions
  loadFilters: () => Promise<void>;
  saveFilters: () => Promise<void>;
  /**
   * Saves permanent filters to AsyncStorage AND to Supabase if the user is
   * authenticated. Called by all permanent-filter toggle actions.
   */
  savePermanentFilters: () => Promise<void>;

  // Database sync actions (for authenticated users)
  lastSyncedAt: number | null;
  loadPreferencesFromDB: (userId: string) => Promise<void>;
  savePreferencesToDB: (userId: string) => Promise<void>;
  syncWithDatabase: (userId: string | null) => Promise<void>;

  // Utility actions
  getDailyFilterCount: () => number;
  getPermanentFilterCount: () => number;
  hasDailyFilters: () => boolean;
  hasPermanentFilters: () => boolean;
}
