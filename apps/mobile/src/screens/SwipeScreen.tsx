import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  getFeed,
  trackSwipe,
  generateSessionId,
  ServerDish,
} from '../services/edgeFunctionsService';
import { useFilterStore } from '../stores/filterStore';
import { useUserLocation } from '../hooks/useUserLocation';
import { useAuthStore } from '../stores/authStore';
import { trackDishInteraction } from '../services/userPreferencesService';

/**
 * SwipeScreen - Demonstration of Edge Functions Integration
 *
 * This screen shows how to use the Edge Functions (getFeed and trackSwipe)
 * to get server-filtered dishes and track user interactions.
 */
export function SwipeScreen() {
  const navigation = useNavigation();
  const { daily, permanent } = useFilterStore();
  const { location, isLoading: locationLoading } = useUserLocation();
  const { user } = useAuthStore();

  const [dishes, setDishes] = useState<ServerDish[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionId] = useState(generateSessionId());
  const [swipeStats, setSwipeStats] = useState({ right: 0, left: 0 });
  const [feedMetadata, setFeedMetadata] = useState<any>(null);

  // Load dishes from Edge Function
  useEffect(() => {
    loadDishes();
  }, [location, daily, permanent]);

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
      console.log(`[SwipeScreen] Loaded ${response.dishes.length} dishes from Edge Function`);
      console.log(`[SwipeScreen] Total available: ${response.metadata.totalAvailable}`);
      console.log(`[SwipeScreen] Personalized: ${response.metadata.personalized}`);
      console.log(`[SwipeScreen] User interactions: ${response.metadata.userInteractions}`);
      console.log(`[SwipeScreen] From cache: ${response.metadata.cached}`);
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

    // Track swipe to Edge Function (fire and forget)
    const userId = user?.id || 'anonymous';
    trackSwipe(
      userId,
      currentDish.id,
      direction,
      3000, // viewDuration in ms (you'd track this with actual timing)
      currentIndex,
      sessionId
    ).catch(err => console.error('[SwipeScreen] Failed to track swipe:', err));

    // Track interaction to database (only if authenticated)
    if (user?.id) {
      trackDishInteraction(
        user.id,
        currentDish.id,
        direction === 'right' ? 'liked' : 'disliked',
        sessionId
      ).catch(err => console.error('[SwipeScreen] Failed to track interaction:', err));
    }

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
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={styles.loadingText}>Getting your location...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading && dishes.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={styles.loadingText}>Loading dishes...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>Error: {error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadDishes}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (currentIndex >= dishes.length) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.emptyTitle}>No more dishes nearby!</Text>
          <Text style={styles.emptySubtitle}>
            Try adjusting your filters or expanding your search radius
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => setCurrentIndex(0)}>
            <Text style={styles.retryButtonText}>Start Over</Text>
          </TouchableOpacity>
          <View style={styles.statsContainer}>
            <Text style={styles.statsTitle}>Session Stats:</Text>
            <Text style={styles.statsText}>❤️ Liked: {swipeStats.right}</Text>
            <Text style={styles.statsText}>✕ Passed: {swipeStats.left}</Text>
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
        <Text style={styles.headerTitle}>Swipe Demo</Text>
        <View style={styles.statsCompact}>
          <Text style={styles.statsCompactText}>
            ❤️ {swipeStats.right} | ✕ {swipeStats.left}
          </Text>
        </View>
      </View>

      {/* Personalization Banner */}
      {feedMetadata?.personalized && feedMetadata?.userInteractions > 0 && (
        <View style={styles.personalizationBanner}>
          <Text style={styles.bannerText}>
            ✨ Personalized for you based on {feedMetadata.userInteractions} interactions
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
              <Text style={styles.placeholderText}>No Image</Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  statsCompact: {
    padding: 8,
  },
  statsCompactText: {
    fontSize: 14,
    color: '#6B7280',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  statsContainer: {
    marginTop: 32,
    padding: 16,
    backgroundColor: '#FFF',
    borderRadius: 12,
    width: '100%',
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  statsText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 4,
  },
  cardContainer: {
    flex: 1,
    padding: 16,
  },
  card: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  dishImage: {
    width: '100%',
    height: 300,
    backgroundColor: '#E5E7EB',
  },
  placeholderImage: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 18,
    color: '#9CA3AF',
  },
  infoContainer: {
    flex: 1,
    padding: 16,
  },
  dishName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  restaurantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  restaurantName: {
    fontSize: 16,
    color: '#6B7280',
    flex: 1,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  starIcon: {
    fontSize: 14,
  },
  rating: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  distance: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 8,
  },
  price: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FF6B35',
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
    marginBottom: 12,
  },
  calories: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  tag: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '500',
  },
  matchScore: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 32,
    paddingVertical: 24,
  },
  swipeButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  passButton: {
    backgroundColor: '#EF4444',
  },
  likeButton: {
    backgroundColor: '#10B981',
  },
  buttonIcon: {
    fontSize: 32,
    color: '#FFF',
  },
  backButtonText: {
    fontSize: 24,
    color: '#000',
  },
  progress: {
    textAlign: 'center',
    fontSize: 14,
    color: '#6B7280',
    paddingBottom: 16,
  },
  personalizationBanner: {
    backgroundColor: '#FF9800',
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  bannerText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
