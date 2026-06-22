import type { StoreApi } from 'zustand';
import { defaultPermanentFilters, defaultFilterState } from './defaults';
import type { PermanentFilters, FilterState, FilterActions } from './types';

type FilterStore = FilterState & FilterActions;
type Set = StoreApi<FilterStore>['setState'];
type Get = StoreApi<FilterStore>['getState'];

export const createPermanentActionsSlice = (set: Set, get: Get) => ({
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
});
