/**
 * Ingredient Service
 *
 * Provides ingredient search against the `ingredient_aliases` table — the
 * same source used by the web portal's IngredientAutocomplete.
 *
 * Why ingredient_aliases and not ingredients_master?
 *   Dishes store their ingredients via dish_ingredients → canonical_ingredients.
 *   ingredient_aliases are the user-facing display names for canonical_ingredients,
 *   so searching here ensures the IDs we persist can actually be matched against
 *   real dish data.
 */

import { supabase } from '../lib/supabase';

export interface IngredientSuggestion {
  /** ingredient_aliases.id — used as the React key */
  aliasId: string;
  /** ingredient_aliases.canonical_ingredient_id — persisted to user_preferences */
  canonicalIngredientId: string;
  /** ingredient_aliases.display_name — shown in the UI */
  displayName: string;
}

/**
 * Most-commonly-disliked ingredients shown immediately when the picker opens,
 * before the user types anything. Ordered by how often users avoid them.
 */
export const COMMON_INGREDIENTS_TO_AVOID: IngredientSuggestion[] = [];
// NOTE: this list is seeded at runtime by fetchCommonIngredients() below.
// It is kept as a module-level mutable so the first fetch warms the cache
// for subsequent opens without a re-fetch.
let _commonCache: IngredientSuggestion[] | null = null;

/**
 * Fetch the most commonly disliked ingredients to pre-populate the picker.
 * Falls back to an empty list on error — the search still works.
 *
 * Currently returns the top 20 ingredients by alphabetical order as a
 * pragmatic default. Replace with a popularity-ranked query once the
 * user_dish_interactions table has enough signal.
 */
export async function fetchCommonIngredients(): Promise<IngredientSuggestion[]> {
  if (_commonCache) return _commonCache;

  // Globally well-known "commonly disliked" ingredient display names.
  // We look these up by name so we get the canonical IDs from the live DB.
  const COMMON_NAMES = [
    'Cilantro',
    'Mushroom',
    'Onion',
    'Garlic',
    'Ginger',
    'Olives',
    'Anchovies',
    'Blue cheese',
    'Licorice',
    'Celery',
    'Beetroot',
    'Raisins',
    'Coconut',
    'Avocado',
    'Bell pepper',
    'Sour cream',
    'Pickles',
    'Mint',
    'Chilli',
    'Paprika',
  ];

  try {
    const { data, error } = await supabase
      .from('ingredient_aliases')
      .select('id, display_name, canonical_ingredient_id')
      .in('display_name', COMMON_NAMES)
      .order('display_name', { ascending: true });

    if (error) {
      console.error('[IngredientService] Failed to fetch common ingredients:', error.message);
      return [];
    }

    _commonCache = (data ?? []).map(row => ({
      aliasId: row.id,
      canonicalIngredientId: row.canonical_ingredient_id,
      displayName: row.display_name,
    }));

    return _commonCache;
  } catch (err) {
    console.error('[IngredientService] Unexpected error fetching common ingredients:', err);
    return [];
  }
}

/**
 * Search ingredient aliases by display name (case-insensitive partial match).
 * Returns up to `limit` results, ordered alphabetically.
 *
 * @param query   Must be at least 2 characters; returns [] otherwise.
 * @param limit   Default 20.
 */
export async function searchIngredientAliases(
  query: string,
  limit = 20
): Promise<IngredientSuggestion[]> {
  if (query.trim().length < 2) return [];

  try {
    const { data, error } = await supabase
      .from('ingredient_aliases')
      .select('id, display_name, canonical_ingredient_id')
      .ilike('display_name', `%${query.trim()}%`)
      .order('display_name', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('[IngredientService] Search error:', error.message);
      return [];
    }

    return (data ?? []).map(row => ({
      aliasId: row.id,
      canonicalIngredientId: row.canonical_ingredient_id,
      displayName: row.display_name,
    }));
  } catch (err) {
    console.error('[IngredientService] Unexpected search error:', err);
    return [];
  }
}
