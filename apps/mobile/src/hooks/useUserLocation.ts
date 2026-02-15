import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { debugLog } from '../config/environment';

export interface UserLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface LocationState {
  location: UserLocation | null;
  isLoading: boolean;
  error: string | null;
  hasPermission: boolean;
  lastUpdated: number | null;
  cachedLocation: UserLocation | null;
}

// Cache duration in milliseconds (5 minutes)
const LOCATION_CACHE_DURATION = 5 * 60 * 1000;

/**
 * Custom hook for managing user location with Expo Location
 * Handles permission requests, location fetching, and error states
 *
 * @returns LocationState with current location, loading, error, and permission status
 */
export const useUserLocation = () => {
  const [state, setState] = useState<LocationState>({
    location: null,
    isLoading: false,
    error: null,
    hasPermission: false,
    lastUpdated: null,
    cachedLocation: null,
  });

  /**
   * Request location permission from the user
   * @returns Promise<boolean> - true if permission granted
   */
  const requestPermission = async (): Promise<boolean> => {
    try {
      debugLog('Requesting location permission...');
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        setState(prev => ({
          ...prev,
          error: 'Location permission denied',
          hasPermission: false,
        }));
        debugLog('Location permission denied');
        return false;
      }

      setState(prev => ({ ...prev, hasPermission: true, error: null }));
      debugLog('Location permission granted');
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown permission error';
      setState(prev => ({
        ...prev,
        error: `Permission error: ${errorMessage}`,
        hasPermission: false,
      }));
      debugLog('Location permission error:', errorMessage);
      return false;
    }
  };

  /**
   * Get current user location with caching
   * @param options - Location options for accuracy
   * @param forceRefresh - Force refresh even if cached location is available
   * @returns Promise<UserLocation | null>
   */
  const getCurrentLocation = async (options?: {
    accuracy?: Location.LocationAccuracy;
    forceRefresh?: boolean;
  }): Promise<UserLocation | null> => {
    try {
      // Check if we have a valid cached location and don't need to force refresh
      const now = Date.now();
      if (
        !options?.forceRefresh &&
        state.cachedLocation &&
        state.lastUpdated &&
        now - state.lastUpdated < LOCATION_CACHE_DURATION
      ) {
        debugLog(
          'Using cached location:',
          `${state.cachedLocation.latitude.toFixed(4)}, ${state.cachedLocation.longitude.toFixed(4)}`
        );
        return state.cachedLocation;
      }

      setState(prev => ({ ...prev, isLoading: true, error: null }));
      debugLog('Getting fresh location...');

      const location = await Location.getCurrentPositionAsync({
        accuracy: options?.accuracy || Location.LocationAccuracy.Balanced,
      });

      const userLocation: UserLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || undefined,
      };

      const timestamp = Date.now();
      setState(prev => ({
        ...prev,
        location: userLocation,
        cachedLocation: userLocation,
        lastUpdated: timestamp,
        isLoading: false,
        error: null,
      }));

      debugLog(
        'Fresh location obtained and cached:',
        `${userLocation.latitude.toFixed(4)}, ${userLocation.longitude.toFixed(4)}`
      );
      return userLocation;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown location error';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: `Location error: ${errorMessage}`,
      }));
      debugLog('Location error:', errorMessage);
      return null;
    }
  };

  /**
   * Get user location with permission check and caching
   * @param options - Location options
   * @returns Promise<UserLocation | null>
   */
  const getLocationWithPermission = async (options?: {
    accuracy?: Location.LocationAccuracy;
    forceRefresh?: boolean;
  }): Promise<UserLocation | null> => {
    const hasPermission = await requestPermission();
    if (!hasPermission) {
      return null;
    }
    return getCurrentLocation(options);
  };

  /**
   * Clear current location, cache, and reset state
   */
  const clearLocation = () => {
    setState(prev => ({
      ...prev,
      location: null,
      cachedLocation: null,
      lastUpdated: null,
      error: null,
    }));
    debugLog('Location and cache cleared');
  };

  // Check permission status on mount
  useEffect(() => {
    const checkPermission = async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        setState(prev => ({
          ...prev,
          hasPermission: status === 'granted',
        }));
      } catch (error) {
        debugLog('Error checking location permission:', error);
      }
    };

    checkPermission();
  }, []);

  return {
    ...state,
    requestPermission,
    getCurrentLocation,
    getLocationWithPermission,
    clearLocation,
  };
};
