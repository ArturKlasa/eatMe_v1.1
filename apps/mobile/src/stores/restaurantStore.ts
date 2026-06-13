import { create } from 'zustand';
import {
  supabase,
  type RestaurantWithMenus,
  type DishWithRelations,
  type Dish,
  type OptionGroup,
} from '../lib/supabase';
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
const RESTAURANT_DETAIL_TTL_MS = 5 * 60 * 1000; // 5 minutes
const CATEGORY_DISHES_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface RestaurantDetailCacheEntry {
  data: RestaurantWithMenus;
  fetchedAt: number;
}

type CategoryDish = Dish & {
  option_groups?: OptionGroup[];
};

interface CategoryDishCacheEntry {
  data: CategoryDish[];
  fetchedAt: number;
}

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
  /** In-memory cache for restaurant detail pages (5-min TTL). */
  restaurantDetailCache: Map<string, RestaurantDetailCacheEntry>;
  /** In-memory per-category dish cache (5-min TTL). */
  categoryDishesCache: Map<string, CategoryDishCacheEntry>;
  /** In-memory whole-restaurant dish cache (5-min TTL), keyed by restaurant id. */
  restaurantDishesCache: Map<string, CategoryDishCacheEntry>;

  // Actions
  loadRestaurants: () => Promise<void>;
  loadDishes: () => Promise<void>;
  refreshData: () => Promise<void>;
  /**
   * Fetch a single restaurant with menu structure (no dishes), using an in-memory cache (5-min TTL).
   * Returns cached data without a network request if the entry is still fresh.
   */
  fetchRestaurantDetail: (
    id: string
  ) => Promise<{ data: RestaurantWithMenus | null; error: Error | null }>;
  /**
   * Fetch dishes for a specific menu category, using an in-memory cache (5-min TTL).
   * Returns cached data without a network request if the entry is still fresh.
   */
  fetchCategoryDishes: (
    categoryId: string
  ) => Promise<{ data: CategoryDish[] | null; error: Error | null }>;
  /**
   * Fetch every published dish for a restaurant in a single query (across all
   * categories), using an in-memory cache (5-min TTL). Replaces the per-category
   * fan-out on restaurant open. Each dish carries `menu_category_id` so the caller
   * can group rows back under their category.
   */
  fetchAllRestaurantDishes: (
    restaurantId: string
  ) => Promise<{ data: CategoryDish[] | null; error: Error | null }>;

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
  restaurantDetailCache: new Map(),
  categoryDishesCache: new Map(),
  restaurantDishesCache: new Map(),

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
              canonical:canonical_menu_categories (slug, names),
              dishes (*)
            )
          )
        `
        )
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (error) throw error;

      set({
        // Double-cast: canonical_menu_categories FK isn't yet in the generated
        // Database types — regenerate after applying migration 124.
        restaurants: (data as unknown as RestaurantWithMenus[]) || [],
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
        .eq('status', 'published')
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

  fetchRestaurantDetail: async (id: string) => {
    const cache = get().restaurantDetailCache;
    const entry = cache.get(id);
    if (entry && Date.now() - entry.fetchedAt < RESTAURANT_DETAIL_TTL_MS) {
      debugLog(`[RestaurantStore] Cache hit for restaurant ${id}`);
      return { data: entry.data, error: null };
    }

    try {
      // Load restaurant metadata + menu structure only (no dishes — fetched lazily per category)
      const { data, error } = await supabase
        .from('restaurants')
        .select(
          `
          id, name, address, city, postal_code, cuisine_types, rating, phone,
          website, open_hours, image_url, payment_methods, is_active,
          delivery_available, takeout_available, dine_in_available,
          currency_code,
          menus (
            id, name, description, display_order, is_active, menu_type, schedule_type,
            menu_categories (
              id, name, description, display_order, is_active, name_translations,
              description_translations,
              canonical:canonical_menu_categories (slug, names)
            )
          )
        `
        )
        .eq('status', 'published')
        .eq('id', id)
        .single();

      if (error) {
        return { data: null, error: new Error(error.message) };
      }

      if (data) {
        const newCache = new Map(cache);
        newCache.set(id, { data: data as unknown as RestaurantWithMenus, fetchedAt: Date.now() });
        set({ restaurantDetailCache: newCache });
      }

      return { data: data as unknown as RestaurantWithMenus, error: null };
    } catch (err) {
      return { data: null, error: err as Error };
    }
  },

  fetchCategoryDishes: async (categoryId: string) => {
    const cache = get().categoryDishesCache;
    const entry = cache.get(categoryId);
    if (entry && Date.now() - entry.fetchedAt < CATEGORY_DISHES_TTL_MS) {
      debugLog(`[RestaurantStore] Category cache hit for ${categoryId}`);
      return { data: entry.data, error: null };
    }

    try {
      const { data, error } = await supabase
        .from('menu_categories')
        .select(
          `
          dishes (
            id, name, description, price, calories,
            spice_level, image_url, is_available, display_price_prefix,
            description_visibility, ingredients_visibility,
            serves,
            primary_protein, dining_format, bundled_items,
            portion_amount, portion_unit,
            available_days, available_hours_start, available_hours_end,
            option_groups (
              id, name, description, selection_type, min_selections, max_selections,
              display_order, display_in_card, is_active,
              options (id, name, description, price_delta, price_override,
                       primary_protein, serves_delta, is_default,
                       calories_delta, is_available, display_order)
            )
          )
        `
        )
        .eq('dishes.status', 'published')
        .eq('id', categoryId)
        .single();

      if (error) {
        return { data: null, error: new Error(error.message) };
      }

      const dishes = ((data as unknown as { dishes?: CategoryDish[] } | null)?.dishes ??
        []) as CategoryDish[];
      const newCache = new Map(cache);
      newCache.set(categoryId, { data: dishes, fetchedAt: Date.now() });
      set({ categoryDishesCache: newCache });

      return { data: dishes, error: null };
    } catch (err) {
      return { data: null, error: err as Error };
    }
  },

  fetchAllRestaurantDishes: async (restaurantId: string) => {
    const cache = get().restaurantDishesCache;
    const entry = cache.get(restaurantId);
    if (entry && Date.now() - entry.fetchedAt < CATEGORY_DISHES_TTL_MS) {
      debugLog(`[RestaurantStore] Restaurant-dishes cache hit for ${restaurantId}`);
      return { data: entry.data, error: null };
    }

    try {
      // Single query for every published dish across all of the restaurant's
      // categories. Mirrors fetchCategoryDishes's column list (so the dish shape is
      // identical) plus menu_category_id, which the caller groups rows by.
      const { data, error } = await supabase
        .from('dishes')
        .select(
          `
          id, name, description, price, calories,
          spice_level, image_url, is_available, display_price_prefix,
          description_visibility, ingredients_visibility,
          serves,
          primary_protein, dining_format, bundled_items,
          portion_amount, portion_unit, menu_category_id,
          available_days, available_hours_start, available_hours_end,
          option_groups (
            id, name, description, selection_type, min_selections, max_selections,
            display_order, display_in_card, is_active,
            options (id, name, description, price_delta, price_override,
                     primary_protein, serves_delta, is_default,
                     calories_delta, is_available, display_order)
          )
        `
        )
        .eq('restaurant_id', restaurantId)
        .eq('status', 'published')
        .order('created_at', { ascending: true });

      if (error) {
        return { data: null, error: new Error(error.message) };
      }

      const dishes = ((data as unknown as CategoryDish[]) ?? []) as CategoryDish[];
      const newCache = new Map(cache);
      newCache.set(restaurantId, { data: dishes, fetchedAt: Date.now() });
      set({ restaurantDishesCache: newCache });

      return { data: dishes, error: null };
    } catch (err) {
      return { data: null, error: err as Error };
    }
  },
}));
