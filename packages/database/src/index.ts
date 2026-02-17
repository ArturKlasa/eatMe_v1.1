/**
 * @eatme/database
 *
 * Shared Supabase database client and data access layer for EatMe monorepo.
 * Used by both mobile app and web portal.
 */

// Export Supabase client
export { supabase, getSupabaseClient, getSupabaseConfig, resetSupabaseClient } from './client';

// Export types
export type { Database, Json } from './types';
export type { SupabaseConfig } from './client';
