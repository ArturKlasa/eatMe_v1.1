import React, { useRef, useEffect, useState, useMemo } from 'react';
import { StyleSheet, View, Text, Alert, TouchableOpacity, Modal, ScrollView } from 'react-native';
import Mapbox, { MapView, Camera, PointAnnotation, UserLocation } from '@rnmapbox/maps';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import { ENV, debugLog } from '../config/environment';
import { mockRestaurants, Restaurant } from '../data/mockRestaurants';
import { useUserLocation } from '../hooks/useUserLocation';
import { FilterFAB } from '../components/FilterFAB';
import { useFilterStore } from '../stores/filterStore';
import { applyFilters, validateFilters, getFilterSuggestions } from '../services/filterService';
import { commonStyles, theme, modals, mapComponentStyles } from '@/styles';
import type { MapScreenProps } from '@/types/navigation';

// Initialize Mapbox with access token
Mapbox.setAccessToken(ENV.mapbox.accessToken);

/**
 * BasicMapScreen Component
 *
 * Displays a Mapbox map centered on Mexico City with restaurant markers and user location.
 * Features:
 * - Restaurant/dish markers with tap interactions
 * - Color-coded markers (green = open, red = closed)
 * - User location detection with "My Location" button
 * - Drawer navigation integration
 * - Basic restaurant information in alerts
 * - Smooth map interactions and camera controls
 */
