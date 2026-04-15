import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { StyleSheet, View, Alert, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import Mapbox, { MapView, Camera, UserLocation, PointAnnotation } from '@rnmapbox/maps';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { supabase } from '../lib/supabase';
import { ENV, debugLog } from '../config/environment';
import { useUserLocation } from '../hooks/useUserLocation';
import { useFilterStore } from '../stores/filterStore';
import { useShallow } from 'zustand/react/shallow';
import { useViewModeStore } from '../stores/viewModeStore';
import { useRestaurantStore } from '../stores/restaurantStore';
import { useSessionStore } from '../stores/sessionStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { estimateAvgPrice } from '../services/filterService';
import { getCombinedFeed, ServerDish, ServerRestaurant } from '../services/edgeFunctionsService';
import { formatDistance } from '../services/geoService';
import { isRestaurantOpenNow } from '../utils/i18nUtils';
import { submitRating, isFirstVisitToRestaurant } from '../services/ratingService';
import { commonStyles, mapComponentStyles } from '@/styles';
import { colors, typography, spacing } from '@/styles/theme';
import type { MapScreenProps } from '@/types/navigation';
import type { RootStackParamList } from '@/types/navigation';
import { useTranslation } from 'react-i18next';

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
import { DishRatingInput, RestaurantFeedbackInput, type PointsEarned } from '../types/rating';

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
  /** Raw numeric distance from the Edge Function in km — used for sorting. */
  distanceKm?: number;
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
  const { t } = useTranslation();

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
  const [footerHeight, setFooterHeight] = useState(0);
  const [hasAutocentered, setHasAutocentered] = useState(false);
  const [isDailyFilterVisible, setIsDailyFilterVisible] = useState(false);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isRatingFlowVisible, setIsRatingFlowVisible] = useState(false);
  const [feedDishes, setFeedDishes] = useState<ServerDish[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [filteredRestaurants, setFilteredRestaurants] = useState<ServerRestaurant[]>([]);

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
  const { daily, permanent } = useFilterStore(
    useShallow(state => ({ daily: state.daily, permanent: state.permanent }))
  );
  const mode = useViewModeStore(state => state.mode);

  // Convert geospatial results to the MapRestaurant shape used by markers.
  // This is now the single authoritative source — no fallback DB query.
  const restaurants = useMemo(() => {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const today = days[new Date().getDay()];
    return nearbyRestaurants.map(r => {
      const openHours = r.open_hours ?? null;
      const todayEntry = openHours?.[today] ?? null;
      return {
        id: r.id,
        name: r.name,
        coordinates: [r.location.lng, r.location.lat] as [number, number],
        cuisine: r.cuisine_types?.[0] || 'Unknown',
        rating: r.rating || 0,
        avgPrice: estimateAvgPrice(r.service_speed, r.restaurant_type),
        address: r.address,
        description: '',
        imageUrl: undefined,
        phone: r.phone || undefined,
        isOpen: isRestaurantOpenNow(openHours),
        openingHours: todayEntry ?? { open: '09:00', close: '22:00' },
        distance: formatDistance(r.distance),
        distanceKm: r.distance,
      };
    }) as MapRestaurant[];
  }, [nearbyRestaurants]);

  // Extract dish pins from the geospatial restaurant results.
  // Dishes are nested inside menus → menu_categories → dishes from the nearby-restaurants Edge Function.
  const dishes = useMemo(() => {
    const result: MapDish[] = [];
    for (const r of nearbyRestaurants) {
      const coords: [number, number] = [r.location.lng, r.location.lat];
      for (const menu of r.menus ?? []) {
        for (const dish of menu.dishes ?? []) {
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

  // filteredRestaurants is now populated by the Edge Function (getFilteredRestaurants)
  // via the useEffect below. No client-side filtering is performed here.

  // Extract restaurants for easy access
  const displayedRestaurants = filteredRestaurants;

  // Map edge-function ServerDish results into the shape MapFooter expects.
  // Limit to 5 dishes, at most one per restaurant.
  // Drinks and desserts are excluded server-side (generate_candidates) but we
  // also apply a lightweight client-side check as a safety net for uncategorised items.
  const recommendedDishes = useMemo(() => {
    const DRINK_KEYWORDS =
      /\b(coffee|espresso|latte|cappuccino|americano|macchiato|mocha|tea|chai|matcha|juice|smoothie|milkshake|soda|cola|lemonade|limeade|water|sparkling|mocktail|cocktail|beer|wine|sangria|margarita|mojito|spritz|kombucha|hot chocolate|iced tea)\b/i;
    const DESSERT_KEYWORDS =
      /\b(cake|cupcake|brownie|cookie|ice cream|gelato|sorbet|tiramisu|cheesecake|pudding|mousse|crème brûlée|creme brulee|macaron|donut|doughnut|muffin|pie à la mode|sundae|churro|baklava|flan|panna cotta|parfait)\b/i;

    const seen = new Set<string>();
    const result: ReturnType<typeof buildDish>[] = [];

    for (const dish of feedDishes ?? []) {
      if (result.length >= 5) break;
      if (seen.has(dish.restaurant_id)) continue;
      // Skip drinks and desserts that slipped past the server filter
      if (DRINK_KEYWORDS.test(dish.name) || DESSERT_KEYWORDS.test(dish.name)) continue;
      seen.add(dish.restaurant_id);
      result.push(buildDish(dish));
    }
    return result;
  }, [feedDishes]);

  function buildDish(dish: ServerDish) {
    // The Edge Function may return restaurant info nested (restaurant.name)
    // or flat (restaurant_name) depending on version. Handle both.
    const flatDish = dish as ServerDish & {
      restaurant_name?: string;
      restaurant_cuisines?: string[];
      restaurant_rating?: number;
    };
    return {
      id: dish.id,
      name: dish.name,
      restaurantId: dish.restaurant_id,
      restaurantName: dish.restaurant?.name || flatDish.restaurant_name || 'Unknown Restaurant',
      price: dish.price,
      cuisine:
        dish.restaurant?.cuisine_types?.[0] || flatDish.restaurant_cuisines?.[0] || 'Unknown',
      imageUrl: dish.image_url || undefined,
      isAvailable: dish.is_available,
      dietary_tags: dish.dietary_tags || [],
      allergens: dish.allergens || [],
    };
  }

  // Convert ServerRestaurant[] from the Edge Function to the shape RestaurantMarkers expects.
  // Shows ALL filtered restaurants (not just ones with recommended dishes).
  const mapPinRestaurants = useMemo(() => {
    return filteredRestaurants
      .filter(r => r.location?.lat != null && r.location?.lng != null)
      .map(r => ({
        id: r.id,
        name: r.name,
        coordinates: [r.location!.lng, r.location!.lat] as [number, number],
        isOpen: r.is_open ?? true,
      }));
  }, [filteredRestaurants]);

  // Convert feed dishes to map pin shape, looking up restaurant coordinates
  // from filteredRestaurants (since feedDishes don't carry location data).
  const mapPinDishes = useMemo(() => {
    const coordsMap = new Map<string, [number, number]>();
    for (const r of filteredRestaurants) {
      if (r.location?.lat != null && r.location?.lng != null) {
        coordsMap.set(r.id, [r.location.lng, r.location.lat]);
      }
    }
    return (feedDishes ?? [])
      .filter(d => coordsMap.has(d.restaurant_id))
      .map(d => {
        return {
          id: d.id,
          name: d.name,
          restaurantId: d.restaurant_id,
          coordinates: coordsMap.get(d.restaurant_id)!,
          price: d.price,
        };
      });
  }, [feedDishes, filteredRestaurants]);

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

  // Fetch dishes + restaurants in a single combined call whenever location or filters change
  useEffect(() => {
    if (!userLocation) return;

    let cancelled = false;
    const timeoutId = setTimeout(async () => {
      setFeedLoading(true);
      try {
        const response = await getCombinedFeed(
          { lat: userLocation.latitude, lng: userLocation.longitude },
          daily,
          permanent,
          user?.id,
          Math.max(2, daily.maxDistance) // respect user's distance preference (min 2km floor)
        );
        if (!cancelled) {
          const dishes = response.dishes ?? [];
          const restaurants = response.restaurants ?? [];
          setFeedDishes(dishes);
          setFilteredRestaurants(restaurants);
          debugLog(
            `[BasicMapScreen] Feed loaded: ${dishes.length} dishes + ${restaurants.length} restaurants (personalized: ${response.metadata?.personalized})`
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
        Alert.alert(t('map.locationUnavailable'), locationError, [
          { text: 'Settings', onPress: () => debugLog('Opening location settings...') },
          { text: t('common.cancel'), style: 'cancel' },
        ]);
      } else {
        Alert.alert(t('map.locationUnavailable'), t('map.locationAccessError'), [
          { text: t('common.ok') },
        ]);
      }
    } catch (error) {
      debugLog('Location button error:', error);
      Alert.alert(t('map.locationError'), t('map.locationErrorMessage'), [
        { text: t('common.ok') },
      ]);
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

  const handleSearchRestaurant = () => {
    // Future: Navigate to restaurant search screen
    Alert.alert(t('common.comingSoon'), t('common.searchComingSoon'));
  };

  const handleViewRewards = () => {
    // Future: Navigate to rewards/profile screen
    Alert.alert(t('common.comingSoon'), t('common.rewardsComingSoon'));
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
        Alert.alert(t('map.refreshFailed'), t('map.refreshFailedMessage'));
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
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={{ marginTop: 16, fontSize: 16, color: colors.textSecondary }}>
          {geoLoading ? 'Finding nearby restaurants...' : 'Loading restaurants...'}
        </Text>
        {userLocation && (
          <Text style={{ marginTop: 8, fontSize: 12, color: colors.textTertiary }}>
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
        <Text style={{ fontSize: 18, color: colors.error, marginBottom: 8, textAlign: 'center' }}>
          {t('map.noNearbyRestaurants')}
        </Text>
        <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center' }}>
          {geoError.message}
        </Text>
        <Text
          style={{ fontSize: 12, color: colors.textTertiary, marginTop: 8, textAlign: 'center' }}
        >
          {t('map.checkLocationPermission')}
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
          Alert.alert(t('map.mapLoadErrorTitle'), t('map.mapLoadError'), [
            { text: t('common.ok') },
          ]);
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
          <RestaurantMarkers restaurants={mapPinRestaurants} onMarkerPress={handleMarkerPress} />
        ) : (
          <DishMarkers dishes={mapPinDishes} onMarkerPress={handleDishMarkerPress} />
        )}
      </MapView>

      <MapControls
        onLocationPress={handleMyLocationPress}
        onMenuPress={handleMenuPress}
        locationLoading={locationLoading}
        footerHeight={footerHeight}
      />

      <View
        onLayout={e => setFooterHeight(e.nativeEvent.layout.height)}
        style={{ backgroundColor: colors.dark }}
      >
        <MapFooter
          recommendedDishes={recommendedDishes}
          onDishPress={handleDishPress}
          onFilterPress={handleDailyFilterPress}
        />
      </View>

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
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={{ marginLeft: 10, color: colors.white, fontSize: 14 }}>
              {geoLoading ? t('map.updatingRestaurants') : t('common.loading')}
            </Text>
          </View>
        </View>
      )}

      <DailyFilterModal visible={isDailyFilterVisible} onClose={closeDailyFilter} />
      <FloatingMenu visible={isMenuVisible} onClose={closeMenu} footerHeight={footerHeight} />
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
            top: insets.top,
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
                {t('map.rateDishesGetRewards')}
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
