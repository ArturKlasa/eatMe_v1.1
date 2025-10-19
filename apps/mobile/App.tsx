import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Mapbox from '@rnmapbox/maps';
import { RootNavigator } from './src/navigation';
import { ENV } from './src/config/environment';
import 'react-native-gesture-handler'; // Required for React Navigation

/**
 * Main App component for EatMe mobile application
 *
 * Updated to use React Navigation with drawer-based navigation structure.
 * Includes proper gesture handling and safe area management.
 *
 * Navigation Structure:
 * - Root Navigator (Stack) -> Drawer Navigator -> Individual Screens
 * - Map, Filters, Favorites, Profile, Settings
 */
export default function App(): React.JSX.Element {
  // Initialize Mapbox once at app level
  useEffect(() => {
    Mapbox.setAccessToken(ENV.mapbox.accessToken);
  }, []);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <RootNavigator />
        <StatusBar style="auto" />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
