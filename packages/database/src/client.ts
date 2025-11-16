/**
 * Supabase Client Configuration
 *
 * Platform-agnostic Supabase client that works in:
 * - React Native (Expo)
 * - Next.js (Web Portal)
 * - Node.js (Edge Functions, if needed)
 *
 * Environment Variables Required:
 * - EXPO_PUBLIC_SUPABASE_URL (mobile)
 * - NEXT_PUBLIC_SUPABASE_URL (web)
 * - SUPABASE_URL (server-side)
 *
 * - EXPO_PUBLIC_SUPABASE_ANON_KEY (mobile)
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY (web)
 * - SUPABASE_ANON_KEY (server-side)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

/**
 * Get environment variable based on platform
 */
function getEnvVar(key: string): string | undefined {
  // Check for Expo (React Native) environment variables
  if (typeof process !== 'undefined' && process.env) {
    // Expo uses EXPO_PUBLIC_ prefix
    const expoVar = process.env[`EXPO_PUBLIC_${key}`];
    if (expoVar) return expoVar;

    // Next.js uses NEXT_PUBLIC_ prefix
    const nextVar = process.env[`NEXT_PUBLIC_${key}`];
    if (nextVar) return nextVar;

    // Server-side or plain environment variable
    const plainVar = process.env[key];
    if (plainVar) return plainVar;
  }

  return undefined;
}

/**
 * Supabase configuration
 */
export interface SupabaseConfig {
  url: string;
  anonKey: string;
  options?: {
    auth?: {
      persistSession?: boolean;
      autoRefreshToken?: boolean;
      detectSessionInUrl?: boolean;
      storage?: any;
    };
  };
}

/**
 * Get Supabase configuration from environment
 */
export function getSupabaseConfig(): SupabaseConfig {
  const url = getEnvVar('SUPABASE_URL');
  const anonKey = getEnvVar('SUPABASE_ANON_KEY');

  if (!url) {
    throw new Error(
      'Missing Supabase URL. Please set EXPO_PUBLIC_SUPABASE_URL (mobile) or NEXT_PUBLIC_SUPABASE_URL (web) in your .env file'
    );
  }

  if (!anonKey) {
    throw new Error(
      'Missing Supabase Anon Key. Please set EXPO_PUBLIC_SUPABASE_ANON_KEY (mobile) or NEXT_PUBLIC_SUPABASE_ANON_KEY (web) in your .env file'
    );
  }

  return {
    url,
    anonKey,
    options: {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    },
  };
}

/**
 * Singleton Supabase client instance
 */
let supabaseInstance: SupabaseClient<Database> | null = null;

/**
 * Get or create Supabase client instance
 *
 * @returns Typed Supabase client
 */
export function getSupabaseClient(): SupabaseClient<Database> {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  const config = getSupabaseConfig();
  supabaseInstance = createClient<Database>(config.url, config.anonKey, config.options);

  return supabaseInstance;
}

/**
 * Export the client instance for convenience
 *
 * Usage:
 * ```ts
 * import { supabase } from '@eatme/database';
 * const { data, error } = await supabase.from('restaurants').select('*');
 * ```
 */
export const supabase = getSupabaseClient();

/**
 * Reset the client instance (useful for testing)
 */
export function resetSupabaseClient(): void {
  supabaseInstance = null;
}
