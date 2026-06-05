/**
 * menuFilterUtils.ts
 *
 * Classifies dishes in the restaurant menu view against the user's permanent
 * HARD filters (diet preference + protein-family exclusions + spice), all
 * derived from `primary_protein` now that dish-level dietary_tags/allergens are
 * retired.
 *
 * This runs entirely in JS on pre-fetched data — no extra network calls needed.
 */

import { deriveProteinFields, type PrimaryProtein } from '@eatme/shared';
import type { DailyFilters, PermanentFilters } from '../stores/filterStore';

// Protein families that disqualify a dish from "vegetarian". Eggs are intentionally
// excluded — egg-primary dishes count as (lacto-ovo) vegetarian. Mirrors the feed
// Edge Function's hard/soft diet logic.
const MEAT_FAMILIES = ['meat', 'poultry', 'fish', 'shellfish'];

/** Resolve a dish's protein families from its precomputed column or `primary_protein`. */
function dishProteinFamilies(dish: {
  primary_protein?: string | null;
  protein_families?: string[] | null;
}): string[] {
  if (Array.isArray(dish.protein_families) && dish.protein_families.length > 0) {
    return dish.protein_families;
  }
  return deriveProteinFields((dish.primary_protein ?? null) as PrimaryProtein | null)
    .protein_families;
}

export interface DishClassification {
  /** True if the dish passes ALL of the user's permanent hard filters. */
  passesHardFilters: boolean;
}

/**
 * Classifies a single dish row against the user's permanent HARD filters —
 * diet preference + protein-family exclusions + spice, all protein-derived.
 *
 * @param dish       Raw dish row (must include primary_protein; protein_families optional)
 * @param permanent  The user's permanent filter state from filterStore
 */
export function classifyDish(
  dish: {
    primary_protein?: string | null;
    protein_families?: string[] | null;
    spice_level?: string | null;
  },
  permanent: PermanentFilters
): DishClassification {
  const families = dishProteinFamilies(dish);
  const protein = dish.primary_protein ?? null;

  let passesHardFilters = true;

  // 1. Diet preference (vegan = strictly 'vegan'; vegetarian = no meat family, eggs OK)
  if (permanent.dietPreference === 'vegan') {
    if (protein !== 'vegan') passesHardFilters = false;
  } else if (permanent.dietPreference === 'vegetarian') {
    if (MEAT_FAMILIES.some(f => families.includes(f))) passesHardFilters = false;
  }

  // 2. Protein-family exclusions
  if (passesHardFilters) {
    const ex = permanent.exclude;
    if (ex.noMeat && (families.includes('meat') || families.includes('poultry'))) {
      passesHardFilters = false;
    } else if (ex.noFish && families.includes('fish')) {
      passesHardFilters = false;
    } else if (ex.noSeafood && families.includes('shellfish')) {
      passesHardFilters = false;
    } else if (ex.noEggs && families.includes('eggs')) {
      passesHardFilters = false;
    }
  }

  // 3. Spice exclusion
  if (passesHardFilters && permanent.exclude.noSpicy && dish.spice_level === 'hot') {
    passesHardFilters = false;
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

// ── Modifier-option classification ───────────────────────────────────────────

/**
 * Per-option classification against the active daily filters. Mobile uses this
 * to highlight option rows whose protein matches the user's daily meat-type pick
 * (e.g. emphasise "Add chicken" when the daily meatTypes.chicken toggle is on).
 */
export interface OptionClassification {
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

export function classifyOption(
  option: {
    primary_protein?: string | null;
  },
  daily: DailyFilters
): OptionClassification {
  const meatKey = proteinToMeatTypeKey(option.primary_protein);
  const matchesDailyMeatType = meatKey != null && daily.meatTypes[meatKey] === true;
  return { matchesDailyMeatType };
}
