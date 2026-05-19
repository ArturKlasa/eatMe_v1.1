/**
 * menuFilterUtils.ts
 *
 * Classifies dishes in the restaurant menu view against the user's permanent
 * hard filters (diet, allergens, religious restrictions).
 *
 * This runs entirely in JS on pre-fetched data — no extra network calls needed.
 *
 * Design reference: first-principles-review Part 14
 */

import type { DailyFilters, PermanentFilters } from '../stores/filterStore';

// Migration 093 unified allergen codes to their canonical shorts — filterStore
// keys are now identical to DB codes. Kept as an identity map so any residual
// caller (and the RestaurantDetailScreen import below) still works unchanged.
export const ALLERGY_TO_DB: Record<keyof PermanentFilters['allergies'], string> = {
  lactose: 'lactose',
  gluten: 'gluten',
  peanuts: 'peanuts',
  soy: 'soy',
  sesame: 'sesame',
  shellfish: 'shellfish',
  nuts: 'nuts',
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
}

/**
 * Classifies a single dish row against the user's permanent filters.
 *
 * @param dish       Raw dish row from Supabase (must include allergens, dietary_tags)
 * @param permanent  The user's permanent filter state from filterStore
 */
export function classifyDish(
  dish: {
    allergens?: string[] | null;
    dietary_tags?: string[] | null;
  },
  permanent: PermanentFilters
): DishClassification {
  const allergens: string[] = dish.allergens ?? [];
  const dietaryTags: string[] = dish.dietary_tags ?? [];

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

  return { passesHardFilters };
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

// ── Modifier-option classification (Phase 5) ─────────────────────────────────

/**
 * Per-option classification against the active permanent + daily filters.
 *
 * Mobile uses this to annotate option rows in the dish detail screen — e.g.
 * show a red allergy chip on "Add anchovies" for a shellfish-allergic user,
 * or grey out "Add chicken" when the user's permanent dietPreference is vegan.
 *
 * Returns lists rather than booleans so the UI can name the specific tag (e.g.
 * "removes vegan") rather than a generic warning.
 */
export interface OptionClassification {
  /** Codes from the option's adds_allergens that the user has marked active. */
  triggersAllergy: string[];
  /** Codes from the option's removes_dietary_tags that the user requires. */
  stripsDietaryTags: string[];
  /** True when permanent.primaryProtein matches the option's primary_protein. */
  matchesPreferredProtein: boolean;
  /** True when the option's primary_protein lines up with an active daily meat type. */
  matchesDailyMeatType: boolean;
}

// Map a PRIMARY_PROTEINS value onto the daily-filter meatTypes keyspace.
// Returns null for proteins that aren't a meat (fish, shellfish, eggs, vegan,
// vegetarian) — those don't participate in the meatTypes toggle.
function proteinToMeatTypeKey(
  protein: string | null | undefined
): keyof DailyFilters['meatTypes'] | null {
  switch (protein) {
    case 'chicken':
      return 'chicken';
    case 'beef':
      return 'beef';
    case 'pork':
      return 'pork';
    case 'lamb':
      return 'lamb';
    case 'goat':
      return 'goat';
    case 'other_meat':
      return 'other';
    default:
      return null;
  }
}

// Religious-restriction → dietary_tag map. Same shape as RELIGIOUS_TO_TAG above
// but with the user-facing filter keys instead of the DB keys for ergonomics.
const RELIGIOUS_REQUIRED_TAG: Record<keyof PermanentFilters['religiousRestrictions'], string> = {
  halal: 'halal',
  hindu: 'hindu_vegetarian',
  kosher: 'kosher',
  jain: 'jain',
  buddhist: 'buddhist',
};

export function classifyOption(
  option: {
    adds_allergens?: string[] | null;
    removes_dietary_tags?: string[] | null;
    primary_protein?: string | null;
  },
  permanent: PermanentFilters,
  daily: DailyFilters
): OptionClassification {
  const addsAllergens = option.adds_allergens ?? [];
  const removesTags = option.removes_dietary_tags ?? [];

  // ── Allergy triggers ──────────────────────────────────────────────────────
  const activeAllergenCodes = (
    Object.entries(permanent.allergies) as [keyof PermanentFilters['allergies'], boolean][]
  )
    .filter(([, active]) => active)
    .map(([key]) => ALLERGY_TO_DB[key]);
  const triggersAllergy = addsAllergens.filter(a => activeAllergenCodes.includes(a));

  // ── Dietary-tag strip detection ───────────────────────────────────────────
  // Build the set of dietary tags the user requires the dish to KEEP. An option
  // that removes one of these is an explicit conflict.
  const requiredTags = new Set<string>();
  if (permanent.dietPreference === 'vegan') requiredTags.add('vegan');
  if (permanent.dietPreference === 'vegetarian') requiredTags.add('vegetarian');
  for (const [key, active] of Object.entries(permanent.religiousRestrictions) as [
    keyof PermanentFilters['religiousRestrictions'],
    boolean,
  ][]) {
    if (active) requiredTags.add(RELIGIOUS_REQUIRED_TAG[key]);
  }
  const stripsDietaryTags = removesTags.filter(t => requiredTags.has(t));

  // ── Protein matching ──────────────────────────────────────────────────────
  const matchesPreferredProtein =
    permanent.primaryProtein != null && option.primary_protein === permanent.primaryProtein;

  const meatKey = proteinToMeatTypeKey(option.primary_protein);
  const matchesDailyMeatType = meatKey != null && daily.meatTypes[meatKey] === true;

  return {
    triggersAllergy,
    stripsDietaryTags,
    matchesPreferredProtein,
    matchesDailyMeatType,
  };
}
