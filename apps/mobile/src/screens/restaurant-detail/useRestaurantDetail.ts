/**
 * useRestaurantDetail
 *
 * All useState / useEffect / data-loading logic for the restaurant detail screen.
 * Handles: restaurant metadata fetch, rating load, favourite check,
 * lazy per-category dish loading, dish detail (option groups, photos,
 * ingredients, option allergens), and interaction recording.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  supabase,
  type RestaurantWithMenus,
  type Dish,
  type OptionGroup,
  type Option,
} from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { useSessionStore } from '../../stores/sessionStore';
import { toggleFavorite, isFavorited, getUserFavorites } from '../../services/favoritesService';
import {
  getDishRatingsBatch,
  getUserDishOpinions,
  type DishRating,
} from '../../services/dishRatingService';
import { type DishOpinion } from '../../types/rating';
import { getRestaurantRating, type RestaurantRating } from '../../services/restaurantRatingService';
import { useFilterStore, type PermanentFilters } from '../../stores/filterStore';
import { useRestaurantStore } from '../../stores/restaurantStore';
import { type User } from '@supabase/supabase-js';
import { recordInteraction } from '../../services/interactionService';
import { type DishWithGroups } from './dishTypes';

export type { DishRating, RestaurantRating };

export interface RestaurantDetailState {
  restaurant: RestaurantWithMenus | null;
  loading: boolean;
  activeTab: 'food' | 'hours';
  setActiveTab: (tab: 'food' | 'hours') => void;
  hoursExpanded: boolean;
  setHoursExpanded: (v: boolean) => void;
  showAddressModal: boolean;
  setShowAddressModal: (v: boolean) => void;
  isFavorite: boolean;
  favoriteLoading: boolean;
  favoritesInitialized: boolean;
  /** The user's favorited dish ids (all restaurants — Set lookup by dish id).
   *  Drives the ❤️ marker on menu rows and the dish sheet's initial heart. */
  favoriteDishIds: Set<string>;
  setDishFavorite: (dishId: string, saved: boolean) => void;
  selectedDish: DishWithGroups | null;
  setSelectedDish: (dish: DishWithGroups | null) => void;
  dishOptionGroups: OptionGroup[];
  setDishOptionGroups: (groups: OptionGroup[]) => void;
  dishPhotos: Array<{
    id: string;
    photo_url: string;
    user_id: string;
    created_at: string;
    dish_id: string;
  }>;
  setDishPhotos: (photos: RestaurantDetailState['dishPhotos']) => void;
  dishRatings: Map<string, DishRating>;
  userDishOpinions: Map<string, DishOpinion>;
  setUserDishOpinions: React.Dispatch<React.SetStateAction<Map<string, DishOpinion>>>;
  restaurantRating: RestaurantRating | null;
  categoryDishes: Map<string, 'loading' | 'error' | Dish[]>;
  loadAttempt: number;
  setLoadAttempt: React.Dispatch<React.SetStateAction<number>>;
  setLoading: (v: boolean) => void;
  /** True while a pull-to-refresh reload is in flight (drives the FlatList spinner). */
  refreshing: boolean;
  /** Clear this restaurant's caches and refetch everything (pull-to-refresh). */
  refresh: () => void;
  handleFavoriteToggle: () => Promise<void>;
  handleDishPress: (dish: DishWithGroups) => Promise<void>;
  loadCategoryDishes: (categoryId: string) => Promise<void>;
  permanentFilters: PermanentFilters;
  user: User | null;
  restaurantId: string;
  mountedRef: React.MutableRefObject<boolean>;
}

