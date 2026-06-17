import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { StyleSheet, View, Alert, Text, TouchableOpacity } from 'react-native';
import Mapbox, { MapView, Camera, UserLocation, PointAnnotation } from '@rnmapbox/maps';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { supabase } from '../lib/supabase';
import { ENV, debugLog } from '../config/environment';
import { useUserLocation } from '../hooks/useUserLocation';
import { useCountryDetectionStore } from '../stores/countryDetectionStore';
import { useFilterStore } from '../stores/filterStore';
import { useShallow } from 'zustand/react/shallow';
import { useViewModeStore } from '../stores/viewModeStore';
import { useSessionStore } from '../stores/sessionStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  composeCardName,
  getCombinedFeedAutoExpand,
  ServerDish,
  ServerRestaurant,
} from '../services/edgeFunctionsService';
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

  // Onboarding state — narrow selectors + memoized derivation (no whole-store
  // subscription, no per-render new Date()).
  const isCompleted = useOnboardingStore(state => state.isCompleted);
  const lastPromptShown = useOnboardingStore(state => state.lastPromptShown);
  const showOnboardingBanner = useMemo(
    () => !!user && !isCompleted && useOnboardingStore.getState().shouldShowPrompt(),
    [user, isCompleted, lastPromptShown]
  );

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

  // Use shallow selectors to reduce re-renders
  const { daily, permanent } = useFilterStore(
    useShallow(state => ({ daily: state.daily, permanent: state.permanent }))
  );
  const mode = useViewModeStore(state => state.mode);

  // Map edge-function ServerDish results into the shape MapFooter expects.
  // Full deduped list (one dish per restaurant); the footer/map page through it in
  // batches of PAGE_SIZE via "Get more dishes".
  // Drinks and desserts are excluded server-side (generate_candidates) but we
  // also apply a lightweight client-side check as a safety net for uncategorised items.
  const allRecommendedDishes = useMemo(() => {
    const DRINK_KEYWORDS =
      /\b(coffee|espresso|latte|cappuccino|americano|macchiato|mocha|tea|chai|matcha|juice|smoothie|milkshake|soda|cola|lemonade|limeade|water|sparkling|mocktail|cocktail|beer|wine|sangria|margarita|mojito|spritz|kombucha|hot chocolate|iced tea)\b/i;
    const DESSERT_KEYWORDS =
      /\b(cake|cupcake|brownie|cookie|ice cream|gelato|sorbet|tiramisu|cheesecake|pudding|mousse|crème brûlée|creme brulee|macaron|donut|doughnut|muffin|pie à la mode|sundae|churro|baklava|flan|panna cotta|parfait)\b/i;

    const seen = new Set<string>();
    const result: ReturnType<typeof buildDish>[] = [];

    for (const dish of feedDishes ?? []) {
      if (seen.has(dish.restaurant_id)) continue;
      // Skip drinks and desserts that slipped past the server filter
      if (DRINK_KEYWORDS.test(dish.name) || DESSERT_KEYWORDS.test(dish.name)) continue;
      seen.add(dish.restaurant_id);
      result.push(buildDish(dish));
    }
    return result;
  }, [feedDishes]);

  // "Get more dishes" pages through the already-fetched feed, PAGE_SIZE restaurants
  // at a time. Resets to page 0 whenever a fresh feed loads (see the feed effect).
  const PAGE_SIZE = 5;
  const [dishPage, setDishPage] = useState(0);
  const recommendedDishes = useMemo(
    () => allRecommendedDishes.slice(dishPage * PAGE_SIZE, dishPage * PAGE_SIZE + PAGE_SIZE),
    [allRecommendedDishes, dishPage]
  );
  const hasMoreDishes = allRecommendedDishes.length > (dishPage + 1) * PAGE_SIZE;
  const handleShowMore = useCallback(() => setDishPage(p => p + 1), []);

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
      // Compose the card name from applied_options (Hybrid A+C). Falls back
      // to dish.name when no descriptors qualify.
      name: composeCardName(dish),
      restaurantId: dish.restaurant_id,
      restaurantName: dish.restaurant?.name || flatDish.restaurant_name || 'Unknown Restaurant',
      // Prefer the feed-resolved effective_price (default options applied);
      // fall back to base price when the feed didn't customise.
      price: dish.effective_price ?? dish.price,
      cuisine:
        dish.restaurant?.cuisine_types?.[0] || flatDish.restaurant_cuisines?.[0] || 'Unknown',
      currencyCode: dish.restaurant?.currency_code ?? null,
      imageUrl: dish.image_url || undefined,
      isAvailable: dish.is_available,
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

  // Pins follow the dishes currently shown in the footer (recommendedDishes), so the
  // map shows only the ~5 restaurants backing the visible cards — not the whole feed.
  // Coordinates come from filteredRestaurants (dishes don't carry location); cuisine
  // rides along for the marker emoji.
  const mapPinDishes = useMemo(() => {
    const coordsMap = new Map<string, [number, number]>();
    for (const r of filteredRestaurants) {
      if (r.location?.lat != null && r.location?.lng != null) {
        coordsMap.set(r.id, [r.location.lng, r.location.lat]);
      }
    }
    return recommendedDishes
      .filter(d => coordsMap.has(d.restaurantId))
      .map(d => ({
        id: d.id,
        name: d.name,
        restaurantId: d.restaurantId,
        coordinates: coordsMap.get(d.restaurantId)!,
        price: d.price,
        cuisine: d.cuisine,
      }));
  }, [recommendedDishes, filteredRestaurants]);

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
  }, [getLocationWithPermission]);

  // Refine country/currency from GPS once permission is granted (idempotent — store no-ops if already done).
  useEffect(() => {
    if (hasPermission) {
      useCountryDetectionStore.getState().refineFromGPS();
    }
  }, [hasPermission]);

  // Fetch dishes + restaurants in a single combined call whenever location or filters change.
  // Keyed on a primitive signature (rounded coords + serialized filters + user id) rather than
  // object identity: GPS returns a fresh userLocation object for near-identical coords, and the
  // filter store spreads new daily/permanent on every interaction, so identity deps re-fire the
  // /feed call spuriously. ~110m rounding matches the feed cache's geohash granularity.
  const feedLat = userLocation ? userLocation.latitude.toFixed(3) : null;
  const feedLng = userLocation ? userLocation.longitude.toFixed(3) : null;
  const dailyKey = JSON.stringify(daily);
  const permanentKey = JSON.stringify(permanent);
  useEffect(() => {
    if (!userLocation) return;

    let cancelled = false;
    const timeoutId = setTimeout(async () => {
      setFeedLoading(true);
      try {
        // Start at 1.5km and auto-expand (→3→5km) only if a radius yields no dishes. Hard-capped
        // at 5km inside the helper — past that generate_candidates hits the statement timeout.
        const response = await getCombinedFeedAutoExpand(
          { lat: userLocation.latitude, lng: userLocation.longitude },
          daily,
          permanent,
          user?.id,
          daily.maxDistance, // ceiling (helper caps at min(5, this))
          () => cancelled
        );
        if (!cancelled && response) {
          const dishes = response.dishes ?? [];
          const restaurants = response.restaurants ?? [];
          setFeedDishes(dishes);
          setFilteredRestaurants(restaurants);
          setDishPage(0); // reset "get more" paging on a fresh feed
          debugLog(
            `[BasicMapScreen] Feed loaded @${response.radiusUsedKm}km: ${dishes.length} dishes + ${restaurants.length} restaurants (personalized: ${response.metadata?.personalized})`
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
    // Deps are the primitive signature, NOT the objects: it IS the semantic identity of
    // (location, filters, user), and depending on the objects is exactly what re-fires /feed
    // on identity churn. userLocation/daily/permanent are read from the closure, consistent
    // with the signature. (The repo has no react-hooks/exhaustive-deps rule, so no disable.)
  }, [feedLat, feedLng, dailyKey, permanentKey, user?.id]);

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
  }, [isMapReady, hasPermission, hasAutocentered, getLocationWithPermission]);

  // Handler functions
  const handleMarkerPress = useCallback(
    (restaurant: { id: string; name: string; coordinates: [number, number]; isOpen: boolean }) => {
      rootNavigation.navigate('RestaurantDetail', { restaurantId: restaurant.id });
    },
    [rootNavigation]
  );

  // Called from DishMarkers — opens the dish's restaurant with the dish
  // featured (pinned) at the top of the menu
  const handleDishMarkerPress = useCallback(
    (dish: {
      id: string;
      name: string;
      coordinates: [number, number];
      price: number;
      restaurantId: string;
    }) => {
      rootNavigation.navigate('RestaurantDetail', {
        restaurantId: dish.restaurantId,
        featuredDishId: dish.id,
      });
    },
    [rootNavigation]
  );

  // Called from MapFooter recommended dishes (has restaurantId, no coordinates)
  const handleDishPress = useCallback(
    (dish: {
      id: string;
      restaurantId: string;
      name: string;
      price: number;
      cuisine: string;
      imageUrl?: string;
      isAvailable: boolean;
    }) => {
      rootNavigation.navigate('RestaurantDetail', {
        restaurantId: dish.restaurantId,
        featuredDishId: dish.id,
      });
    },
    [rootNavigation]
  );

  const handleMyLocationPress = useCallback(async () => {
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
  }, [getLocationWithPermission, locationLoading, locationError, t]);

  const handleMenuPress = useCallback(() => {
    setIsMenuVisible(prev => !prev);
  }, []);

  const handleDailyFilterPress = useCallback(() => {
    setIsDailyFilterVisible(true);
  }, []);

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
          onShowMore={handleShowMore}
          hasMore={hasMoreDishes}
        />
      </View>

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
