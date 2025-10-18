/**
 * Map Controls Component
 *
 * Floating controls for map interaction: location and menu buttons
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { commonStyles, mapComponentStyles } from '@/styles';

interface MapControlsProps {
  onLocationPress: () => void;
  onMenuPress: () => void;
  locationLoading: boolean;
}

export const MapControls: React.FC<MapControlsProps> = ({
  onLocationPress,
  onMenuPress,
  locationLoading,
}) => {
  return (
    <>
      {/* Menu FAB - Above Location FAB */}
      <TouchableOpacity
        style={[
          commonStyles.mapStyles.locationButton,
          {
            bottom: 390, // Moved up by 20px (was 370, now 390)
            right: 20, // Same right alignment as location FAB
            zIndex: 1000,
            elevation: 10,
          },
        ]}
        onPress={onMenuPress}
      >
        <Text style={commonStyles.mapStyles.locationButtonText}>☰</Text>
      </TouchableOpacity>

      {/* Location FAB - Right Side */}
      <TouchableOpacity
        style={[
          commonStyles.mapStyles.locationButton,
          {
            bottom: 330, // Moved back up (was 300, now 330)
            zIndex: 1000, // Ensure it's above everything
            elevation: 10, // Android shadow/elevation
          },
        ]}
        onPress={onLocationPress}
        disabled={locationLoading}
      >
        <Text style={commonStyles.mapStyles.locationButtonText}>
          {locationLoading ? '🎯...' : '🎯'}
        </Text>
      </TouchableOpacity>
    </>
  );
};