export const BasicMapScreen: React.FC<MapScreenProps> = ({ navigation }) => {
  debugLog('BasicMapScreen rendered with token:', ENV.mapbox.accessToken.substring(0, 20) + '...');
  debugLog('Loaded restaurants:', mockRestaurants.length);

  const cameraRef = useRef<Camera>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [hasAutocentered, setHasAutocentered] = useState(false);
  const [isDailyFilterVisible, setIsDailyFilterVisible] = useState(false);

  const {
    daily,
    permanent,
    setDailyPriceRange,
    toggleDailyCuisine,
    toggleDietToggle,
    setDailyCalorieRange,
    toggleOpenNow,
    applyPreset,
  } = useFilterStore();

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

  const renderRestaurantMarkers = () => {
    return displayedRestaurants.map(restaurant => (
      <PointAnnotation
        key={restaurant.id}
        id={restaurant.id}
        coordinate={restaurant.coordinates}
        onSelected={() => handleMarkerPress(restaurant)}
      >
        <View
          style={[
            commonStyles.mapStyles.markerContainer,
            {
              backgroundColor: restaurant.isOpen
                ? theme.colors.mapMarkerOpen
                : theme.colors.mapMarkerClosed,
            },
          ]}
        >
          <View style={commonStyles.mapStyles.markerInner}>
            <Text style={commonStyles.mapStyles.markerText}>🍽️</Text>
          </View>
        </View>
      </PointAnnotation>
    ));
  };

  return (
    <View style={commonStyles.containers.screen}>
      <View style={commonStyles.mapStyles.header}>
        <View style={commonStyles.mapStyles.headerContent}>
          <TouchableOpacity style={commonStyles.buttons.iconButton} onPress={handleMenuPress}>
            <Text>☰</Text>
          </TouchableOpacity>
          <View style={commonStyles.mapStyles.headerText}>
            <Text style={commonStyles.mapStyles.title}>Food Map</Text>
            <Text style={commonStyles.mapStyles.subtitle}>Discover nearby restaurants</Text>
          </View>
          <TouchableOpacity
            style={commonStyles.buttons.iconButton}
            onPress={handleMyLocationPress}
            disabled={locationLoading}
          >
            <Text>{locationLoading ? '🎯...' : '🎯'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <MapView
        style={mapComponentStyles.map}
        styleURL={Mapbox.StyleURL.Street}
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

        {renderRestaurantMarkers()}
      </MapView>

      {/* My Location Button */}
      <TouchableOpacity
        style={commonStyles.mapStyles.locationButton}
        onPress={handleMyLocationPress}
        disabled={locationLoading}
      >
        <Text style={commonStyles.mapStyles.locationButtonText}>
          {locationLoading ? '📍...' : '📍'}
        </Text>
      </TouchableOpacity>

      <View style={commonStyles.mapStyles.footer}>
        <Text style={commonStyles.mapStyles.footerText}>
          {mockRestaurants.length} restaurants found
          {isMapReady ? '' : ' • Loading map...'}
          {userLocation && isMapReady
            ? ` • Location: ${userLocation.latitude.toFixed(3)}, ${userLocation.longitude.toFixed(3)}`
            : hasPermission
              ? ' • Getting location...'
              : ' • Tap 📍 for location'}
        </Text>
      </View>

      {/* Filter Floating Action Button */}
      <TouchableOpacity
        style={mapComponentStyles.filterFAB}
        onPress={handleDailyFilterPress}
        activeOpacity={0.8}
      >
        <Text style={mapComponentStyles.filterFABIcon}>🎛️</Text>
        {filteredResults.appliedFilters.daily + filteredResults.appliedFilters.permanent > 0 && (
          <View style={mapComponentStyles.filterBadge}>
            <Text style={mapComponentStyles.filterBadgeText}>
              {filteredResults.appliedFilters.daily + filteredResults.appliedFilters.permanent}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Daily Filter Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isDailyFilterVisible}
        onRequestClose={closeDailyFilter}
      >
        <View style={modals.overlay}>
          <View style={modals.container}>
            <View style={modals.header}>
              <Text style={modals.title}>🎯 Daily Filters</Text>
              <TouchableOpacity onPress={closeDailyFilter} style={modals.closeButton}>
                <Text style={modals.closeText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={modals.content} showsVerticalScrollIndicator={false} bounces={false}>
              {/* Price Range Section */}
              <View style={modals.section}>
                <Text style={modals.sectionTitle}>💰 Price Range</Text>
                <View style={modals.optionsRow}>
                  {[1, 2, 3, 4].map(price => (
                    <TouchableOpacity
                      key={price}
                      style={[
                        modals.priceOption,
                        daily.priceRange.max === price && modals.selectedOption,
                      ]}
                      onPress={() => setDailyPriceRange(1, price)}
                    >
                      <Text
                        style={[
                          modals.priceText,
                          daily.priceRange.max === price && modals.selectedText,
                        ]}
                      >
                        {'$'.repeat(price)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Cuisine Types Section */}
              <View style={modals.section}>
                <Text style={modals.sectionTitle}>🍽️ Cuisine Types</Text>
                <View style={modals.cuisineGrid}>
                  {['American', 'Asian', 'Italian', 'Mexican', 'Indian', 'Mediterranean'].map(
                    cuisine => (
                      <TouchableOpacity
                        key={cuisine}
                        style={[
                          modals.cuisineOption,
                          daily.cuisineTypes.includes(cuisine) && modals.selectedOption,
                        ]}
                        onPress={() => toggleDailyCuisine(cuisine)}
                      >
                        <Text
                          style={[
                            modals.cuisineText,
                            daily.cuisineTypes.includes(cuisine) && modals.selectedText,
                          ]}
                        >
                          {cuisine}
                        </Text>
                      </TouchableOpacity>
                    )
                  )}
                </View>
              </View>

              {/* Diet Toggle Section */}
              <View style={modals.section}>
                <Text style={modals.sectionTitle}>🥗 Diet Toggle</Text>

                {/* First row - Meat & Fish */}
                <View style={modals.optionsRow}>
                  {[
                    { key: 'meat', label: 'Meat', icon: '🥩' },
                    { key: 'fish', label: 'Fish', icon: '🐟' },
                  ].map(diet => (
                    <TouchableOpacity
                      key={diet.key}
                      style={[
                        modals.dietOption,
                        daily.dietToggle[diet.key as keyof typeof daily.dietToggle] &&
                          modals.selectedOption,
                      ]}
                      onPress={() => toggleDietToggle(diet.key as keyof typeof daily.dietToggle)}
                    >
                      <Text style={modals.dietIcon}>{diet.icon}</Text>
                      <Text
                        style={[
                          modals.dietText,
                          daily.dietToggle[diet.key as keyof typeof daily.dietToggle] &&
                            modals.selectedText,
                        ]}
                      >
                        {diet.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Second row - Vegetarian & Vegan */}
                <View style={[modals.optionsRow, { marginTop: 8 }]}>
                  {[
                    { key: 'vegetarian', label: 'Vegetarian', icon: '🥗' },
                    { key: 'vegan', label: 'Vegan', icon: '🌱' },
                  ].map(diet => (
                    <TouchableOpacity
                      key={diet.key}
                      style={[
                        modals.dietOption,
                        daily.dietToggle[diet.key as keyof typeof daily.dietToggle] &&
                          modals.selectedOption,
                      ]}
                      onPress={() => toggleDietToggle(diet.key as keyof typeof daily.dietToggle)}
                    >
                      <Text style={modals.dietIcon}>{diet.icon}</Text>
                      <Text
                        style={[
                          modals.dietText,
                          daily.dietToggle[diet.key as keyof typeof daily.dietToggle] &&
                            modals.selectedText,
                        ]}
                      >
                        {diet.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Calorie Range Section */}
              <View style={modals.section}>
                <Text style={modals.sectionTitle}>
                  🔥 Calorie Range{' '}
                  {daily.calorieRange.enabled
                    ? `(${daily.calorieRange.min}-${daily.calorieRange.max} kcal)`
                    : '(disabled)'}
                </Text>
                <View style={modals.optionsRow}>
                  <TouchableOpacity
                    style={[
                      modals.calorieToggle,
                      daily.calorieRange.enabled && modals.selectedOption,
                    ]}
                    onPress={() =>
                      setDailyCalorieRange(
                        daily.calorieRange.min,
                        daily.calorieRange.max,
                        !daily.calorieRange.enabled
                      )
                    }
                  >
                    <Text
                      style={[
                        modals.calorieText,
                        daily.calorieRange.enabled && modals.selectedText,
                      ]}
                    >
                      {daily.calorieRange.enabled ? 'Enabled' : 'Disabled'}
                    </Text>
                  </TouchableOpacity>

                  {daily.calorieRange.enabled && (
                    <>
                      {[200, 400, 600, 800, 1000].map(calories => (
                        <TouchableOpacity
                          key={calories}
                          style={[
                            modals.calorieOption,
                            daily.calorieRange.max === calories && modals.selectedOption,
                          ]}
                          onPress={() => setDailyCalorieRange(200, calories, true)}
                        >
                          <Text
                            style={[
                              modals.calorieText,
                              daily.calorieRange.max === calories && modals.selectedText,
                            ]}
                          >
                            {calories}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </>
                  )}
                </View>
              </View>

              {/* Open Now Section */}
              <View style={modals.section}>
                <View style={modals.optionsRow}>
                  <TouchableOpacity
                    style={[modals.cuisineOption, daily.openNow && modals.selectedOption]}
                    onPress={() => toggleOpenNow()}
                  >
                    <Text style={[modals.cuisineText, daily.openNow && modals.selectedText]}>
                      ⏰ Open Now
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Quick Presets */}
              <View style={modals.section}>
                <Text style={modals.sectionTitle}>⚡ Quick Filters</Text>
                <View style={modals.optionsRow}>
                  <TouchableOpacity
                    style={modals.presetButton}
                    onPress={() => applyPreset('nearby')}
                  >
                    <Text style={modals.presetText}>📍 Nearby</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={modals.presetButton}
                    onPress={() => applyPreset('cheapEats')}
                  >
                    <Text style={modals.presetText}>💰 Cheap Eats</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>

            <View style={modals.footer}>
              <TouchableOpacity style={modals.clearButton} onPress={closeDailyFilter}>
                <Text style={modals.clearText}>Clear All</Text>
              </TouchableOpacity>
              <TouchableOpacity style={modals.applyButton} onPress={closeDailyFilter}>
                <Text style={modals.applyText}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
  filterFAB: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  filterFABIcon: {
    fontSize: 24,
  },
  filterBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: theme.colors.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.white,
  },
  filterBadgeText: {
    color: theme.colors.white,
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default BasicMapScreen;
