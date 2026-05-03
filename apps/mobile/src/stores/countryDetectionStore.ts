/**
 * Country Detection Store
 *
 * Two-tier country/currency detection:
 *   1. Device locale via react-native-localize (instant, no permission, runs at construction)
 *   2. GPS reverse-geocoding via expo-location (refines to physical country once permission is granted)
 *
 * `refineFromGPS()` is idempotent and once-per-session: callers (App.tsx on mount,
 * BasicMapScreen after permission grant) can fire it freely; the store no-ops
 * after the first successful GPS refinement.
 */

import { create } from 'zustand';
import * as RNLocalize from 'react-native-localize';
import * as Location from 'expo-location';
import { type SupportedCurrency, getCurrencyForCountry } from '../utils/currencyConfig';
import { debugLog } from '../config/environment';

export type DetectionSource = 'device-locale' | 'gps' | 'fallback';

interface CountryDetectionState {
  countryCode: string | null;
  currency: SupportedCurrency;
  source: DetectionSource;
  isRefining: boolean;
  refineFromGPS: () => Promise<void>;
}

const readDeviceLocale = (): Pick<CountryDetectionState, 'countryCode' | 'currency' | 'source'> => {
  try {
    const code = RNLocalize.getCountry() ?? null;
    return {
      countryCode: code,
      currency: getCurrencyForCountry(code),
      source: code ? 'device-locale' : 'fallback',
    };
  } catch {
    return { countryCode: null, currency: 'USD', source: 'fallback' };
  }
};

export const useCountryDetectionStore = create<CountryDetectionState>((set, get) => ({
  ...readDeviceLocale(),
  isRefining: false,
  refineFromGPS: async () => {
    const { source, isRefining } = get();
    if (source === 'gps' || isRefining) return;
    set({ isRefining: true });
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        debugLog('[CountryDetection] Permission not granted; staying on device locale');
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.LocationAccuracy.Low,
      });
      const [geocodeResult] = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      const gpsCountryCode = geocodeResult?.isoCountryCode ?? null;
      if (gpsCountryCode) {
        const gpsCurrency = getCurrencyForCountry(gpsCountryCode);
        set({ countryCode: gpsCountryCode, currency: gpsCurrency, source: 'gps' });
        debugLog('[CountryDetection] Refined to GPS:', gpsCountryCode, gpsCurrency);
      }
    } catch (err) {
      debugLog('[CountryDetection] GPS refinement error:', err);
    } finally {
      set({ isRefining: false });
    }
  },
}));
