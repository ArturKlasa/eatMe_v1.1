/**
 * Floating Menu Component
 *
 * Displays menu options next to the FAB button when opened.
 * Replaces the drawer navigation with a compact floating menu.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '@/types/navigation';

type NavigationProp = StackNavigationProp<RootStackParamList>;

interface FloatingMenuProps {
  visible: boolean;
  onClose: () => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: string;
  screen: keyof RootStackParamList;
}

const menuItems: MenuItem[] = [
  { id: 'filters', label: 'Personal filters', icon: '🥢', screen: 'Filters' },
  { id: 'favorites', label: 'Favorites', icon: '❤️', screen: 'Favorites' },
  { id: 'profile', label: 'Profile', icon: '👤', screen: 'Profile' },
  { id: 'settings', label: 'Settings', icon: '⚙️', screen: 'Settings' },
];

export const FloatingMenu: React.FC<FloatingMenuProps> = ({ visible, onClose }) => {
  const navigation = useNavigation<NavigationProp>();

  const handleMenuItemPress = (screen: keyof RootStackParamList) => {
    onClose();
    navigation.navigate(screen as any);
  };

  if (!visible) return null;

  return (
    <View style={styles.container}>
      {/* Backdrop */}
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

      {/* Menu Items */}
      <View style={styles.menuContainer}>
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={item.id}
            style={[
              styles.menuItem,
              { top: index * 60 }, // Stack items vertically
            ]}
            onPress={() => handleMenuItemPress(item.screen)}
            activeOpacity={0.8}
          >
            <View style={styles.menuItemContent}>
              <Text style={styles.menuIcon}>{item.icon}</Text>
              <Text style={styles.menuLabel}>{item.label}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  menuContainer: {
    position: 'absolute',
    right: 92, // Position to the left of the FAB (FAB is at right: 20, width ~56, so 20 + 56 + 16 = 92)
    bottom: 560, // Move up a bit more
  },
  menuItem: {
    position: 'absolute',
    right: 0,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    minWidth: 180,
    borderWidth: 1,
    borderColor: '#333',
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuIcon: {
    fontSize: 20,
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E0E0E0',
  },
});
