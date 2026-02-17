import { supabase } from './supabase';

export interface CanonicalIngredient {
  id: string;
  canonical_name: string;
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
  icon: string;
}

export interface DietaryTag {
  id: string;
  code: string;
  name: string;
  icon: string;
  category: string;
}

export interface DishIngredient {
  dish_id: string;
  canonical_ingredient_id: string;
  quantity?: string;
}

/**
 * Search ingredient aliases by display name using full-text search
 * Returns aliases with their canonical ingredient info
 */
export async function searchIngredients(query: string, limit = 10) {
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
        is_vegetarian,
        is_vegan
      )
    `
    )
    .ilike('display_name', `${query}%`)
    .order('display_name')
    .limit(limit);

  return { data: data as IngredientAlias[] | null, error };
}

/**
 * Get canonical ingredient details with allergens and dietary tags
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
  const { data, error } = await supabase.from('allergens').select('*').order('name');

  return { data: data as Allergen[] | null, error };
}

/**
 * Get all dietary tags
 */
export async function getDietaryTags() {
  const { data, error } = await supabase.from('dietary_tags').select('*').order('name');

  return { data: data as DietaryTag[] | null, error };
}

/**
 * Add ingredients to a dish (stores canonical ingredient IDs)
 */
export async function addDishIngredients(
  dishId: string,
  ingredients: Array<{ canonical_ingredient_id: string; quantity?: string }>
) {
  const dishIngredients = ingredients.map(ing => ({
    dish_id: dishId,
    canonical_ingredient_id: ing.canonical_ingredient_id,
    quantity: ing.quantity || null,
  }));

  const { data, error } = await supabase.from('dish_ingredients').insert(dishIngredients).select();

  return { data, error };
}

/**
 * Get ingredients for a dish
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
 * Remove ingredient from dish
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
 * Update ingredient quantity in dish
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
 * Get calculated allergens for a dish (from dishes table after trigger runs)
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
 * Get calculated dietary tags for a dish (from dishes table after trigger runs)
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
