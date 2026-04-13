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

export interface Ingredient {
  id: string;
  display_name: string;
  canonical_ingredient_id: string;
  canonical_name?: string;
  ingredient_family_name?: string;
  is_vegetarian?: boolean;
  is_vegan?: boolean;
  quantity?: string;
}

/**
 * Search ingredient aliases by display name.
 * @param query
 * @param limit
 
 * @returns*/
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
 * Fetch a canonical ingredient with its allergens and dietary tags.
 * @param canonicalIngredientId
 
 * @returns*/
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

/** Fetch all allergens.
 * @returns*/
export async function getAllergens() {
  const { data, error } = await supabase.from('allergens').select('id, code, name').order('name');

  return { data: data as Allergen[] | null, error };
}

/** Fetch all dietary tags.
 * @returns*/
export async function getDietaryTags() {
  const { data, error } = await supabase
    .from('dietary_tags')
    .select('id, code, name, category')
    .order('name');

  return { data: data as DietaryTag[] | null, error };
}

/**
 * Link canonical ingredients to a dish.
 * @param dishId
 * @param ingredients
 
 * @returns*/
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
 * Fetch all ingredients linked to a dish.
 * @param dishId
 
 * @returns*/
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
 * Remove an ingredient link from a dish.
 * @param dishId
 * @param canonicalIngredientId
 
 * @returns*/
export async function removeDishIngredient(dishId: string, canonicalIngredientId: string) {
  const { error } = await supabase
    .from('dish_ingredients')
    .delete()
    .eq('dish_id', dishId)
    .eq('canonical_ingredient_id', canonicalIngredientId);

  return { error };
}

/**
 * Update the serving quantity for a dish ingredient.
 * @param dishId
 * @param canonicalIngredientId
 * @param quantity
 
 * @returns*/
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
 * Fetch allergen details for a dish.
 * @param dishId
 
 * @returns*/
export async function getDishAllergens(dishId: string) {
  const { data, error } = await supabase
    .from('dishes')
    .select('allergens')
    .eq('id', dishId)
    .single();

  if (error || !data) return { data: null, error };

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
 * Fetch dietary tag details for a dish.
 * @param dishId
 
 * @returns*/
export async function getDishDietaryTags(dishId: string) {
  const { data, error } = await supabase
    .from('dishes')
    .select('dietary_tags')
    .eq('id', dishId)
    .single();

  if (error || !data) return { data: null, error };

  if (data.dietary_tags && data.dietary_tags.length > 0) {
    const { data: tagData, error: tagError } = await supabase
      .from('dietary_tags')
      .select('*')
      .in('code', data.dietary_tags);

    return { data: tagData as DietaryTag[] | null, error: tagError };
  }

  return { data: [], error: null };
}
