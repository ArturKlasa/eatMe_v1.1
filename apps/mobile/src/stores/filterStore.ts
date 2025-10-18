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
  // Price range filter ($10 - $50 slider)
  priceRange: {
    min: number;
    max: number;
  };

  // Cuisine types selection (multiple choice)
  cuisineTypes: string[];

  // Diet preference (single choice: all, vegetarian, vegan)
  dietPreference: 'all' | 'vegetarian' | 'vegan';

  // Protein types (multiple choice: meat, fish, seafood, egg)
  proteinTypes: {
    meat: boolean;
    fish: boolean;
    seafood: boolean;
    egg: boolean;
  };

  // Hunger level (single choice: on a diet, normal, starving)
  hungerLevel: 'diet' | 'normal' | 'starving';

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
  // 1. Diet preference (only one can be selected)
  dietPreference: 'all' | 'vegetarian' | 'vegan';

  // 2. Exclude (multiple selection)
  exclude: {
    noMeat: boolean;
    noFish: boolean;
    noSeafood: boolean;
    noEggs: boolean;
    noDairy: boolean;
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
  };

  // 6. Restaurant facilities (multiple selection)
  facilities: {
    familyFriendly: boolean;
    wheelchairAccessible: boolean;
    petFriendly: boolean;
    lgbtAccessible: boolean;
    kidsMenu: boolean;
  };

  // 7. Ingredients to avoid (list of ingredients)
  ingredientsToAvoid: string[];

  // Legacy fields for backward compatibility
  ingredientExclusions: string[];
  dislikedIngredients: string[];
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
  setDietPreference: (preference: DailyFilters['dietPreference']) => void;
  toggleProteinType: (protein: keyof DailyFilters['proteinTypes']) => void;
  setHungerLevel: (level: DailyFilters['hungerLevel']) => void;
  setDailyCalorieRange: (min: number, max: number, enabled?: boolean) => void;
  setDailyMaxDistance: (distance: number) => void;
  toggleOpenNow: () => void;
  setSortBy: (sortBy: DailyFilters['sortBy']) => void;

  // Permanent filter actions
  setPermanentDietPreference: (preference: PermanentFilters['dietPreference']) => void;
  toggleExclude: (exclusion: keyof PermanentFilters['exclude']) => void;
  toggleAllergy: (allergy: keyof PermanentFilters['allergies']) => void;
  toggleDietType: (dietType: keyof PermanentFilters['dietTypes']) => void;
  toggleReligiousRestriction: (
    restriction: keyof PermanentFilters['religiousRestrictions']
  ) => void;
  toggleFacility: (facility: keyof PermanentFilters['facilities']) => void;
  addIngredientToAvoid: (ingredient: string) => void;
  removeIngredientToAvoid: (ingredient: string) => void;
  addIngredientExclusion: (ingredient: string) => void;
  removeIngredientExclusion: (ingredient: string) => void;
  addDislikedIngredient: (ingredient: string) => void;
  removeDislikedIngredient: (ingredient: string) => void;
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
  dietPreference: 'all',
  proteinTypes: {
    meat: false,
    fish: false,
    seafood: false,
    egg: false,
  },
  hungerLevel: 'normal',
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
  dietPreference: 'all',
  exclude: {
    noMeat: false,
    noFish: false,
    noSeafood: false,
    noEggs: false,
    noDairy: false,
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
  },
  facilities: {
    familyFriendly: false,
    wheelchairAccessible: false,
    petFriendly: false,
    lgbtAccessible: false,
    kidsMenu: false,
  },
  ingredientsToAvoid: [],
  ingredientExclusions: [],
  dislikedIngredients: [],
  defaultPriceRange: {
    min: 1,
    max: 4,
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

  setDietPreference: (preference: DailyFilters['dietPreference']) => {
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

  setHungerLevel: (level: DailyFilters['hungerLevel']) => {
    set(state => ({
      daily: {
        ...state.daily,
        hungerLevel: level,
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
  setPermanentDietPreference: (preference: PermanentFilters['dietPreference']) => {
    set(state => ({
      permanent: {
        ...state.permanent,
        dietPreference: preference,
      },
    }));
    get().saveFilters();
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
    get().saveFilters();
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
    get().saveFilters();
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
    get().saveFilters();
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
    get().saveFilters();
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
    get().saveFilters();
  },

  addIngredientToAvoid: (ingredient: string) => {
    set(state => ({
      permanent: {
        ...state.permanent,
        ingredientsToAvoid: [...state.permanent.ingredientsToAvoid, ingredient],
      },
    }));
    get().saveFilters();
  },

  removeIngredientToAvoid: (ingredient: string) => {
    set(state => ({
      permanent: {
        ...state.permanent,
        ingredientsToAvoid: state.permanent.ingredientsToAvoid.filter(i => i !== ingredient),
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

    // Check diet preference (not 'all')
    if (state.daily.dietPreference !== 'all') {
      count++;
    }

    // Check protein types (any enabled)
    const hasProteinFilter = Object.values(state.daily.proteinTypes).some(Boolean);
    if (hasProteinFilter) {
      count++;
    }

    // Check hunger level (not 'normal')
    if (state.daily.hungerLevel !== 'normal') {
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

    // Check ingredient exclusions (legacy)
    if (state.permanent.ingredientExclusions.length > 0) {
      count++;
    }

    // Check disliked ingredients (legacy)
    if (state.permanent.dislikedIngredients.length > 0) {
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
