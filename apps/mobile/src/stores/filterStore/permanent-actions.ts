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
