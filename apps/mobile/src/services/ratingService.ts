/**
 * Rating Service
 *
 * Handles all backend operations for the rating system:
 * - Saving dish opinions
 * - Saving restaurant feedback
 * - Uploading photos
 * - Awarding points
 * - Creating user visits
 */

import { supabase } from '../lib/supabase';
import { DishRatingInput, RestaurantFeedbackInput, PointsEarned } from '../types/rating';

/**
 * Upload a photo to Supabase Storage
 */
export async function uploadPhoto(
  uri: string,
  type: 'dish' | 'restaurant',
  userId: string
): Promise<string | null> {
  try {
    // Generate unique filename
    const fileExt = uri.split('.').pop() || 'jpeg';
    const fileName = `${type}_${userId}_${Date.now()}.${fileExt}`;
    const filePath = `${type}_photos/${fileName}`;

    // Read file as ArrayBuffer for React Native
    const response = await fetch(uri);
    const arrayBuffer = await response.arrayBuffer();

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage.from('photos').upload(filePath, arrayBuffer, {
      contentType: 'image/jpeg',
      upsert: false,
    });

    if (error) {
      console.error('[RatingService] Error uploading photo:', error);
      return null;
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from('photos').getPublicUrl(filePath);

    return publicUrl;
  } catch (error) {
    console.error('[RatingService] Error in uploadPhoto:', error);
    return null;
  }
}

/**
 * Create a user visit record
 */
export async function createUserVisit(
  userId: string,
  restaurantId: string,
  sessionId: string | null
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('user_visits')
      .insert({
        user_id: userId,
        restaurant_id: restaurantId,
        session_id: sessionId,
        visited_at: new Date().toISOString(),
        confirmed_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      console.error('[RatingService] Error creating visit:', error);
      return null;
    }

    return data.id;
  } catch (error) {
    console.error('[RatingService] Error in createUserVisit:', error);
    return null;
  }
}

/**
 * Save dish opinions (ratings)
 */
export async function saveDishOpinions(
  userId: string,
  dishRatings: DishRatingInput[],
  visitId: string | null
): Promise<{ success: boolean; photoIds: Record<string, string> }> {
  const photoIds: Record<string, string> = {};

  try {
    for (const rating of dishRatings) {
      // Upload photo if exists
      let photoId: string | null = null;
      if (rating.photoUri) {
        const photoUrl = await uploadPhoto(rating.photoUri, 'dish', userId);
        if (photoUrl) {
          // Save photo record
          const { data: photoData, error: photoError } = await supabase
            .from('dish_photos')
            .insert({
              dish_id: rating.dishId,
              user_id: userId,
              photo_url: photoUrl,
            })
            .select('id')
            .single();

          if (!photoError && photoData) {
            photoId = photoData.id;
            photoIds[rating.dishId] = photoId;
          }
        }
      }

      // Save dish opinion
      const { error: opinionError } = await supabase.from('dish_opinions').upsert(
        {
          user_id: userId,
          dish_id: rating.dishId,
          visit_id: visitId,
          opinion: rating.opinion,
          tags: rating.tags,
          photo_id: photoId,
        },
        {
          onConflict: 'user_id,dish_id,visit_id',
        }
      );

      if (opinionError) {
        console.error('[RatingService] Error saving dish opinion:', opinionError);
      }
    }

    return { success: true, photoIds };
  } catch (error) {
    console.error('[RatingService] Error in saveDishOpinions:', error);
    return { success: false, photoIds };
  }
}

/**
 * Save restaurant feedback
 */
export async function saveRestaurantFeedback(
  userId: string,
  restaurantId: string,
  feedback: RestaurantFeedbackInput,
  visitId: string | null
): Promise<boolean> {
  try {
    // Upload photo if exists
    if (feedback.photoUri) {
      const photoUrl = await uploadPhoto(feedback.photoUri, 'restaurant', userId);
      // For now, we don't have a restaurant_photos table, so we'll skip this
      // In the future, we can add a restaurant_photos table similar to dish_photos
    }

    // Save restaurant experience response
    console.log(
      '[RatingService] Saving restaurant feedback with questionType:',
      feedback.questionType
    );

    const { error } = await supabase.from('restaurant_experience_responses').insert({
      user_id: userId,
      restaurant_id: restaurantId,
      visit_id: visitId,
      question_type: feedback.questionType,
      response: feedback.response,
    });

    if (error) {
      console.error('[RatingService] Error saving restaurant feedback:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[RatingService] Error in saveRestaurantFeedback:', error);
    return false;
  }
}

/**
 * Award points to user
 */
export async function awardPoints(
  userId: string,
  points: PointsEarned,
  dishRatings: DishRatingInput[],
  restaurantFeedback: RestaurantFeedbackInput | null
): Promise<boolean> {
  try {
    const pointsToAward: Array<{
      user_id: string;
      points: number;
      action_type: string;
      reference_id?: string;
      description: string;
    }> = [];

    // Dish rating points
    if (points.dishRatings > 0) {
      dishRatings.forEach(rating => {
        pointsToAward.push({
          user_id: userId,
          points: 10,
          action_type: 'dish_rating',
          reference_id: rating.dishId,
          description: `Rated dish: ${rating.opinion}`,
        });
      });
    }

    // Dish tag points
    if (points.dishTags > 0) {
      dishRatings
        .filter(r => r.tags.length > 0)
        .forEach(rating => {
          pointsToAward.push({
            user_id: userId,
            points: 5,
            action_type: 'dish_tags',
            reference_id: rating.dishId,
            description: `Added tags: ${rating.tags.join(', ')}`,
          });
        });
    }

    // Dish photo points
    if (points.dishPhotos > 0) {
      dishRatings
        .filter(r => r.photoUri)
        .forEach(rating => {
          pointsToAward.push({
            user_id: userId,
            points: 15,
            action_type: 'dish_photo',
            reference_id: rating.dishId,
            description: 'Added dish photo',
          });
        });
    }

    // Restaurant feedback points
    if (points.restaurantFeedback > 0 && restaurantFeedback) {
      pointsToAward.push({
        user_id: userId,
        points: 5,
        action_type: 'restaurant_question',
        description: `Answered: ${restaurantFeedback.questionType}`,
      });
    }

    // First visit bonus
    if (points.firstVisitBonus > 0) {
      pointsToAward.push({
        user_id: userId,
        points: 20,
        action_type: 'first_rating_bonus',
        description: 'First rating at this restaurant',
      });
    }

    // Insert all points
    const { error } = await supabase.from('user_points').insert(pointsToAward);

    if (error) {
      console.error('[RatingService] Error awarding points:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[RatingService] Error in awardPoints:', error);
    return false;
  }
}

/**
 * Check if user has rated any dishes at this restaurant before
 */
export async function isFirstVisitToRestaurant(
  userId: string,
  restaurantId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('user_visits')
      .select('id')
      .eq('user_id', userId)
      .eq('restaurant_id', restaurantId)
      .limit(1);

    if (error) {
      console.error('[RatingService] Error checking first visit:', error);
      return false;
    }

    return !data || data.length === 0;
  } catch (error) {
    console.error('[RatingService] Error in isFirstVisitToRestaurant:', error);
    return false;
  }
}

/**
 * Get user's total points
 */
export async function getUserTotalPoints(userId: string): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('get_user_total_points', {
      p_user_id: userId,
    });

    if (error) {
      console.error('[RatingService] Error getting total points:', error);
      return 0;
    }

    return data || 0;
  } catch (error) {
    console.error('[RatingService] Error in getUserTotalPoints:', error);
    return 0;
  }
}

