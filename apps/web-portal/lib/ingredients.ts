/**
 * Ingredients Service
 *
 * Supabase data operations for the canonical ingredient library.
 * Canonical ingredients are the source-of-truth records (e.g., "Chicken Breast");
 * aliases map user-entered or import names back to a canonical record.
 */

import { supabase } from './supabase';

export interface CanonicalIngredient {
  id: string;
  canonical_name: string;
  ingredient_family_name?: string;
  is_vegetarian: boolean;
  is_vegan: boolean;
}

export interface IngredientAlias {
  id: string;
  display_name: string;
  canonical_ingredient_id: string;
  canonical_ingredient?: CanonicalIngredient;
}

export interface Allergen {
  id: string;
  code: string;
  name: string;
}

export interface DietaryTag {
  id: string;
  code: string;
  name: string;
  category: string;
}

export interface DishIngredient {
  dish_id: string;
  canonical_ingredient_id: string;
  quantity?: string;
}

/**
 * Flat ingredient shape returned by searchIngredients and used in the UI.
 * Combines alias display data with canonical ingredient properties.
 */
export interface Ingredient {
  id: string; // ingredient_alias.id
  display_name: string; // ingredient_alias.display_name
  canonical_ingredient_id: string;
  canonical_name?: string; // flattened from canonical_ingredient.canonical_name
  ingredient_family_name?: string; // flattened from canonical_ingredient.ingredient_family_name
  is_vegetarian?: boolean; // flattened from canonical_ingredient.is_vegetarian
  is_vegan?: boolean; // flattened from canonical_ingredient.is_vegan
  quantity?: string; // optional quantity when added to a dish
}

/**
 * Searches ingredient aliases by display name (case-insensitive LIKE).
 * Returns flattened {@link Ingredient} objects with canonical info included.
 *
 * @param query - Partial ingredient name typed by the user.
 * @param limit - Maximum number of results to return (default 10).
 * @returns Matched ingredients or an empty array when the query is blank.
 */
export async function searchIngredients(
  query: string,
  limit = 10
): Promise<{ data: Ingredient[]; error: unknown }> {
  if (!query || query.trim().length === 0) {
    return { data: [], error: null };
  }

  const { data, error } = await supabase
    .from('ingredient_aliases')
    .select(
      `
      id,
      display_name,
      canonical_ingredient_id,
      canonical_ingredient:canonical_ingredients(
        id,
        canonical_name,
        ingredient_family_name,
        is_vegetarian,
        is_vegan
      )
    `
    )
    .ilike('display_name', `%${query}%`)
    .order('display_name')
    .limit(limit);

  type AliasRow = {
    id: string;
    display_name: string;
    canonical_ingredient_id: string;
    canonical_ingredient?: {
      canonical_name?: string;
      ingredient_family_name?: string;
      is_vegetarian?: boolean | null;
      is_vegan?: boolean | null;
    } | null;
  };

  // Flatten nested canonical_ingredient into the Ingredient shape
  const flat: Ingredient[] = (data ?? []).map((row: AliasRow) => ({
    id: row.id,
    display_name: row.display_name,
    canonical_ingredient_id: row.canonical_ingredient_id,
    canonical_name: row.canonical_ingredient?.canonical_name,
    ingredient_family_name: row.canonical_ingredient?.ingredient_family_name,
    is_vegetarian: row.canonical_ingredient?.is_vegetarian ?? undefined,
    is_vegan: row.canonical_ingredient?.is_vegan ?? undefined,
  }));

  return { data: flat, error };
}

/**
 * Fetches a canonical ingredient with its linked allergens and dietary tags.
 *
 * @param canonicalIngredientId - UUID of the `canonical_ingredients` row.
 * @returns The ingredient row with nested `allergens` and `dietary_tags` arrays.
 */
export async function getIngredientDetails(canonicalIngredientId: string) {
  const { data, error } = await supabase
    .from('canonical_ingredients')
    .select(
      `
      *,
      allergens:canonical_ingredient_allergens(
        allergen:allergens(*)
      ),
      dietary_tags:canonical_ingredient_dietary_tags(
        dietary_tag:dietary_tags(*)
      )
    `
    )
    .eq('id', canonicalIngredientId)
    .single();

  return { data, error };
}

/**
 * Get all allergens
 */
export async function getAllergens() {
  const { data, error } = await supabase.from('allergens').select('id, code, name').order('name');

  return { data: data as Allergen[] | null, error };
}

