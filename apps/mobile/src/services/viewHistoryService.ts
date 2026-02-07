/**
 * View History Service
 *
 * Fetches user's viewed restaurant history from session_views table
 */

import { supabase } from '../lib/supabase';

export interface ViewedRestaurant {
  id: string;
  name: string;
  cuisine: string;
  imageUrl?: string;
  viewedAt: Date;
}

/**
 * Get user's recently viewed restaurants (deduplicated)
 * Returns last 15 unique restaurants ordered by most recent view
 */
export async function getViewedRestaurants(
  userId: string,
  limit: number = 15
): Promise<ViewedRestaurant[]> {
  try {
    // Get distinct restaurant views with most recent timestamp
    const { data, error } = await supabase
      .from('session_views')
      .select(
        `
        entity_id,
        viewed_at,
        restaurants!inner(
          id,
          name,
          cuisine_types,
          image_url
        )
      `
      )
      .eq('user_id', userId)
      .eq('entity_type', 'restaurant')
      .order('viewed_at', { ascending: false });

    if (error) {
      console.error('[ViewHistory] Error fetching viewed restaurants:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Deduplicate by restaurant ID, keeping most recent view
    const uniqueRestaurants = new Map<string, ViewedRestaurant>();

    for (const view of data) {
      const restaurant = (view as any).restaurants;
      if (!restaurant || uniqueRestaurants.has(restaurant.id)) {
        continue;
      }

      uniqueRestaurants.set(restaurant.id, {
        id: restaurant.id,
        name: restaurant.name,
        cuisine: restaurant.cuisine_types?.[0] || 'Restaurant',
        imageUrl: restaurant.image_url,
        viewedAt: new Date(view.viewed_at),
      });

      // Stop after we have enough unique restaurants
      if (uniqueRestaurants.size >= limit) {
        break;
      }
    }

    return Array.from(uniqueRestaurants.values());
  } catch (error) {
    console.error('[ViewHistory] Error in getViewedRestaurants:', error);
    return [];
  }
}

/**
 * Format date as "Today" or "X days ago"
 */
export function formatViewDate(date: Date): string {
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInDays === 0) {
    return 'Today';
  } else if (diffInDays === 1) {
    return 'Yesterday';
  } else if (diffInDays < 7) {
    return `${diffInDays} days ago`;
  } else if (diffInDays < 30) {
    const weeks = Math.floor(diffInDays / 7);
    return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
  } else if (diffInDays < 365) {
    const months = Math.floor(diffInDays / 30);
    return months === 1 ? '1 month ago' : `${months} months ago`;
  } else {
    const years = Math.floor(diffInDays / 365);
    return years === 1 ? '1 year ago' : `${years} years ago`;
  }
}
