/**
 * View Mode Store - Simple Restaurant/Dish toggle
 */

import { create } from 'zustand';

export type ViewMode = 'restaurant' | 'dish';

interface ViewModeStore {
  mode: ViewMode;
  setMode: (mode: ViewMode) => void;
  toggleMode: () => void;
  isRestaurantMode: () => boolean;
  isDishMode: () => boolean;
}

export const useViewModeStore = create<ViewModeStore>((set, get) => ({
  mode: 'dish', // Dishes have priority
  setMode: (mode: ViewMode) => set({ mode }),
  toggleMode: () => set(state => ({ mode: state.mode === 'restaurant' ? 'dish' : 'restaurant' })),
  isRestaurantMode: () => get().mode === 'restaurant',
  isDishMode: () => get().mode === 'dish',
}));
