/**
 * Dish Rating Service
 *
 * Fetches and manages dish ratings from the database
 */

import { supabase } from '../lib/supabase';
import { colors } from '@eatme/tokens';

/**
 * Aggregated rating data for a single dish, derived from the
 * `dish_ratings_summary` materialized view.
 *
 * Percentages are stored as 0–100 values and may be `null` when the dish has
 * received fewer than 3 ratings (not enough data to display meaningfully).
 */
export interface DishRating {
  dishId: string;
  likePercentage: number | null;
  okayPercentage: number | null;
  dislikePercentage: number | null;
  totalRatings: number;
  topTags: string[];
  recentNotes: string[];
}

/**
 * Fetch ratings for multiple dishes in a single query
 */
export async function getDishRatingsBatch(dishIds: string[]): Promise<Map<string, DishRating>> {
  const ratingsMap = new Map<string, DishRating>();

  if (dishIds.length === 0) {
    return ratingsMap;
  }

  try {
    const { data, error } = await supabase
      .from('dish_ratings_summary')
      .select('dish_id, like_percentage, okay_percentage, dislike_percentage, total_ratings, top_tags, recent_notes')
      .in('dish_id', dishIds);

    if (error) {
      console.error('[DishRatingService] Error fetching ratings:', error);
      return ratingsMap;
    }

    // Build map
    data?.forEach(rating => {
      if (!rating.dish_id) return;
      ratingsMap.set(rating.dish_id, {
        dishId: rating.dish_id,
        likePercentage: rating.like_percentage,
        okayPercentage: rating.okay_percentage,
        dislikePercentage: rating.dislike_percentage,
        totalRatings: rating.total_ratings || 0,
        topTags: rating.top_tags || [],
        recentNotes: rating.recent_notes || [],
      });
    });

    return ratingsMap;
  } catch (error) {
    console.error('[DishRatingService] Error in getDishRatingsBatch:', error);
    return ratingsMap;
  }
}

/**
 * Fetch rating for a single dish
 */
export async function getDishRating(dishId: string): Promise<DishRating | null> {
  try {
    const { data, error } = await supabase
      .from('dish_ratings_summary')
      .select('dish_id, like_percentage, okay_percentage, dislike_percentage, total_ratings, top_tags, recent_notes')
      .eq('dish_id', dishId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      dishId: data.dish_id ?? '',
      likePercentage: data.like_percentage,
      okayPercentage: data.okay_percentage,
      dislikePercentage: data.dislike_percentage,
      totalRatings: data.total_ratings || 0,
      topTags: data.top_tags || [],
      recentNotes: data.recent_notes || [],
    };
  } catch (error) {
    console.error('[DishRatingService] Error in getDishRating:', error);
    return null;
  }
}

/**
 * Get rating tier based on like percentage and total ratings
 */
export function getRatingTier(
  likePercentage: number | null,
  totalRatings: number
): 'top' | 'good' | 'neutral' | 'none' {
  if (likePercentage === null || totalRatings === 0) return 'none';
  if (likePercentage >= 90 && totalRatings >= 20) return 'top';
  if (likePercentage >= 75 && totalRatings >= 5) return 'good';
  if (likePercentage >= 60 && totalRatings >= 3) return 'neutral';
  return 'none';
}

/**
 * Get color for rating percentage
 */
export function getRatingColor(percentage: number | null): string {
  if (percentage === null) return colors.darkTextMuted;
  if (percentage >= 80) return colors.success;
  if (percentage >= 60) return colors.warning;
  return colors.error;
}

/**
 * Fetch the most recent opinion per dish for a given user
 */
export async function getUserDishOpinions(
  userId: string,
  dishIds: string[]
): Promise<Map<string, import('../types/rating').DishOpinion>> {
  const map = new Map<string, import('../types/rating').DishOpinion>();

  if (dishIds.length === 0) return map;

  try {
    const { data, error } = await supabase
      .from('dish_opinions')
      .select('dish_id, opinion, created_at')
      .eq('user_id', userId)
      .in('dish_id', dishIds)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[DishRatingService] Error fetching user dish opinions:', error);
      return map;
    }

    // Keep only the most recent opinion per dish
    data?.forEach(row => {
      if (row.dish_id && !map.has(row.dish_id)) {
        map.set(row.dish_id, row.opinion as import('../types/rating').DishOpinion);
      }
    });
  } catch (error) {
    console.error('[DishRatingService] Error in getUserDishOpinions:', error);
  }

  return map;
}

/**
 * Format rating display text
 */
export function formatRatingText(
  likePercentage: number | null,
  totalRatings: number
): string | null {
  if (totalRatings === 0 || likePercentage === null) {
    return null;
  }

  return `${likePercentage}% 👍 (${totalRatings})`;
}
