import React from 'react';
import { Text } from 'react-native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import {
  MapScreen,
  FiltersScreen,
  FavoritesScreen,
  ProfileScreen,
  SettingsScreen,
} from '@/screens';
import type { DrawerParamList } from '@/types/navigation';

const Drawer = createDrawerNavigator<DrawerParamList>();

/**
 * Main Drawer Navigator
 *
 * Contains the primary navigation structure for the app.
 * Custom drawer content will be implemented in Task 1.3.2.
 */
export const DrawerNavigator: React.FC = () => {
  return (
    <Drawer.Navigator
      initialRouteName="Map"
      screenOptions={{
        headerShown: false, // We'll handle headers in individual screens
        drawerStyle: {
          backgroundColor: '#fff',
          width: 280,
        },
        drawerActiveTintColor: '#007AFF',
        drawerInactiveTintColor: '#666',
        drawerLabelStyle: {
          fontSize: 16,
          fontWeight: '500',
          marginLeft: -10,
        },
      }}
    >
      <Drawer.Screen
        name="Map"
        component={MapScreen}
        options={{
          drawerItemStyle: { display: 'none' },
        }}
      />
      <Drawer.Screen
        name="Filters"
        component={FiltersScreen}
        options={{
          drawerLabel: 'Personal filters',
          drawerIcon: ({ color }) => <Text>🎛️</Text>,
        }}
      />
      <Drawer.Screen
        name="Favorites"
        component={FavoritesScreen}
        options={{
          drawerLabel: 'Favorites',
          drawerIcon: ({ color }) => <Text>❤️</Text>,
        }}
      />
      <Drawer.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          drawerLabel: 'Profile',
          drawerIcon: ({ color }) => <Text>👤</Text>,
        }}
      />
      <Drawer.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          drawerLabel: 'Settings',
          drawerIcon: ({ color }) => <Text>⚙️</Text>,
        }}
      />
    </Drawer.Navigator>
  );
};
