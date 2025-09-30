/**
 * Filter Floating Action Button (FAB)
 *
 * Provides quick access to filters from the map screen with visual
 * indication of active filter count and smooth animations.
 */

import React from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useFilterStore } from '../stores/filterStore';
import { theme } from '@/styles';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import type { DrawerParamList } from '@/types/navigation';

type NavigationProp = DrawerNavigationProp<DrawerParamList>;

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
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.fab, hasDailyFilters() && styles.fabActive]}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <Text style={styles.fabIcon}>🎛️</Text>

        {/* Active filter count badge */}
        {activeCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{activeCount}</Text>
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

// Styles for the FAB component
const styles = StyleSheet.create({
  container: {
    position: 'absolute' as const,
    bottom: 100,
    right: 20,
    zIndex: 1000,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    elevation: 8,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fabActive: {
    backgroundColor: theme.colors.primaryDark,
    transform: [{ scale: 1.1 }],
  },
  fabIcon: {
    fontSize: 24,
  },
  badge: {
    position: 'absolute' as const,
    top: -2,
    right: -2,
    backgroundColor: theme.colors.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    borderWidth: 2,
    borderColor: theme.colors.white,
  },
  badgeText: {
    color: theme.colors.white,
    fontSize: 12,
    fontWeight: 'bold' as const,
  },
});
