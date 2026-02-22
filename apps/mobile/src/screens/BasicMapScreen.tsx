import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { StyleSheet, View, Alert, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import Mapbox, { MapView, Camera, UserLocation, PointAnnotation } from '@rnmapbox/maps';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { supabase } from '../lib/supabase';
import { ENV, debugLog } from '../config/environment';
import { useUserLocation } from '../hooks/useUserLocation';
import { useRestaurants, useAllDishes } from '../hooks';
import { useFilterStore } from '../stores/filterStore';
import { useViewModeStore } from '../stores/viewModeStore';
import { useRestaurantStore } from '../stores/restaurantStore';
import { useSessionStore } from '../stores/sessionStore';
import { applyFilters, validateFilters, getFilterSuggestions } from '../services/filterService';
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

/**
 * BasicMapScreen Component
 *
 * Displays a Mapbox map with restaurant markers and user location.
 * Now fetches real data from Supabase instead of using mock data.
 */
export function BasicMapScreen({ navigation }: MapScreenProps) {
  debugLog('BasicMapScreen rendered with token:', ENV.mapbox.accessToken.substring(0, 20) + '...');

  // Get the root stack navigation for navigating to RestaurantDetail
  const rootNavigation = useNavigation<StackNavigationProp<RootStackParamList>>();

  // Use geospatial store for nearby restaurants
  const {
    nearbyRestaurants,
    loading: geoLoading,
    error: geoError,
    loadNearbyRestaurantsFromCurrentLocation,
  } = useRestaurantStore();

  // Fallback to old data hooks if needed
  const {
    restaurants: dbRestaurants,
    loading: restaurantsLoading,
    error: restaurantsError,
  } = useRestaurants();
  const { dishes: dbDishes, loading: dishesLoading, error: dishesError } = useAllDishes();

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

  // Convert Supabase data to match existing Restaurant/Dish types
  const restaurants = useMemo(() => {
    // Prefer geospatial search results if available
    if (nearbyRestaurants && nearbyRestaurants.length > 0) {
      debugLog(`Using ${nearbyRestaurants.length} nearby restaurants from geospatial search`);
      return nearbyRestaurants.map(r => {
        const priceSymbols = ['$', '$$', '$$$', '$$$$'];
        const priceRange = priceSymbols[Math.min((r.price_level || 1) - 1, 3)] as
          | '$'
          | '$$'
          | '$$$'
          | '$$$$';

        return {
          id: r.id,
          name: r.name,
          coordinates: [r.location.lng, r.location.lat] as [number, number],
          cuisine: r.cuisine_types?.[0] || 'Unknown',
          rating: r.rating || 4.5,
          priceRange,
          address: r.address,
          description: '',
          imageUrl: undefined,
          phone: r.phone || undefined,
          isOpen: true,
          openingHours: {
            open: '09:00',
            close: '22:00',
          },
          distance: formatDistance(r.distance), // Add distance from geospatial search
        };
      }) as Restaurant[];
    }

    // Fallback to old method if geospatial search hasn't loaded yet
    debugLog('Falling back to dbRestaurants');
    return dbRestaurants
      .map(r => {
        // Guard against null/undefined location
        if (!r || !r.location) {
          console.warn('Restaurant missing location data:', r?.id);
          return null;
        }

        const location = parseLocation(r.location);
        if (!location) return null;

        // Convert price_range number to $ symbols
        const priceSymbols = ['$', '$$', '$$$', '$$$$'];
        const priceRange = priceSymbols[Math.min(r.price_range - 1, 3)] as
          | '$'
          | '$$'
          | '$$$'
          | '$$$$';

        return {
          id: r.id,
          name: r.name,
          coordinates: [location.lng, location.lat] as [number, number], // GeoJSON format
          cuisine: r.cuisine_types?.[0] || 'Unknown',
          rating: 4.5, // TODO: Add rating to database
          priceRange,
          address: r.address,
          description: r.description || '',
          imageUrl: undefined,
          phone: r.phone || undefined,
          isOpen: true, // TODO: Calculate from operating_hours
          openingHours: {
            open: '09:00',
            close: '22:00',
          }, // TODO: Parse from operating_hours
        };
      })
      .filter(r => r !== null) as Restaurant[];
  }, [dbRestaurants, nearbyRestaurants]);

  const dishes = useMemo(() => {
    return dbDishes
      .map(d => {
        // Guard against null/undefined restaurant or location
        if (!d || !d.restaurant || !d.restaurant.location) {
          console.warn('Dish missing restaurant location data:', d?.id);
          return null;
        }

        const location = parseLocation(d.restaurant.location);
        if (!location) return null;

        // Determine price range from price
        let priceRange: '$' | '$$' | '$$$' | '$$$$';
        if (d.price < 10) priceRange = '$';
        else if (d.price < 20) priceRange = '$$';
        else if (d.price < 40) priceRange = '$$$';
        else priceRange = '$$$$';

        return {
          id: d.id,
          name: d.name,
          restaurantId: d.restaurant_id,
          restaurantName: d.restaurant.name,
          price: d.price,
          priceRange,
          cuisine: d.restaurant.cuisine_types?.[0] || 'Unknown',
          coordinates: [location.lng, location.lat] as [number, number], // GeoJSON format
          description: d.description || '',
          imageUrl: d.image_url || undefined,
          rating: 4.5, // TODO: Add rating to database
          isAvailable: d.is_available,
          // Include diet/allergen fields for filtering
          dietary_tags: d.dietary_tags || [],
          allergens: d.allergens || [],
        };
      })
      .filter(d => d !== null) as Dish[];
  }, [dbDishes]);

  // Apply filters to restaurants with performance optimization
  const filteredResults = useMemo(() => {
    if (restaurantsLoading) return { restaurants: [], dishes: [] };

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
  }, [restaurants, daily, permanent, restaurantsLoading]);

  // Extract restaurants for easy access
  const displayedRestaurants = filteredResults.restaurants;

  // Map edge-function ServerDish results into the shape MapFooter expects
  const recommendedDishes = useMemo(() => {
    return feedDishes.map(dish => {
      let priceRange: '$' | '$$' | '$$$' | '$$$$';
      if (dish.price < 10) priceRange = '$';
      else if (dish.price < 20) priceRange = '$$';
      else if (dish.price < 40) priceRange = '$$$';
      else priceRange = '$$$$';

      return {
        id: dish.id,
        name: dish.name,
        restaurantId: dish.restaurant_id,
        restaurantName: dish.restaurant?.name || 'Unknown Restaurant',
        price: dish.price,
        priceRange,
        cuisine: dish.restaurant?.cuisine_types?.[0] || 'Unknown',
        imageUrl: dish.image_url || undefined,
        rating: dish.restaurant?.rating || 0,
        isAvailable: dish.is_available,
        dietary_tags: dish.dietary_tags || [],
        allergens: dish.allergens || [],
      };
    });
  }, [feedDishes]);

  // Debug logging
  console.log('=== SUPABASE DATA DEBUG ===');
  console.log('Raw DB restaurants:', dbRestaurants.length);
  console.log('First restaurant raw:', dbRestaurants[0]);
  console.log('Restaurants from DB:', restaurants.length);
  console.log('First restaurant parsed:', restaurants[0]);
  console.log('Dishes from DB:', dishes.length);
  console.log('First dish dietary_tags:', dishes[0]?.dietary_tags);
  console.log('Recommended dishes after filter:', recommendedDishes.length);
  console.log('Restaurants after filtering:', displayedRestaurants.length);
  console.log('Filter state - daily:', daily);
  console.log('Filter state - permanent:', permanent);
  console.log('First restaurant coordinates:', displayedRestaurants[0]?.coordinates);
  console.log('Map center:', [
    ENV.mapbox.defaultLocation.longitude,
    ENV.mapbox.defaultLocation.latitude,
  ]);
  console.log('========================');

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
          user?.id,
          10 // 10km radius
        );
        if (!cancelled) {
          setFeedDishes(response.dishes);
          console.log(
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
  }, [userLocation, daily, permanent, user?.id]);

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
  const handleMarkerPress = (restaurant: Restaurant) => {
    // Navigate to restaurant detail screen
    rootNavigation.navigate('RestaurantDetail', { restaurantId: restaurant.id });
  };

  const handleDishPress = (dish: Dish) => {
    // Navigate to restaurant detail screen
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
          imageUrl: dish.photo_url,
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
          getLocationWithPermission,
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

  // Show loading state while fetching data
  const isLoading = restaurantsLoading || dishesLoading || geoLoading;

  if (isLoading && nearbyRestaurants.length === 0 && restaurants.length === 0) {
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
  if (geoError && nearbyRestaurants.length === 0 && restaurants.length === 0) {
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

  // Show error state if data fetch failed
  if (restaurantsError || dishesError) {
    return (
      <View
        style={[
          commonStyles.containers.screen,
          { justifyContent: 'center', alignItems: 'center', padding: 20 },
        ]}
      >
        <Text style={{ fontSize: 18, color: '#FF3B30', marginBottom: 8, textAlign: 'center' }}>
          Failed to load data
        </Text>
        <Text style={{ fontSize: 14, color: '#666', textAlign: 'center' }}>
          {restaurantsError?.message || dishesError?.message}
        </Text>
        <Text style={{ fontSize: 12, color: '#999', marginTop: 8, textAlign: 'center' }}>
          Please check your internet connection and Supabase configuration
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
          <RestaurantMarkers restaurants={displayedRestaurants} onMarkerPress={handleMarkerPress} />
        ) : (
          <DishMarkers dishes={dishes} onMarkerPress={handleDishPress} />
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
      {isLoading && restaurants.length > 0 && (
        <View
          style={{
            position: 'absolute',
            top: 60,
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
        <ProfileCompletionBanner onPress={() => rootNavigation.navigate('OnboardingStep1')} />
      )}

      {/* Rating Banner - Only show when user has viewed restaurants */}
      {showRatingBanner && (
        <View
          style={{
            position: 'absolute',
            top: 16,
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
