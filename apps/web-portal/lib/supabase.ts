/**
 * Web Portal — Browser Supabase Client
 *
 * Singleton browser client for the Next.js web portal. Uses `@supabase/ssr`
 * so that auth cookies are handled automatically by the SSR layer.
 * Server-side operations use `supabase-server.ts` instead.
 */

import { createBrowserClient } from '@supabase/ssr';
import type { Database, Tables, TablesInsert } from '@eatme/database';

// Re-export types for convenience — callers keep their existing imports
export type { Tables, TablesInsert };

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing Supabase environment variables. Check .env.local:\n' +
      '  NEXT_PUBLIC_SUPABASE_URL\n' +
      '  NEXT_PUBLIC_SUPABASE_ANON_KEY'
  );
}

/**
 * Browser-side Supabase client (PKCE, cookie-based session).
 *
 * Uses @supabase/ssr's createBrowserClient which:
 * - Stores the session in cookies (not localStorage) so the proxy can read it
 * - Uses PKCE flow by default (replaces deprecated implicit/hash flow)
 *
 * For server-side usage, import createSupabaseSessionClient from
 * @/lib/supabase-server instead.
 */
export const supabase = createBrowserClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// ============================================================================
// DATABASE TYPES — derived from generated @eatme/database types
// Single source of truth: packages/database/src/types.ts (auto-generated).
// Run `supabase gen types typescript --project-id <id> > packages/database/src/types.ts`
// after every schema migration to keep these in sync.
// ============================================================================

/** Row returned from `restaurants` */
export type Restaurant = Tables<'restaurants'>;
/** Insert payload for `restaurants` */
export type RestaurantInsert = TablesInsert<'restaurants'>;

/** Row returned from `menus` */
export type Menu = Tables<'menus'>;
/** Insert payload for `menus` */
export type MenuInsert = TablesInsert<'menus'>;

/** Row returned from `menu_categories` */
export type MenuCategory = Tables<'menu_categories'>;
/** Insert payload for `menu_categories` */
export type MenuCategoryInsert = TablesInsert<'menu_categories'>;

/** Row returned from `dishes` */
export type Dish = Tables<'dishes'>;
/** Insert payload for `dishes` */
export type DishInsert = TablesInsert<'dishes'>;

/** Row returned from `dish_categories` */
export type DishCategory = Tables<'dish_categories'>;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert portal location format to PostGIS POINT format OR JSONB
 *
 * @param lat - Latitude
 * @param lng - Longitude
 * @param format - 'point' for PostGIS or 'json' for JSONB (default: 'point')
 * @returns PostGIS POINT string or JSON object
 *
 * @example
 * formatLocationForSupabase(40.7128, -74.0060)
 * // Returns: "POINT(-74.0060 40.7128)"
 * formatLocationForSupabase(40.7128, -74.0060, 'json')
 * // Returns: {lat: 40.7128, lng: -74.0060}
 */
export function formatLocationForSupabase(
  lat: number,
  lng: number,
  format: 'point' | 'json' = 'json'
): string | { lat: number; lng: number } {
  if (format === 'json') {
    return { lat, lng };
  }
  // PostGIS uses (longitude, latitude) order - this is critical!
  return `POINT(${lng} ${lat})`;
}

/**
 * Convert portal operating hours format to Supabase format
 * Filters out closed days
 *
 * @param hours - Operating hours from portal
 * @returns Filtered hours object for Supabase
 *
 * @example
 * formatOperatingHours({
 *   monday: { open: "09:00", close: "21:00", closed: false },
 *   sunday: { open: "10:00", close: "20:00", closed: true }
 * })
 * // Returns: { monday: { open: "09:00", close: "21:00" } }
 */
export function formatOperatingHours(
  hours: Record<string, { open: string; close: string; closed: boolean }>
): Record<string, { open: string; close: string }> {
  const openHours: Record<string, { open: string; close: string }> = {};

  Object.entries(hours).forEach(([day, schedule]) => {
    if (!schedule.closed) {
      openHours[day] = {
        open: schedule.open,
        close: schedule.close,
      };
    }
  });

  return openHours;
}

/**
 * Test Supabase connection
 *
 * @returns Promise<boolean> - true if connection successful
 */
export async function testSupabaseConnection(): Promise<boolean> {
  try {
    const { error } = await supabase.from('restaurants').select('count').limit(1);

    if (error) {
      console.error('❌ Supabase connection failed:', error.message);
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return false;
  }
}
