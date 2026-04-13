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

export const supabase = createBrowserClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export type Restaurant = Tables<'restaurants'>;
export type RestaurantInsert = TablesInsert<'restaurants'>;
export type Menu = Tables<'menus'>;
export type MenuInsert = TablesInsert<'menus'>;
export type MenuCategory = Tables<'menu_categories'>;
export type MenuCategoryInsert = TablesInsert<'menu_categories'>;
export type Dish = Tables<'dishes'>;
export type DishInsert = TablesInsert<'dishes'>;
export type DishCategory = Tables<'dish_categories'>;
/**
 * Convert lat/lng to PostGIS POINT string or JSON object.
 * @param lat
 * @param lng
 * @param format
 
 * @returns*/
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
 * Filter out closed days from operating hours.
 * @param hours
 
 * @returns*/
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
