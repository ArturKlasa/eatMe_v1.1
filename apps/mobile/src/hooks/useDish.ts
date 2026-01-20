import { useState, useEffect } from 'react';
import { supabase, type DishWithRelations } from '../lib/supabase';

interface UseDishResult {
  dish: DishWithRelations | null;
  loading: boolean;
  error: Error | null;
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

      const { data, error: queryError } = await supabase
        .from('dishes')
        .select(
          `
          *,
          menu:menus (*),
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
