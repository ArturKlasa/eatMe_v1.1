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

// Daily Filters - Quick, session-based choices
export interface DailyFilters {
  // Price range filter (1 = $, 2 = $$, 3 = $$$, 4 = $$$$)
  priceRange: {
    min: number;
    max: number;
  };

  // Cuisine types selection (multiple choice)
  cuisineTypes: string[];

  // Diet toggle options
  dietToggle: {
    meat: boolean;
    fish: boolean;
    vegetarian: boolean;
    vegan: boolean;
  };

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
}

// Permanent Filters - Profile-level, stored in user settings
export interface PermanentFilters {
  // Allergies (hard constraints)
  allergies: {
    nuts: boolean;
    dairy: boolean;
    gluten: boolean;
    shellfish: boolean;
    eggs: boolean;
    soy: boolean;
  };

  // Religious/Cultural requirements (hard constraints)
  religiousCultural: {
    halal: boolean;
    kosher: boolean;
    jain: boolean;
    buddhist: boolean;
  };

  // Strict diet type (hard constraint)
  strictDietType: 'none' | 'vegetarian' | 'vegan' | 'pescatarian';

  // Ingredient exclusions (hard constraints)
  ingredientExclusions: string[]; // e.g., ["cilantro", "mushrooms"]

  // Disliked flavors/ingredients (soft exclusions)
  dislikedIngredients: string[];

  // Permanent price sensitivity (default for daily filters)
  defaultPriceRange: {
    min: number;
    max: number;
  };

  // Cuisine preferences (favorite cuisines ranked)
  cuisinePreferences: string[];

  // Accessibility requirements
  accessibility: {
    wheelchairAccessible: boolean;
    hearingImpaired: boolean;
    visuallyImpaired: boolean;
  };

  // Default calorie/nutrition preferences
  defaultNutrition: {
    maxCalories: number;
    lowSodium: boolean;
    highProtein: boolean;
    enabled: boolean;
  };

  // Notification preferences
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
  toggleDietToggle: (diet: keyof DailyFilters['dietToggle']) => void;
  setDailyCalorieRange: (min: number, max: number, enabled?: boolean) => void;
  setDailyMaxDistance: (distance: number) => void;
  toggleOpenNow: () => void;
  setSortBy: (sortBy: DailyFilters['sortBy']) => void;

  // Permanent filter actions
  toggleAllergy: (allergy: keyof PermanentFilters['allergies']) => void;
  toggleReligiousCultural: (requirement: keyof PermanentFilters['religiousCultural']) => void;
  setStrictDietType: (dietType: PermanentFilters['strictDietType']) => void;
  addIngredientExclusion: (ingredient: string) => void;
  removeIngredientExclusion: (ingredient: string) => void;
  addDislikedIngredient: (ingredient: string) => void;
  removeDislikedIngredient: (ingredient: string) => void;
  setPermanentPriceRange: (min: number, max: number) => void;
  setCuisinePreferences: (cuisines: string[]) => void;
  toggleAccessibility: (requirement: keyof PermanentFilters['accessibility']) => void;
  setDefaultNutrition: (nutrition: Partial<PermanentFilters['defaultNutrition']>) => void;
  toggleNotification: (notification: keyof PermanentFilters['notifications']) => void;

  // Preset actions
  applyPreset: (preset: string) => void;
  clearActivePreset: () => void;

  // Reset actions
  resetDailyFilters: () => void;
  resetPermanentFilters: () => void;
  resetAllFilters: () => void;

  // Persistence actions
  loadFilters: () => Promise<void>;
  saveFilters: () => Promise<void>;

  // Utility actions
  getDailyFilterCount: () => number;
  getPermanentFilterCount: () => number;
  hasDailyFilters: () => boolean;
  hasPermanentFilters: () => boolean;
}

// Default daily filters
const defaultDailyFilters: DailyFilters = {
  priceRange: {
    min: 1,
    max: 4,
  },
  cuisineTypes: [],
  dietToggle: {
    meat: true,
    fish: true,
    vegetarian: true,
    vegan: true,
  },
  calorieRange: {
    min: 200,
    max: 800,
    enabled: false,
  },
  maxDistance: 5, // 5km default
  openNow: false,
  sortBy: 'bestMatch',
};

