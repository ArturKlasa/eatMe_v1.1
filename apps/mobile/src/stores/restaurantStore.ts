import { create } from 'zustand';
import { supabase, type RestaurantWithMenus, type DishWithRelations } from '../lib/supabase';

interface RestaurantStore {
  restaurants: RestaurantWithMenus[];
  dishes: DishWithRelations[];
  loading: boolean;
  error: Error | null;

  // Actions
  loadRestaurants: () => Promise<void>;
  loadDishes: () => Promise<void>;
  refreshData: () => Promise<void>;
}

export const useRestaurantStore = create<RestaurantStore>((set, get) => ({
  restaurants: [],
  dishes: [],
  loading: false,
  error: null,

  loadRestaurants: async () => {
    set({ loading: true, error: null });

    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select(
          `
          *,
          menus (
            *,
            dishes (*)
          )
        `
        )
        .order('created_at', { ascending: false });

      if (error) throw error;

      set({
        restaurants: (data as RestaurantWithMenus[]) || [],
        loading: false,
      });
    } catch (err) {
      const error = err as Error;
      console.error('Failed to load restaurants:', error);
      set({ error, loading: false });
    }
  },

  loadDishes: async () => {
    set({ loading: true, error: null });

    try {
      const { data, error } = await supabase
        .from('dishes')
        .select(
          `
          *,
          menu:menus (*),
          restaurant:restaurants (*)
        `
        )
        .eq('is_available', true)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      set({
        dishes: (data as DishWithRelations[]) || [],
        loading: false,
      });
    } catch (err) {
      const error = err as Error;
      console.error('Failed to load dishes:', error);
      set({ error, loading: false });
    }
  },

  refreshData: async () => {
    const { loadRestaurants, loadDishes } = get();
    await Promise.all([loadRestaurants(), loadDishes()]);
  },
}));