/**
 * Get all dietary tags
 */
export async function getDietaryTags() {
  const { data, error } = await supabase
    .from('dietary_tags')
    .select('id, code, name, category')
    .order('name');

  return { data: data as DietaryTag[] | null, error };
}

/**
 * Links canonical ingredients to a dish via the `dish_ingredients` junction table.
 *
 * @param dishId - UUID of the dish to add ingredients to.
 * @param ingredients - Ingredients to link, each with a canonical ingredient ID and optional quantity.
 * @returns The inserted `dish_ingredients` rows or an error.
 */
export async function addDishIngredients(
  dishId: string,
  ingredients: Array<{ ingredient_id: string; quantity?: string | null }>
) {
  const dishIngredients = ingredients.map(ing => ({
    dish_id: dishId,
    ingredient_id: ing.ingredient_id,
    quantity: ing.quantity || null,
  }));

  const { data, error } = await supabase.from('dish_ingredients').insert(dishIngredients).select();

  return { data, error };
}

/**
 * Fetches all ingredients linked to a dish with their canonical details.
 *
 * @param dishId - UUID of the dish to query.
 * @returns Rows from `dish_ingredients` with nested canonical ingredient info.
 */
export async function getDishIngredients(dishId: string) {
  const { data, error } = await supabase
    .from('dish_ingredients')
    .select(
      `
      quantity,
      canonical_ingredient:canonical_ingredients(
        id,
        canonical_name,
        is_vegetarian,
        is_vegan
      )
    `
    )
    .eq('dish_id', dishId);

  return { data, error };
}

/**
 * Removes a single ingredient link from a dish.
 *
 * @param dishId - UUID of the dish.
 * @param canonicalIngredientId - UUID of the canonical ingredient to unlink.
 */
export async function removeDishIngredient(dishId: string, canonicalIngredientId: string) {
  const { error } = await supabase
    .from('dish_ingredients')
    .delete()
    .eq('dish_id', dishId)
    .eq('canonical_ingredient_id', canonicalIngredientId);

  return { error };
}

/**
 * Updates the serving quantity for an ingredient already linked to a dish.
 *
 * @param dishId - UUID of the dish.
 * @param canonicalIngredientId - UUID of the canonical ingredient to update.
 * @param quantity - Human-readable quantity string (e.g. "2 tbsp", "100g").
 */
export async function updateDishIngredientQuantity(
  dishId: string,
  canonicalIngredientId: string,
  quantity: string
) {
  const { error } = await supabase
    .from('dish_ingredients')
    .update({ quantity })
    .eq('dish_id', dishId)
    .eq('canonical_ingredient_id', canonicalIngredientId);

  return { error };
}

/**
 * Fetches allergen details for a dish using the pre-calculated `allergens` column.
 * The column is populated by a Postgres trigger when `dish_ingredients` changes.
 *
 * @param dishId - UUID of the dish.
 * @returns Full allergen rows for the codes stored on the dish, or an empty array.
 */
export async function getDishAllergens(dishId: string) {
  const { data, error } = await supabase
    .from('dishes')
    .select('allergens')
    .eq('id', dishId)
    .single();

  if (error || !data) return { data: null, error };

  // Fetch allergen details
  if (data.allergens && data.allergens.length > 0) {
    const { data: allergenData, error: allergenError } = await supabase
      .from('allergens')
      .select('*')
      .in('code', data.allergens);

    return { data: allergenData as Allergen[] | null, error: allergenError };
  }

  return { data: [], error: null };
}

/**
 * Fetches dietary tag details for a dish using the pre-calculated `dietary_tags` column.
 * The column is populated by a Postgres trigger when `dish_ingredients` changes.
 *
 * @param dishId - UUID of the dish.
 * @returns Full dietary tag rows for the codes stored on the dish, or an empty array.
 */
export async function getDishDietaryTags(dishId: string) {
  const { data, error } = await supabase
    .from('dishes')
    .select('dietary_tags')
    .eq('id', dishId)
    .single();

  if (error || !data) return { data: null, error };

  // Fetch dietary tag details
  if (data.dietary_tags && data.dietary_tags.length > 0) {
    const { data: tagData, error: tagError } = await supabase
      .from('dietary_tags')
      .select('*')
      .in('code', data.dietary_tags);

    return { data: tagData as DietaryTag[] | null, error: tagError };
  }

  return { data: [], error: null };
}
