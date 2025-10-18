/**
 * Map Footer Component
 *
 * Footer showing count and location status, mode-aware for restaurants vs dishes
 */

import React from 'react';
import { View, Text } from 'react-native';
import { commonStyles } from '@/styles';

interface MapFooterProps {
  restaurantCount: number;
  dishCount?: number;
  viewMode?: 'restaurant' | 'dish';
  isMapReady: boolean;
  userLocation?: {
    latitude: number;
    longitude: number;
  } | null;
  hasPermission: boolean;
}

export const MapFooter: React.FC<MapFooterProps> = ({
  restaurantCount,
  dishCount = 0,
  viewMode,
  isMapReady,
  userLocation,
  hasPermission,
}) => {
  const getLocationText = () => {
    if (userLocation && isMapReady) {
      return ` • Location: ${userLocation.latitude.toFixed(3)}, ${userLocation.longitude.toFixed(3)}`;
    }
    if (hasPermission) {
      return ' • Getting location...';
    }
    return ' • Tap 📍 for location';
  };

  const getCountText = () => {
    if (viewMode === 'restaurant') {
      return `${restaurantCount} restaurants found`;
    } else if (viewMode === 'dish') {
      return `${dishCount} dishes found`;
    } else {
      return `${restaurantCount} restaurants found`; // Default fallback
    }
  };

  return (
    <View style={commonStyles.mapStyles.footer}>
      <Text style={commonStyles.mapStyles.footerText}>
        {getCountText()}
        {isMapReady ? '' : ' • Loading map...'}
        {getLocationText()}
      </Text>
    </View>
  );
};
