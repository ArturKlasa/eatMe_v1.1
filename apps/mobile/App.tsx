import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { StyleSheet, AppState, AppStateStatus } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Mapbox from '@rnmapbox/maps';
import { RootNavigator } from './src/navigation';
import { ENV } from './src/config/environment';
import { useSessionStore } from './src/stores/sessionStore';
import './src/i18n'; // Initialize i18n
import { initializeSettings, useSettingsStore } from './src/stores/settingsStore';
import { useFilterStore } from './src/stores/filterStore';
import { useCountryDetection } from './src/hooks/useCountryDetection';
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

  // Initialize settings (auto-detects currency from device locale on every launch)
  useEffect(() => {
    initializeSettings();
  }, []);

  /**
   * GPS-based country/currency refinement.
   *
   * Tier 1 (device locale) runs synchronously inside initializeSettings().
   * Here we run Tier 2 (GPS reverse geocoding) in the background so the
   * price-range slider updates to the user's physical location if it differs
   * from their device region (e.g., a US user currently in Mexico).
   *
   * autoRefineWithGPS=true automatically fires when location permission is
   * already granted; it silently does nothing if permission is denied.
   */
  const { currency: detectedCurrency, source: detectionSource } = useCountryDetection(true);
  const updateCurrency = useSettingsStore(state => state.updateCurrency);
  const setCurrencyPriceRange = useFilterStore(state => state.setCurrencyPriceRange);

  useEffect(() => {
    if (detectionSource === 'gps') {
      // GPS confirmed (or overrode) the device-locale currency — sync both stores
      updateCurrency(detectedCurrency);
      setCurrencyPriceRange(detectedCurrency);
    }
  }, [detectedCurrency, detectionSource, updateCurrency, setCurrencyPriceRange]);

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
