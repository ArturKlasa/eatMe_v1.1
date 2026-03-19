/**
 * menuFilterUtils.ts
 *
 * Classifies dishes in the restaurant menu view against the user's permanent
 * hard filters and ingredients-to-avoid list.
 *
 * This runs entirely in JS on pre-fetched data — no extra network calls needed.
 *
 * Design reference: first-principles-review Part 14
 */

import type { PermanentFilters, IngredientToAvoid } from '../stores/filterStore';

// Mirrors ALLERGY_TO_DB from userPreferencesService.ts.
// Kept local so this util has no circular dependency on the service.
const ALLERGY_TO_DB: Record<keyof PermanentFilters['allergies'], string> = {
  lactose: 'lactose',
  gluten: 'gluten',
  peanuts: 'peanuts',
  soy: 'soybeans',
  sesame: 'sesame',
  shellfish: 'shellfish',
  nuts: 'tree_nuts',
};

// Religious restriction filterStore key → dietary_tag code on dishes
const RELIGIOUS_TO_TAG: Record<keyof PermanentFilters['religiousRestrictions'], string> = {
  halal: 'halal',
  hindu: 'hindu_vegetarian',
  kosher: 'kosher',
  jain: 'jain',
  buddhist: 'buddhist',
};

export interface DishClassification {
  /** True if the dish passes ALL of the user's permanent hard filters. */
  passesHardFilters: boolean;
  /**
   * Display names of any ingredients the user wants to avoid that appear in
   * this dish's dish_ingredients list. Empty array = no flagged ingredients.
   */
  flaggedIngredientNames: string[];
}

/**
 * Classifies a single dish row against the user's permanent filters.
 *
 * @param dish             Raw dish row from Supabase (must include allergens, dietary_tags,
 *                         and dish_ingredients[].ingredient_id)
 * @param permanent        The user's permanent filter state from filterStore
 * @param ingredientsToAvoid  The user's ingredients-to-avoid list from filterStore
 */
export function classifyDish(
  dish: {
    allergens?: string[] | null;
    dietary_tags?: string[] | null;
    dish_ingredients?: Array<{ ingredient_id: string }> | null;
  },
  permanent: PermanentFilters,
  ingredientsToAvoid: IngredientToAvoid[]
): DishClassification {
  const allergens: string[] = dish.allergens ?? [];
  const dietaryTags: string[] = dish.dietary_tags ?? [];
  const dishIngredientIds = new Set(
    (dish.dish_ingredients ?? []).map(di => di.ingredient_id)
  );

  // ── Hard filter checks ───────────────────────────────────────────────────

  let passesHardFilters = true;

  // 1. Diet preference
  if (permanent.dietPreference === 'vegan') {
    if (!dietaryTags.includes('vegan')) passesHardFilters = false;
  } else if (permanent.dietPreference === 'vegetarian') {
    if (!dietaryTags.includes('vegetarian') && !dietaryTags.includes('vegan')) {
      passesHardFilters = false;
    }
  }

  // 2. Allergen exclusions (only if still passing — avoid redundant checks)
  if (passesHardFilters) {
    const activeAllergenCodes = (
      Object.entries(permanent.allergies) as [keyof PermanentFilters['allergies'], boolean][]
    )
      .filter(([, active]) => active)
      .map(([key]) => ALLERGY_TO_DB[key]);

    if (activeAllergenCodes.some(code => allergens.includes(code))) {
      passesHardFilters = false;
    }
  }

  // 3. Religious restrictions
  if (passesHardFilters) {
    const activeRestrictions = (
      Object.entries(permanent.religiousRestrictions) as [
        keyof PermanentFilters['religiousRestrictions'],
        boolean,
      ][]
    )
      .filter(([, active]) => active)
      .map(([key]) => RELIGIOUS_TO_TAG[key]);

    if (activeRestrictions.some(tag => !dietaryTags.includes(tag))) {
      passesHardFilters = false;
    }
  }

  // ── Soft: ingredient flagging ────────────────────────────────────────────

  const flaggedIngredientNames: string[] = ingredientsToAvoid
    .filter(item => dishIngredientIds.has(item.canonicalIngredientId))
    .map(item => item.displayName);

  return { passesHardFilters, flaggedIngredientNames };
}

/**
 * Sorts a dish array so that dishes passing hard filters come first.
 * Stable sort — preserves original restaurant-defined ordering within each group.
 */
export function sortDishesByFilter<T extends { passesHardFilters: boolean }>(dishes: T[]): T[] {
  return [...dishes].sort((a, b) => {
    if (a.passesHardFilters === b.passesHardFilters) return 0;
    return a.passesHardFilters ? -1 : 1;
  });
}
