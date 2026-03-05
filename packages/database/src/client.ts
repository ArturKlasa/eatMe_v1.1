/**
 * Supabase Client Factory
 *
 * Platform-agnostic Supabase client factory for the EatMe monorepo.
 * Each app creates its own typed client with platform-specific auth options,
 * passing in the URL and anon key explicitly.
 *
 * WHY explicit params instead of reading process.env here:
 * Next.js and Expo/Metro replace NEXT_PUBLIC_* / EXPO_PUBLIC_* env vars at
 * build time via static analysis on LITERAL keys only. Computed key access
 * (e.g. process.env[`NEXT_PUBLIC_${key}`]) evaluates to undefined at runtime.
 * Each app must read its own env vars with literal keys and pass them in.
 *
 * Usage — web portal (Next.js):
 *   import { getWebClient } from '@eatme/database';
 *   export const supabase = getWebClient(
 *     process.env.NEXT_PUBLIC_SUPABASE_URL!,
 *     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
 *   );
 *
 * Usage — mobile (Expo / React Native):
 *   import { getMobileClient } from '@eatme/database';
 *   import AsyncStorage from '@react-native-async-storage/async-storage';
 *   export const supabase = getMobileClient(
 *     process.env.EXPO_PUBLIC_SUPABASE_URL!,
 *     process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
 *     AsyncStorage
 *   );
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

/**
 * Create a typed Supabase client configured for **Next.js / web portal**.
 *
 * Auth: implicit flow preserved until A8 migrates to PKCE + @supabase/ssr.
 */
export function getWebClient(url: string, anonKey: string): SupabaseClient<Database> {
  if (!url || !anonKey) {
    throw new Error(
      '[eatme/database] getWebClient: url and anonKey are required. ' +
        'Pass process.env.NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    );
  }
  return createClient<Database>(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      // Keep implicit until A8 migrates to PKCE + @supabase/ssr
      flowType: 'implicit',
    },
  });
}

/**
 * Create a typed Supabase client configured for **React Native / Expo**.
 *
 * @param storage - AsyncStorage instance injected by the caller so the shared
 *   package has no native dependency.
 */
export function getMobileClient(
  url: string,
  anonKey: string,
  storage: {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
  }
): SupabaseClient<Database> {
  if (!url || !anonKey) {
    throw new Error(
      '[eatme/database] getMobileClient: url and anonKey are required. ' +
        'Pass process.env.EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.'
    );
  }
  return createClient<Database>(url, anonKey, {
    auth: {
      storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}
