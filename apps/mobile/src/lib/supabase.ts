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

// ============================================================================
// COMPOUND QUERY SHAPES — Supabase .select() results with joined relations
// ============================================================================

export interface DishWithRelations extends Dish {
  menu_category: MenuCategory;
  restaurant: Restaurant;
}

export interface RestaurantWithMenus extends Restaurant {
  menus: Array<Menu & { menu_categories: Array<MenuCategory & { dishes: Dish[] }> }>;
}
