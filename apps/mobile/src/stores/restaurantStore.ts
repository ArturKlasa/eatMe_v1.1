import { create } from 'zustand';
import { supabase, type RestaurantWithMenus, type DishWithRelations } from '../lib/supabase';
import {
  fetchNearbyRestaurants,
  fetchNearbyRestaurantsFromCurrentLocation,
  type RestaurantWithDistance,
} from '../services/geoService';
import { DailyFilters, PermanentFilters } from './filterStore';

interface RestaurantStore {
  restaurants: RestaurantWithMenus[];
  dishes: DishWithRelations[];
  nearbyRestaurants: RestaurantWithDistance[]; // NEW: restaurants from geospatial search
  searchCenter: { latitude: number; longitude: number } | null; // NEW: last search location
  searchRadius: number; // NEW: last search radius
  loading: boolean;
  error: Error | null;

  // Actions
  loadRestaurants: () => Promise<void>;
  loadDishes: () => Promise<void>;
  refreshData: () => Promise<void>;

  // NEW: Geospatial actions
  loadNearbyRestaurants: (
    latitude: number,
    longitude: number,
    radiusKm?: number,
    dailyFilters?: DailyFilters,
    permanentFilters?: PermanentFilters
  ) => Promise<void>;
  loadNearbyRestaurantsFromCurrentLocation: (
    getCurrentLocation: () => Promise<{ latitude: number; longitude: number }>,
    radiusKm?: number,
    dailyFilters?: DailyFilters,
    permanentFilters?: PermanentFilters
  ) => Promise<void>;
}

export const useRestaurantStore = create<RestaurantStore>((set, get) => ({
  restaurants: [],
  dishes: [],
  nearbyRestaurants: [],
  searchCenter: null,
  searchRadius: 5,
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
          menu_category:menu_categories (*),
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

  // NEW: Load restaurants near a specific location
  loadNearbyRestaurants: async (
    latitude: number,
    longitude: number,
    radiusKm = 5,
    dailyFilters?: DailyFilters,
    permanentFilters?: PermanentFilters
  ) => {
    set({ loading: true, error: null });

    try {
      const response = await fetchNearbyRestaurants(
        latitude,
        longitude,
        radiusKm,
        dailyFilters,
        permanentFilters
      );

      set({
        nearbyRestaurants: response.restaurants,
        searchCenter: { latitude, longitude },
        searchRadius: radiusKm,
        loading: false,
      });

      console.log(`[RestaurantStore] Loaded ${response.totalCount} nearby restaurants`);
    } catch (err) {
      const error = err as Error;
      console.error('[RestaurantStore] Failed to load nearby restaurants:', error);
      set({ error, loading: false });
    }
  },

  // NEW: Load restaurants near current device location
  loadNearbyRestaurantsFromCurrentLocation: async (
    getCurrentLocation: () => Promise<{ latitude: number; longitude: number }>,
    radiusKm = 5,
    dailyFilters?: DailyFilters,
    permanentFilters?: PermanentFilters
  ) => {
    set({ loading: true, error: null });

    try {
      const response = await fetchNearbyRestaurantsFromCurrentLocation(
        getCurrentLocation,
        radiusKm,
        dailyFilters,
        permanentFilters
      );

      set({
        nearbyRestaurants: response.restaurants,
        searchCenter: response.centerPoint,
        searchRadius: radiusKm,
        loading: false,
      });

      console.log(
        `[RestaurantStore] Loaded ${response.totalCount} nearby restaurants from current location`
      );
    } catch (err) {
      const error = err as Error;
      console.error(
        '[RestaurantStore] Failed to load nearby restaurants from current location:',
        error
      );
      set({ error, loading: false });
    }
  },
}));
