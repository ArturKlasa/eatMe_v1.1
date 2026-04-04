import { create } from 'zustand';
import { supabase, type RestaurantWithMenus, type DishWithRelations } from '../lib/supabase';
import { debugLog } from '../config/environment';
import {
  fetchNearbyRestaurants,
  fetchNearbyRestaurantsFromCurrentLocation,
  type RestaurantWithDistance,
} from '../services/geoService';
import { DailyFilters, PermanentFilters } from './filterStore';

/**
 * Zustand store for restaurant and dish data.
 *
 * Holds two data layers:
 *  - `restaurants` / `dishes`: full Supabase records fetched directly from the DB
 *    (used by the web portal and admin screens).
 *  - `nearbyRestaurants`: geospatially filtered records returned by the nearby-
 *    restaurants Edge Function, used by the map/swipe feed on mobile.
 *
 * Typical mobile flow:
 *   1. BasicMapScreen calls `loadNearbyRestaurants()` with the user's location.
 *   2. The store proxies to geoService which calls the feed Edge Function.
 *   3. Results are stored in `nearbyRestaurants` together with the search center
 *      and radius so the map can display the coverage circle.
 */
interface RestaurantStore {
  /** Full restaurant records including nested menus/categories/dishes. */
  restaurants: RestaurantWithMenus[];
  /** Available dishes with their parent menu-category and restaurant joined. */
  dishes: DishWithRelations[];
  /** Geospatially filtered restaurants returned by the feed Edge Function. */
  nearbyRestaurants: RestaurantWithDistance[];
  /** Latitude/longitude of the last geospatial search (used to draw map coverage circle). */
  searchCenter: { latitude: number; longitude: number } | null;
  /** Radius (km) of the last geospatial search. */
  searchRadius: number;
  loading: boolean;
  error: Error | null;

  // Actions
  loadRestaurants: () => Promise<void>;
  loadDishes: () => Promise<void>;
  refreshData: () => Promise<void>;

  /**
   * Fetch restaurants near a fixed latitude/longitude via the feed Edge Function.
   * Optionally applies daily and permanent filters server-side before returning results.
   */
  loadNearbyRestaurants: (
    latitude: number,
    longitude: number,
    radiusKm?: number,
    dailyFilters?: DailyFilters,
    permanentFilters?: PermanentFilters
  ) => Promise<void>;
  /**
   * Fetch restaurants near the device's current GPS location.
   * Accepts a `getCurrentLocation` callback so the store is decoupled from the
   * geolocation API — callers inject the permission-aware hook result.
   */
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
            menu_categories (
              *,
              dishes (*)
            )
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

      debugLog(`[RestaurantStore] Loaded ${response.totalCount} nearby restaurants`);
    } catch (err) {
      const error = err as Error;
      console.error('[RestaurantStore] Failed to load nearby restaurants:', error);
      set({ error, loading: false });
    }
  },

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

      debugLog(
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
