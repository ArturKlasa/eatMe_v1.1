/**
 * Navigation type definitions for React Navigation
 *
 * This file defines the navigation structure and parameter types
 * for type-safe navigation throughout the app.
 */

import type { NavigatorScreenParams } from '@react-navigation/native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { DrawerScreenProps as RNDrawerScreenProps } from '@react-navigation/drawer';

// Root Stack Navigator - Contains all screens
export type RootStackParamList = {
  Map: undefined;
  Filters: undefined;
  Favorites: undefined;
  Profile: undefined;
  Settings: undefined;
  RestaurantDetail: { restaurantId: string };
  // Auth screens will be added here later
  Login?: undefined;
  SignUp?: undefined;
};

// Legacy Drawer Navigator type (kept for backward compatibility during transition)
export type DrawerParamList = {
  Map: undefined;
  Filters: undefined;
  Favorites: undefined;
  Profile: undefined;
  Settings: undefined;
};

// Stack Navigator Props
export type RootStackScreenProps<T extends keyof RootStackParamList> = StackScreenProps<
  RootStackParamList,
  T
>;

// Drawer Navigator Props
export type DrawerScreenProps<T extends keyof DrawerParamList> = RNDrawerScreenProps<
  DrawerParamList,
  T
>;

// Navigation prop types for screens
export type MapScreenProps = RootStackScreenProps<'Map'>;
export type FiltersScreenProps = RootStackScreenProps<'Filters'>;
export type FavoritesScreenProps = RootStackScreenProps<'Favorites'>;
export type ProfileScreenProps = RootStackScreenProps<'Profile'>;
export type SettingsScreenProps = RootStackScreenProps<'Settings'>;

// Global navigation declaration for useNavigation hook
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
