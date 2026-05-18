import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Mapbox from '@rnmapbox/maps';
import { RootNavigator } from './src/navigation';
import { ENV } from './src/config/environment';
import { ErrorBoundary } from './src/components/common/ErrorBoundary';
import { ForceUpdateScreen } from './src/components/common/ForceUpdateScreen';
import { useAppVersionGate } from './src/hooks/useAppVersionGate';
import { useSessionStore } from './src/stores/sessionStore';
import './src/i18n'; // Initialize i18n
import { initializeSettings, useSettingsStore } from './src/stores/settingsStore';
import { useFilterStore } from './src/stores/filterStore';
import { useCountryDetectionStore } from './src/stores/countryDetectionStore';
import 'react-native-gesture-handler'; // Required for React Navigation
import { configureGoogleSignIn } from './src/lib/googleAuth';

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

  // Best-effort early warm-up of the Google Sign-In SDK.
  // signInWithGoogle() also calls configureGoogleSignIn() right before the
  // native call, so this useEffect is not strictly required — it just allows
  // the native _apiClient to be constructed in the background before the user
  // taps the button, saving ~50 ms on the first sign-in attempt.
  useEffect(() => {
    configureGoogleSignIn();
  }, []);

  // Initialize settings (auto-detects currency from device locale on every launch)
  useEffect(() => {
    initializeSettings();
  }, []);

  // Tier 1 (device locale) runs synchronously inside initializeSettings().
  // Fire Tier 2 (GPS reverse geocoding) once on mount; it no-ops silently if
  // location permission isn't granted yet — BasicMapScreen retries after the
  // user grants permission.
  useEffect(() => {
    useCountryDetectionStore.getState().refineFromGPS();
  }, []);

  const detectedCurrency = useCountryDetectionStore(state => state.currency);
  const detectionSource = useCountryDetectionStore(state => state.source);
  const updateCurrency = useSettingsStore(state => state.updateCurrency);
  const setCurrencyPriceRange = useFilterStore(state => state.setCurrencyPriceRange);

  useEffect(() => {
    if (detectionSource === 'gps') {
      updateCurrency(detectedCurrency);
      setCurrencyPriceRange(detectedCurrency);
    }
  }, [detectedCurrency, detectionSource, updateCurrency, setCurrencyPriceRange]);

  useEffect(() => {
    const loadFromStorage = useSessionStore.getState().loadFromStorage;
    const startSession = useSessionStore.getState().startSession;

    loadFromStorage();
    startSession();
  }, []);

  // Phase 6 force-upgrade gate — see docs/plans/dish-model-rewrite-phase-1-database.md §6.
  // Non-null when the installed app version is below app_config.min_supported_mobile_version.
  const versionGate = useAppVersionGate();

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {versionGate ? (
          <ForceUpdateScreen config={versionGate} />
        ) : (
          <ErrorBoundary>
            <RootNavigator />
          </ErrorBoundary>
        )}
        <StatusBar style="light" />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
});
