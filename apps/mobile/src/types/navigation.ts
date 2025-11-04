/**
 * Navigation type definitions
 *
 * This file defines the navigation structure and parameter types
 * for type-safe navigation throughout the app.
 */

import type { NavigatorScreenParams } from '@react-navigation/native';
import type { StackScreenProps } from '@react-navigation/stack';

// Root Stack Navigator - Contains all screens
export type RootStackParamList = {
  Map: undefined;
  Filters: undefined;
  Favorites: undefined;
  Profile: undefined;
  EatTogether: undefined;
  Settings: undefined;
  RestaurantDetail: { restaurantId: string };
  // Auth screens will be added here later
  Login?: undefined;
  SignUp?: undefined;
};

// Stack Navigator Props
export type RootStackScreenProps<T extends keyof RootStackParamList> = StackScreenProps<
  RootStackParamList,
  T
>;

// Navigation prop types for screens
export type MapScreenProps = RootStackScreenProps<'Map'>;
export type FiltersScreenProps = RootStackScreenProps<'Filters'>;
export type FavoritesScreenProps = RootStackScreenProps<'Favorites'>;
export type ProfileScreenProps = RootStackScreenProps<'Profile'>;
export type EatTogetherScreenProps = RootStackScreenProps<'EatTogether'>;
export type SettingsScreenProps = RootStackScreenProps<'Settings'>;

// Global navigation declaration for useNavigation hook
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
