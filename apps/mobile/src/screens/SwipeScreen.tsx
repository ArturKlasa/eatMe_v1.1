import React, { useState, useEffect, useRef, useMemo } from 'react';
import { debugLog } from '../config/environment';
import { View, Text, TouchableOpacity, ActivityIndicator, Image, ScrollView } from 'react-native';
import { styles } from './SwipeScreen.styles';
import { colors } from '@eatme/tokens';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  getFeed,
  trackSwipe,
  generateSessionId,
  ServerDish,
  type FeedResponse,
} from '../services/edgeFunctionsService';
import { useFilterStore } from '../stores/filterStore';
import { useUserLocation } from '../hooks/useUserLocation';
import { useAuthStore } from '../stores/authStore';

/**
 * SwipeScreen - Dish feed with personalised Edge Functions integration
 *
 * This screen shows how to use the Edge Functions (getFeed and trackSwipe)
 * to get server-filtered dishes and track user interactions.
 */
export function SwipeScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();

  // Use shallow selectors to prevent re-renders
  const daily = useFilterStore(state => state.daily);
  const permanent = useFilterStore(state => state.permanent);
  const { location, isLoading: locationLoading } = useUserLocation();
  const user = useAuthStore(state => state.user);

  const [dishes, setDishes] = useState<ServerDish[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [swipeStats, setSwipeStats] = useState({ right: 0, left: 0 });
  const [feedMetadata, setFeedMetadata] = useState<FeedResponse['metadata'] | null>(null);

  // Stable session ID that doesn't change on re-render
  const sessionIdRef = useRef(generateSessionId());
  const sessionId = sessionIdRef.current;

  // Track if initial load has been done
  const hasLoadedRef = useRef(false);

  // Load dishes from Edge Function - only when location is ready
  useEffect(() => {
    if (location && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadDishes();
    }
  }, [location]);

  // Reload when filters change (after initial load)
  useEffect(() => {
    if (hasLoadedRef.current && location) {
      loadDishes();
    }
  }, [daily, permanent]);

  async function loadDishes() {
    if (!location) {
      setError('Location not available');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await getFeed(
        { lat: location.latitude, lng: location.longitude },
        daily,
        permanent,
        user?.id, // Pass authenticated user ID
        10 // radius in km
      );

      setDishes(response.dishes);
      setFeedMetadata(response.metadata);
      debugLog(`[SwipeScreen] Loaded ${response.dishes.length} dishes from Edge Function`);
      debugLog(`[SwipeScreen] Total available: ${response.metadata.totalAvailable}`);
      debugLog(`[SwipeScreen] Personalized: ${response.metadata.personalized}`);
      debugLog(`[SwipeScreen] User interactions: ${response.metadata.userInteractions}`);
      debugLog(`[SwipeScreen] From cache: ${response.metadata.cached}`);
    } catch (err) {
      console.error('[SwipeScreen] Failed to load dishes:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dishes');
    } finally {
      setLoading(false);
    }
  }

  async function handleSwipe(direction: 'left' | 'right') {
    const currentDish = dishes[currentIndex];
    if (!currentDish) return;

    // Update local stats
    setSwipeStats(prev => ({
      ...prev,
      [direction]: prev[direction] + 1,
    }));

    // Track swipe to Edge Function (fire and forget).
    // trackSwipe writes to user_swipes via the Edge Function — that is the
    // single authoritative record. user_dish_interactions is redundant.
    const userId = user?.id || 'anonymous';
    trackSwipe(
      userId,
      currentDish.id,
      direction,
      3000, // viewDuration in ms (you'd track this with actual timing)
      currentIndex,
      sessionId
    ).catch(err => console.error('[SwipeScreen] Failed to track swipe:', err));

    // Move to next dish
    setCurrentIndex(prev => prev + 1);

    // Load more dishes if running low
    if (currentIndex >= dishes.length - 3) {
      loadDishes();
    }
  }

  const currentDish = dishes[currentIndex];

  if (locationLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>{t('swipe.gettingLocation')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading && dishes.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>{t('swipe.loadingDishes')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>
            {t('common.error')}: {error}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadDishes}>
            <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (currentIndex >= dishes.length) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.emptyTitle}>{t('swipe.noMoreDishes')}</Text>
          <Text style={styles.emptySubtitle}>{t('swipe.noMoreDishesHint')}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => setCurrentIndex(0)}>
            <Text style={styles.retryButtonText}>{t('swipe.startOver')}</Text>
          </TouchableOpacity>
          <View style={styles.statsContainer}>
            <Text style={styles.statsTitle}>{t('swipe.sessionStats')}</Text>
            <Text style={styles.statsText}>
              ❤️ {t('swipe.liked')}: {swipeStats.right}
            </Text>
            <Text style={styles.statsText}>
              ✕ {t('swipe.passed')}: {swipeStats.left}
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('swipe.title')}</Text>
        <View style={styles.statsCompact}>
          <Text style={styles.statsCompactText}>
            ❤️ {swipeStats.right} | ✕ {swipeStats.left}
          </Text>
        </View>
      </View>

      {/* Personalization Banner */}
      {feedMetadata?.personalized && (feedMetadata?.userInteractions ?? 0) > 0 && (
        <View style={styles.personalizationBanner}>
          <Text style={styles.bannerText}>
            ✨ {t('swipe.personalizedBanner', { count: feedMetadata.userInteractions })}
          </Text>
        </View>
      )}

      {/* Dish Card */}
      <View style={styles.cardContainer}>
        <View style={styles.card}>
          {currentDish.image_url ? (
            <Image source={{ uri: currentDish.image_url }} style={styles.dishImage} />
          ) : (
            <View style={[styles.dishImage, styles.placeholderImage]}>
              <Text style={styles.placeholderText}>{t('swipe.noImage')}</Text>
            </View>
          )}

          <ScrollView style={styles.infoContainer}>
            <Text style={styles.dishName}>{currentDish.name}</Text>

            {currentDish.restaurant && (
              <View style={styles.restaurantInfo}>
                <Text style={styles.restaurantName}>{currentDish.restaurant.name}</Text>
                {currentDish.restaurant.rating && (
                  <View style={styles.ratingContainer}>
                    <Text style={styles.starIcon}>⭐</Text>
                    <Text style={styles.rating}>{currentDish.restaurant.rating}</Text>
                  </View>
                )}
              </View>
            )}

            {currentDish.distance_km !== undefined && (
              <Text style={styles.distance}>{currentDish.distance_km.toFixed(1)} km away</Text>
            )}

            <Text style={styles.price}>${currentDish.price.toFixed(2)}</Text>

            {currentDish.description && (
              <Text style={styles.description}>{currentDish.description}</Text>
            )}

            {currentDish.calories && (
              <Text style={styles.calories}>{currentDish.calories} calories</Text>
            )}

            {currentDish.dietary_tags && currentDish.dietary_tags.length > 0 && (
              <View style={styles.tagsContainer}>
                {currentDish.dietary_tags.map((tag, index) => (
                  <View key={index} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            )}

            {currentDish.score !== undefined && (
              <Text style={styles.matchScore}>Match Score: {currentDish.score.toFixed(0)}%</Text>
            )}
          </ScrollView>
        </View>
      </View>

      {/* Swipe Buttons */}
      <View style={styles.buttonsContainer}>
        <TouchableOpacity
          style={[styles.swipeButton, styles.passButton]}
          onPress={() => handleSwipe('left')}
        >
          <Text style={styles.buttonIcon}>✕</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.swipeButton, styles.likeButton]}
          onPress={() => handleSwipe('right')}
        >
          <Text style={styles.buttonIcon}>♥</Text>
        </TouchableOpacity>
      </View>

      {/* Progress */}
      <Text style={styles.progress}>
        {currentIndex + 1} / {dishes.length}
      </Text>
    </SafeAreaView>
  );
}
