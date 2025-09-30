/**
 * Navigation type definitions for React Navigation
 *
 * This file defines the navigation structure and parameter types
 * for type-safe navigation throughout the app.
 */

import type { NavigatorScreenParams } from '@react-navigation/native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { DrawerScreenProps as RNDrawerScreenProps } from '@react-navigation/drawer';

// Root Stack Navigator - Contains the main drawer
export type RootStackParamList = {
  Main: NavigatorScreenParams<DrawerParamList>;
  // Auth screens will be added here later
  Login?: undefined;
  SignUp?: undefined;
};

// Drawer Navigator - Main app navigation
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
export type MapScreenProps = DrawerScreenProps<'Map'>;
export type FiltersScreenProps = DrawerScreenProps<'Filters'>;
export type FavoritesScreenProps = DrawerScreenProps<'Favorites'>;
export type ProfileScreenProps = DrawerScreenProps<'Profile'>;
export type SettingsScreenProps = DrawerScreenProps<'Settings'>;

// Global navigation declaration for useNavigation hook
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
