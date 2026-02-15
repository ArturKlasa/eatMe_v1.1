import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { StyleSheet, AppState, AppStateStatus } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Mapbox from '@rnmapbox/maps';
import { RootNavigator } from './src/navigation';
import { ENV } from './src/config/environment';
import { useSessionStore } from './src/stores/sessionStore';
import './src/i18n'; // Initialize i18n
import { initializeSettings } from './src/stores/settingsStore';
import 'react-native-gesture-handler'; // Required for React Navigation

/**
 * Main App component for EatMe mobile application
 *
 * Updated to use React Navigation with drawer-based navigation structure.
 * Includes proper gesture handling and safe area management.
 * Manages user sessions for rating prompts.
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

  // Initialize settings
  useEffect(() => {
    initializeSettings();
  }, []);

  // Session management - disabled to prevent excessive re-renders
  // TODO: Re-enable with proper debouncing
  useEffect(() => {
    const loadFromStorage = useSessionStore.getState().loadFromStorage;
    const startSession = useSessionStore.getState().startSession;

    // Load previous session data
    loadFromStorage();

    // Start initial session
    startSession();

    // Disabled: AppState listener causes too many re-renders
    // TODO: Add debouncing or rate limiting before re-enabling
    /*
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        endSession();
      } else if (nextAppState === 'active') {
        startSession();
      }
    });

    return () => {
      subscription.remove();
      endSession();
    };
    */
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
