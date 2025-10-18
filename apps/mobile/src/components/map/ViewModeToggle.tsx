/**
 * View Mode Toggle Component - Simple segmented control
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useViewModeStore } from '../../stores/viewModeStore';

export const ViewModeToggle: React.FC<{ style?: any }> = ({ style }) => {
  const { mode, setMode } = useViewModeStore();

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        style={[styles.button, mode === 'dish' && styles.activeButton]}
        onPress={() => setMode('dish')}
      >
        <Text style={[styles.text, mode === 'dish' && styles.activeText]}>🍽️ Dishes</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, mode === 'restaurant' && styles.activeButton]}
        onPress={() => setMode('restaurant')}
      >
        <Text style={[styles.text, mode === 'restaurant' && styles.activeText]}>🏪 Places</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = {
  container: {
    flexDirection: 'row' as const,
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    padding: 2,
    alignSelf: 'center' as const,
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  activeButton: {
    backgroundColor: '#007AFF',
  },
  text: {
    fontSize: 14,
    color: '#666',
  },
  activeText: {
    color: '#FFF',
  },
};
