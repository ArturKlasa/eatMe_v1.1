import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { DrawerNavigator } from './DrawerNavigator';
import { RestaurantDetailScreen } from '../screens/RestaurantDetailScreen';
import type { RootStackParamList } from '@/types/navigation';

const RootStack = createStackNavigator<RootStackParamList>();

/**
 * Root Navigation Component
 *
 * Main navigation container that wraps the entire app navigation structure.
 * Contains the drawer navigator and will include auth screens in later tasks.
 */
export const RootNavigator: React.FC = () => {
  return (
    <NavigationContainer>
      <RootStack.Navigator
        screenOptions={{
          headerShown: false, // Hide stack headers, drawer handles its own
        }}
      >
        <RootStack.Screen name="Main" component={DrawerNavigator} />
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
