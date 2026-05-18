// app-config fetcher with AsyncStorage offline survival cache.
//
// The mobile app calls this on startup to power the Phase 6 force-upgrade gate
// (see docs/plans/dish-model-rewrite-phase-1-database.md §6). The edge function
// is anonymous-readable, so this runs BEFORE sign-in.
//
// Fail-open philosophy: if both the live fetch AND the cached value are
// unavailable, the hook returns null and the app proceeds normally. We'd
// rather risk a stale-floor pass than lock the entire user base out when
// the server is down.

import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const APP_CONFIG_URL = `${SUPABASE_URL}/functions/v1/app-config`;

const STORAGE_KEY = '@eatme_app_config_cache';
const FETCH_TIMEOUT_MS = 3000;

export interface AppConfig {
  min_supported_mobile_version: string;
  latest_mobile_version: string;
  update_url_ios: string;
  update_url_android: string;
  updated_at: string;
}

/**
 * Fetches the app config from the edge function with a short timeout, falling
 * back to the last-cached value on failure. Caches every successful response.
 * Returns null if both live and cached values are unavailable.
 */
export async function fetchAppConfig(): Promise<AppConfig | null> {
  // 1. Try live fetch.
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const resp = await fetch(APP_CONFIG_URL, {
      method: 'GET',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (resp.ok) {
      const config = (await resp.json()) as AppConfig;
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(config)).catch(() => {
        // Cache write failure is non-fatal — return the live value anyway.
      });
      return config;
    }
  } catch {
    // Network error, timeout, or non-OK response — fall through to cache.
  }

  // 2. Fallback to cached value.
  try {
    const cached = await AsyncStorage.getItem(STORAGE_KEY);
    if (cached) return JSON.parse(cached) as AppConfig;
  } catch {
    // AsyncStorage read failure — fall through.
  }

  // 3. Fail open.
  return null;
}
