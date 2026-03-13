import React, { useEffect, useCallback, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { colors } from '@eatme/tokens';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import {
  MapScreen,
  FiltersScreen,
  FavoritesScreen,
  ProfileScreen,
  ProfileEditScreen,
  ViewedHistoryScreen,
  EatTogetherScreen,
  SettingsScreen,
  SwipeScreen,
  OnboardingStep1Screen,
  OnboardingStep2Screen,
} from '@/screens';
import { LoginScreen, RegisterScreen, ForgotPasswordScreen } from '@/screens/auth';
import {
  CreateSessionScreen,
  JoinSessionScreen,
  SessionLobbyScreen,
  RecommendationsScreen,
  VotingResultsScreen,
} from '@/screens/eatTogether';
import { RestaurantDetailScreen } from '../screens/RestaurantDetailScreen';
import { useAuthStore } from '../stores/authStore';
import { initStoreBindings } from '../stores/storeBindings';
import type {
  RootStackParamList,
  AuthStackParamList,
  MainStackParamList,
} from '@/types/navigation';

const RootStack = createStackNavigator<RootStackParamList>();
const AuthStack = createStackNavigator<AuthStackParamList>();
const MainStack = createStackNavigator<MainStackParamList>();

/**
 * Auth Navigator - Screens for non-authenticated users
 */
function AuthNavigator() {
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </AuthStack.Navigator>
  );
}

/**
 * Main Navigator - Screens for authenticated users
 */
function MainNavigator() {
  return (
    <MainStack.Navigator
      initialRouteName="Map"
      screenOptions={{
        headerShown: false,
      }}
    >
      <MainStack.Screen name="Map" component={MapScreen} />
      <MainStack.Screen
        name="Swipe"
        component={SwipeScreen}
        options={{
          headerShown: true,
          title: 'Swipe',
        }}
      />
      <MainStack.Screen
        name="Filters"
        component={FiltersScreen}
        options={{
          presentation: 'transparentModal',
          cardStyle: { backgroundColor: 'transparent' },
        }}
      />
      <MainStack.Screen
        name="Favorites"
        component={FavoritesScreen}
        options={{
          presentation: 'transparentModal',
          cardStyle: { backgroundColor: 'transparent' },
        }}
      />
      <MainStack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          presentation: 'transparentModal',
          cardStyle: { backgroundColor: 'transparent' },
        }}
      />
      <MainStack.Screen
        name="ProfileEdit"
        component={ProfileEditScreen}
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
      <MainStack.Screen
        name="ViewedHistory"
        component={ViewedHistoryScreen}
        options={{
          presentation: 'card',
          headerShown: true,
          headerTitle: 'Viewed History',
          headerBackTitle: 'Back',
        }}
      />
      <MainStack.Screen
        name="EatTogether"
        component={EatTogetherScreen}
        options={{
          presentation: 'transparentModal',
          cardStyle: { backgroundColor: 'transparent' },
        }}
      />
      <MainStack.Screen
        name="CreateSession"
        component={CreateSessionScreen}
        options={{
          headerShown: true,
          title: 'Create Eat Together',
        }}
      />
      <MainStack.Screen
        name="JoinSession"
        component={JoinSessionScreen}
        options={{
          headerShown: true,
          title: 'Join Session',
        }}
      />
      <MainStack.Screen
        name="SessionLobby"
        component={SessionLobbyScreen}
        options={{
          headerShown: true,
          title: 'Waiting Room',
        }}
      />
      <MainStack.Screen
        name="Recommendations"
        component={RecommendationsScreen}
        options={{
          headerShown: true,
          title: 'Restaurant Recommendations',
        }}
      />
      <MainStack.Screen
        name="VotingResults"
        component={VotingResultsScreen}
        options={{
          headerShown: true,
          title: 'Voting Results',
        }}
      />
      <MainStack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          presentation: 'transparentModal',
          cardStyle: { backgroundColor: 'transparent' },
        }}
      />
      <MainStack.Screen
        name="RestaurantDetail"
        component={RestaurantDetailScreen}
        options={{
          presentation: 'modal',
          gestureEnabled: true,
          cardStyle: { backgroundColor: 'transparent' },
        }}
      />
      <MainStack.Screen
        name="OnboardingStep1"
        component={OnboardingStep1Screen}
        options={{
          headerShown: true,
          title: 'Complete Your Profile',
          headerBackTitle: 'Cancel',
        }}
      />
      <MainStack.Screen
        name="OnboardingStep2"
        component={OnboardingStep2Screen}
        options={{
          headerShown: true,
          title: 'Complete Your Profile',
          headerBackTitle: 'Back',
        }}
      />
    </MainStack.Navigator>
  );
}

/**
 * Loading Screen - Shown while checking auth state
 */
function LoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={colors.accentDark} />
    </View>
  );
}

/**
 * Root Navigation Component
 *
 * Handles authentication flow:
 * - Shows loading screen while initializing auth
 * - Shows Auth screens if not logged in
 * - Shows Main app screens if logged in
 */
export const RootNavigator: React.FC = () => {
  // Use shallow selectors to prevent unnecessary re-renders
  const isInitialized = useAuthStore(state => state.isInitialized);
  const session = useAuthStore(state => state.session);
  const initialize = useAuthStore(state => state.initialize);

  // Track if we've already started initialization
  const hasInitialized = useRef(false);

  // Initialize auth on mount - only once, and wire store-to-store subscriptions
  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      // Wire reactive subscriptions BEFORE initialize() so the initial session
      // load also triggers filter/onboarding sync if a session already exists.
      const cleanup = initStoreBindings();
      initialize();
      return cleanup;
    }
  }, []); // Empty deps - only run once

  // Show loading while initializing
  if (!isInitialized) {
    return (
      <NavigationContainer>
        <LoadingScreen />
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {session ? (
          // User is signed in - show main app
          <RootStack.Screen name="Main" component={MainNavigator} />
        ) : (
          // User is not signed in - show auth screens
          <RootStack.Screen name="Auth" component={AuthNavigator} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.backgroundWarm,
  },
});
