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
    // Step 1: Get recent restaurant views (session_views has no FK to restaurants
    // because entity_id is polymorphic, so we can't use a PostgREST join).
    const { data: views, error: viewsError } = await supabase
      .from('session_views')
      .select('entity_id, viewed_at')
      .eq('user_id', userId)
      .eq('entity_type', 'restaurant')
      .order('viewed_at', { ascending: false });

    if (viewsError) {
      console.error('[ViewHistory] Error fetching viewed restaurants:', viewsError);
      return [];
    }

    if (!views || views.length === 0) {
      return [];
    }

    // Deduplicate entity_ids, keeping the most recent viewed_at per restaurant
    const uniqueIds = new Map<string, string>(); // entity_id → viewed_at
    for (const v of views) {
      if (!uniqueIds.has(v.entity_id)) {
        uniqueIds.set(v.entity_id, v.viewed_at ?? new Date().toISOString());
        if (uniqueIds.size >= limit) break;
      }
    }

    // Step 2: Fetch restaurant details for the unique IDs
    const { data: restaurants, error: restError } = await supabase
      .from('restaurants')
      .select('id, name, cuisine_types, image_url')
      .in('id', Array.from(uniqueIds.keys()));

    if (restError) {
      console.error('[ViewHistory] Error fetching restaurant details:', restError);
      return [];
    }

    // Build result in most-recent-first order
    const restaurantMap = new Map((restaurants ?? []).map(r => [r.id, r]));

    const result: ViewedRestaurant[] = [];
    for (const [entityId, viewedAt] of uniqueIds) {
      const r = restaurantMap.get(entityId);
      if (r) {
        result.push({
          id: r.id,
          name: r.name,
          cuisine: r.cuisine_types?.[0] || 'Restaurant',
          imageUrl: r.image_url ?? undefined,
          viewedAt: new Date(viewedAt),
        });
      }
    }

    return result;
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
