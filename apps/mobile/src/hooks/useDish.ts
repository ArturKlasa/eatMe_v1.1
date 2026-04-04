import { useState, useEffect } from 'react';
import { supabase, type DishWithRelations } from '../lib/supabase';

/** Return shape for the useDish hook. */
interface UseDishResult {
  /** The fetched dish with its parent menu-category and restaurant joined, or null while loading. */
  dish: DishWithRelations | null;
  loading: boolean;
  error: Error | null;
  /** Manually re-trigger the fetch (e.g. after an optimistic update). */
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch a single dish with its menu and restaurant details
 */
export function useDish(dishId: string | null): UseDishResult {
  const [dish, setDish] = useState<DishWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadDish = async () => {
    if (!dishId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Join menu_category and parent restaurant so callers don't need
      // extra fetches for the detail screen header and breadcrumbs.
      const { data, error: queryError } = await supabase
        .from('dishes')
        .select(
          `
          *,
          menu_category:menu_categories (*),
          restaurant:restaurants (*)
        `
        )
        .eq('id', dishId)
        .single();

      if (queryError) {
        throw queryError;
      }

      setDish(data as DishWithRelations);
    } catch (err) {
      const error = err as Error;
      setError(error);
      console.error('Error loading dish:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDish();
  }, [dishId]);

  return { dish, loading, error, refetch: loadDish };
}
