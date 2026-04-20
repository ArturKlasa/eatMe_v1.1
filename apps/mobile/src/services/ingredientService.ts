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
  /** ingredient_aliases_v2.id — used as the React key */
  aliasId: string;
  /** ingredient_concepts.id — primary match key after Phase 6A cutover */
  conceptId: string;
  /** canonical_ingredients.id — legacy match key, still persisted for backward-compat during the transition */
  canonicalIngredientId: string;
  /** Shown in the UI */
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

  const lowerNames = COMMON_NAMES.map(n => n.toLowerCase());

  try {
    const { data, error } = await (
      supabase.from as unknown as (t: string) => ReturnType<typeof supabase.from>
    )('ingredient_aliases_v2')
      .select('id, alias_text, concept_id, concept:ingredient_concepts!inner(legacy_canonical_id)')
      .in('alias_text', lowerNames)
      .order('alias_text', { ascending: true });

    if (error) {
      console.error('[IngredientService] Failed to fetch common ingredients:', error.message);
      return [];
    }

    _commonCache = (
      (data ?? []) as unknown as Array<{
        id: string;
        alias_text: string;
        concept_id: string;
        concept: { legacy_canonical_id: string | null };
      }>
    )
      .filter(r => r.concept.legacy_canonical_id != null)
      .map(row => ({
        aliasId: row.id,
        conceptId: row.concept_id,
        canonicalIngredientId: row.concept.legacy_canonical_id as string,
        displayName: row.alias_text,
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
    const { data, error } = await (
      supabase.from as unknown as (t: string) => ReturnType<typeof supabase.from>
    )('ingredient_aliases_v2')
      .select('id, alias_text, concept_id, concept:ingredient_concepts!inner(legacy_canonical_id)')
      .ilike('alias_text', `%${query.trim().toLowerCase()}%`)
      .order('alias_text', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('[IngredientService] Search error:', error.message);
      return [];
    }

    return (
      (data ?? []) as unknown as Array<{
        id: string;
        alias_text: string;
        concept_id: string;
        concept: { legacy_canonical_id: string | null };
      }>
    )
      .filter(r => r.concept.legacy_canonical_id != null)
      .map(row => ({
        aliasId: row.id,
        conceptId: row.concept_id,
        canonicalIngredientId: row.concept.legacy_canonical_id as string,
        displayName: row.alias_text,
      }));
  } catch (err) {
    console.error('[IngredientService] Unexpected search error:', err);
    return [];
  }
}
