import { create } from 'zustand';
import { supabase, type RestaurantWithMenus, type Dish, type OptionGroup } from '../lib/supabase';
import { debugLog } from '../config/environment';
import { type RestaurantRating } from '../services/restaurantRatingService';
import { type DishRating } from '../services/dishRatingService';
import { type DishOpinion } from '../types/rating';

/**
 * Zustand store for restaurant-detail data on mobile: per-restaurant menu/detail
 * caches (5-min TTL) plus the non-skeleton aux cache (ratings, hearts, opinions).
 * Consumed by `useRestaurantDetail`. The map/feed reads dishes from the feed Edge
 * Function directly (see `edgeFunctionsService`), not from this store.
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

/**
 * The non-skeleton restaurant-detail data (rating badges, hearts, opinions) cached
 * per restaurant so a reopen can paint them instantly (stale-while-revalidate).
 * Keyed with userId so a sign-out/in never shows the previous user's favourites.
 */
interface RestaurantAuxEntry {
  userId: string | null;
  restaurantRating: RestaurantRating | null;
  dishRatings: Map<string, DishRating>;
  userDishOpinions: Map<string, DishOpinion>;
  favoriteDishIds: Set<string>;
  isFavorite: boolean;
  fetchedAt: number;
}

// Module-level, intentionally NOT in Zustand state: this is a render-irrelevant
// cache, so reads/writes must not notify store subscribers (see audit R7 on the
// churn from Map caches living in reactive state).
const restaurantAuxCache = new Map<string, RestaurantAuxEntry>();

interface RestaurantStore {
  /** In-memory cache for restaurant detail pages (5-min TTL). */
  restaurantDetailCache: Map<string, RestaurantDetailCacheEntry>;
  /** In-memory per-category dish cache (5-min TTL). */
  categoryDishesCache: Map<string, CategoryDishCacheEntry>;
  /** In-memory whole-restaurant dish cache (5-min TTL), keyed by restaurant id. */
  restaurantDishesCache: Map<string, CategoryDishCacheEntry>;

  // Actions
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
  /** Read the cached non-skeleton detail data for a restaurant, or null if absent/stale. */
  getRestaurantAux: (restaurantId: string) => RestaurantAuxEntry | null;
  /** Write the latest non-skeleton detail snapshot for a restaurant into the aux cache. */
  setRestaurantAux: (restaurantId: string, entry: RestaurantAuxEntry) => void;
  /** Drop all cached data for a restaurant (detail + whole-restaurant dishes + aux) —
   *  used by pull-to-refresh to force a full refetch. */
  clearRestaurantCaches: (restaurantId: string) => void;
}

export const useRestaurantStore = create<RestaurantStore>((set, get) => ({
  restaurantDetailCache: new Map(),
  categoryDishesCache: new Map(),
  restaurantDishesCache: new Map(),

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

  getRestaurantAux: (restaurantId: string) => {
    const entry = restaurantAuxCache.get(restaurantId);
    if (entry && Date.now() - entry.fetchedAt < RESTAURANT_DETAIL_TTL_MS) {
      return entry;
    }
    return null;
  },

  setRestaurantAux: (restaurantId: string, entry: RestaurantAuxEntry) => {
    restaurantAuxCache.set(restaurantId, entry);
  },

  clearRestaurantCaches: (restaurantId: string) => {
    restaurantAuxCache.delete(restaurantId);
    set(state => {
      const detail = new Map(state.restaurantDetailCache);
      detail.delete(restaurantId);
      const dishes = new Map(state.restaurantDishesCache);
      dishes.delete(restaurantId);
      return { restaurantDetailCache: detail, restaurantDishesCache: dishes };
    });
  },
}));
