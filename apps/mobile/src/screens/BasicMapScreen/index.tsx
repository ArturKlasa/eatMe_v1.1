import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Alert } from 'react-native';
import Mapbox, { MapView, Camera, UserLocation } from '@rnmapbox/maps';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { ENV, debugLog } from '../../config/environment';
import { useCountryDetectionStore } from '../../stores/countryDetectionStore';
import { commonStyles, mapComponentStyles } from '@/styles';
import { colors } from '@/styles/theme';
import type { MapScreenProps } from '@/types/navigation';
import type { RootStackParamList } from '@/types/navigation';
import { useTranslation } from 'react-i18next';

// Extracted Components
import { DailyFilterModal } from '../../components/map/DailyFilterModal';
import { DishMarkers } from '../../components/map/DishMarkers';
import { MapControls } from '../../components/map/MapControls';
import { MapFooter } from '../../components/map/MapFooter';
import { FloatingMenu } from '../../components/FloatingMenu';
import { RatingFlowModal } from '../../components/rating';
import { ProfileCompletionBanner } from '../../components/ProfileCompletionBanner';
import { useAuthStore } from '../../stores/authStore';
import { useOnboardingStore } from '../../stores/onboardingStore';

// Co-located hooks + presentational child
import { useMapCamera } from './hooks/useMapCamera';
import { useDishFeed } from './hooks/useDishFeed';
import { useRatingFlow } from './hooks/useRatingFlow';
import { RatingBanner } from './components/RatingBanner';

/**
 * BasicMapScreen Component
 *
 * Displays a Mapbox map with restaurant markers and user location.
 * Now fetches real data from Supabase instead of using mock data.
 */
export function BasicMapScreen({ navigation }: MapScreenProps) {
  debugLog('BasicMapScreen rendered with token:', ENV.mapbox.accessToken.substring(0, 20) + '...');
  const { t } = useTranslation();

  // Get the root stack navigation for navigating to RestaurantDetail
  const rootNavigation = useNavigation<StackNavigationProp<RootStackParamList>>();

  const [footerHeight, setFooterHeight] = useState(0);
  const [isDailyFilterVisible, setIsDailyFilterVisible] = useState(false);
  const [isMenuVisible, setIsMenuVisible] = useState(false);

  // Auth and session
  const user = useAuthStore(state => state.user);

  const {
    cameraRef,
    setIsMapReady,
    handleMyLocationPress,
    userLocation,
    locationLoading,
    getLocationWithPermission,
    hasPermission,
  } = useMapCamera();

  const { recommendedDishes, mapPinDishes, hasMoreDishes, handleShowMore } =
    useDishFeed(userLocation);

  const {
    recentRestaurants,
    showRatingBanner,
    isRatingFlowVisible,
    handleRatingBannerPress,
    closeRatingFlow,
    handleRatingComplete,
    getRestaurantDishes,
    checkIsFirstVisit,
  } = useRatingFlow();

  // Onboarding state — narrow selectors + memoized derivation (no whole-store
  // subscription, no per-render new Date()).
  const isCompleted = useOnboardingStore(state => state.isCompleted);
  const lastPromptShown = useOnboardingStore(state => state.lastPromptShown);
  const showOnboardingBanner = useMemo(
    () => !!user && !isCompleted && useOnboardingStore.getState().shouldShowPrompt(),
    [user, isCompleted, lastPromptShown]
  );

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

  // Handler functions
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

  const handleSearchRestaurant = () => {
    // Future: Navigate to restaurant search screen
    Alert.alert(t('common.comingSoon'), t('common.searchComingSoon'));
  };

  const handleViewRewards = () => {
    // Future: Navigate to rewards/profile screen
    Alert.alert(t('common.comingSoon'), t('common.rewardsComingSoon'));
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

        <DishMarkers dishes={mapPinDishes} onMarkerPress={handleDishMarkerPress} />
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
      {showRatingBanner && <RatingBanner onPress={handleRatingBannerPress} />}
    </View>
  );
}

export default BasicMapScreen;
