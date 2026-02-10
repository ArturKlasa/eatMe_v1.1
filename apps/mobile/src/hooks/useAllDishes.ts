import { useState, useEffect } from 'react';
import { supabase, type Dish, type DishWithRelations } from '../lib/supabase';

interface UseAllDishesOptions {
  limit?: number;
  cuisines?: string[];
  dietaryTags?: string[];
  priceRange?: { min: number; max: number };
}

interface UseAllDishesResult {
  dishes: DishWithRelations[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch all dishes for the swipe interface
 * Returns dishes with their restaurant and menu information
 */
export function useAllDishes(options: UseAllDishesOptions = {}): UseAllDishesResult {
  const { limit = 100, cuisines, dietaryTags, priceRange } = options;
  const [dishes, setDishes] = useState<DishWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadDishes = async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('dishes')
        .select(
          `
          *,
          menu_category:menu_categories (*),
          restaurant:restaurants (*)
        `
        )
        .eq('is_available', true)
        .order('created_at', { ascending: false });

      // Filter by price range
      if (priceRange) {
        query = query.gte('price', priceRange.min).lte('price', priceRange.max);
      }

      // Filter by dietary tags if provided
      if (dietaryTags && dietaryTags.length > 0) {
        query = query.overlaps('dietary_tags', dietaryTags);
      }

      // Apply limit
      if (limit) {
        query = query.limit(limit);
      }

      const { data, error: queryError } = await query;

      if (queryError) {
        throw queryError;
      }

      // Filter by cuisine types if provided (done client-side since it's on restaurant)
      let filteredDishes = (data as DishWithRelations[]) || [];
      if (cuisines && cuisines.length > 0) {
        filteredDishes = filteredDishes.filter(dish =>
          dish.restaurant.cuisine_types.some(cuisine => cuisines.includes(cuisine))
        );
      }

      setDishes(filteredDishes);
    } catch (err) {
      const error = err as Error;
      setError(error);
      console.error('Error loading dishes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDishes();
  }, [limit, cuisines?.join(','), dietaryTags?.join(','), priceRange?.min, priceRange?.max]);

  return { dishes, loading, error, refetch: loadDishes };
}
