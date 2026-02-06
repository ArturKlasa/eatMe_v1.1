/**
 * Restaurant Rating Service
 *
 * Fetches aggregated restaurant ratings from materialized view
 */

import { supabase } from '../lib/supabase';

export interface RestaurantRating {
  restaurantId: string;
  overallPercentage: number;
  foodScore: number;
  serviceScore: number;
  cleanlinessScore: number;
  waitTimeScore: number;
  valueScore: number;
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
      restaurantId: data.restaurant_id,
      overallPercentage: data.overall_percentage || 0,
      foodScore: Math.round((data.food_score || 0.5) * 100),
      serviceScore: Math.round((data.service_score || 0.5) * 100),
      cleanlinessScore: Math.round((data.cleanliness_score || 0.5) * 100),
      waitTimeScore: Math.round((data.wait_time_score || 0.5) * 100),
      valueScore: Math.round((data.value_score || 0.5) * 100),
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
      ratingsMap.set(rating.restaurant_id, {
        restaurantId: rating.restaurant_id,
        overallPercentage: rating.overall_percentage || 0,
        foodScore: Math.round((rating.food_score || 0.5) * 100),
        serviceScore: Math.round((rating.service_score || 0.5) * 100),
        cleanlinessScore: Math.round((rating.cleanliness_score || 0.5) * 100),
        waitTimeScore: Math.round((rating.wait_time_score || 0.5) * 100),
        valueScore: Math.round((rating.value_score || 0.5) * 100),
      });
    });

    return ratingsMap;
  } catch (error) {
    console.error('[RestaurantRatingService] Error fetching ratings batch:', error);
    return ratingsMap;
  }
}
