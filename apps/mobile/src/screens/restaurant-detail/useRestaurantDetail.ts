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
import { toggleFavorite, isFavorited } from '../../services/favoritesService';
import {
  getDishRatingsBatch,
  getUserDishOpinions,
  type DishRating,
} from '../../services/dishRatingService';
import { type DishOpinion } from '../../types/rating';
import { getRestaurantRating, type RestaurantRating } from '../../services/restaurantRatingService';
import {
  useFilterStore,
  type PermanentFilters,
  type IngredientToAvoid,
} from '../../stores/filterStore';
import { useRestaurantStore } from '../../stores/restaurantStore';
import { type User } from '@supabase/supabase-js';
import { recordInteraction } from '../../services/interactionService';
import { type DishWithGroups } from './DishGrouping';
import i18n from '../../i18n';
import { resolveIngredientNames, type JoinedDishIngredient } from '../../lib/ingredientDisplay';

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
  dishIngredientNames: string[];
  setDishIngredientNames: (names: string[]) => void;
  dishRatings: Map<string, DishRating>;
  userDishOpinions: Map<string, DishOpinion>;
  setUserDishOpinions: React.Dispatch<React.SetStateAction<Map<string, DishOpinion>>>;
  restaurantRating: RestaurantRating | null;
  categoryDishes: Map<string, 'loading' | 'error' | Dish[]>;
  optionAllergens: Map<string, string[]>;
  setOptionAllergens: (map: Map<string, string[]>) => void;
  loadAttempt: number;
  setLoadAttempt: React.Dispatch<React.SetStateAction<number>>;
  setLoading: (v: boolean) => void;
  handleFavoriteToggle: () => Promise<void>;
  handleDishPress: (dish: DishWithGroups) => Promise<void>;
  loadCategoryDishes: (categoryId: string) => Promise<void>;
  permanentFilters: PermanentFilters;
  ingredientsToAvoid: IngredientToAvoid[];
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
  const permanentFilters = useFilterStore(state => state.permanent);
  const ingredientsToAvoid = useFilterStore(state => state.permanent.ingredientsToAvoid);

  const [restaurant, setRestaurant] = useState<RestaurantWithMenus | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'food' | 'hours'>('food');
  const [hoursExpanded, setHoursExpanded] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [favoritesInitialized, setFavoritesInitialized] = useState(false);
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
  const [dishIngredientNames, setDishIngredientNames] = useState<string[]>([]);
  const [dishRatings, setDishRatings] = useState<Map<string, DishRating>>(new Map());
  const [userDishOpinions, setUserDishOpinions] = useState<Map<string, DishOpinion>>(new Map());
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [restaurantRating, setRestaurantRating] = useState<RestaurantRating | null>(null);
  const [categoryDishes, setCategoryDishes] = useState<Map<string, 'loading' | 'error' | Dish[]>>(
    new Map()
  );
  const [optionAllergens, setOptionAllergens] = useState<Map<string, string[]>>(new Map());

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Critical-path load: restaurant metadata + non-critical ratings/favourites in parallel
  useEffect(() => {
    const loadAll = async () => {
      try {
        const timeoutFallback = new Promise<{ data: null; error: Error }>(resolve =>
          setTimeout(() => resolve({ data: null, error: new Error('timeout') }), 12000)
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
          });
        }
      } catch (err) {
        console.error('Failed to load restaurant:', err);
      } finally {
        if (mountedRef.current) setLoading(false);
      }

      if (!mountedRef.current) return;
      const [ratingResult, favResult] = await Promise.all([
        getRestaurantRating(restaurantId).catch(() => null),
        user
          ? isFavorited(user.id, 'restaurant', restaurantId).catch(() => null)
          : Promise.resolve(null),
      ]);
      if (!mountedRef.current) return;
      setRestaurantRating(ratingResult);
      if (favResult !== null) {
        setIsFavorite((favResult as any).ok ? (favResult as any).data : false);
      }
      setFavoritesInitialized(true);
    };

    loadAll();
    // user?.id (not the full user object) — prevents TOKEN_REFRESHED from causing
    // re-runs every time Supabase issues a new access token with a new object reference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fetchCategoryDishes, user?.id]
  );

  // Auto-load all categories in parallel when restaurant metadata arrives
  useEffect(() => {
    if (!restaurant) return;
    restaurant.menus?.forEach(menu =>
      menu.menu_categories?.forEach(cat => {
        if (cat?.id) loadCategoryDishes(cat.id);
      })
    );
  }, [restaurant?.id, loadCategoryDishes]);

  // Record 'viewed' interaction after the dish detail has been open for 3+ seconds.
  useEffect(() => {
    if (!selectedDish || !user) return;
    const timer = setTimeout(() => {
      recordInteraction(user.id, selectedDish.id, 'viewed');
    }, 3000);
    return () => clearTimeout(timer);
  }, [selectedDish?.id, user?.id]);

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

  const handleDishPress = async (dish: DishWithGroups) => {
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
    setOptionAllergens(new Map());

    const optionsWithIngredient: { optionId: string; ingredientId: string }[] = [];
    for (const group of embedded) {
      for (const opt of group.options) {
        if (opt.canonical_ingredient_id) {
          optionsWithIngredient.push({
            optionId: opt.id,
            ingredientId: opt.canonical_ingredient_id,
          });
        }
      }
    }
    trackDishView(restaurantId, {
      id: dish.id,
      name: dish.name,
      price: dish.price,
      imageUrl: dish.photo_url ?? undefined,
    });

    const [photosResult, ingredientsResult, allergenResult] = await Promise.allSettled([
      supabase
        .from('dish_photos')
        .select('*')
        .eq('dish_id', dish.id)
        .order('created_at', { ascending: false }),
      // Phase 5: fetch concept/variant + translations so we can show the
      // user's locale. The new tables aren't in the generated Database types
      // yet, so we cast .from() to bypass the overload check; the returned
      // rows are retyped below via JoinedDishIngredient.
      (supabase.from as unknown as (t: string) => ReturnType<typeof supabase.from>)(
        'dish_ingredients'
      )
        .select(
          `
          concept_id,
          variant_id,
          ingredient_id,
          concept:ingredient_concepts(slug, translations:concept_translations(language, name)),
          variant:ingredient_variants(modifier, translations:variant_translations(language, name)),
          canonical_ingredient:canonical_ingredients(canonical_name)
        `
        )
        .eq('dish_id', dish.id),
      optionsWithIngredient.length > 0
        ? supabase
            .from('canonical_ingredient_allergens')
            .select('canonical_ingredient_id, allergen_code')
            .in(
              'canonical_ingredient_id',
              optionsWithIngredient.map(o => o.ingredientId)
            )
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (photosResult.status === 'fulfilled') {
      const { data, error } = photosResult.value;
      if (error) {
        console.error('Error fetching dish photos:', error);
        setDishPhotos([]);
      } else {
        setDishPhotos(
          (data || []).map(row => ({
            ...row,
            created_at: row.created_at ?? '',
            updated_at: row.updated_at ?? '',
          }))
        );
      }
    } else {
      setDishPhotos([]);
    }

    if (ingredientsResult.status === 'fulfilled') {
      const { data, error } = ingredientsResult.value;
      if (!error && data && data.length > 0) {
        const locale = i18n.language || 'en';
        const names = resolveIngredientNames(data as unknown as JoinedDishIngredient[], locale);
        setDishIngredientNames(names.length > 0 ? names : dish.ingredients || []);
      } else {
        setDishIngredientNames(dish.ingredients || []);
      }
    } else {
      setDishIngredientNames(dish.ingredients || []);
    }

    if (allergenResult.status === 'fulfilled') {
      const { data } = allergenResult.value as {
        data: { canonical_ingredient_id: string; allergen_code: string }[] | null;
        error: { message: string } | null;
      };
      if (data && data.length > 0) {
        const byIngredient = new Map<string, string[]>();
        for (const row of data) {
          const existing = byIngredient.get(row.canonical_ingredient_id) ?? [];
          existing.push(row.allergen_code);
          byIngredient.set(row.canonical_ingredient_id, existing);
        }
        const map = new Map<string, string[]>();
        for (const { optionId, ingredientId } of optionsWithIngredient) {
          const codes = byIngredient.get(ingredientId);
          if (codes && codes.length > 0) map.set(optionId, codes);
        }
        if (mountedRef.current) setOptionAllergens(map);
      }
    }
  };

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
    selectedDish,
    setSelectedDish,
    dishOptionGroups,
    setDishOptionGroups,
    dishPhotos,
    setDishPhotos,
    dishIngredientNames,
    setDishIngredientNames,
    dishRatings,
    userDishOpinions,
    setUserDishOpinions,
    restaurantRating,
    categoryDishes,
    optionAllergens,
    setOptionAllergens,
    loadAttempt,
    setLoadAttempt,
    setLoading,
    handleFavoriteToggle,
    handleDishPress,
    loadCategoryDishes,
    permanentFilters,
    ingredientsToAvoid,
    user,
    restaurantId,
    mountedRef,
  };
}
