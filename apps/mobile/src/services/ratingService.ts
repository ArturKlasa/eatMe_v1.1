import { supabase } from '../lib/supabase';
import {
  DishRatingInput,
  DishOpinion,
  DishTag,
  RestaurantFeedbackInput,
  PointsEarned,
} from '../types/rating';
import { debugLog } from '../config/environment';
import { recordInteraction } from './interactionService';
import {
  updateStreak,
  checkAndAwardTrustedTasterBadge,
  StreakResult,
  BadgeResult,
} from './gamificationService';

/** Upload a photo to Supabase Storage. */
export async function uploadPhoto(
  uri: string,
  type: 'dish' | 'restaurant',
  userId: string
): Promise<string | null> {
  try {
    const fileExt = uri.split('.').pop() || 'jpeg';
    const fileName = `${type}_${userId}_${Date.now()}.${fileExt}`;
    const filePath = `${type}_photos/${fileName}`;

    const response = await fetch(uri);
    const arrayBuffer = await response.arrayBuffer();

    const { data, error } = await supabase.storage.from('photos').upload(filePath, arrayBuffer, {
      contentType: 'image/jpeg',
      upsert: false,
    });

    if (error) {
      console.error('[RatingService] Error uploading photo:', error);
      return null;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('photos').getPublicUrl(filePath);

    return publicUrl;
  } catch (error) {
    console.error('[RatingService] Error in uploadPhoto:', error);
    return null;
  }
}

/** Create a user visit record. */
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

/** Save dish opinions (ratings). */
export async function saveDishOpinions(
  userId: string,
  dishRatings: DishRatingInput[],
  visitId: string | null
): Promise<{ success: boolean; photoIds: Record<string, string> }> {
  const photoIds: Record<string, string> = {};

  try {
    for (const rating of dishRatings) {
      let photoId: string | null = null;
      if (rating.photoUri) {
        const photoUrl = await uploadPhoto(rating.photoUri, 'dish', userId);
        if (photoUrl) {
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

      const { error: opinionError } = await supabase.from('dish_opinions').upsert(
        {
          user_id: userId,
          dish_id: rating.dishId,
          visit_id: visitId,
          opinion: rating.opinion,
          tags: rating.tags,
          photo_id: photoId,
          note: rating.note ?? null,
          source: 'full_flow',
        },
        {
          onConflict: 'user_id,dish_id,visit_id',
        }
      );

      if (opinionError) {
        console.error('[RatingService] Error saving dish opinion:', opinionError);
      } else {
        // 'disliked' intentionally NOT recorded — disliking at one restaurant
        // doesn't mean the user dislikes that category. Feed exclusion handled
        // separately via user_dish_interactions from the swipe/feed layer.
        if (rating.opinion === 'liked' || rating.opinion === 'okay') {
          recordInteraction(userId, rating.dishId, 'liked');
        }
      }
    }

    return { success: true, photoIds };
  } catch (error) {
    console.error('[RatingService] Error in saveDishOpinions:', error);
    return { success: false, photoIds };
  }
}

/** Save restaurant feedback. */
export async function saveRestaurantFeedback(
  userId: string,
  restaurantId: string,
  feedback: RestaurantFeedbackInput,
  visitId: string | null
): Promise<boolean> {
  try {
    if (feedback.photoUri) {
      await uploadPhoto(feedback.photoUri, 'restaurant', userId);
    }

    debugLog(
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

/** Award points to user. */
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

    if (points.dishPhotos > 0) {
      dishRatings
        .filter(r => r.photoUri)
        .forEach(rating => {
          pointsToAward.push({
            user_id: userId,
            points: 20,
            action_type: 'dish_photo',
            reference_id: rating.dishId,
            description: 'Added dish photo',
          });
        });
    }

    if (points.restaurantFeedback > 0 && restaurantFeedback) {
      pointsToAward.push({
        user_id: userId,
        points: 5,
        action_type: 'restaurant_question',
        description: `Answered: ${restaurantFeedback.questionType}`,
      });
    }

    if (points.firstVisitBonus > 0) {
      pointsToAward.push({
        user_id: userId,
        points: 20,
        action_type: 'first_rating_bonus',
        description: 'First rating at this restaurant',
      });
    }

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

/** Check if user has rated any dishes at this restaurant before. */
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

/** Get user's total points. */
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

/** Submit an in-context dish rating (quick rating from RestaurantDetailScreen). */
export async function submitInContextRating(
  userId: string,
  restaurantId: string,
  dishId: string,
  _dishName: string,
  opinion: DishOpinion,
  tags: DishTag[],
  sessionId: string | null
): Promise<{
  success: boolean;
  error?: string;
  streakResult?: StreakResult | null;
  badgeResult?: BadgeResult | null;
}> {
  try {
    const { data: existingVisit } = await supabase
      .from('user_visits')
      .select('id')
      .eq('user_id', userId)
      .eq('restaurant_id', restaurantId)
      .eq('source', 'in_context')
      .gte('visited_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(1)
      .maybeSingle();

    let visitId: string;

    if (existingVisit) {
      visitId = existingVisit.id;
    } else {
      const { data: newVisit, error: visitError } = await supabase
        .from('user_visits')
        .insert({
          user_id: userId,
          restaurant_id: restaurantId,
          session_id: sessionId,
          visited_at: new Date().toISOString(),
          confirmed_at: new Date().toISOString(),
          source: 'in_context',
        })
        .select('id')
        .single();

      if (visitError || !newVisit) {
        console.error('[RatingService] Error creating in-context visit:', visitError);
        return { success: false, error: 'Failed to create visit record' };
      }

      visitId = newVisit.id;
    }

    const { error: opinionError } = await supabase.from('dish_opinions').upsert(
      {
        user_id: userId,
        dish_id: dishId,
        visit_id: visitId,
        opinion,
        tags,
        source: 'in_context',
      },
      { onConflict: 'user_id,dish_id,visit_id' }
    );

    if (opinionError) {
      console.error('[RatingService] Error saving in-context opinion:', opinionError);
      return { success: false, error: 'Failed to save dish rating' };
    }

    if (opinion === 'liked') {
      recordInteraction(userId, dishId, 'liked', sessionId ?? undefined);
    } else if (opinion === 'disliked') {
      recordInteraction(userId, dishId, 'disliked', sessionId ?? undefined);
    }
    // 'okay' is neutral — not recorded so it doesn't affect the preference vector

    const pointsToAward: Array<{
      user_id: string;
      points: number;
      action_type: string;
      reference_id?: string;
      description: string;
    }> = [
      {
        user_id: userId,
        points: 10,
        action_type: 'dish_rating',
        reference_id: dishId,
        description: `In-context rating: ${opinion}`,
      },
    ];

    if (tags.length > 0) {
      pointsToAward.push({
        user_id: userId,
        points: 5,
        action_type: 'dish_tags',
        reference_id: dishId,
        description: `In-context tags: ${tags.join(', ')}`,
      });
    }

    supabase
      .from('user_points')
      .insert(pointsToAward)
      .then(({ error }) => {
        if (error) {
          console.warn('[RatingService] Failed to award in-context points (non-fatal):', error);
        }
      });

    const [streakResult, badgeResult] = await Promise.all([
      updateStreak(userId).catch(() => null),
      checkAndAwardTrustedTasterBadge(userId).catch(() => null),
    ]);

    return { success: true, streakResult, badgeResult };
  } catch (error) {
    console.error('[RatingService] Error in submitInContextRating:', error);
    return { success: false, error: 'Unexpected error occurred' };
  }
}

/** Complete rating submission (main function). */
export async function submitRating(
  userId: string,
  restaurantId: string,
  sessionId: string | null,
  dishRatings: DishRatingInput[],
  restaurantFeedback: RestaurantFeedbackInput | null,
  pointsEarned: PointsEarned
): Promise<{
  success: boolean;
  error?: string;
  streakResult?: StreakResult | null;
  badgeResult?: BadgeResult | null;
}> {
  try {
    debugLog('[RatingService] Starting rating submission...');

    const visitId = await createUserVisit(userId, restaurantId, sessionId);
    if (!visitId) {
      return { success: false, error: 'Failed to create visit record' };
    }
    debugLog('[RatingService] Created visit:', visitId);

    const { success: dishSuccess } = await saveDishOpinions(userId, dishRatings, visitId);
    if (!dishSuccess) {
      return { success: false, error: 'Failed to save dish ratings' };
    }
    debugLog('[RatingService] Saved dish opinions');

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

    const pointsSuccess = await awardPoints(userId, pointsEarned, dishRatings, restaurantFeedback);
    if (!pointsSuccess) {
      console.warn('[RatingService] Failed to award points (non-fatal)');
    }

    const [streakResult, badgeResult] = await Promise.all([
      updateStreak(userId).catch(() => null),
      checkAndAwardTrustedTasterBadge(userId).catch(() => null),
    ]);

    debugLog('[RatingService] Rating submission complete!');
    return { success: true, streakResult, badgeResult };
  } catch (error) {
    console.error('[RatingService] Error in submitRating:', error);
    return { success: false, error: 'Unexpected error occurred' };
  }
}
