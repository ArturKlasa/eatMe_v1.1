/**
 * View Mode Toggle Component - Simple segmented control
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useViewModeStore } from '../../stores/viewModeStore';
import { viewModeToggleStyles } from '@/styles';

export const ViewModeToggle: React.FC<{ style?: any }> = ({ style }) => {
  const { mode, setMode } = useViewModeStore();

  return (
    <View style={[viewModeToggleStyles.container, style]}>
      <TouchableOpacity
        style={[viewModeToggleStyles.button, mode === 'dish' && viewModeToggleStyles.activeButton]}
        onPress={() => setMode('dish')}
      >
        <Text
          style={[viewModeToggleStyles.text, mode === 'dish' && viewModeToggleStyles.activeText]}
        >
          🍽️ Dishes
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          viewModeToggleStyles.button,
          mode === 'restaurant' && viewModeToggleStyles.activeButton,
        ]}
        onPress={() => setMode('restaurant')}
      >
        <Text
          style={[
            viewModeToggleStyles.text,
            mode === 'restaurant' && viewModeToggleStyles.activeText,
          ]}
        >
          🏪 Places
        </Text>
      </TouchableOpacity>
    </View>
  );
};
