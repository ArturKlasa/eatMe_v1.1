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
}

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
   * Get current user location
   * @param options - Location options for accuracy
   * @returns Promise<UserLocation | null>
   */
  const getCurrentLocation = async (options?: {
    accuracy?: Location.LocationAccuracy;
  }): Promise<UserLocation | null> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      debugLog('Getting current location...');

      const location = await Location.getCurrentPositionAsync({
        accuracy: options?.accuracy || Location.LocationAccuracy.Balanced,
      });

      const userLocation: UserLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || undefined,
      };

      setState(prev => ({
        ...prev,
        location: userLocation,
        isLoading: false,
        error: null,
      }));

      debugLog(
        'Location obtained:',
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
   * Get user location with permission check
   * @param options - Location options
   * @returns Promise<UserLocation | null>
   */
  const getLocationWithPermission = async (options?: {
    accuracy?: Location.LocationAccuracy;
  }): Promise<UserLocation | null> => {
    const hasPermission = await requestPermission();
    if (!hasPermission) {
      return null;
    }
    return getCurrentLocation(options);
  };

  /**
   * Clear current location and reset state
   */
  const clearLocation = () => {
    setState(prev => ({
      ...prev,
      location: null,
      error: null,
    }));
    debugLog('Location cleared');
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
