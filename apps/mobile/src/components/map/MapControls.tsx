/**
 * Map Controls Component
 * 
 * Floating controls for map interaction: location button and filter FAB
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { commonStyles, mapComponentStyles } from '@/styles';

interface MapControlsProps {
  onLocationPress: () => void;
  onFilterPress: () => void;
  locationLoading: boolean;
  filterCount: number;
}

export const MapControls: React.FC<MapControlsProps> = ({
  onLocationPress,
  onFilterPress,
  locationLoading,
  filterCount,
}) => {
  return (
    <>
      {/* My Location Button */}
      <TouchableOpacity
        style={commonStyles.mapStyles.locationButton}
        onPress={onLocationPress}
        disabled={locationLoading}
      >
        <Text style={commonStyles.mapStyles.locationButtonText}>
          {locationLoading ? '📍...' : '📍'}
        </Text>
      </TouchableOpacity>

      {/* Filter Floating Action Button */}
      <TouchableOpacity
        style={mapComponentStyles.filterFAB}
        onPress={onFilterPress}
        activeOpacity={0.8}
      >
        <Text style={mapComponentStyles.filterFABIcon}>🎛️</Text>
        {filterCount > 0 && (
          <View style={mapComponentStyles.filterBadge}>
            <Text style={mapComponentStyles.filterBadgeText}>
              {filterCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </>
  );
};