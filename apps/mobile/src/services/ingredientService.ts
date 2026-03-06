/**
 * Ingredient Service
 *
 * Fetches ingredient data from the `ingredients_master` Supabase table for use
 * in the permanent filters "Ingredients to Avoid" section.
 */

import { supabase } from '../lib/supabase';

/**
 * Fetch the names of all ingredients in the master list, ordered alphabetically.
 *
 * Returns an empty array on error so callers can gracefully fall back to a
 * hardcoded list rather than crashing.
 */
export async function fetchIngredientNames(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('ingredients_master')
      .select('name')
      .order('name', { ascending: true });

    if (error) {
      console.error('[IngredientService] Failed to fetch ingredients:', error.message);
      return [];
    }

    return (data ?? []).map(row => row.name);
  } catch (err) {
    console.error('[IngredientService] Unexpected error:', err);
    return [];
  }
}
