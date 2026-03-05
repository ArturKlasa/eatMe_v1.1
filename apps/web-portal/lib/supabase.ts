import { getWebClient } from '@eatme/database';
import type { Tables, TablesInsert } from '@eatme/database';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing Supabase environment variables. Check .env.local:\n' +
      '  NEXT_PUBLIC_SUPABASE_URL\n' +
      '  NEXT_PUBLIC_SUPABASE_ANON_KEY'
  );
}

// Typed Supabase client — auth config in packages/database/src/client.ts
// Env vars read here with literal keys so Next.js static analysis can replace them.
// Auth: implicit flow preserved until A8 migrates to PKCE + @supabase/ssr
export const supabase = getWebClient(
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

    console.log('✅ Supabase connection successful!');
    return true;
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return false;
  }
}
