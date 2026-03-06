import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { StyleSheet, View, Alert, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import Mapbox, { MapView, Camera, UserLocation, PointAnnotation } from '@rnmapbox/maps';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { supabase } from '../lib/supabase';
import { ENV, debugLog } from '../config/environment';
import { useUserLocation } from '../hooks/useUserLocation';
import { useFilterStore } from '../stores/filterStore';
import { useViewModeStore } from '../stores/viewModeStore';
import { useRestaurantStore } from '../stores/restaurantStore';
import { useSessionStore } from '../stores/sessionStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { applyFilters, validateFilters, getFilterSuggestions } from '../services/filterService';
import type { FilterResult } from '../services/filterService';
import { getFeed, ServerDish } from '../services/edgeFunctionsService';
import { formatDistance } from '../services/geoService';
import { submitRating, isFirstVisitToRestaurant } from '../services/ratingService';
import { commonStyles, mapComponentStyles } from '@/styles';
import { colors, typography, spacing } from '@/styles/theme';
import type { MapScreenProps } from '@/types/navigation';
import type { RootStackParamList } from '@/types/navigation';

// Extracted Components
import { DailyFilterModal } from '../components/map/DailyFilterModal';
import { RestaurantMarkers } from '../components/map/RestaurantMarkers';
import { DishMarkers } from '../components/map/DishMarkers';
import { MapControls } from '../components/map/MapControls';
import { MapFooter } from '../components/map/MapFooter';
import { FloatingMenu } from '../components/FloatingMenu';
import { RatingFlowModal } from '../components/rating';
import { ProfileCompletionBanner } from '../components/ProfileCompletionBanner';
import { useAuthStore } from '../stores/authStore';
import { useOnboardingStore } from '../stores/onboardingStore';
import { DishRatingInput, RestaurantFeedbackInput } from '../types/rating';

/** Map-display view model built from DB data. Not the same as the DB Restaurant type — includes pre-computed map fields (coordinates, isOpen, etc.). */
interface MapRestaurant {
  id: string;
  name: string;
  coordinates: [number, number];
  cuisine: string;
  rating: number;
  /** Estimated average price in local currency (e.g. 20 = ~$20) */
  avgPrice: number;
  address: string;
  description: string;
  imageUrl?: string;
  phone?: string;
  isOpen: boolean;
  openingHours: { open: string; close: string };
  distance?: string;
}

/** Map-display view model for dishes. Not the same as the DB Dish type — includes pre-computed map fields (coordinates, restaurantName, etc.). */
interface MapDish {
  id: string;
  name: string;
  restaurantId: string;
  restaurantName: string;
  price: number;
  cuisine: string;
  coordinates: [number, number];
  description: string;
  imageUrl?: string;
  rating: number;
  dietary_tags: string[];
  allergens: string[];
}

/**
 * BasicMapScreen Component
 *
 * Displays a Mapbox map with restaurant markers and user location.
 * Now fetches real data from Supabase instead of using mock data.
 */
export function BasicMapScreen({ navigation }: MapScreenProps) {
  debugLog('BasicMapScreen rendered with token:', ENV.mapbox.accessToken.substring(0, 20) + '...');

  const insets = useSafeAreaInsets();
  // Get the root stack navigation for navigating to RestaurantDetail
  const rootNavigation = useNavigation<StackNavigationProp<RootStackParamList>>();

  // Use geospatial store for nearby restaurants
  const {
    nearbyRestaurants,
    loading: geoLoading,
    error: geoError,
    loadNearbyRestaurantsFromCurrentLocation,
  } = useRestaurantStore();

  const cameraRef = useRef<Camera>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [hasAutocentered, setHasAutocentered] = useState(false);
  const [isDailyFilterVisible, setIsDailyFilterVisible] = useState(false);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isRatingFlowVisible, setIsRatingFlowVisible] = useState(false);
  const [feedDishes, setFeedDishes] = useState<ServerDish[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);

  // Auth and session
  const user = useAuthStore(state => state.user);
  const currentSessionId = useSessionStore(state => state.currentSessionId);

  // Onboarding state
  const { shouldShowPrompt, isCompleted } = useOnboardingStore();
  const showOnboardingBanner = user && !isCompleted && shouldShowPrompt();

  // Session tracking for rating prompts
  const getRecentRestaurantsForRating = useSessionStore(
    state => state.getRecentRestaurantsForRating
  );
  const recentRestaurants = getRecentRestaurantsForRating();
  const showRatingBanner = recentRestaurants.length > 0 && !!user;

  // Use shallow selectors to reduce re-renders
  const daily = useFilterStore(state => state.daily);
  const permanent = useFilterStore(state => state.permanent);
  const mode = useViewModeStore(state => state.mode);

  // Helper function to parse location data
  const parseLocation = (location: any): { lat: number; lng: number } | null => {
    if (!location) return null;

    // If it's already an object with lat/lng
    if (typeof location === 'object' && location.lat && location.lng) {
      return { lat: location.lat, lng: location.lng };
    }

    // If it's a PostGIS point string like "POINT(-122.084 37.422)"
    if (typeof location === 'string') {
      if (location.startsWith('POINT')) {
        const match = location.match(/POINT\(([^ ]+) ([^ ]+)\)/);
        if (match) {
          return { lat: parseFloat(match[2]), lng: parseFloat(match[1]) };
        }
      }

      // If it's WKB hexadecimal format from PostGIS
      // Format: 0101000020E6... (starts with 0101)
      if (location.match(/^0101/)) {
        // WKB format - we need to decode the binary
        // For now, log and skip - we'll handle this with a better query
        console.warn(
          'WKB location format detected, needs proper parsing:',
          location.substring(0, 40) + '...'
        );
        return null;
      }
    }

    console.warn(
      'Unable to parse location:',
      typeof location === 'string' ? location.substring(0, 60) : location
    );
    return null;
  };

  // Convert geospatial results to the MapRestaurant shape used by markers.
  // This is now the single authoritative source — no fallback DB query.
  const restaurants = useMemo(() => {
    return nearbyRestaurants.map(r => ({
      id: r.id,
      name: r.name,
      coordinates: [r.location.lng, r.location.lat] as [number, number],
      cuisine: r.cuisine_types?.[0] || 'Unknown',
      rating: r.rating || 0,
      avgPrice: 20, // price_range not returned by geospatial endpoint; use mid-range default
      address: r.address,
      description: '',
      imageUrl: undefined,
      phone: r.phone || undefined,
      isOpen: true,
      openingHours: { open: '09:00', close: '22:00' },
      distance: formatDistance(r.distance),
    })) as MapRestaurant[];
  }, [nearbyRestaurants]);

  // Extract dish pins from the geospatial restaurant results.
  // Dishes are nested inside menus → menu_categories → dishes from the nearby-restaurants Edge Function.
  const dishes = useMemo(() => {
    const result: MapDish[] = [];
    for (const r of nearbyRestaurants) {
      const coords: [number, number] = [r.location.lng, r.location.lat];
      for (const menu of r.menus ?? []) {
        for (const dish of (menu as any).dishes ?? []) {
          result.push({
            id: dish.id,
            name: dish.name,
            restaurantId: r.id,
            restaurantName: r.name,
            price: dish.price,
            cuisine: r.cuisine_types?.[0] || 'Unknown',
            coordinates: coords,
            description: '',
            imageUrl: dish.image_url || undefined,
            rating: r.rating || 0,
            dietary_tags: dish.dietary_tags || [],
            allergens: dish.allergens || [],
          });
        }
      }
    }
    return result;
  }, [nearbyRestaurants]);

  // Apply filters to restaurants with performance optimization
  const filteredResults = useMemo(() => {
    if (geoLoading) return { restaurants: [], dishes: [] };

    debugLog('Applying filters to restaurants...');
    const result = applyFilters(restaurants, daily, permanent);
    debugLog(`Filtered ${restaurants.length} → ${result.restaurants.length} restaurants`);

    // Validate filters and log any issues
    const validation = validateFilters(daily, permanent);
    if (!validation.isValid) {
      debugLog('Filter validation errors:', validation.errors);
    }

    // Log filter suggestions if needed
    const suggestions = getFilterSuggestions(daily, permanent, result.restaurants.length);
    if (suggestions.length > 0) {
      debugLog('Filter suggestions:', suggestions);
    }

    return result;
  }, [restaurants, daily, permanent, geoLoading]);

  // Extract restaurants for easy access
  const displayedRestaurants = filteredResults.restaurants;

  // Map edge-function ServerDish results into the shape MapFooter expects.
  // Limit to 5 dishes, at most one per restaurant.
  const recommendedDishes = useMemo(() => {
    const seen = new Set<string>();
    const result: ReturnType<typeof buildDish>[] = [];

    for (const dish of feedDishes ?? []) {
      if (result.length >= 5) break;
      if (seen.has(dish.restaurant_id)) continue;
      seen.add(dish.restaurant_id);
      result.push(buildDish(dish));
    }
    return result;
  }, [feedDishes]);

  function buildDish(dish: ServerDish) {
    return {
      id: dish.id,
      name: dish.name,
      restaurantId: dish.restaurant_id,
      restaurantName: dish.restaurant?.name || 'Unknown Restaurant',
      price: dish.price,
      cuisine: dish.restaurant?.cuisine_types?.[0] || 'Unknown',
      imageUrl: dish.image_url || undefined,
      rating: dish.restaurant?.rating || 0,
      isAvailable: dish.is_available,
      dietary_tags: dish.dietary_tags || [],
      allergens: dish.allergens || [],
    };
  }

  // For the map pins, show only one pin per restaurant that has a recommended dish
  const pinnedRestaurants = useMemo(() => {
    const recommendedIds = new Set(recommendedDishes.map(d => d.restaurantId));
    const seen = new Set<string>();
    return (displayedRestaurants ?? []).filter(r => {
      if (!recommendedIds.has(r.id) || seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
  }, [displayedRestaurants, recommendedDishes]);

  const {
    location: userLocation,
    isLoading: locationLoading,
    error: locationError,
    getLocationWithPermission,
    hasPermission,
  } = useUserLocation();

  // Eagerly request location on mount so the feed can load without waiting for map auto-centering
  useEffect(() => {
    getLocationWithPermission();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch recommended dishes from the 'feed' Edge Function whenever location or filters change
  useEffect(() => {
    if (!userLocation) return;

    let cancelled = false;
    const timeoutId = setTimeout(async () => {
      setFeedLoading(true);
      try {
        const response = await getFeed(
          { lat: userLocation.latitude, lng: userLocation.longitude },
          daily,
          permanent,
          undefined, // userId intentionally omitted — swipe-based personalisation not active yet
          10 // 10km radius
        );
        if (!cancelled) {
          setFeedDishes(response.dishes);
          debugLog(
            `[BasicMapScreen] Feed loaded: ${response.dishes.length} dishes (personalized: ${response.metadata.personalized})`
          );
        }
      } catch (err) {
        console.error('[BasicMapScreen] Failed to load feed from Edge Function:', err);
      } finally {
        if (!cancelled) setFeedLoading(false);
      }
    }, 300); // debounce rapid filter changes

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [userLocation, daily, permanent]);

  // Load nearby restaurants when location is available and filters change
  // DISABLED: Edge function is failing, causing excessive re-renders and errors
  // TODO: Fix edge function deployment and re-enable
  /*
  const loadNearbyDataStable = useCallback(async () => {
    if (hasPermission && !locationLoading && userLocation) {
      debugLog('Loading nearby restaurants with geospatial search...');
      try {
        await loadNearbyRestaurantsFromCurrentLocation(
          getLocationWithPermission,
          5, // 5km radius
          daily,
          permanent
        );
        debugLog('Nearby restaurants loaded successfully');
      } catch (error) {
        console.error('[BasicMapScreen] Failed to load nearby restaurants:', error);
      }
    }
  }, [hasPermission, locationLoading, userLocation, loadNearbyRestaurantsFromCurrentLocation, getLocationWithPermission, daily, permanent]);

  useEffect(() => {
    // Debounce filter changes to prevent rapid re-fetching
    const timeoutId = setTimeout(() => {
      loadNearbyDataStable();
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [loadNearbyDataStable]);
  */

  // Auto-center map on user location when map is ready and location is available
  useEffect(() => {
    if (!isMapReady || hasAutocentered || !hasPermission || !cameraRef.current) {
      return;
    }

    const autoCenterOnLocation = async () => {
      debugLog('Auto-centering map on user location...');

      const location = await getLocationWithPermission();
      if (location && cameraRef.current) {
        cameraRef.current.setCamera({
          centerCoordinate: [location.longitude, location.latitude],
          zoomLevel: 14,
          animationDuration: 2000,
        });
        debugLog(
          'Map auto-centered on user location:',
          `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
        );
        setHasAutocentered(true);
      }
    };

    autoCenterOnLocation();
    // Only depend on state flags, not the function itself
  }, [isMapReady, hasPermission, hasAutocentered]);

  // Handler functions
  const handleMarkerPress = (restaurant: {
    id: string;
    name: string;
    coordinates: [number, number];
    isOpen: boolean;
  }) => {
    rootNavigation.navigate('RestaurantDetail', { restaurantId: restaurant.id });
  };

  // Called from DishMarkers — navigates to the dish's restaurant, not the dish itself
  const handleDishMarkerPress = (dish: {
    id: string;
    name: string;
    coordinates: [number, number];
    price: number;
    restaurantId: string;
  }) => {
    rootNavigation.navigate('RestaurantDetail', { restaurantId: dish.restaurantId });
  };

  // Called from MapFooter recommended dishes (has restaurantId, no coordinates)
  const handleDishPress = (dish: {
    id: string;
    restaurantId: string;
    name: string;
    price: number;
    cuisine: string;
    imageUrl?: string;
    rating: number;
    isAvailable: boolean;
    dietary_tags: string[];
    allergens: string[];
  }) => {
    rootNavigation.navigate('RestaurantDetail', { restaurantId: dish.restaurantId });
  };

  const handleMyLocationPress = async () => {
    debugLog('My Location button pressed');

    if (locationLoading) {
      return; // Prevent multiple requests
    }

    try {
      const location = await getLocationWithPermission();

      if (location && cameraRef.current) {
        // Animate camera to user location with smooth transition
        cameraRef.current.setCamera({
          centerCoordinate: [location.longitude, location.latitude],
          zoomLevel: 15,
          animationDuration: 1500,
        });
        debugLog(
          'Camera moved to user location:',
          `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
        );
      } else if (locationError) {
        Alert.alert('Location Unavailable', locationError, [
          { text: 'Settings', onPress: () => debugLog('Opening location settings...') },
          { text: 'Cancel', style: 'cancel' },
        ]);
      } else {
        Alert.alert(
          'Location Access',
          'Unable to get your current location. Please check your location settings and try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      debugLog('Location button error:', error);
      Alert.alert(
        'Location Error',
        'Something went wrong while getting your location. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleMenuPress = () => {
    setIsMenuVisible(!isMenuVisible);
  };

  const handleDailyFilterPress = () => {
    setIsDailyFilterVisible(true);
  };

  const closeDailyFilter = () => {
    setIsDailyFilterVisible(false);
  };

  const closeMenu = () => {
    setIsMenuVisible(false);
  };

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
    pointsEarned: any;
  }) => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to submit ratings');
      return;
    }

    const { success, error } = await submitRating(
      user.id,
      submission.restaurantId,
      currentSessionId,
      submission.dishRatings,
      submission.restaurantFeedback,
      submission.pointsEarned
    );

    if (!success) {
      Alert.alert('Error', error || 'Failed to submit rating');
    }
  };

  const handleSearchRestaurant = () => {
    // Future: Navigate to restaurant search screen
    Alert.alert('Coming Soon', 'Search for restaurants feature coming soon!');
  };

  const handleViewRewards = () => {
    // Future: Navigate to rewards/profile screen
    Alert.alert('Coming Soon', 'Rewards screen coming soon!');
  };

  const getRestaurantDishes = async (restaurantId: string) => {
    try {
      // Fetch dishes through the menu_categories table
      const { data, error } = await supabase
        .from('dishes')
        .select('*, menu_categories!inner(restaurant_id)')
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

  const handleRefresh = async () => {
    debugLog('Refreshing nearby restaurants...');
    if (hasPermission && userLocation) {
      try {
        await loadNearbyRestaurantsFromCurrentLocation(
          async () => {
            const loc = await getLocationWithPermission();
            if (!loc) throw new Error('Location unavailable');
            return { latitude: loc.latitude, longitude: loc.longitude };
          },
          5, // 5km radius
          daily,
          permanent
        );
      } catch (error) {
        console.error('[BasicMapScreen] Refresh failed:', error);
        Alert.alert('Refresh Failed', 'Unable to update nearby restaurants. Please try again.');
      }
    }
  };

  // Single loading signal — geospatial store + location permission
  const isLoading = geoLoading;

  if (isLoading && nearbyRestaurants.length === 0) {
    return (
      <View
        style={[commonStyles.containers.screen, { justifyContent: 'center', alignItems: 'center' }]}
      >
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={{ marginTop: 16, fontSize: 16, color: '#666' }}>
          {geoLoading ? 'Finding nearby restaurants...' : 'Loading restaurants...'}
        </Text>
        {userLocation && (
          <Text style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
            Searching within 5km radius
          </Text>
        )}
      </View>
    );
  }

  // Show error state if geospatial search failed (but allow fallback)
  if (geoError && nearbyRestaurants.length === 0) {
    return (
      <View
        style={[
          commonStyles.containers.screen,
          { justifyContent: 'center', alignItems: 'center', padding: 20 },
        ]}
      >
        <Text style={{ fontSize: 18, color: '#FF3B30', marginBottom: 8, textAlign: 'center' }}>
          Unable to find nearby restaurants
        </Text>
        <Text style={{ fontSize: 14, color: '#666', textAlign: 'center' }}>{geoError.message}</Text>
        <Text style={{ fontSize: 12, color: '#999', marginTop: 8, textAlign: 'center' }}>
          Please check your location permission and internet connection
        </Text>
      </View>
    );
  }

  return (
    <View style={commonStyles.containers.screen}>
      <MapView
        style={mapComponentStyles.map}
        styleURL={Mapbox.StyleURL.Dark}
        zoomEnabled={true}
        scrollEnabled={true}
        pitchEnabled={true}
        rotateEnabled={true}
        scaleBarEnabled={false}
        onDidFinishLoadingMap={() => {
          debugLog('Map finished loading successfully');
          setIsMapReady(true);
        }}
        onDidFailLoadingMap={() => {
          debugLog('Map failed to load');
          Alert.alert(
            'Map Loading Error',
            'Unable to load the map. Please check your internet connection and try again.',
            [{ text: 'OK' }]
          );
        }}
      >
        <Camera
          ref={cameraRef}
          centerCoordinate={[
            ENV.mapbox.defaultLocation.longitude,
            ENV.mapbox.defaultLocation.latitude,
          ]}
          zoomLevel={ENV.mapbox.defaultLocation.zoom}
          animationDuration={1000}
        />

        <UserLocation
          visible={true}
          showsUserHeadingIndicator={true}
          androidRenderMode="gps"
          requestsAlwaysUse={false}
        />

        {/* Conditional markers based on view mode */}
        {mode === 'restaurant' ? (
          <RestaurantMarkers restaurants={pinnedRestaurants} onMarkerPress={handleMarkerPress} />
        ) : (
          <DishMarkers dishes={dishes} onMarkerPress={handleDishMarkerPress} />
        )}
      </MapView>

      <MapControls
        onLocationPress={handleMyLocationPress}
        onMenuPress={handleMenuPress}
        locationLoading={locationLoading}
      />

      <MapFooter
        recommendedDishes={recommendedDishes}
        onDishPress={handleDishPress}
        onFilterPress={handleDailyFilterPress}
      />

      {/* Loading indicator overlay when refreshing in background */}
      {isLoading && nearbyRestaurants.length > 0 && (
        <View
          style={{
            position: 'absolute',
            top: insets.top + 16,
            left: 0,
            right: 0,
            alignItems: 'center',
            zIndex: 1000,
          }}
        >
          <View
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              paddingHorizontal: 20,
              paddingVertical: 12,
              borderRadius: 20,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <ActivityIndicator size="small" color="#FF6B35" />
            <Text style={{ marginLeft: 10, color: '#fff', fontSize: 14 }}>
              {geoLoading ? 'Updating nearby restaurants...' : 'Loading...'}
            </Text>
          </View>
        </View>
      )}

      <DailyFilterModal visible={isDailyFilterVisible} onClose={closeDailyFilter} />
      <FloatingMenu visible={isMenuVisible} onClose={closeMenu} />
      <RatingFlowModal
        visible={isRatingFlowVisible}
        recentRestaurants={recentRestaurants}
        onClose={closeRatingFlow}
        onComplete={handleRatingComplete}
        onSearchRestaurant={handleSearchRestaurant}
        onViewRewards={handleViewRewards}
        getRestaurantDishes={getRestaurantDishes}
        isFirstVisit={checkIsFirstVisit}
      />

      {/* Onboarding Banner - Gentle prompt to complete profile */}
      {showOnboardingBanner && (
        <ProfileCompletionBanner
          onStartOnboarding={() => rootNavigation.navigate('OnboardingStep1')}
        />
      )}

      {/* Rating Banner - Only show when user has viewed restaurants */}
      {showRatingBanner && (
        <View
          style={{
            position: 'absolute',
            top: insets.top + 16,
            left: 16,
            right: 16,
            zIndex: 1000,
          }}
        >
          <TouchableOpacity
            onPress={handleRatingBannerPress}
            style={{
              backgroundColor: colors.darkSecondary,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              borderRadius: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderWidth: 1,
              borderColor: colors.darkBorder,
              shadowColor: colors.black,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 3.84,
              elevation: 5,
            }}
            activeOpacity={0.8}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 20, marginRight: spacing.sm }}>🎁</Text>
              <Text
                style={{
                  color: colors.accent,
                  fontSize: typography.size.base,
                  fontWeight: typography.weight.semibold,
                }}
              >
                Rate dishes, get rewards
              </Text>
            </View>
            <Text style={{ color: colors.accent, fontSize: typography.size.lg }}>→</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default BasicMapScreen;
