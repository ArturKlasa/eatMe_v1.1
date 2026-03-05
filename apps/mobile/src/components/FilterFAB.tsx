/**
 * Filter Floating Action Button (FAB)
 *
 * Provides quick access to filters from the map screen with visual
 * indication of active filter count and smooth animations.
 */

import React from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { MainStackParamList } from '@/types/navigation';
import { useFilterStore } from '../stores/filterStore';
import { filterFABStyles } from '@/styles';

type NavigationProp = StackNavigationProp<MainStackParamList>;

/**
 * Filter FAB Component
 */
export const FilterFAB: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { getDailyFilterCount, hasDailyFilters } = useFilterStore();

  const activeCount = getDailyFilterCount();

  const handlePress = () => {
    navigation.navigate('Filters');
  };

  return (
    <View style={filterFABStyles.container}>
      <TouchableOpacity
        style={[filterFABStyles.fab, hasDailyFilters() && filterFABStyles.fabActive]}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <Text style={filterFABStyles.fabIcon}>🎛️</Text>

        {/* Active filter count badge */}
        {activeCount > 0 && (
          <View style={filterFABStyles.badge}>
            <Text style={filterFABStyles.badgeText}>{activeCount}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
};

/**
 * Quick Filter Modal/Bottom Sheet (for future implementation)
 * This will be implemented in Task 1.4.3
 */
export const QuickFilterModal: React.FC<{
  visible: boolean;
  onClose: () => void;
}> = ({ visible, onClose }) => {
  // Placeholder for modal implementation
  return null;
};
