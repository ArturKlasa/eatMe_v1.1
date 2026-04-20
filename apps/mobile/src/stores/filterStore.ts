/**
 * Filter Store - Zustand-based state management for food filters
 *
 * Two-tier filter system:
 * - Daily Filters: Quick, session-based choices (reset often)
 * - Permanent Filters: Profile-level settings (hard constraints, rarely changed)
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { debugLog } from '../config/environment';
import {
  loadUserPreferences,
  saveUserPreferences,
  permanentFiltersToDb,
  dbToPermanentFilters,
} from '../services/userPreferencesService';
import { getPriceRangeForCurrency, type SupportedCurrency } from '../utils/currencyConfig';

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

  // Diet preference (multi-select: vegetarian, vegan)
  dietPreference: {
    vegetarian: boolean;
    vegan: boolean;
  };

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
    duck: boolean;
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

/** A single ingredient entry in the "Ingredients to Avoid" permanent filter. */
export interface IngredientToAvoid {
  /**
   * ingredient_concepts.id — the primary match key after Phase 6A cutover.
   * Optional during the transition so existing user preferences (which only
   * carry canonicalIngredientId) keep working. New entries always include
   * both; legacy entries get `conceptId` populated lazily on next write.
   */
  conceptId?: string;
  /** canonical_ingredients.id — legacy match key. Still used as a fallback when conceptId is absent. */
  canonicalIngredientId: string;
  /** Display name shown in the UI without a join */
  displayName: string;
}

// Permanent Filters - Profile-level, stored in user settings
export interface PermanentFilters {
  // 1. Diet preference (only one can be selected)
  dietPreference: 'all' | 'vegetarian' | 'vegan';

  // 2. Exclude (multiple selection)
  exclude: {
    noMeat: boolean;
    noFish: boolean;
    noSeafood: boolean;
    noEggs: boolean;
    noDairy: boolean;
    noSpicy: boolean;
  };

  // 3. Allergies (multiple selection)
  allergies: {
    lactose: boolean;
    gluten: boolean;
    peanuts: boolean;
    soy: boolean;
    sesame: boolean;
    shellfish: boolean;
    nuts: boolean;
  };

  // 4. Diet preference types (multiple selection)
  dietTypes: {
    diabetic: boolean;
    keto: boolean;
    paleo: boolean;
    lowCarb: boolean;
    pescatarian: boolean;
  };

  // 5. Religious restrictions (multiple selection)
  religiousRestrictions: {
    halal: boolean;
    hindu: boolean;
    kosher: boolean;
    jain: boolean;
    buddhist: boolean;
  };

  // 6. Restaurant facilities (multiple selection)
  facilities: {
    familyFriendly: boolean;
    wheelchairAccessible: boolean;
    petFriendly: boolean;
    lgbtAccessible: boolean;
    kidsMenu: boolean;
  };

  // 7. Ingredients to avoid — keyed by canonical_ingredient_id so filters
  //    can match against dish_ingredients without string comparisons.
  ingredientsToAvoid: IngredientToAvoid[];

