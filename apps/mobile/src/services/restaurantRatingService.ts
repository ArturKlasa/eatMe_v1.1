/**
 * Restaurant Rating Service
 *
 * Fetches aggregated restaurant ratings from materialized view
 */

import { supabase } from '../lib/supabase';

/**
 * Aggregated restaurant-level rating data, derived from the
 * `restaurant_ratings_summary` materialized view.
 *
 * `foodScore` is a 0–100 composite of dish like/dislike ratios.
 * All `*Percentage` fields represent the share of positive responses
 * for that experience dimension (0–100).
 */
export interface RestaurantRating {
  restaurantId: string;
  foodScore: number;
  totalDishRatings: number;
  servicePercentage: number;
  cleanlinessPercentage: number;
  waitTimePercentage: number;
  valuePercentage: number;
  wouldRecommendPercentage: number;
  overallPercentage: number;
  totalExperienceResponses: number;
}

/**
 * Get rating for a single restaurant
 */
export async function getRestaurantRating(restaurantId: string): Promise<RestaurantRating | null> {
  try {
    const { data, error } = await supabase
      .from('restaurant_ratings_summary')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      restaurantId: data.restaurant_id ?? '',
      foodScore: data.food_score || 0,
      totalDishRatings: data.total_dish_ratings || 0,
      servicePercentage: data.service_percentage || 0,
      cleanlinessPercentage: data.cleanliness_percentage || 0,
      waitTimePercentage: data.wait_time_percentage || 0,
      valuePercentage: data.value_percentage || 0,
      wouldRecommendPercentage: data.would_recommend_percentage || 0,
      overallPercentage: data.overall_percentage || 0,
      totalExperienceResponses: data.total_experience_responses || 0,
    };
  } catch (error) {
    console.error('[RestaurantRatingService] Error fetching rating:', error);
    return null;
  }
}

/**
 * Get ratings for multiple restaurants (batch)
 */
export async function getRestaurantRatingsBatch(
  restaurantIds: string[]
): Promise<Map<string, RestaurantRating>> {
  const ratingsMap = new Map<string, RestaurantRating>();

  if (restaurantIds.length === 0) return ratingsMap;

  try {
    const { data, error } = await supabase
      .from('restaurant_ratings_summary')
      .select('*')
      .in('restaurant_id', restaurantIds);

    if (error || !data) {
      return ratingsMap;
    }

    data.forEach(rating => {
      if (!rating.restaurant_id) return;
      ratingsMap.set(rating.restaurant_id ?? '', {
        restaurantId: rating.restaurant_id,
        foodScore: rating.food_score || 0,
        totalDishRatings: rating.total_dish_ratings || 0,
        servicePercentage: rating.service_percentage || 0,
        cleanlinessPercentage: rating.cleanliness_percentage || 0,
        waitTimePercentage: rating.wait_time_percentage || 0,
        valuePercentage: rating.value_percentage || 0,
        wouldRecommendPercentage: rating.would_recommend_percentage || 0,
        overallPercentage: rating.overall_percentage || 0,
        totalExperienceResponses: rating.total_experience_responses || 0,
      });
    });

    return ratingsMap;
  } catch (error) {
    console.error('[RestaurantRatingService] Error fetching ratings batch:', error);
    return ratingsMap;
  }
}
