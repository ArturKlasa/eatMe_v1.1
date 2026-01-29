import { supabase } from './supabase';

// Types
export interface Ingredient {
  id: string;
  name: string;
  name_variants: string[];
  category: string;
  is_vegetarian: boolean;
  is_vegan: boolean;
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
  ingredient_id: string;
  quantity?: string;
}

/**
 * Search ingredients by name using full-text search
 */
export async function searchIngredients(query: string, limit = 10) {
  if (!query || query.trim().length === 0) {
    return { data: [], error: null };
  }

  // Use ILIKE for simple prefix matching (works well for autocomplete)
  const { data, error } = await supabase
    .from('ingredients_master')
    .select('id, name, name_variants, category, is_vegetarian, is_vegan')
    .or(`name.ilike.${query}%,name_variants.cs.{${query}}`)
    .order('name')
    .limit(limit);

  return { data: data as Ingredient[] | null, error };
}

/**
 * Get ingredient details with allergens and dietary tags
 */
export async function getIngredientDetails(ingredientId: string) {
  const { data, error } = await supabase
    .from('ingredients_master')
    .select(
      `
      *,
      allergens:ingredient_allergens(
        allergen:allergens(*)
      ),
      dietary_tags:ingredient_dietary_tags(
        dietary_tag:dietary_tags(*)
      )
    `
    )
    .eq('id', ingredientId)
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
 * Add ingredients to a dish
 */
export async function addDishIngredients(
  dishId: string,
  ingredients: Array<{ ingredient_id: string; quantity?: string }>
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
 * Get ingredients for a dish
 */
export async function getDishIngredients(dishId: string) {
  const { data, error } = await supabase
    .from('dish_ingredients')
    .select(
      `
      quantity,
      ingredient:ingredients_master(
        id,
        name,
        category
      )
    `
    )
    .eq('dish_id', dishId);

  return { data, error };
}

/**
 * Remove ingredient from dish
 */
export async function removeDishIngredient(dishId: string, ingredientId: string) {
  const { error } = await supabase
    .from('dish_ingredients')
    .delete()
    .eq('dish_id', dishId)
    .eq('ingredient_id', ingredientId);

  return { error };
}

/**
 * Update ingredient quantity in dish
 */
export async function updateDishIngredientQuantity(
  dishId: string,
  ingredientId: string,
  quantity: string
) {
  const { error } = await supabase
    .from('dish_ingredients')
    .update({ quantity })
    .eq('dish_id', dishId)
    .eq('ingredient_id', ingredientId);

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
