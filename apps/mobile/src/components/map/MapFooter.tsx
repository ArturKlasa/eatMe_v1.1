/**
 * Map Footer Component
 * 
 * Footer showing restaurant count and location status
 */

import React from 'react';
import { View, Text } from 'react-native';
import { commonStyles } from '@/styles';

interface MapFooterProps {
  restaurantCount: number;
  isMapReady: boolean;
  userLocation?: {
    latitude: number;
    longitude: number;
  } | null;
  hasPermission: boolean;
}

export const MapFooter: React.FC<MapFooterProps> = ({
  restaurantCount,
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

  return (
    <View style={commonStyles.mapStyles.footer}>
      <Text style={commonStyles.mapStyles.footerText}>
        {restaurantCount} restaurants found
        {isMapReady ? '' : ' • Loading map...'}
        {getLocationText()}
      </Text>
    </View>
  );
};