// Default permanent filters
const defaultPermanentFilters: PermanentFilters = {
  allergies: {
    nuts: false,
    dairy: false,
    gluten: false,
    shellfish: false,
    eggs: false,
    soy: false,
  },
  religiousCultural: {
    halal: false,
    kosher: false,
    jain: false,
    buddhist: false,
  },
  strictDietType: 'none',
  ingredientExclusions: [],
  dislikedIngredients: [],
  defaultPriceRange: {
    min: 1,
    max: 4,
  },
  cuisinePreferences: [],
  accessibility: {
    wheelchairAccessible: false,
    hearingImpaired: false,
    visuallyImpaired: false,
  },
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
      priceRange: { min: 1, max: 2 },
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

/**
 * Filter Store using Zustand
 *
 * Two-tier filter system with separate daily and permanent filters
 */
export const useFilterStore = create<FilterState & FilterActions>((set, get) => ({
  // Initial state
  ...defaultFilterState,

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

  toggleDietToggle: (diet: keyof DailyFilters['dietToggle']) => {
    set(state => ({
      daily: {
        ...state.daily,
        dietToggle: {
          ...state.daily.dietToggle,
          [diet]: !state.daily.dietToggle[diet],
        },
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

  // Permanent filter actions
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
    get().saveFilters();
  },

  toggleReligiousCultural: (requirement: keyof PermanentFilters['religiousCultural']) => {
    set(state => ({
      permanent: {
        ...state.permanent,
        religiousCultural: {
          ...state.permanent.religiousCultural,
          [requirement]: !state.permanent.religiousCultural[requirement],
        },
      },
    }));
    get().saveFilters();
  },

  setStrictDietType: (dietType: PermanentFilters['strictDietType']) => {
    set(state => ({
      permanent: {
        ...state.permanent,
        strictDietType: dietType,
      },
    }));
    get().saveFilters();
  },

  addIngredientExclusion: (ingredient: string) => {
    set(state => ({
      permanent: {
        ...state.permanent,
        ingredientExclusions: [...state.permanent.ingredientExclusions, ingredient],
      },
    }));
    get().saveFilters();
  },

  removeIngredientExclusion: (ingredient: string) => {
    set(state => ({
      permanent: {
        ...state.permanent,
        ingredientExclusions: state.permanent.ingredientExclusions.filter(i => i !== ingredient),
      },
    }));
    get().saveFilters();
  },

  addDislikedIngredient: (ingredient: string) => {
    set(state => ({
      permanent: {
        ...state.permanent,
        dislikedIngredients: [...state.permanent.dislikedIngredients, ingredient],
      },
    }));
    get().saveFilters();
  },

  removeDislikedIngredient: (ingredient: string) => {
    set(state => ({
      permanent: {
        ...state.permanent,
        dislikedIngredients: state.permanent.dislikedIngredients.filter(i => i !== ingredient),
      },
    }));
    get().saveFilters();
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

  toggleAccessibility: (requirement: keyof PermanentFilters['accessibility']) => {
    set(state => ({
      permanent: {
        ...state.permanent,
        accessibility: {
          ...state.permanent.accessibility,
          [requirement]: !state.permanent.accessibility[requirement],
        },
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
    set(state => ({
      daily: { ...defaultDailyFilters },
      activePreset: null,
    }));
    get().saveFilters();
  },

  resetPermanentFilters: () => {
    set(state => ({
      permanent: { ...defaultPermanentFilters },
    }));
    get().saveFilters();
  },

  resetAllFilters: () => {
    set({ ...defaultFilterState });
    get().saveFilters();
  },

  // Persistence actions
  loadFilters: async () => {
    try {
      const [dailyStored, permanentStored] = await Promise.all([
        AsyncStorage.getItem(DAILY_STORAGE_KEY),
        AsyncStorage.getItem(PERMANENT_STORAGE_KEY),
      ]);

      let updates: Partial<FilterState> = {};

      if (dailyStored) {
        const parsedDaily = JSON.parse(dailyStored);
        updates.daily = { ...defaultDailyFilters, ...parsedDaily };
      }

      if (permanentStored) {
        const parsedPermanent = JSON.parse(permanentStored);
        updates.permanent = { ...defaultPermanentFilters, ...parsedPermanent };
      }

      if (Object.keys(updates).length > 0) {
        set(state => ({ ...state, ...updates }));
        debugLog('Loaded filters from storage');
      }
    } catch (error) {
      debugLog('Failed to load filters from storage:', error);
    }
  },

  saveFilters: async () => {
    try {
      const currentState = get();
      await Promise.all([
        AsyncStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify(currentState.daily)),
        AsyncStorage.setItem(PERMANENT_STORAGE_KEY, JSON.stringify(currentState.permanent)),
      ]);
      debugLog('Saved filters to storage');
    } catch (error) {
      debugLog('Failed to save filters to storage:', error);
    }
  },

  // Utility actions
  getDailyFilterCount: () => {
    const state = get();
    let count = 0;

    // Check price range (not default)
    if (state.daily.priceRange.min !== 1 || state.daily.priceRange.max !== 4) {
      count++;
    }

    // Check cuisines
    if (state.daily.cuisineTypes.length > 0) {
      count++;
    }

    // Check diet toggles (not all enabled)
    const allDietEnabled = Object.values(state.daily.dietToggle).every(Boolean);
    if (!allDietEnabled) {
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

    // Check sort by (not default)
    if (state.daily.sortBy !== 'bestMatch') {
      count++;
    }

    return count;
  },

  getPermanentFilterCount: () => {
    const state = get();
    let count = 0;

    // Check allergies
    const activeAllergies = Object.values(state.permanent.allergies).filter(Boolean);
    if (activeAllergies.length > 0) {
      count++;
    }

    // Check religious/cultural requirements
    const activeReligious = Object.values(state.permanent.religiousCultural).filter(Boolean);
    if (activeReligious.length > 0) {
      count++;
    }

    // Check strict diet type
    if (state.permanent.strictDietType !== 'none') {
      count++;
    }

    // Check ingredient exclusions
    if (state.permanent.ingredientExclusions.length > 0) {
      count++;
    }

    // Check disliked ingredients
    if (state.permanent.dislikedIngredients.length > 0) {
      count++;
    }

    // Check accessibility requirements
    const activeAccessibility = Object.values(state.permanent.accessibility).filter(Boolean);
    if (activeAccessibility.length > 0) {
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
