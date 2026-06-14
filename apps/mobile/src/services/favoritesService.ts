import { supabase as _supabase } from '../lib/supabase';
import type { FavoriteRow } from '../lib/supabase';
import { type Result, ok, err } from '../lib/result';
import { recordInteraction } from './interactionService';
// favorites table is not in generated DB types yet (migration 064).
// Narrow cast to bypass the table union until supabase gen types is re-run.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;

export type FavoriteSubjectType = 'restaurant' | 'dish';

export interface Favorite {
  id: string;
  user_id: string;
  subject_type: FavoriteSubjectType;
  subject_id: string;
  created_at: string;
}

/** Add item to favorites. */
export async function addToFavorites(
  userId: string,
  subjectType: FavoriteSubjectType,
  subjectId: string
): Promise<Result<Favorite>> {
  try {
    const { data, error } = (await supabase
      .from('favorites')
      .insert({
        user_id: userId,
        subject_type: subjectType,
        subject_id: subjectId,
      })
      .select()
      .single()) as unknown as {
      data: FavoriteRow | null;
      error: { message: string; code: string } | null;
    };

    if (error) {
      if (error.code === '23505') return err('Already in favorites');
      return err(error.message);
    }

    return ok(data as Favorite);
  } catch (e) {
    return err(e as Error);
  }
}

/** Remove item from favorites. */
export async function removeFromFavorites(
  userId: string,
  subjectType: FavoriteSubjectType,
  subjectId: string
): Promise<Result<void>> {
  try {
    const { error } = (await supabase
      .from('favorites')
      .delete()
      .eq('user_id', userId)
      .eq('subject_type', subjectType)
      .eq('subject_id', subjectId)) as unknown as {
      error: { message: string; code: string } | null;
    };

    if (error) return err(error.message);
    return ok(undefined);
  } catch (e) {
    return err(e as Error);
  }
}

/** Check if item is favorited. */
export async function isFavorited(
  userId: string,
  subjectType: FavoriteSubjectType,
  subjectId: string
): Promise<Result<boolean>> {
  try {
    const { data, error } = (await supabase
      .from('favorites')
      .select('id')
      .eq('user_id', userId)
      .eq('subject_type', subjectType)
      .eq('subject_id', subjectId)
      .single()) as unknown as {
      data: { id: string } | null;
      error: { message: string; code: string } | null;
    };

    if (error) {
      // PGRST116 = no rows returned → not favorited (not an error)
      if (error.code === 'PGRST116') return ok(false);
      return err(error.message);
    }

    return ok(!!data);
  } catch (e) {
    return err(e as Error);
  }
}

/** Get all user favorites. */
export async function getUserFavorites(
  userId: string,
  subjectType?: FavoriteSubjectType
): Promise<Result<Favorite[]>> {
  try {
    let query = supabase
      .from('favorites')
      .select('id, user_id, subject_type, subject_id, created_at')
      .eq('user_id', userId);

    if (subjectType) {
      query = query.eq('subject_type', subjectType);
    }

    const { data, error } = (await query.order('created_at', { ascending: false })) as unknown as {
      data: FavoriteRow[] | null;
      error: { message: string; code: string } | null;
    };

    if (error) return err(error.message);
    return ok(data as Favorite[]);
  } catch (e) {
    return err(e as Error);
  }
}

/** Toggle favorite status. */
export async function toggleFavorite(
  userId: string,
  subjectType: FavoriteSubjectType,
  subjectId: string
): Promise<Result<boolean>> {
  try {
    // Delete-first: one round-trip to un-favourite. .select() returns the deleted rows, so a
    // non-empty result means it was favourited (now removed); an empty result means it wasn't,
    // so we add it. Halves the round-trips on the un-favourite path vs a separate check + mutate.
    const { data: deleted, error: delError } = (await supabase
      .from('favorites')
      .delete()
      .eq('user_id', userId)
      .eq('subject_type', subjectType)
      .eq('subject_id', subjectId)
      .select('id')) as unknown as {
      data: { id: string }[] | null;
      error: { message: string; code: string } | null;
    };

    if (delError) return err(delError.message);
    if (deleted && deleted.length > 0) {
      return ok(false);
    }

    const addResult = await addToFavorites(userId, subjectType, subjectId);
    if (!addResult.ok && addResult.error !== 'Already in favorites') return addResult;
    // Record 'saved' interaction for dish favourites only (not restaurants)
    if (subjectType === 'dish') {
      recordInteraction(userId, subjectId, 'saved');
    }
    return ok(true);
  } catch (e) {
    return err(e as Error);
  }
}