/**
 * Complete rating submission (main function)
 */
export async function submitRating(
  userId: string,
  restaurantId: string,
  sessionId: string | null,
  dishRatings: DishRatingInput[],
  restaurantFeedback: RestaurantFeedbackInput | null,
  pointsEarned: PointsEarned
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[RatingService] Starting rating submission...');

    // 1. Create visit record
    const visitId = await createUserVisit(userId, restaurantId, sessionId);
    if (!visitId) {
      return { success: false, error: 'Failed to create visit record' };
    }
    console.log('[RatingService] Created visit:', visitId);

    // 2. Save dish opinions
    const { success: dishSuccess } = await saveDishOpinions(userId, dishRatings, visitId);
    if (!dishSuccess) {
      return { success: false, error: 'Failed to save dish ratings' };
    }
    console.log('[RatingService] Saved dish opinions');

    // 3. Save restaurant feedback if provided
    if (restaurantFeedback) {
      const feedbackSuccess = await saveRestaurantFeedback(
        userId,
        restaurantId,
        restaurantFeedback,
        visitId
      );
      if (!feedbackSuccess) {
        console.warn('[RatingService] Failed to save restaurant feedback (non-fatal)');
      }
    }

    // 4. Award points
    const pointsSuccess = await awardPoints(userId, pointsEarned, dishRatings, restaurantFeedback);
    if (!pointsSuccess) {
      console.warn('[RatingService] Failed to award points (non-fatal)');
    }

    console.log('[RatingService] Rating submission complete!');
    return { success: true };
  } catch (error) {
    console.error('[RatingService] Error in submitRating:', error);
    return { success: false, error: 'Unexpected error occurred' };
  }
}
