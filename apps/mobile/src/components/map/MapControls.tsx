/**
 * Map Controls Component
 *
 * Floating controls for map interaction: location and menu buttons
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { commonStyles, mapComponentStyles } from '@/styles';
import { colors } from '@eatme/tokens';

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
  const insets = useSafeAreaInsets();
  const bottomOffset = insets.bottom;

  return (
    <>
      {/* Menu FAB - Above Location FAB */}
      <TouchableOpacity
        style={[
          commonStyles.mapStyles.locationButton,
          {
            bottom: 390 + bottomOffset,
            right: 20,
            zIndex: 1000,
            elevation: 10,
            backgroundColor: colors.gray300,
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
            bottom: 330 + bottomOffset,
            zIndex: 1000,
            elevation: 10,
            backgroundColor: colors.gray300,
          },
        ]}
        onPress={onLocationPress}
        disabled={locationLoading}
      >
        <Text
          style={[
            commonStyles.mapStyles.locationButtonText,
            {
              fontSize: 45,
              textAlign: 'center',
              lineHeight: 45,
            },
          ]}
        >
          {locationLoading ? '⌖...' : '⌖'}
        </Text>
      </TouchableOpacity>
    </>
  );
};
