import React, { useRef } from 'react';
import { StyleSheet, View, Text, Alert, TouchableOpacity } from 'react-native';
import Mapbox, { MapView, Camera, PointAnnotation, UserLocation } from '@rnmapbox/maps';
import { ENV, debugLog } from '../config/environment';
import { mockRestaurants, Restaurant } from '../data/mockRestaurants';
import { useUserLocation } from '../hooks/useUserLocation';

// Initialize Mapbox with access token
Mapbox.setAccessToken(ENV.mapbox.accessToken);

/**
 * BasicMapScreen Component
 *
 * Displays a Mapbox map centered on Mexico City with restaurant markers.
 * Features:
 * - Restaurant/dish markers with tap interactions
 * - Color-coded markers (green = open, red = closed)
 * - Basic restaurant information in alerts
 * - Default Mexico City view with sample restaurants
 */
export const BasicMapScreen: React.FC = () => {
  debugLog('BasicMapScreen rendered with token:', ENV.mapbox.accessToken.substring(0, 20) + '...');
  debugLog('Loaded restaurants:', mockRestaurants.length);

  const cameraRef = useRef<Camera>(null);
  const {
    location: userLocation,
    isLoading: locationLoading,
    error: locationError,
    getLocationWithPermission,
  } = useUserLocation();

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

    const location = await getLocationWithPermission();

    if (location && cameraRef.current) {
      // Animate camera to user location
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
      Alert.alert('Location Error', locationError, [{ text: 'OK' }]);
    }
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
            styles.markerContainer,
            { backgroundColor: restaurant.isOpen ? '#4CAF50' : '#F44336' },
          ]}
        >
          <View style={styles.markerInner}>
            <Text style={styles.markerText}>🍽️</Text>
          </View>
        </View>
      </PointAnnotation>
    ));
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>EatMe - Food Discovery Map</Text>
        <Text style={styles.locationText}>Mexico City</Text>
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
        style={styles.myLocationButton}
        onPress={handleMyLocationPress}
        disabled={locationLoading}
      >
        <Text style={styles.myLocationButtonText}>{locationLoading ? '📍...' : '📍'}</Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          📍 {mockRestaurants.length} restaurants •{' '}
          {userLocation
            ? `📍 Location: ${userLocation.latitude.toFixed(4)}, ${userLocation.longitude.toFixed(4)}`
            : 'Tap 📍 for location'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 10,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  locationText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  map: {
    flex: 1,
  },
  footer: {
    padding: 10,
    backgroundColor: '#f9f9f9',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  footerText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  // Restaurant marker styles
  markerContainer: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  markerInner: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  markerText: {
    fontSize: 12,
    textAlign: 'center',
  },
  // My Location button styles
  myLocationButton: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  myLocationButtonText: {
    fontSize: 20,
    textAlign: 'center',
  },
});

export default BasicMapScreen;