export function useRestaurantDetail(restaurantId: string): RestaurantDetailState {
  const user = useAuthStore(state => state.user);
  const trackRestaurantView = useSessionStore(state => state.trackRestaurantView);
  const trackDishView = useSessionStore(state => state.trackDishView);
  const fetchRestaurantDetail = useRestaurantStore(state => state.fetchRestaurantDetail);
  const fetchCategoryDishes = useRestaurantStore(state => state.fetchCategoryDishes);
  const fetchAllRestaurantDishes = useRestaurantStore(state => state.fetchAllRestaurantDishes);
  const getRestaurantAux = useRestaurantStore(state => state.getRestaurantAux);
  const setRestaurantAux = useRestaurantStore(state => state.setRestaurantAux);
  const clearRestaurantCaches = useRestaurantStore(state => state.clearRestaurantCaches);
  const permanentFilters = useFilterStore(state => state.permanent);

  const [restaurant, setRestaurant] = useState<RestaurantWithMenus | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'food' | 'hours'>('food');
  const [hoursExpanded, setHoursExpanded] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [favoritesInitialized, setFavoritesInitialized] = useState(false);
  const [favoriteDishIds, setFavoriteDishIds] = useState<Set<string>>(new Set());
  const [selectedDish, setSelectedDish] = useState<DishWithGroups | null>(null);
  const [dishOptionGroups, setDishOptionGroups] = useState<OptionGroup[]>([]);
  const [dishPhotos, setDishPhotos] = useState<
    Array<{
      id: string;
      photo_url: string;
      user_id: string;
      created_at: string;
      dish_id: string;
    }>
  >([]);
  const [dishRatings, setDishRatings] = useState<Map<string, DishRating>>(new Map());
  const [userDishOpinions, setUserDishOpinions] = useState<Map<string, DishOpinion>>(new Map());
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [restaurantRating, setRestaurantRating] = useState<RestaurantRating | null>(null);
  const [categoryDishes, setCategoryDishes] = useState<Map<string, 'loading' | 'error' | Dish[]>>(
    new Map()
  );
  // Raw bulk-dish fetch result, loaded in PARALLEL with the restaurant metadata
  // (it needs only restaurantId). The grouping effect below buckets it under
  // categories once both this and the metadata have arrived. 'loading' until the
  // first fetch resolves.
  const [dishesResult, setDishesResult] = useState<'loading' | 'error' | Dish[]>('loading');
  const [refreshing, setRefreshing] = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Stale-while-revalidate: on a reopen within the cache window, paint the non-skeleton
  // data (restaurant rating, dish rating badges, opinions, favourite hearts) from cache
  // immediately so it doesn't flash in after a round-trip. The fetch effects below still
  // run and refresh it (cached value is shown, then overwritten with fresh — usually
  // identical). Seed only when the cached userId matches the current user.
  useEffect(() => {
    const aux = getRestaurantAux(restaurantId);
    if (!aux || aux.userId !== (user?.id ?? null)) return;
    setRestaurantRating(aux.restaurantRating);
    setDishRatings(aux.dishRatings);
    setUserDishOpinions(aux.userDishOpinions);
    setFavoriteDishIds(aux.favoriteDishIds);
    setIsFavorite(aux.isFavorite);
    setFavoritesInitialized(true);
  }, [restaurantId, user?.id, getRestaurantAux]);

  // Critical-path load: restaurant metadata + non-critical ratings/favourites in parallel
  useEffect(() => {
    const loadAll = async () => {
      try {
        const timeoutFallback = new Promise<{ data: null; error: Error }>(resolve =>
          setTimeout(() => resolve({ data: null, error: new Error('timeout') }), 6000)
        );
        const { data, error } = await Promise.race([
          fetchRestaurantDetail(restaurantId),
          timeoutFallback,
        ]);
        if (!mountedRef.current) return;
        if (error) throw error;
        if (data) {
          setRestaurant(data);
          trackRestaurantView({
            id: data.id,
            name: data.name,
            cuisine: data.cuisine_types?.[0] || 'Restaurant',
            imageUrl: data.image_url ?? undefined,
            currencyCode: data.currency_code ?? null,
          });
        }
      } catch (err) {
        console.error('Failed to load restaurant:', err);
      } finally {
        if (mountedRef.current) setLoading(false);
      }

      if (!mountedRef.current) return;
      const [ratingResult, favResult, dishFavsResult] = await Promise.all([
        getRestaurantRating(restaurantId).catch(() => null),
        user
          ? isFavorited(user.id, 'restaurant', restaurantId).catch(() => null)
          : Promise.resolve(null),
        user ? getUserFavorites(user.id, 'dish').catch(() => null) : Promise.resolve(null),
      ]);
      if (!mountedRef.current) return;
      setRestaurantRating(ratingResult);
      if (favResult !== null) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setIsFavorite((favResult as any).ok ? (favResult as any).data : false);
      }
      if (dishFavsResult?.ok) {
        setFavoriteDishIds(new Set(dishFavsResult.data.map(f => f.subject_id)));
      }
      setFavoritesInitialized(true);
      if (mountedRef.current) setRefreshing(false);
    };

    loadAll();
    // user?.id (not the full user object) — prevents TOKEN_REFRESHED from causing
    // re-runs every time Supabase issues a new access token with a new object reference.
  }, [restaurantId, user?.id, loadAttempt, trackRestaurantView]);

  // Lazy-load dishes for a specific category; no-op if already loading or loaded
  const loadCategoryDishes = React.useCallback(
    async (categoryId: string) => {
      if (!mountedRef.current) return;
      setCategoryDishes(prev => {
        if (prev.has(categoryId)) return prev;
        const next = new Map(prev);
        next.set(categoryId, 'loading');
        return next;
      });
      const { data, error } = await fetchCategoryDishes(categoryId);
      if (!mountedRef.current) return;
      if (error || !data) {
        setCategoryDishes(prev => {
          const next = new Map(prev);
          next.set(categoryId, 'error');
          return next;
        });
        return;
      }
      setCategoryDishes(prev => {
        const next = new Map(prev);
        next.set(categoryId, data);
        return next;
      });
      const dishIds = data.map(d => d.id);
      if (dishIds.length > 0) {
        const [ratings, opinions] = await Promise.all([
          getDishRatingsBatch(dishIds),
          user
            ? getUserDishOpinions(user.id, dishIds)
            : Promise.resolve(new Map<string, DishOpinion>()),
        ]);
        if (mountedRef.current) {
          setDishRatings(prev => new Map([...prev, ...ratings]));
          if (opinions.size > 0) {
            setUserDishOpinions(prev => new Map([...prev, ...opinions]));
          }
        }
      }
    },
    [fetchCategoryDishes, user?.id]
  );

  // Load EVERY dish for the restaurant in a single query, then one ratings + one
  // opinions batch across all dish ids. This runs at mount IN PARALLEL with the
  // metadata effect above (it depends only on restaurantId, never on the metadata
  // response) — dropping the old `if (!restaurant) return` gate is the optimization:
  // the heavy dish query no longer waits for the metadata round-trip to finish first.
  useEffect(() => {
    let cancelled = false;
    setDishesResult('loading');

    (async () => {
      const { data, error } = await fetchAllRestaurantDishes(restaurantId);
      if (cancelled || !mountedRef.current) return;

      if (error || !data) {
        setDishesResult('error');
        return;
      }
      setDishesResult(data);

      // One ratings + one opinions batch across every dish id.
      const dishIds = data.map(d => d.id);
      if (dishIds.length === 0) return;
      const [ratings, opinions] = await Promise.all([
        getDishRatingsBatch(dishIds),
        user
          ? getUserDishOpinions(user.id, dishIds)
          : Promise.resolve(new Map<string, DishOpinion>()),
      ]);
      if (cancelled || !mountedRef.current) return;
      setDishRatings(prev => new Map([...prev, ...ratings]));
      if (opinions.size > 0) {
        setUserDishOpinions(prev => new Map([...prev, ...opinions]));
      }
    })();

    return () => {
      cancelled = true;
    };
    // user?.id (not the full user object) — same TOKEN_REFRESHED guard as the metadata effect.
    // loadAttempt — re-fetch on pull-to-refresh.
  }, [restaurantId, fetchAllRestaurantDishes, user?.id, loadAttempt]);

  // Bucket the bulk-fetched dishes under their categories. Re-runs whenever the
  // metadata OR the dish result changes, so it reconciles no matter which arrives
  // first: while dishes are loading it paints each category's spinner; on error,
  // each category's error row; once ready, each dish under its menu_category_id
  // (categories with no dishes resolve to an empty array, not 'loading').
  useEffect(() => {
    if (!restaurant) return;
    const categoryIds: string[] = [];
    restaurant.menus?.forEach(menu =>
      menu.menu_categories?.forEach(cat => {
        if (cat?.id) categoryIds.push(cat.id);
      })
    );
    if (categoryIds.length === 0) return;

    if (dishesResult === 'loading') {
      setCategoryDishes(prev => {
        const next = new Map(prev);
        for (const id of categoryIds) {
          if (!next.has(id)) next.set(id, 'loading');
        }
        return next;
      });
      return;
    }

    if (dishesResult === 'error') {
      setCategoryDishes(prev => {
        const next = new Map(prev);
        for (const id of categoryIds) next.set(id, 'error');
        return next;
      });
      return;
    }

    const byCategory = new Map<string, Dish[]>();
    for (const id of categoryIds) byCategory.set(id, []);
    for (const dish of dishesResult) {
      const cid = dish.menu_category_id;
      if (cid && byCategory.has(cid)) byCategory.get(cid)!.push(dish);
    }
    setCategoryDishes(prev => {
      const next = new Map(prev);
      for (const [cid, list] of byCategory) next.set(cid, list);
      return next;
    });
  }, [restaurant?.id, dishesResult]);

  // Mirror the latest non-skeleton snapshot into the aux cache so the next reopen can
  // seed it instantly. Gated on favoritesInitialized so we never cache the pre-fetch
  // empty state; runs on every slice change (incl. in-session rating / favourite toggles)
  // to keep the cache coherent.
  useEffect(() => {
    if (!favoritesInitialized) return;
    setRestaurantAux(restaurantId, {
      userId: user?.id ?? null,
      restaurantRating,
      dishRatings,
      userDishOpinions,
      favoriteDishIds,
      isFavorite,
      fetchedAt: Date.now(),
    });
  }, [
    restaurantId,
    user?.id,
    favoritesInitialized,
    restaurantRating,
    dishRatings,
    userDishOpinions,
    favoriteDishIds,
    isFavorite,
    setRestaurantAux,
  ]);

  // Record 'viewed' interaction after the dish detail has been open for 3+ seconds.
  useEffect(() => {
    if (!selectedDish || !user) return;
    const timer = setTimeout(() => {
      recordInteraction(user.id, selectedDish.id, 'viewed');
    }, 3000);
    return () => clearTimeout(timer);
  }, [selectedDish?.id, user?.id]);

  // Local mirror of a dish's saved state — called when the dish sheet toggles
  // the heart or a "Loved it" rating auto-favorites, so menu rows update live.
  const setDishFavorite = React.useCallback((dishId: string, saved: boolean) => {
    setFavoriteDishIds(prev => {
      if (prev.has(dishId) === saved) return prev;
      const next = new Set(prev);
      if (saved) next.add(dishId);
      else next.delete(dishId);
      return next;
    });
  }, []);

  // Pull-to-refresh: drop this restaurant's caches and bump loadAttempt so both the
  // metadata and the bulk-dish effects re-run against fresh data. Deliberately does NOT
  // set the screen-level `loading` (which would blank the screen) — the FlatList's
  // RefreshControl spinner shows instead, cleared when the metadata reload finishes.
  const refresh = React.useCallback(() => {
    clearRestaurantCaches(restaurantId);
    setRefreshing(true);
    setLoadAttempt(n => n + 1);
  }, [restaurantId, clearRestaurantCaches]);

  const handleFavoriteToggle = async (): Promise<void> => {
    setFavoriteLoading(true);
    try {
      const result = await toggleFavorite(user!.id, 'restaurant', restaurantId);
      if (result.ok) {
        setIsFavorite(result.data);
      }
    } finally {
      setFavoriteLoading(false);
    }
  };

  const handleDishPress = React.useCallback(
    async (dish: DishWithGroups) => {
      setSelectedDish(dish);
      const embedded: OptionGroup[] = (dish.option_groups ?? [])
        .filter((g: OptionGroup) => g.is_active)
        .sort((a: OptionGroup, b: OptionGroup) => a.display_order - b.display_order)
        .map((g: OptionGroup) => ({
          ...g,
          options: (g.options ?? [])
            .filter((o: Option) => o.is_available)
            .sort((a: Option, b: Option) => a.display_order - b.display_order),
        }));
      setDishOptionGroups(embedded);

      trackDishView(restaurantId, {
        id: dish.id,
        name: dish.name,
        price: dish.price,
        imageUrl: dish.photo_url ?? undefined,
      });

      const { data: photosData, error: photosError } = await supabase
        .from('dish_photos')
        .select('id, photo_url, user_id, created_at, dish_id')
        .eq('dish_id', dish.id)
        .order('created_at', { ascending: false });

      if (photosError) {
        console.error('Error fetching dish photos:', photosError);
        setDishPhotos([]);
      } else {
        setDishPhotos(
          (photosData || []).map(row => ({
            id: row.id,
            photo_url: row.photo_url,
            user_id: row.user_id ?? '',
            created_at: row.created_at ?? '',
            dish_id: row.dish_id,
          }))
        );
      }
    },
    [restaurantId, trackDishView]
  );

  return {
    restaurant,
    loading,
    activeTab,
    setActiveTab,
    hoursExpanded,
    setHoursExpanded,
    showAddressModal,
    setShowAddressModal,
    isFavorite,
    favoriteLoading,
    favoritesInitialized,
    favoriteDishIds,
    setDishFavorite,
    selectedDish,
    setSelectedDish,
    dishOptionGroups,
    setDishOptionGroups,
    dishPhotos,
    setDishPhotos,
    dishRatings,
    userDishOpinions,
    setUserDishOpinions,
    restaurantRating,
    categoryDishes,
    loadAttempt,
    setLoadAttempt,
    setLoading,
    refreshing,
    refresh,
    handleFavoriteToggle,
    handleDishPress,
    loadCategoryDishes,
    permanentFilters,
    user,
    restaurantId,
    mountedRef,
  };
}