/** Favorited dish with display details (joined from `dishes` + parent restaurant). */
export interface FavoriteDish {
  id: string;
  name: string;
  price: number;
  imageUrl?: string;
  displayPricePrefix?: string;
  restaurantId: string;
  restaurantName: string;
  currencyCode?: string | null;
}

/** Favorited restaurant with display details (joined from `restaurants`). */
export interface FavoriteRestaurant {
  id: string;
  name: string;
  imageUrl?: string;
  cuisine?: string;
}

export interface FavoritesDetailed {
  dishes: FavoriteDish[];
  restaurants: FavoriteRestaurant[];
}

/**
 * Fetch the user's favorites with display details, newest-favorited first.
 *
 * `getUserFavorites` only returns subject ids; this joins each to its `dishes`
 * (with parent restaurant name + currency) or `restaurants` row so the Favorites
 * screen can render cards. Subjects that no longer exist or are unpublished are
 * skipped silently.
 */
export async function getFavoritesDetailed(userId: string): Promise<Result<FavoritesDetailed>> {
  const favResult = await getUserFavorites(userId);
  if (!favResult.ok) return favResult;

  const favorites = favResult.data;
  const dishIds = favorites.filter(f => f.subject_type === 'dish').map(f => f.subject_id);
  const restaurantIds = favorites
    .filter(f => f.subject_type === 'restaurant')
    .map(f => f.subject_id);

  try {
    const [dishRes, restRes] = await Promise.all([
      dishIds.length
        ? supabase
            .from('dishes')
            .select(
              'id, name, price, image_url, display_price_prefix, restaurant_id, restaurant:restaurants(name, currency_code)'
            )
            .in('id', dishIds)
            .eq('status', 'published')
        : Promise.resolve({ data: [], error: null }),
      restaurantIds.length
        ? supabase
            .from('restaurants')
            .select('id, name, image_url, cuisine_types')
            .in('id', restaurantIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (dishRes.error) return err(dishRes.error.message);
    if (restRes.error) return err(restRes.error.message);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dishById = new Map<string, FavoriteDish>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const d of (dishRes.data ?? []) as any[]) {
      dishById.set(d.id, {
        id: d.id,
        name: d.name,
        price: d.price,
        imageUrl: d.image_url ?? undefined,
        displayPricePrefix: d.display_price_prefix ?? undefined,
        restaurantId: d.restaurant_id,
        restaurantName: d.restaurant?.name ?? '',
        currencyCode: d.restaurant?.currency_code ?? undefined,
      });
    }

    const restById = new Map<string, FavoriteRestaurant>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const r of (restRes.data ?? []) as any[]) {
      restById.set(r.id, {
        id: r.id,
        name: r.name,
        imageUrl: r.image_url ?? undefined,
        cuisine: Array.isArray(r.cuisine_types) ? r.cuisine_types[0] : undefined,
      });
    }

    // Re-order to match the favorites list (getUserFavorites is newest-first).
    const dishes: FavoriteDish[] = [];
    const restaurants: FavoriteRestaurant[] = [];
    for (const f of favorites) {
      if (f.subject_type === 'dish') {
        const d = dishById.get(f.subject_id);
        if (d) dishes.push(d);
      } else {
        const r = restById.get(f.subject_id);
        if (r) restaurants.push(r);
      }
    }

    return ok({ dishes, restaurants });
  } catch (e) {
    return err(e as Error);
  }
}
