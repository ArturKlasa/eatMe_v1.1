import { useState, useEffect } from 'react';
import { supabase, type RestaurantWithMenus } from '../lib/supabase';

interface UseRestaurantsOptions {
  location?: { lat: number; lng: number };
  limit?: number;
  cuisines?: string[];
}

interface UseRestaurantsResult {
  restaurants: RestaurantWithMenus[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch restaurants from Supabase
 * Optionally filters by location proximity and cuisine types
 */
export function useRestaurants(options: UseRestaurantsOptions = {}): UseRestaurantsResult {
  const { location, limit = 50, cuisines } = options;
  const [restaurants, setRestaurants] = useState<RestaurantWithMenus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadRestaurants = async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
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

      // Filter by cuisine types if provided
      if (cuisines && cuisines.length > 0) {
        query = query.overlaps('cuisine_types', cuisines);
      }

      // Apply limit
      if (limit) {
        query = query.limit(limit);
      }

      const { data, error: queryError } = await query;

      if (queryError) {
        throw queryError;
      }

      // TODO: If location is provided, sort by distance using PostGIS
      // For now, just return all restaurants
      setRestaurants((data as RestaurantWithMenus[]) || []);
    } catch (err) {
      const error = err as Error;
      setError(error);
      console.error('Error loading restaurants:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRestaurants();
  }, [location?.lat, location?.lng, limit, cuisines?.join(',')]);

  return { restaurants, loading, error, refetch: loadRestaurants };
}
