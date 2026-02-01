import React, { useEffect, useCallback, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import {
  MapScreen,
  FiltersScreen,
  FavoritesScreen,
  ProfileScreen,
  ProfileEditScreen,
  EatTogetherScreen,
  SettingsScreen,
  SwipeScreen,
} from '@/screens';
import { LoginScreen, RegisterScreen, ForgotPasswordScreen } from '@/screens/auth';
import { RestaurantDetailScreen } from '../screens/RestaurantDetailScreen';
import { SupabaseTestScreen } from '../screens/SupabaseTestScreen';
import { useAuthStore } from '../stores/authStore';
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
          title: 'Swipe Demo',
        }}
      />
      <MainStack.Screen
        name="SupabaseTest"
        component={SupabaseTestScreen}
        options={{
          headerShown: true,
          title: 'Supabase Connection Test',
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
        name="EatTogether"
        component={EatTogetherScreen}
        options={{
          presentation: 'transparentModal',
          cardStyle: { backgroundColor: 'transparent' },
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
    </MainStack.Navigator>
  );
}

/**
 * Loading Screen - Shown while checking auth state
 */
function LoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#EA580C" />
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

  // Initialize auth on mount - only once
  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      initialize();
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
    backgroundColor: '#FFF7ED',
  },
});
