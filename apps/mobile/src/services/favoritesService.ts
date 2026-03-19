/**
 * Favorites Service
 * Handles adding/removing restaurants and dishes to/from user favorites
 */

import { supabase as _supabase } from '../lib/supabase';
import { type Result, ok, err } from '../lib/result';
import { recordInteraction } from './interactionService';
// favorites table is not yet in the generated DB types — use untyped client
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

/**
 * Add item to favorites
 */
export async function addToFavorites(
  userId: string,
  subjectType: FavoriteSubjectType,
  subjectId: string
): Promise<Result<Favorite>> {
  try {
    const { data, error } = (await (supabase.from('favorites') as any)
      .insert({
        user_id: userId,
        subject_type: subjectType,
        subject_id: subjectId,
      })
      .select()
      .single()) as { data: any; error: any };

    if (error) {
      if (error.code === '23505') return err('Already in favorites');
      return err(error.message);
    }

    return ok(data as Favorite);
  } catch (e) {
    return err(e as Error);
  }
}

/**
 * Remove item from favorites
 */
export async function removeFromFavorites(
  userId: string,
  subjectType: FavoriteSubjectType,
  subjectId: string
): Promise<Result<void>> {
  try {
    const { error } = (await (supabase.from('favorites') as any)
      .delete()
      .eq('user_id', userId)
      .eq('subject_type', subjectType)
      .eq('subject_id', subjectId)) as { error: any };

    if (error) return err(error.message);
    return ok(undefined);
  } catch (e) {
    return err(e as Error);
  }
}

/**
 * Check if item is favorited.
 * Returns ok(true) if favorited, ok(false) if not, err(...) on DB failure.
 */
export async function isFavorited(
  userId: string,
  subjectType: FavoriteSubjectType,
  subjectId: string
): Promise<Result<boolean>> {
  try {
    const { data, error } = await (supabase.from('favorites') as any)
      .select('id')
      .eq('user_id', userId)
      .eq('subject_type', subjectType)
      .eq('subject_id', subjectId)
      .single();

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

/**
 * Get all user favorites
 */
export async function getUserFavorites(
  userId: string,
  subjectType?: FavoriteSubjectType
): Promise<Result<Favorite[]>> {
  try {
    let query = (supabase.from('favorites') as any)
      .select('id, user_id, subject_type, subject_id, created_at')
      .eq('user_id', userId);

    if (subjectType) {
      query = query.eq('subject_type', subjectType);
    }

    const { data, error } = (await query.order('created_at', { ascending: false })) as {
      data: any;
      error: any;
    };

    if (error) return err(error.message);
    return ok(data as Favorite[]);
  } catch (e) {
    return err(e as Error);
  }
}

/**
 * Toggle favorite (add if not favorited, remove if already favorited).
 * Returns ok(true) if now favorited, ok(false) if now unfavorited.
 */
export async function toggleFavorite(
  userId: string,
  subjectType: FavoriteSubjectType,
  subjectId: string
): Promise<Result<boolean>> {
  try {
    const checkResult = await isFavorited(userId, subjectType, subjectId);
    if (!checkResult.ok) return checkResult;

    if (checkResult.data) {
      const removeResult = await removeFromFavorites(userId, subjectType, subjectId);
      if (!removeResult.ok) return removeResult;
      return ok(false);
    } else {
      const addResult = await addToFavorites(userId, subjectType, subjectId);
      if (!addResult.ok && addResult.error !== 'Already in favorites') return addResult;
      // Record 'saved' interaction for dish favourites only (not restaurants)
      if (subjectType === 'dish') {
        recordInteraction(userId, subjectId, 'saved');
      }
      return ok(true);
    }
  } catch (e) {
    return err(e as Error);
  }
}
