import React, { useRef, useEffect, useState, useMemo } from 'react';
import { StyleSheet, View, Alert, Text, ActivityIndicator } from 'react-native';
import Mapbox, { MapView, Camera, UserLocation, PointAnnotation } from '@rnmapbox/maps';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { ENV, debugLog } from '../config/environment';
import { mockRestaurants, Restaurant } from '../data/mockRestaurants';
import { mockDishes, Dish } from '../data/mockDishes';
import { useUserLocation } from '../hooks/useUserLocation';
import { useRestaurants, useAllDishes } from '../hooks';
import { useFilterStore } from '../stores/filterStore';
import { useViewModeStore } from '../stores/viewModeStore';
import { applyFilters, validateFilters, getFilterSuggestions } from '../services/filterService';
import { commonStyles, mapComponentStyles } from '@/styles';
import type { MapScreenProps } from '@/types/navigation';
import type { RootStackParamList } from '@/types/navigation';

// Extracted Components
import { DailyFilterModal } from '../components/map/DailyFilterModal';
import { RestaurantMarkers } from '../components/map/RestaurantMarkers';
import { DishMarkers } from '../components/map/DishMarkers';
import { MapControls } from '../components/map/MapControls';
import { MapFooter } from '../components/map/MapFooter';
import { FloatingMenu } from '../components/FloatingMenu';

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

  // Fetch real data from Supabase
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

  const { daily, permanent } = useFilterStore();
  const { mode } = useViewModeStore();

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
    return dbRestaurants
      .map(r => {
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
  }, [dbRestaurants]);

  const dishes = useMemo(() => {
    return dbDishes
      .map(d => {
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

  // Get recommended dishes from database
  const recommendedDishes = useMemo(() => {
    return dishes.filter(dish => dish.isAvailable).slice(0, 8);
  }, [dishes]);

  // Add debugging
  console.log('=== SUPABASE DATA DEBUG ===');
  console.log('Raw DB restaurants:', dbRestaurants.length);
  console.log('First restaurant raw:', dbRestaurants[0]);
  console.log('Restaurants from DB:', restaurants.length);
  console.log('First restaurant parsed:', restaurants[0]);
  console.log('Dishes from DB:', dishes.length);
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

  // Show loading state while fetching data
  if (restaurantsLoading || dishesLoading) {
    return (
      <View
        style={[commonStyles.containers.screen, { justifyContent: 'center', alignItems: 'center' }]}
      >
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={{ marginTop: 16, fontSize: 16, color: '#666' }}>Loading restaurants...</Text>
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

      <DailyFilterModal visible={isDailyFilterVisible} onClose={closeDailyFilter} />
      <FloatingMenu visible={isMenuVisible} onClose={closeMenu} />
    </View>
  );
}

export default BasicMapScreen;
