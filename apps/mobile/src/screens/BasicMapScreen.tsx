import React, { useRef, useEffect, useState } from 'react';
import { StyleSheet, View, Text, Alert, TouchableOpacity } from 'react-native';
import Mapbox, { MapView, Camera, PointAnnotation, UserLocation } from '@rnmapbox/maps';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import { ENV, debugLog } from '../config/environment';
import { mockRestaurants, Restaurant } from '../data/mockRestaurants';
import { useUserLocation } from '../hooks/useUserLocation';
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
          <View style={commonStyles.buttons.iconButton} />
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
    </View>
  );
};

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});

export default BasicMapScreen;
