import { getMobileClient } from '@eatme/database';
import type { Tables } from '@eatme/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { debugLog } from '../config/environment';

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
  debugLog('[OAuth] Redirect URL:', redirectUrl);
  return redirectUrl;
};

// ============================================================================
// DATABASE TYPES — derived from generated @eatme/database types
// Single source of truth: packages/database/src/types.ts (auto-generated).
// Run `supabase gen types typescript --project-id <id> > packages/database/src/types.ts`
// after every schema migration to keep these in sync.
// ============================================================================

/** Raw row from the `restaurants` table */
export type Restaurant = Tables<'restaurants'>;

/** Raw row from the `menus` table */
export type Menu = Tables<'menus'>;

/** Raw row from the `menu_categories` table */
export type MenuCategory = Tables<'menu_categories'>;

/** Raw row from the `dishes` table */
export type Dish = Tables<'dishes'>;

/** A single selectable option within an option group */
export interface Option {
  id: string;
  option_group_id: string;
  name: string;
  description?: string | null;
  price_delta: number;
  calories_delta?: number | null;
  canonical_ingredient_id?: string | null;
  is_available: boolean;
  display_order: number;
}

/** A group of options attached to a dish (template / experience kinds) */
export interface OptionGroup {
  id: string;
  restaurant_id: string;
  dish_id?: string | null;
  menu_category_id?: string | null;
  name: string;
  description?: string | null;
  selection_type: 'single' | 'multiple' | 'quantity';
  min_selections: number;
  max_selections?: number | null;
  display_order: number;
  is_active: boolean;
  options: Option[];
}

// ============================================================================
// COMPOUND QUERY SHAPES — Supabase .select() results with joined relations
// ============================================================================

export interface DishWithRelations extends Dish {
  menu_category: MenuCategory;
  restaurant: Restaurant;
}

export interface RestaurantWithMenus extends Restaurant {
  menus: Array<
    Menu & {
      menu_categories: Array<
        MenuCategory & { dishes: Array<Dish & { option_groups?: OptionGroup[] }> }
      >;
    }
  >;
}

// ============================================================================
// TABLES WITHOUT GENERATED TYPES
// Add manual types here for tables not yet in packages/database/src/types.ts.
// Run `supabase gen types typescript` after each migration to graduate these.
// ============================================================================

/**
 * Row shape for the `favorites` table (added in migration 064).
 * Remove this once `supabase gen types` is re-run and Tables<'favorites'> exists.
 */
export interface FavoriteRow {
  id: string;
  user_id: string;
  subject_type: 'restaurant' | 'dish';
  subject_id: string;
  created_at: string;
}
