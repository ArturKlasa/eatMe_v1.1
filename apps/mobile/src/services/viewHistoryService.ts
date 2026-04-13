import { supabase } from '../lib/supabase';

export interface ViewedRestaurant {
  id: string;
  name: string;
  cuisine: string;
  imageUrl?: string;
  viewedAt: Date;
}

/** Get user's recently viewed restaurants (deduplicated, last 15). */
export async function getViewedRestaurants(
  userId: string,
  limit: number = 15
): Promise<ViewedRestaurant[]> {
  try {
    type RecentViewRow = {
      id: string;
      name: string;
      cuisine_types: string[] | null;
      image_url: string | null;
      viewed_at: string;
    };
    // recent_viewed_restaurants is a DB view not in the generated Supabase types.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = (await (supabase as any)
      .from('recent_viewed_restaurants')
      .select('id, name, cuisine_types, image_url, viewed_at')
      .eq('user_id', userId)
      .order('viewed_at', { ascending: false })
      .limit(limit * 3)) as { data: RecentViewRow[] | null; error: { message: string } | null };

    if (error) {
      console.error('[ViewHistory] Error fetching viewed restaurants:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    const seen = new Set<string>();
    const result: ViewedRestaurant[] = [];
    for (const row of data) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      result.push({
        id: row.id,
        name: row.name,
        cuisine: (row.cuisine_types as string[])?.[0] || 'Restaurant',
        imageUrl: row.image_url ?? undefined,
        viewedAt: new Date(row.viewed_at),
      });
      if (result.length >= limit) break;
    }

    return result;
  } catch (error) {
    console.error('[ViewHistory] Error in getViewedRestaurants:', error);
    return [];
  }
}

/** Format date as "Today" or "X days ago". */
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
