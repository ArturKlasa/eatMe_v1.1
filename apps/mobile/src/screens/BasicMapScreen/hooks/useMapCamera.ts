import { useRef, useEffect, useState, useCallback } from 'react';
import { Alert } from 'react-native';
import type { Camera } from '@rnmapbox/maps';
import { useTranslation } from 'react-i18next';
import { useUserLocation } from '../../../hooks/useUserLocation';
import { debugLog } from '../../../config/environment';

/**
 * useMapCamera
 *
 * Owns the imperative Mapbox camera handle, map-ready state, and the auto-center
 * lifecycle. Consumes the shared `useUserLocation` hook internally (D-05 — does NOT
 * recreate it) and re-exposes the location data the screen needs.
 */
export function useMapCamera() {
  const { t } = useTranslation();

  const cameraRef = useRef<Camera>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [hasAutocentered, setHasAutocentered] = useState(false);

  const {
    location,
    isLoading: locationLoading,
    error: locationError,
    getLocationWithPermission,
    hasPermission,
  } = useUserLocation();

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

  return {
    cameraRef,
    isMapReady,
    setIsMapReady,
    hasAutocentered,
    handleMyLocationPress,
    userLocation: location,
    locationLoading,
    locationError,
    getLocationWithPermission,
    hasPermission,
  };
}
