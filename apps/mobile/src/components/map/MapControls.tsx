/**
 * Map Controls Component
 *
 * Floating controls for map interaction: location and menu buttons
 */

import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { commonStyles } from '@/styles';
import { colors } from '@eatme/tokens';

interface MapControlsProps {
  onLocationPress: () => void;
  onMenuPress: () => void;
  locationLoading: boolean;
  footerHeight: number;
}

const BUTTON_GAP = 16;
const BETWEEN_BUTTONS = 60;

export const MapControls: React.FC<MapControlsProps> = ({
  onLocationPress,
  onMenuPress,
  locationLoading,
  footerHeight,
}) => {
  const locationBottom = footerHeight + BUTTON_GAP;
  const menuBottom = locationBottom + BETWEEN_BUTTONS;

  return (
    <>
      {/* Menu FAB - Above Location FAB */}
      <TouchableOpacity
        style={[
          commonStyles.mapStyles.locationButton,
          {
            bottom: menuBottom,
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
            bottom: locationBottom,
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
