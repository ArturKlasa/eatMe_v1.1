import { getMobileClient } from '@eatme/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

// Warm up the browser for faster OAuth flows
WebBrowser.maybeCompleteAuthSession();

// Env vars read here with literal keys so Expo/Metro static analysis can replace them.
// AsyncStorage injected so the shared package has no native dependency.
export const supabase = getMobileClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  AsyncStorage
);

// Get the redirect URL for OAuth
export const getOAuthRedirectUrl = () => {
  // Use expo-linking to get the app's deep link URL
  const redirectUrl = Linking.createURL('auth/callback');
  console.log('[OAuth] Redirect URL:', redirectUrl);
  return redirectUrl;
};

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
  rating: number;
  delivery_available: boolean;
  takeout_available: boolean;
  dine_in_available: boolean;
  service_speed: 'fast-food' | 'regular' | null;
  accepts_reservations: boolean;
  operating_hours: Record<string, { open: string; close: string; closed: boolean }>;
  open_hours?: Record<string, { open: string; close: string }> | null; // actual DB column name
  image_url?: string | null;
  city?: string | null;
  postal_code?: string | null;
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
  description_visibility?: 'menu' | 'detail';
  ingredients_visibility?: 'menu' | 'detail' | 'none';
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
