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
  /** ingredient_aliases_v2.id — unique per alias, NOT per concept */
  id: string;
  /** alias_text — the exact string the admin typed or a canonical form */
  display_name: string;
  /** 2-letter language code of the alias (en, es, pl, …). Undefined for legacy loaders that don't carry language. */
  language?: string;
  /** ingredient_concepts.id — populated by the multi-language search. Undefined when a legacy loader built this object. */
  concept_id?: string;
  /** ingredient_variants.id — populated when the alias points at a specific variant */
  variant_id?: string | null;
  /** Legacy canonical_ingredients.id — still required to write dish_ingredients until Phase 6 cutover */
  canonical_ingredient_id: string;
  /** ingredient_concepts.slug — stable slug, shown as a subtitle */
  canonical_name?: string;
  ingredient_family_name?: string;
  is_vegetarian?: boolean;
  is_vegan?: boolean;
  quantity?: string;
}

/**
 * Search for ingredients across every alias in every language.
 *
 * Queries `ingredient_aliases_v2` (not the legacy `ingredient_aliases`) so a
 * user typing "łosoś", "jitomate", or "salmon" all converge on the same
 * concept when the Polish/Spanish alias is present. The result carries
 * `concept_id` / `variant_id` / `language` so the caller can:
 *   - feed Phase 3 `dish_ingredients.concept_id`/`variant_id`
 *   - show which language matched (useful UI affordance)
 *
 * `canonical_ingredient_id` is still filled via the concept's legacy link so
 * downstream code that writes the legacy FK keeps working during the
 * transition.
 */
export async function searchIngredients(
  query: string,
  limit = 10
): Promise<{ data: Ingredient[]; error: unknown }> {
  if (!query || query.trim().length === 0) {
    return { data: [], error: null };
  }

  // The new ingredient tables (migration 099) aren't yet included in the
  // generated Database types — cast to skip the overload check. Retypes
  // below handle the actual row shape.
  const { data, error } = await (
    supabase.from as unknown as (t: string) => ReturnType<typeof supabase.from>
  )('ingredient_aliases_v2')
    .select(
      `
      id,
      alias_text,
      language,
      concept_id,
      variant_id,
      concept:ingredient_concepts!inner(
        slug,
        family,
        is_vegetarian,
        is_vegan,
        legacy_canonical_id
      )
    `
    )
    .ilike('alias_text', `%${query.toLowerCase()}%`)
    .order('alias_text')
    .limit(limit);

  type AliasRow = {
    id: string;
    alias_text: string;
    language: string;
    concept_id: string;
    variant_id: string | null;
    concept: {
      slug: string;
      family: string;
      is_vegetarian: boolean;
      is_vegan: boolean;
      legacy_canonical_id: string | null;
    };
  };

  const flat: Ingredient[] = ((data ?? []) as unknown as AliasRow[])
    // Skip any row whose concept has no legacy mirror — we can't populate
    // dish_ingredients.ingredient_id for those during the transition, so
    // they'd fail the legacy cascade path. Phase 6 drops this filter.
    .filter(r => r.concept.legacy_canonical_id != null)
    .map(r => ({
      id: r.id,
      display_name: r.alias_text,
      language: r.language,
      concept_id: r.concept_id,
      variant_id: r.variant_id,
      canonical_ingredient_id: r.concept.legacy_canonical_id as string,
      canonical_name: r.concept.slug,
      ingredient_family_name: r.concept.family,
      is_vegetarian: r.concept.is_vegetarian,
      is_vegan: r.concept.is_vegan,
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
 *
 * Phase 6A cutover: dish_ingredients.concept_id is required. Callers supply
 * `concept_id` directly; if only the legacy `ingredient_id` is provided, we
 * resolve the matching concept in a single bulk query. `variant_id` is
 * optional.
 */
export async function addDishIngredients(
  dishId: string,
  ingredients: Array<{
    ingredient_id: string;
    concept_id?: string;
    variant_id?: string | null;
    quantity?: string | null;
  }>
) {
  const needLookup = ingredients.filter(i => !i.concept_id).map(i => i.ingredient_id);
  const conceptByCanonical = new Map<string, string>();
  if (needLookup.length > 0) {
    const { data: conceptRows } = await (
      supabase.from as unknown as (t: string) => ReturnType<typeof supabase.from>
    )('ingredient_concepts')
      .select('id, legacy_canonical_id')
      .in('legacy_canonical_id', needLookup);
    for (const row of (conceptRows ?? []) as unknown as Array<{
      id: string;
      legacy_canonical_id: string;
    }>) {
      conceptByCanonical.set(row.legacy_canonical_id, row.id);
    }
  }

  const dishIngredients = ingredients.map(ing => ({
    dish_id: dishId,
    ingredient_id: ing.ingredient_id,
    concept_id: ing.concept_id ?? conceptByCanonical.get(ing.ingredient_id) ?? null,
    variant_id: ing.variant_id ?? null,
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