  // 8. Primary protein preference — single-select, null means no preference.
  primaryProtein: string | null;

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
interface FilterActions {
  // Daily filter actions
  setDailyPriceRange: (min: number, max: number) => void;
  toggleDailyCuisine: (cuisine: string) => void;
  setDailyCuisines: (cuisines: string[]) => void;
  toggleDailyMeal: (meal: string) => void;
  setDailyMeals: (meals: string[]) => void;
  setDietPreference: (key: keyof DailyFilters['dietPreference']) => void;
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
  toggleAllergy: (allergy: keyof PermanentFilters['allergies']) => void;
  toggleDietType: (dietType: keyof PermanentFilters['dietTypes']) => void;
  toggleReligiousRestriction: (
    restriction: keyof PermanentFilters['religiousRestrictions']
  ) => void;
  toggleFacility: (facility: keyof PermanentFilters['facilities']) => void;
  addIngredientToAvoid: (ingredient: IngredientToAvoid) => void;
  removeIngredientToAvoid: (canonicalIngredientId: string) => void;
  setPrimaryProtein: (protein: string | null) => void;
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
   * the given currency. Call this after autoDetectCurrency() resolves so the
   * slider immediately reflects local prices.
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

// Default daily filters (USD baseline — see getDefaultDailyFilters() for currency-aware defaults)
export const defaultDailyFilters: DailyFilters = {
  priceRange: {
    min: 10, // 10 USD: cheapest street food / quick-service item
    max: 50, // 50 USD: casual sit-down restaurant meal
  },
  cuisineTypes: [],
  meals: [],
  dietPreference: {
    vegetarian: false,
    vegan: false,
  },
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
    duck: false,
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
const defaultPermanentFilters: PermanentFilters = {
  dietPreference: 'all',
  exclude: {
    noMeat: false,
    noFish: false,
    noSeafood: false,
    noEggs: false,
    noDairy: false,
    noSpicy: false,
  },
  allergies: {
    lactose: false,
    gluten: false,
    peanuts: false,
    soy: false,
    sesame: false,
    shellfish: false,
    nuts: false,
  },
  dietTypes: {
    diabetic: false,
    keto: false,
    paleo: false,
    lowCarb: false,
    pescatarian: false,
  },
  religiousRestrictions: {
    halal: false,
    hindu: false,
    kosher: false,
    jain: false,
    buddhist: false,
  },
  facilities: {
    familyFriendly: false,
    wheelchairAccessible: false,
    petFriendly: false,
    lgbtAccessible: false,
    kidsMenu: false,
  },
  ingredientsToAvoid: [],
  primaryProtein: null,
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
const defaultFilterState: FilterState = {
  daily: defaultDailyFilters,
  permanent: defaultPermanentFilters,
  activePreset: null,
};

// Quick filter presets for daily filters
const DAILY_FILTER_PRESETS = {
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
const DAILY_STORAGE_KEY = '@eatme_daily_filters';
const PERMANENT_STORAGE_KEY = '@eatme_permanent_filters';
const LAST_SYNCED_STORAGE_KEY = '@eatme_last_synced_at';

// Debounce timer for saveFilters (500ms) — prevents excessive AsyncStorage writes on rapid slider movement
let _saveFiltersTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Filter Store using Zustand
 *
 * Two-tier filter system with separate daily and permanent filters
 */
export const useFilterStore = create<FilterState & FilterActions>((set, get) => ({
  // Initial state
  ...defaultFilterState,
  lastSyncedAt: null,

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

  setDietPreference: (key: keyof DailyFilters['dietPreference']) => {
    set(state => ({
      daily: {
        ...state.daily,
        dietPreference: {
          ...state.daily.dietPreference,
          [key]: !state.daily.dietPreference[key],
        },
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

  // Permanent filter actions
  setPermanentDietPreference: (preference: PermanentFilters['dietPreference']) => {
    set(state => ({
      permanent: {
        ...state.permanent,
        dietPreference: preference,
      },
    }));
    get().savePermanentFilters();
  },

  toggleExclude: (exclusion: keyof PermanentFilters['exclude']) => {
    set(state => ({
      permanent: {
        ...state.permanent,
        exclude: {
          ...state.permanent.exclude,
          [exclusion]: !state.permanent.exclude[exclusion],
        },
      },
    }));
    get().savePermanentFilters();
  },

  toggleAllergy: (allergy: keyof PermanentFilters['allergies']) => {
    set(state => ({
      permanent: {
        ...state.permanent,
        allergies: {
          ...state.permanent.allergies,
          [allergy]: !state.permanent.allergies[allergy],
        },
      },
    }));
    get().savePermanentFilters();
  },

  toggleDietType: (dietType: keyof PermanentFilters['dietTypes']) => {
    set(state => ({
      permanent: {
        ...state.permanent,
        dietTypes: {
          ...state.permanent.dietTypes,
          [dietType]: !state.permanent.dietTypes[dietType],
        },
      },
    }));
    get().savePermanentFilters();
  },

  toggleReligiousRestriction: (restriction: keyof PermanentFilters['religiousRestrictions']) => {
    set(state => ({
      permanent: {
        ...state.permanent,
        religiousRestrictions: {
          ...state.permanent.religiousRestrictions,
          [restriction]: !state.permanent.religiousRestrictions[restriction],
        },
      },
    }));
    get().savePermanentFilters();
  },

  toggleFacility: (facility: keyof PermanentFilters['facilities']) => {
    set(state => ({
      permanent: {
        ...state.permanent,
        facilities: {
          ...state.permanent.facilities,
          [facility]: !state.permanent.facilities[facility],
        },
      },
    }));
    get().savePermanentFilters();
  },

  addIngredientToAvoid: (ingredient: IngredientToAvoid) => {
    set(state => ({
      permanent: {
        ...state.permanent,
        ingredientsToAvoid: [...state.permanent.ingredientsToAvoid, ingredient],
      },
    }));
    get().savePermanentFilters();
  },

  removeIngredientToAvoid: (canonicalIngredientId: string) => {
    set(state => ({
      permanent: {
        ...state.permanent,
        ingredientsToAvoid: state.permanent.ingredientsToAvoid.filter(
          i => i.canonicalIngredientId !== canonicalIngredientId
        ),
      },
    }));
    get().savePermanentFilters();
  },

  setPrimaryProtein: (protein: string | null) => {
    set(state => ({
      permanent: {
        ...state.permanent,
        primaryProtein: protein,
      },
    }));
    get().savePermanentFilters();
  },

  setPermanentPriceRange: (min: number, max: number) => {
    set(state => ({
      permanent: {
        ...state.permanent,
        defaultPriceRange: { min, max },
      },
    }));
    get().saveFilters();
  },

  setCuisinePreferences: (cuisines: string[]) => {
    set(state => ({
      permanent: {
        ...state.permanent,
        cuisinePreferences: cuisines,
      },
    }));
    get().saveFilters();
  },

  setDefaultNutrition: (nutrition: Partial<PermanentFilters['defaultNutrition']>) => {
    set(state => ({
      permanent: {
        ...state.permanent,
        defaultNutrition: {
          ...state.permanent.defaultNutrition,
          ...nutrition,
        },
      },
    }));
    get().saveFilters();
  },

  toggleNotification: (notification: keyof PermanentFilters['notifications']) => {
    set(state => ({
      permanent: {
        ...state.permanent,
        notifications: {
          ...state.permanent.notifications,
          [notification]: !state.permanent.notifications[notification],
        },
      },
    }));
    get().saveFilters();
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
        return require('./settingsStore').useSettingsStore.getState().currency as SupportedCurrency;
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

  resetPermanentFilters: () => {
    set(state => ({
      permanent: { ...defaultPermanentFilters },
    }));
    get().savePermanentFilters();
  },

  resetAllFilters: () => {
    set({ ...defaultFilterState });
    get().savePermanentFilters();
  },

  // Persistence actions
  loadFilters: async () => {
    try {
      // Daily filters are session-only — always start from defaults.
      // Remove any stale key that may have been saved by older app versions.
      await AsyncStorage.removeItem(DAILY_STORAGE_KEY);

      const [permanentStored, lastSyncedStored] = await Promise.all([
        AsyncStorage.getItem(PERMANENT_STORAGE_KEY),
        AsyncStorage.getItem(LAST_SYNCED_STORAGE_KEY),
      ]);

      if (permanentStored) {
        const parsedPermanent = JSON.parse(permanentStored);
        set(state => ({
          ...state,
          daily: getDefaultDailyFilters(
            (() => {
              try {
                return require('./settingsStore').useSettingsStore.getState()
                  .currency as SupportedCurrency;
              } catch {
                return undefined;
              }
            })()
          ), // ensure daily is always reset on load with correct currency
          permanent: { ...defaultPermanentFilters, ...parsedPermanent },
        }));
        debugLog(
          'Loaded permanent filters from storage; daily filters reset to currency-aware defaults'
        );
      } else {
        // No permanent filters saved yet — still reset daily to be safe
        set(state => ({ ...state, daily: { ...defaultDailyFilters } }));
      }

      // Restore lastSyncedAt so the 30-min debounce survives app restarts
      if (lastSyncedStored) {
        set({ lastSyncedAt: Number(lastSyncedStored) });
        debugLog('[FilterStore] Restored lastSyncedAt from storage:', Number(lastSyncedStored));
      }
    } catch (error) {
      debugLog('Failed to load filters from storage:', error);
    }
  },

  saveFilters: () => {
    // Debounce: coalesce rapid calls (e.g. slider dragging) into a single AsyncStorage write
    if (_saveFiltersTimer !== null) {
      clearTimeout(_saveFiltersTimer);
    }
    _saveFiltersTimer = setTimeout(async () => {
      _saveFiltersTimer = null;
      try {
        // Daily filters are session-only — only permanent filters and sync timestamp are persisted.
        const currentState = get();
        const writes: Promise<void>[] = [
          AsyncStorage.setItem(PERMANENT_STORAGE_KEY, JSON.stringify(currentState.permanent)),
        ];
        if (currentState.lastSyncedAt !== null) {
          writes.push(
            AsyncStorage.setItem(LAST_SYNCED_STORAGE_KEY, String(currentState.lastSyncedAt))
          );
        }
        await Promise.all(writes);
        debugLog('Saved permanent filters and sync timestamp to storage');
      } catch (error) {
        debugLog('Failed to save filters to storage:', error);
      }
    }, 500);
    return Promise.resolve();
  },

  // Database sync actions (for authenticated users)
  loadPreferencesFromDB: async (userId: string) => {
    try {
      debugLog('[FilterStore] Loading preferences from database...');
      const result = await loadUserPreferences(userId);

      if (!result.ok) {
        console.error('[FilterStore] Failed to load preferences from DB:', result.error);
        return;
      }

      if (result.data) {
        // Convert DB format to filterStore format and merge with current state
        const dbFilters = dbToPermanentFilters(result.data);
        set(state => ({
          permanent: {
            ...state.permanent,
            ...dbFilters,
          },
        }));
        debugLog('[FilterStore] Loaded preferences from database');
      } else {
        debugLog('[FilterStore] No preferences found in database (first time user)');
      }
    } catch (error) {
      console.error('[FilterStore] Unexpected error loading from DB:', error);
    }
  },

  savePreferencesToDB: async (userId: string) => {
    try {
      debugLog('[FilterStore] Saving preferences to database...');
      const currentState = get();
      const dbPrefs = permanentFiltersToDb(currentState.permanent);

      const result = await saveUserPreferences(userId, dbPrefs);

      if (!result.ok) {
        console.error('[FilterStore] Failed to save preferences to DB:', result.error);
        return;
      }

      debugLog('[FilterStore] Saved preferences to database');
    } catch (error) {
      console.error('[FilterStore] Unexpected error saving to DB:', error);
    }
  },

  syncWithDatabase: async (userId: string | null) => {
    if (!userId) {
      debugLog('[FilterStore] No user ID, skipping database sync');
      return;
    }

    // Load preferences from database on app start/login
    await get().loadPreferencesFromDB(userId);
    const syncTime = Date.now();
    set({ lastSyncedAt: syncTime });
    // Persist immediately so next app restart sees the correct timestamp
    try {
      await AsyncStorage.setItem(LAST_SYNCED_STORAGE_KEY, String(syncTime));
    } catch (e) {
      debugLog('[FilterStore] Failed to persist lastSyncedAt:', e);
    }
  },

  // Helper: Save filters locally AND to database if user is authenticated
  savePermanentFilters: async () => {
    const state = get();
    await state.saveFilters(); // Save to AsyncStorage

    // Also save to database if user is authenticated
    // We'll get the user from authStore
    try {
      const { useAuthStore: getAuthStore } = await import('./authStore');
      const user = getAuthStore.getState().user;
      if (user?.id) {
        await state.savePreferencesToDB(user.id);
      }
    } catch (error) {
      // Auth store might not be ready yet, that's okay
      debugLog('[FilterStore] Could not auto-save to DB:', error);
    }
  },

  // Utility actions
  getDailyFilterCount: () => {
    const state = get();
    let count = 0;

    // Check price range against the currency-aware defaults so a fresh, untouched
    // slider never inflates the badge count.
    const currency = (() => {
      try {
        return require('./settingsStore').useSettingsStore.getState().currency as SupportedCurrency;
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

    // Check diet preference (any enabled)
    if (Object.values(state.daily.dietPreference).some(Boolean)) {
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

    // Check allergies
    const activeAllergies = Object.values(state.permanent.allergies).filter(Boolean);
    if (activeAllergies.length > 0) {
      count++;
    }

    // Check diet types
    const activeDietTypes = Object.values(state.permanent.dietTypes).filter(Boolean);
    if (activeDietTypes.length > 0) {
      count++;
    }

    // Check religious restrictions
    const activeReligious = Object.values(state.permanent.religiousRestrictions).filter(Boolean);
    if (activeReligious.length > 0) {
      count++;
    }

    // Check facilities
    const activeFacilities = Object.values(state.permanent.facilities).filter(Boolean);
    if (activeFacilities.length > 0) {
      count++;
    }

    // Check ingredients to avoid
    if (state.permanent.ingredientsToAvoid.length > 0) {
      count++;
    }

    // Check primary protein preference
    if (state.permanent.primaryProtein !== null) {
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
}));

// Export presets for use in components
export { DAILY_FILTER_PRESETS };
