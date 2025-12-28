import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check .env.local file:\n' +
      '- NEXT_PUBLIC_SUPABASE_URL\n' +
      '- NEXT_PUBLIC_SUPABASE_ANON_KEY'
  );
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // Portal doesn't need authentication yet
    autoRefreshToken: false,
  },
});

// ============================================================================
// TypeScript Types for Database
// ============================================================================

/**
 * Restaurant data structure for insertion into Supabase
 * Matches the schema in 002_restaurant_portal_schema.sql
 */
export interface RestaurantInsert {
  // Required fields
  name: string;
  location: string; // PostGIS format: "POINT(lng lat)"
  address: string;

  // Optional basic info
  restaurant_type?: string;
  country_code?: string;
  city?: string;
  postal_code?: string;

  // Contact
  phone?: string;
  website?: string;

  // Cuisine
  cuisine_types: string[];

  // Operating hours (only days that are open)
  open_hours: Record<string, { open: string; close: string }>;

  // Service options
  delivery_available?: boolean;
  takeout_available?: boolean;
  dine_in_available?: boolean;
  accepts_reservations?: boolean;
  service_speed?: 'fast-food' | 'regular';

  // Future fields
  description?: string;
  image_url?: string;
}

/**
 * Restaurant data returned from Supabase
 */
export interface Restaurant extends RestaurantInsert {
  id: string;
  rating: number;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert portal location format to PostGIS POINT format
 *
 * @param lat - Latitude
 * @param lng - Longitude
 * @returns PostGIS POINT string (note: longitude comes first!)
 *
 * @example
 * formatLocationForSupabase(40.7128, -74.0060)
 * // Returns: "POINT(-74.0060 40.7128)"
 */
export function formatLocationForSupabase(lat: number, lng: number): string {
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
