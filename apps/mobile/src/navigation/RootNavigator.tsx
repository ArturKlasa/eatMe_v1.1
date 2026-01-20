import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import {
  MapScreen,
  FiltersScreen,
  FavoritesScreen,
  ProfileScreen,
  EatTogetherScreen,
  SettingsScreen,
} from '@/screens';
import { RestaurantDetailScreen } from '../screens/RestaurantDetailScreen';
import { SupabaseTestScreen } from '../screens/SupabaseTestScreen';
import type { RootStackParamList } from '@/types/navigation';

const RootStack = createStackNavigator<RootStackParamList>();

/**
 * Root Navigation Component
 *
 * Main navigation container using Stack Navigator for all screens.
 * Drawer navigation replaced with floating menu component.
 */
export const RootNavigator: React.FC = () => {
  return (
    <NavigationContainer>
      <RootStack.Navigator
        initialRouteName="Map"
        screenOptions={{
          headerShown: false,
        }}
      >
        <RootStack.Screen name="Map" component={MapScreen} />
        <RootStack.Screen
          name="SupabaseTest"
          component={SupabaseTestScreen}
          options={{
            headerShown: true,
            title: 'Supabase Connection Test',
          }}
        />
        <RootStack.Screen
          name="Filters"
          component={FiltersScreen}
          options={{
            presentation: 'transparentModal',
            cardStyle: { backgroundColor: 'transparent' },
          }}
        />
        <RootStack.Screen
          name="Favorites"
          component={FavoritesScreen}
          options={{
            presentation: 'transparentModal',
            cardStyle: { backgroundColor: 'transparent' },
          }}
        />
        <RootStack.Screen
          name="Profile"
          component={ProfileScreen}
          options={{
            presentation: 'transparentModal',
            cardStyle: { backgroundColor: 'transparent' },
          }}
        />
        <RootStack.Screen
          name="EatTogether"
          component={EatTogetherScreen}
          options={{
            presentation: 'transparentModal',
            cardStyle: { backgroundColor: 'transparent' },
          }}
        />
        <RootStack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            presentation: 'transparentModal',
            cardStyle: { backgroundColor: 'transparent' },
          }}
        />
        <RootStack.Screen
          name="RestaurantDetail"
          component={RestaurantDetailScreen}
          options={{
            presentation: 'modal',
            gestureEnabled: true,
            cardStyle: { backgroundColor: 'transparent' },
          }}
        />
        {/* Auth screens will be added here in Task 1.7.2 */}
        {/* 
        <RootStack.Screen name="Login" component={LoginScreen} />
        <RootStack.Screen name="SignUp" component={SignUpScreen} />
        */}
      </RootStack.Navigator>
    </NavigationContainer>
  );
};
