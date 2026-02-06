/**
 * Dish Rating Service
 *
 * Fetches and manages dish ratings from the database
 */

import { supabase } from '../lib/supabase';

export interface DishRating {
  dishId: string;
  likePercentage: number | null;
  totalRatings: number;
  topTags: string[];
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
      .select('dish_id, like_percentage, total_ratings, top_tags')
      .in('dish_id', dishIds);

    if (error) {
      console.error('[DishRatingService] Error fetching ratings:', error);
      return ratingsMap;
    }

    // Build map
    data?.forEach(rating => {
      ratingsMap.set(rating.dish_id, {
        dishId: rating.dish_id,
        likePercentage: rating.like_percentage,
        totalRatings: rating.total_ratings || 0,
        topTags: rating.top_tags || [],
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
      .select('dish_id, like_percentage, total_ratings, top_tags')
      .eq('dish_id', dishId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      dishId: data.dish_id,
      likePercentage: data.like_percentage,
      totalRatings: data.total_ratings || 0,
      topTags: data.top_tags || [],
    };
  } catch (error) {
    console.error('[DishRatingService] Error in getDishRating:', error);
    return null;
  }
}

/**
 * Get color for rating percentage
 */
export function getRatingColor(percentage: number | null): string {
  if (percentage === null) return '#999999'; // Gray for no ratings
  if (percentage >= 80) return '#4CAF50'; // Green
  if (percentage >= 60) return '#FF9800'; // Yellow/Orange
  return '#F44336'; // Red
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

  return `${likePercentage}% ❤️ ${totalRatings}`;
}
