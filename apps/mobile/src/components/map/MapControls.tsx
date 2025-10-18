/**
 * Map Controls Component
 *
 * Floating controls for map interaction: location button only
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { commonStyles, mapComponentStyles } from '@/styles';

interface MapControlsProps {
  onLocationPress: () => void;
  locationLoading: boolean;
}

export const MapControls: React.FC<MapControlsProps> = ({ onLocationPress, locationLoading }) => {
  return (
    <TouchableOpacity
      style={[
        commonStyles.mapStyles.locationButton,
        { bottom: 257 }, // Raised by ~17px (1/3 of 50px icon size)
      ]}
      onPress={onLocationPress}
      disabled={locationLoading}
    >
      <Text style={commonStyles.mapStyles.locationButtonText}>
        {locationLoading ? '🎯...' : '🎯'}
      </Text>
    </TouchableOpacity>
  );
};
