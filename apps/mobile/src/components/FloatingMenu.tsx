/**
 * Floating Menu Componeconst menuItems: MenuItem[] = [
  { id: 'filters', label: 'Personal filters', icon: '🥢', screen: 'Filters' },
  { id: 'profile', label: 'Profile', icon: '👤', screen: 'Profile' },
  { id: 'eatTogether', label: 'Eat together', icon: '🍲', screen: 'EatTogether' },
  { id: 'settings', label: 'Settings', icon: '⚙️', screen: 'Settings' },
]; * Displays menu options next to the FAB button when opened.
 * Replaces the drawer navigation with a compact floating menu.
 */

import React from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '@/types/navigation';
import { floatingMenuStyles } from '@/styles';

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
  { id: 'profile', label: 'Profile', icon: '👤', screen: 'Profile' },
  { id: 'eatTogether', label: 'Eat together', icon: '🍲', screen: 'EatTogether' },
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
    <View style={floatingMenuStyles.container}>
      {/* Backdrop */}
      <TouchableOpacity style={floatingMenuStyles.backdrop} activeOpacity={1} onPress={onClose} />

      {/* Menu Items */}
      <View style={floatingMenuStyles.menuContainer}>
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={item.id}
            style={[
              floatingMenuStyles.menuItem,
              { top: index * 60 }, // Stack items vertically
            ]}
            onPress={() => handleMenuItemPress(item.screen)}
            activeOpacity={0.8}
          >
            <View style={floatingMenuStyles.menuItemContent}>
              <Text style={floatingMenuStyles.menuIcon}>{item.icon}</Text>
              <Text style={floatingMenuStyles.menuLabel}>{item.label}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};
