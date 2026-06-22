import { useState, useMemo } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../../stores/authStore';
import { useSessionStore } from '../../../stores/sessionStore';
import { submitRating, isFirstVisitToRestaurant } from '../../../services/ratingService';
import { supabase } from '../../../lib/supabase';
import { DishRatingInput, RestaurantFeedbackInput, type PointsEarned } from '../../../types/rating';

/**
 * useRatingFlow
 *
 * Owns the recent-restaurants derivation, rating-modal visibility, and the rating
 * submission / restaurant-dish / first-visit helpers.
 */
export function useRatingFlow() {
  const { t } = useTranslation();
  const user = useAuthStore(state => state.user);
  const currentSessionId = useSessionStore(state => state.currentSessionId);

  const [isRatingFlowVisible, setIsRatingFlowVisible] = useState(false);

  // Session tracking for rating prompts — subscribe to the raw array, derive the
  // filtered/sorted list in a memo so RatingFlowModal isn't fed a new array each render.
  const recentRestaurantsRaw = useSessionStore(state => state.recentRestaurants);
  const getRecentRestaurantsForRating = useSessionStore(
    state => state.getRecentRestaurantsForRating
  );
  const recentRestaurants = useMemo(
    () => getRecentRestaurantsForRating(),
    [recentRestaurantsRaw, getRecentRestaurantsForRating]
  );
  const showRatingBanner = recentRestaurants.length > 0 && !!user;

  const handleRatingBannerPress = () => {
    setIsRatingFlowVisible(true);
  };

  const closeRatingFlow = () => {
    setIsRatingFlowVisible(false);
  };

  const handleRatingComplete = async (submission: {
    restaurantId: string;
    dishRatings: DishRatingInput[];
    restaurantFeedback: RestaurantFeedbackInput | null;
    pointsEarned: PointsEarned;
  }) => {
    if (!user) {
      Alert.alert(t('common.error'), t('common.mustBeLoggedIn'));
      return;
    }

    const { success, error, streakResult, badgeResult } = await submitRating(
      user.id,
      submission.restaurantId,
      currentSessionId,
      submission.dishRatings,
      submission.restaurantFeedback,
      submission.pointsEarned
    );

    if (!success) {
      Alert.alert(t('common.error'), error || t('map.ratingSubmitError'));
      return;
    }

    return { streakResult, badgeResult };
  };

  const getRestaurantDishes = async (restaurantId: string) => {
    try {
      // Fetch dishes through the menu_categories table
      const { data, error } = await supabase
        .from('dishes')
        .select('*, menu_categories!inner(restaurant_id)')
        .eq('status', 'published')
        .eq('menu_categories.restaurant_id', restaurantId);

      if (error) throw error;

      return (
        data?.map(dish => ({
          id: dish.id,
          name: dish.name,
          price: dish.price,
          imageUrl: dish.image_url ?? undefined,
          viewedAt: new Date(),
        })) || []
      );
    } catch (error) {
      console.error('Error fetching dishes:', error);
      return [];
    }
  };

  const checkIsFirstVisit = async (restaurantId: string) => {
    if (!user) return false;
    return await isFirstVisitToRestaurant(user.id, restaurantId);
  };

  return {
    recentRestaurants,
    showRatingBanner,
    isRatingFlowVisible,
    handleRatingBannerPress,
    closeRatingFlow,
    handleRatingComplete,
    getRestaurantDishes,
    checkIsFirstVisit,
  };
}
