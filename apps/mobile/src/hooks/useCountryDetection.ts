/**
 * useCountryDetection hook
 *
 * Detects the user's country using a two-tier strategy:
 *
 *  Tier 1 — Device locale (instant, no permissions):
 *    react-native-localize's getCountry() returns the ISO country code
 *    that the user has set in their device region settings.
 *    This is the right default for currency because it reflects the
 *    user's home country, even when offline.
 *
 *  Tier 2 — GPS reverse geocoding (physical location, requires permission):
 *    If the user has already granted location permission (e.g., for the map),
 *    expo-location's reverseGeocodeAsync() is called to confirm the physical
 *    country. This correctly handles travelers (e.g., a US user in Mexico
 *    should see MXN prices).
 *
 * Returns the detected country code (ISO 3166-1 alpha-2) and derived currency.
 */

import { useState, useEffect, useCallback } from 'react';
import * as RNLocalize from 'react-native-localize';
import * as Location from 'expo-location';
import {
  type SupportedCurrency,
  getCurrencyForCountry,
  getPriceRangeForCurrency,
} from '../utils/currencyConfig';
import { debugLog } from '../config/environment';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CountryDetectionResult {
  /** ISO 3166-1 alpha-2 country code, e.g. "US", "MX", "PL" */
  countryCode: string | null;
  /** Currency derived from the country code */
  currency: SupportedCurrency;
  /** Default price range for the detected currency */
  priceRangeDefaults: { min: number; max: number };
  /** True while GPS reverse geocoding is in progress */
  isRefining: boolean;
  /** Source of the most recent detection */
  source: 'device-locale' | 'gps' | 'fallback';
  /** Re-run GPS detection (call after location permission is granted) */
  refineWithGPS: () => Promise<void>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Detects the user's country and returns currency / price-range defaults.
 *
 * @param autoRefineWithGPS - If true, will attempt GPS reverse geocoding
 *   automatically when location permission is already granted (default: true).
 */
export function useCountryDetection(autoRefineWithGPS = true): CountryDetectionResult {
  // ── Tier 1: device locale ──────────────────────────────────────────────────
  const deviceCountryCode: string | null = (() => {
    try {
      // react-native-localize.getCountry() returns the ISO country code from
      // device region settings synchronously — no permission needed.
      return RNLocalize.getCountry() ?? null;
    } catch {
      return null;
    }
  })();

  const deviceCurrency = getCurrencyForCountry(deviceCountryCode);

  const [countryCode, setCountryCode] = useState<string | null>(deviceCountryCode);
  const [currency, setCurrency] = useState<SupportedCurrency>(deviceCurrency);
  const [source, setSource] = useState<CountryDetectionResult['source']>(
    deviceCountryCode ? 'device-locale' : 'fallback'
  );
  const [isRefining, setIsRefining] = useState(false);

  // ── Tier 2: GPS reverse geocoding ─────────────────────────────────────────

  const refineWithGPS = useCallback(async () => {
    try {
      setIsRefining(true);

      // Only proceed if permission is already granted (don't prompt here).
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        debugLog('[CountryDetection] Location permission not granted, skipping GPS refinement');
        return;
      }

      // Get a quick, low-accuracy position (we only need country-level precision).
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.LocationAccuracy.Low,
      });

      const [geocodeResult] = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });

      const gpsCountryCode = geocodeResult?.isoCountryCode ?? null;
      debugLog('[CountryDetection] GPS country code:', gpsCountryCode);

      if (gpsCountryCode && gpsCountryCode !== countryCode) {
        const gpsCurrency = getCurrencyForCountry(gpsCountryCode);
        setCountryCode(gpsCountryCode);
        setCurrency(gpsCurrency);
        setSource('gps');
        debugLog('[CountryDetection] Refined to GPS country:', gpsCountryCode, gpsCurrency);
      } else {
        // GPS confirmed device locale — just update source
        setSource('gps');
      }
    } catch (error) {
      debugLog('[CountryDetection] GPS refinement error:', error);
      // Keep device-locale result — non-fatal
    } finally {
      setIsRefining(false);
    }
  }, [countryCode]);

  // Auto-refine on mount if permission already granted
  useEffect(() => {
    if (autoRefineWithGPS) {
      refineWithGPS();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefineWithGPS]);

  return {
    countryCode,
    currency,
    priceRangeDefaults: getPriceRangeForCurrency(currency),
    isRefining,
    source,
    refineWithGPS,
  };
}
