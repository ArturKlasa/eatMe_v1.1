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
  Profile: undefined;
  EatTogether: undefined;
  Settings: undefined;
  RestaurantDetail: { restaurantId: string };
  // Auth screens will be added here later
  Login?: undefined;
  SignUp?: undefined;
};

// Drawer Navigator type
export type DrawerParamList = {
  Map: undefined;
  Filters: undefined;
  Profile: undefined;
  EatTogether: undefined;
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
// Using DrawerScreenProps since these screens are used in DrawerNavigator
export type MapScreenProps = DrawerScreenProps<'Map'>;
export type FiltersScreenProps = DrawerScreenProps<'Filters'>;
export type ProfileScreenProps = DrawerScreenProps<'Profile'>;
export type EatTogetherScreenProps = DrawerScreenProps<'EatTogether'>;
export type SettingsScreenProps = DrawerScreenProps<'Settings'>;

// Legacy type for backward compatibility
export type FavoritesScreenProps = ProfileScreenProps;

// Global navigation declaration for useNavigation hook
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
