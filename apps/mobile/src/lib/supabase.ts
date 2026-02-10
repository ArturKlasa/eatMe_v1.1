import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Get Supabase configuration from environment variables
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '⚠️ Missing Supabase configuration. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env'
  );
}

// Create Supabase client configured for React Native
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Not needed in mobile
  },
});

// ============================================================================
// DATABASE TYPES
// ============================================================================

export interface Restaurant {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  restaurant_type: string;
  address: string;
  location: {
    lat: number;
    lng: number;
  };
  country: string;
  phone: string | null;
  website: string | null;
  cuisine_types: string[];
  price_range: number;
  delivery_available: boolean;
  takeout_available: boolean;
  dine_in_available: boolean;
  service_speed: 'fast-food' | 'regular' | null;
  accepts_reservations: boolean;
  operating_hours: Record<string, { open: string; close: string; closed: boolean }>;
  created_at: string;
  updated_at: string;
  menus?: Menu[];
}

export interface Menu {
  id: string;
  restaurant_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  display_order: number;
  available_start_time?: string | null;
  available_end_time?: string | null;
  available_days?: string[] | null;
  created_at: string;
  updated_at: string;
  menu_categories?: MenuCategory[];
}

export interface MenuCategory {
  id: string;
  restaurant_id: string;
  menu_id: string;
  name: string;
  type?: string | null;
  description?: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
  dishes?: Dish[];
}

export interface Dish {
  id: string;
  restaurant_id: string;
  menu_category_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  dietary_tags: string[];
  allergens: string[];
  ingredients: string[];
  calories: number | null;
  spice_level: number | null;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// HELPER TYPES FOR QUERIES
// ============================================================================

export interface DishWithRelations extends Dish {
  menu_category: MenuCategory;
  restaurant: Restaurant;
}

export interface RestaurantWithMenus extends Restaurant {
  menus: Array<Menu & { menu_categories: Array<MenuCategory & { dishes: Dish[] }> }>;
}
