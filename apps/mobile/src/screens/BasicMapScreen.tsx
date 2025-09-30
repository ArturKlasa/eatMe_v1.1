import React, { useRef, useEffect, useState } from 'react';
import { StyleSheet, View, Text, Alert, TouchableOpacity, Modal } from 'react-native';
import Mapbox, { MapView, Camera, PointAnnotation, UserLocation } from '@rnmapbox/maps';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import { ENV, debugLog } from '../config/environment';
import { mockRestaurants, Restaurant } from '../data/mockRestaurants';
import { useUserLocation } from '../hooks/useUserLocation';
import { FilterFAB } from '../components/FilterFAB';
import { useFilterStore } from '../stores/filterStore';
import { commonStyles, theme } from '@/styles';
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

  const { daily, setDailyPriceRange, toggleDailyCuisine, applyPreset } = useFilterStore();

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
    return mockRestaurants.map(restaurant => (
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
            onPress={handleDailyFilterPress}
          >
            <Text>🎯</Text>
          </TouchableOpacity>
        </View>
      </View>

      <MapView
        style={styles.map}
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

      {/* Filter Floating Action Button - Temporarily disabled for debugging */}
      {/* <FilterFAB /> */}

      {/* Daily Filter Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isDailyFilterVisible}
        onRequestClose={closeDailyFilter}
      >
        <View style={modalStyles.overlay}>
          <View style={modalStyles.container}>
            <View style={modalStyles.header}>
              <Text style={modalStyles.title}>🎯 Daily Filters</Text>
              <TouchableOpacity onPress={closeDailyFilter} style={modalStyles.closeButton}>
                <Text style={modalStyles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={modalStyles.content}>
              {/* Price Range Section */}
              <View style={modalStyles.section}>
                <Text style={modalStyles.sectionTitle}>💰 Price Range</Text>
                <View style={modalStyles.optionsRow}>
                  {[1, 2, 3, 4].map(price => (
                    <TouchableOpacity
                      key={price}
                      style={[
                        modalStyles.priceOption,
                        daily.priceRange.max === price && modalStyles.selectedOption,
                      ]}
                      onPress={() => setDailyPriceRange(1, price)}
                    >
                      <Text
                        style={[
                          modalStyles.priceText,
                          daily.priceRange.max === price && modalStyles.selectedText,
                        ]}
                      >
                        {'$'.repeat(price)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Cuisine Types Section */}
              <View style={modalStyles.section}>
                <Text style={modalStyles.sectionTitle}>🍽️ Cuisine Types</Text>
                <View style={modalStyles.cuisineGrid}>
                  {['American', 'Asian', 'Italian', 'Mexican', 'Indian', 'Mediterranean'].map(
                    cuisine => (
                      <TouchableOpacity
                        key={cuisine}
                        style={[
                          modalStyles.cuisineOption,
                          daily.cuisineTypes.includes(cuisine) && modalStyles.selectedOption,
                        ]}
                        onPress={() => toggleDailyCuisine(cuisine)}
                      >
                        <Text
                          style={[
                            modalStyles.cuisineText,
                            daily.cuisineTypes.includes(cuisine) && modalStyles.selectedText,
                          ]}
                        >
                          {cuisine}
                        </Text>
                      </TouchableOpacity>
                    )
                  )}
                </View>
              </View>

              {/* Quick Presets */}
              <View style={modalStyles.section}>
                <Text style={modalStyles.sectionTitle}>⚡ Quick Filters</Text>
                <View style={modalStyles.optionsRow}>
                  <TouchableOpacity
                    style={modalStyles.presetButton}
                    onPress={() => applyPreset('nearby')}
                  >
                    <Text style={modalStyles.presetText}>📍 Nearby</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={modalStyles.presetButton}
                    onPress={() => applyPreset('cheapEats')}
                  >
                    <Text style={modalStyles.presetText}>💰 Cheap Eats</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={modalStyles.footer}>
              <TouchableOpacity style={modalStyles.clearButton} onPress={closeDailyFilter}>
                <Text style={modalStyles.clearText}>Clear All</Text>
              </TouchableOpacity>
              <TouchableOpacity style={modalStyles.applyButton} onPress={closeDailyFilter}>
                <Text style={modalStyles.applyText}>Apply Filters</Text>
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
});

// Modal styles for Daily Filter
const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.colors.gray200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  content: {
    padding: 20,
    maxHeight: '70%',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 12,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  cuisineGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  priceOption: {
    margin: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minWidth: 50,
    alignItems: 'center',
  },
  priceText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  cuisineOption: {
    margin: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: theme.colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cuisineText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  selectedOption: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  selectedText: {
    color: theme.colors.white,
    fontWeight: '600',
  },
  presetButton: {
    flex: 1,
    margin: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: theme.colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  presetText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 12,
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  filterText: {
    fontSize: 16,
    color: theme.colors.textPrimary,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
  },
  clearButton: {
    flex: 1,
    padding: 16,
    marginRight: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  clearText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  applyButton: {
    flex: 1,
    padding: 16,
    marginLeft: 6,
    borderRadius: 12,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
  },
  applyText: {
    fontSize: 16,
    color: theme.colors.white,
    fontWeight: '600',
  },
});

export default BasicMapScreen;
