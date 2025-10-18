import React, { useRef, useEffect, useState, useMemo } from 'react';
import { StyleSheet, View, Alert, Text } from 'react-native';
import Mapbox, { MapView, Camera, UserLocation, PointAnnotation } from '@rnmapbox/maps';
import { DrawerActions } from '@react-navigation/native';
import { ENV, debugLog } from '../config/environment';
import { mockRestaurants, Restaurant } from '../data/mockRestaurants';
import { mockDishes, Dish } from '../data/mockDishes';
import { useUserLocation } from '../hooks/useUserLocation';
import { useFilterStore } from '../stores/filterStore';
import { useViewModeStore } from '../stores/viewModeStore';
import { applyFilters, validateFilters, getFilterSuggestions } from '../services/filterService';
import { commonStyles, mapComponentStyles } from '@/styles';
import type { MapScreenProps } from '@/types/navigation';

// Extracted Components
import { DailyFilterModal } from '../components/map/DailyFilterModal';
import { MapHeader } from '../components/map/MapHeader';
import { RestaurantMarkers } from '../components/map/RestaurantMarkers';
import { DishMarkers } from '../components/map/DishMarkers';
import { MapControls } from '../components/map/MapControls';
import { MapFooter } from '../components/map/MapFooter';

// Initialize Mapbox with access token
Mapbox.setAccessToken(ENV.mapbox.accessToken);

/**
 * BasicMapScreen Component
 *
 * Displays a Mapbox map centered on Mexico City with restaurant markers and user location.
 * Now refactored into smaller, focused components for better maintainability.
 */
export const BasicMapScreen: React.FC<MapScreenProps> = ({ navigation }) => {
  debugLog('BasicMapScreen rendered with token:', ENV.mapbox.accessToken.substring(0, 20) + '...');
  debugLog('Loaded restaurants:', mockRestaurants.length);

  const cameraRef = useRef<Camera>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [hasAutocentered, setHasAutocentered] = useState(false);
  const [isDailyFilterVisible, setIsDailyFilterVisible] = useState(false);

  const { daily, permanent } = useFilterStore();
  const { mode } = useViewModeStore();

  // Apply filters to restaurants with performance optimization
  const filteredResults = useMemo(() => {
    debugLog('Applying filters to restaurants...');
    const result = applyFilters(mockRestaurants, daily, permanent);
    debugLog(`Filtered ${mockRestaurants.length} → ${result.restaurants.length} restaurants`);

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
  }, [daily, permanent]);

  // Extract restaurants for easy access
  const displayedRestaurants = filteredResults.restaurants;

  // Get recommended dishes (mock algorithm - will be replaced with ML/database in future)
  const getRecommendedDishes = () => {
    // For now, return top-rated available dishes, limited to 8
    return mockDishes
      .filter(dish => dish.isAvailable)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 8);
  };

  const recommendedDishes = getRecommendedDishes();

  // Add debugging
  console.log('=== RESTAURANT DEBUG ===');
  console.log('Total mock restaurants loaded:', mockRestaurants.length);
  console.log('Restaurants after filtering:', displayedRestaurants.length);
  console.log('Filter state - daily:', daily);
  console.log('Filter state - permanent:', permanent);
  console.log('First restaurant coordinates:', displayedRestaurants[0]?.coordinates);
  console.log('Map center:', ENV.mapbox.defaultLocation);
  console.log('========================');

  const {
    location: userLocation,
    isLoading: locationLoading,
    error: locationError,
    getLocationWithPermission,
    hasPermission,
  } = useUserLocation();

  // Auto-center map on user location when map is ready and location is available
  useEffect(() => {
    const autoCenterOnLocation = async () => {
      if (isMapReady && !hasAutocentered && hasPermission && cameraRef.current) {
        debugLog('Auto-centering map on user location...');

        const location = await getLocationWithPermission();
        if (location) {
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
      }
    };

    autoCenterOnLocation();
  }, [isMapReady, hasPermission, hasAutocentered, getLocationWithPermission]);

  // Handler functions
  const handleMarkerPress = (restaurant: Restaurant) => {
    Alert.alert(
      `🍽️ ${restaurant.name}`,
      [
        `📍 ${restaurant.address}`,
        `🍴 ${restaurant.cuisine} • ${restaurant.priceRange}`,
        `⭐ ${restaurant.rating}/5`,
        `📄 ${restaurant.description}`,
        ``,
        `🕒 ${restaurant.isOpen ? 'Open' : 'Closed'} (${restaurant.openingHours.open} - ${restaurant.openingHours.close})`,
      ].join('\n'),
      [
        { text: 'Call', onPress: () => restaurant.phone && debugLog('Calling:', restaurant.phone) },
        { text: 'Close', style: 'cancel' },
      ]
    );
  };

  const handleDishPress = (dish: Dish) => {
    Alert.alert(
      `🍽️ ${dish.name}`,
      [
        `🏪 ${dish.restaurantName}`,
        `🍴 ${dish.cuisine} • $${dish.price}`,
        `⭐ ${dish.rating}/5`,
        `📄 ${dish.description}`,
        ``,
        `${dish.isAvailable ? '✅ Available' : '❌ Currently unavailable'}`,
      ].join('\n'),
      [{ text: 'Close', style: 'cancel' }]
    );
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
    navigation.dispatch(DrawerActions.openDrawer());
  };

  const handleDailyFilterPress = () => {
    setIsDailyFilterVisible(true);
  };

  const closeDailyFilter = () => {
    setIsDailyFilterVisible(false);
  };

  return (
    <View style={commonStyles.containers.screen}>
      <MapHeader onMenuPress={handleMenuPress} onFilterPress={handleDailyFilterPress} />

      <MapView
        style={mapComponentStyles.map}
        styleURL={Mapbox.StyleURL.Dark}
        zoomEnabled={true}
        scrollEnabled={true}
        pitchEnabled={true}
        rotateEnabled={true}
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
          <DishMarkers dishes={mockDishes} onMarkerPress={handleDishPress} />
        )}
      </MapView>

      <MapControls onLocationPress={handleMyLocationPress} locationLoading={locationLoading} />

      <MapFooter recommendedDishes={recommendedDishes} onDishPress={handleDishPress} />

      <DailyFilterModal visible={isDailyFilterVisible} onClose={closeDailyFilter} />
    </View>
  );
};

export default BasicMapScreen;
