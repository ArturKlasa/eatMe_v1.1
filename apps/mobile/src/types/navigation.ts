/**
 * Navigation type definitions
 *
 * This file defines the navigation structure and parameter types
 * for type-safe navigation throughout the app.
 */

import type { NavigatorScreenParams } from '@react-navigation/native';
import type { StackScreenProps } from '@react-navigation/stack';

// Auth Stack Navigator - Authentication screens
export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

// Main App Stack Navigator - Contains all app screens (authenticated)
export type MainStackParamList = {
  Map: undefined;
  Swipe: undefined;
  Filters: undefined;
  Favorites: undefined;
  Profile: undefined;
  ProfileEdit: undefined;
  ViewedHistory: undefined;
  EatTogether: undefined;
  CreateSession: undefined;
  JoinSession: undefined;
  SessionLobby: { sessionId: string };
  Recommendations: { sessionId: string };
  VotingResults: { sessionId: string };
  Settings: undefined;
  RestaurantDetail: { restaurantId: string };
  SupabaseTest: undefined;
};

// Root Stack Navigator - Contains Auth and Main stacks
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainStackParamList>;
} & MainStackParamList &
  AuthStackParamList; // Also allow direct navigation for backward compatibility

// Stack Navigator Props
export type RootStackScreenProps<T extends keyof RootStackParamList> = StackScreenProps<
  RootStackParamList,
  T
>;

export type AuthStackScreenProps<T extends keyof AuthStackParamList> = StackScreenProps<
  AuthStackParamList,
  T
>;

export type MainStackScreenProps<T extends keyof MainStackParamList> = StackScreenProps<
  MainStackParamList,
  T
>;

// Navigation prop types for screens
export type MapScreenProps = MainStackScreenProps<'Map'>;
export type FiltersScreenProps = MainStackScreenProps<'Filters'>;
export type FavoritesScreenProps = MainStackScreenProps<'Favorites'>;
export type ProfileScreenProps = MainStackScreenProps<'Profile'>;
export type ProfileEditScreenProps = MainStackScreenProps<'ProfileEdit'>;
export type EatTogetherScreenProps = MainStackScreenProps<'EatTogether'>;
export type CreateSessionScreenProps = MainStackScreenProps<'CreateSession'>;
export type JoinSessionScreenProps = MainStackScreenProps<'JoinSession'>;
export type SessionLobbyScreenProps = MainStackScreenProps<'SessionLobby'>;
export type RecommendationsScreenProps = MainStackScreenProps<'Recommendations'>;
export type VotingResultsScreenProps = MainStackScreenProps<'VotingResults'>;
export type SettingsScreenProps = MainStackScreenProps<'Settings'>;

// Global navigation declaration for useNavigation hook
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
