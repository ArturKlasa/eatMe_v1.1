/**
 * Favorites Service
 * Handles adding/removing restaurants and dishes to/from user favorites
 */

import { supabase } from '../lib/supabase';

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
): Promise<{ data: Favorite | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('favorites')
      .insert({
        user_id: userId,
        subject_type: subjectType,
        subject_id: subjectId,
      })
      .select()
      .single();

    if (error) {
      // Check if it's a duplicate error (already favorited)
      if (error.code === '23505') {
        return { data: null, error: new Error('Already in favorites') };
      }
      return { data: null, error: new Error(error.message) };
    }

    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Remove item from favorites
 */
export async function removeFromFavorites(
  userId: string,
  subjectType: FavoriteSubjectType,
  subjectId: string
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', userId)
      .eq('subject_type', subjectType)
      .eq('subject_id', subjectId);

    if (error) {
      return { error: new Error(error.message) };
    }

    return { error: null };
  } catch (err) {
    return { error: err as Error };
  }
}

/**
 * Check if item is favorited
 */
export async function isFavorited(
  userId: string,
  subjectType: FavoriteSubjectType,
  subjectId: string
): Promise<{ isFavorited: boolean; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('favorites')
      .select('id')
      .eq('user_id', userId)
      .eq('subject_type', subjectType)
      .eq('subject_id', subjectId)
      .single();

    if (error) {
      // PGRST116 means no rows returned (not favorited)
      if (error.code === 'PGRST116') {
        return { isFavorited: false, error: null };
      }
      return { isFavorited: false, error: new Error(error.message) };
    }

    return { isFavorited: !!data, error: null };
  } catch (err) {
    return { isFavorited: false, error: err as Error };
  }
}

/**
 * Get all user favorites
 */
export async function getUserFavorites(
  userId: string,
  subjectType?: FavoriteSubjectType
): Promise<{ data: Favorite[] | null; error: Error | null }> {
  try {
    let query = supabase.from('favorites').select('*').eq('user_id', userId);

    if (subjectType) {
      query = query.eq('subject_type', subjectType);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Toggle favorite (add if not favorited, remove if already favorited)
 */
export async function toggleFavorite(
  userId: string,
  subjectType: FavoriteSubjectType,
  subjectId: string
): Promise<{ isFavorited: boolean; error: Error | null }> {
  try {
    // Check current status
    const { isFavorited: currentlyFavorited } = await isFavorited(userId, subjectType, subjectId);

    if (currentlyFavorited) {
      // Remove from favorites
      const { error } = await removeFromFavorites(userId, subjectType, subjectId);
      if (error) return { isFavorited: true, error };
      return { isFavorited: false, error: null };
    } else {
      // Add to favorites
      const { error } = await addToFavorites(userId, subjectType, subjectId);
      if (error && error.message !== 'Already in favorites') {
        return { isFavorited: false, error };
      }
      return { isFavorited: true, error: null };
    }
  } catch (err) {
    return { isFavorited: false, error: err as Error };
  }
}
