// ============================================================================
// Menu Scan — Shared Types & Pure Helper Functions
// ============================================================================
// This module contains:
//  1. Types for the AI extraction pipeline (server + client shared)
//  2. Pure functions for merging multi-page extraction results
//  3. Dietary hint → dietary_tag code mapping
//
// DB-dependent logic (ingredient matching, category lookup) lives in the
// API route to keep this file importable without Supabase.
// ============================================================================

// ---------------------------------------------------------------------------
// Raw AI extraction types (as returned by GPT-4o)
// ---------------------------------------------------------------------------

export interface RawExtractedDish {
  name: string;
  price: number | null;
  description: string | null;
  raw_ingredients: string[] | null;
  dietary_hints: string[];
  // AI prompt asks for 0 (none) | 1 (mild) | 3 (hot) | null.
  // route.ts normalises any out-of-range value before producing EnrichedDish.
  spice_level: 0 | 1 | 3 | null;
  calories: number | null;
  confidence: number;
}

export interface RawExtractedCategory {
  name: string | null;
  dishes: RawExtractedDish[];
}

export interface RawExtractedMenu {
  name: string | null;
  menu_type: 'food' | 'drink';
  categories: RawExtractedCategory[];
}

export interface RawExtractionResult {
  menus: RawExtractedMenu[];
}

// ---------------------------------------------------------------------------
// Post-processed / enriched types (after server-side ingredient matching)
// ---------------------------------------------------------------------------

export interface MatchedIngredient {
  raw_text: string;
  status: 'matched' | 'unmatched';
  canonical_ingredient_id?: string;
  canonical_name?: string;
  display_name?: string;
}

export interface EnrichedDish extends RawExtractedDish {
  matched_ingredients: MatchedIngredient[];
  mapped_dietary_tags: string[]; // dietary_tags.code values mapped from dietary_hints
}

export interface EnrichedCategory {
  name: string | null;
  dishes: EnrichedDish[];
}

export interface EnrichedMenu {
  name: string | null;
  menu_type: 'food' | 'drink';
  categories: EnrichedCategory[];
}

export interface EnrichedResult {
  menus: EnrichedMenu[];
  currency: string;
}

// ---------------------------------------------------------------------------
// Editable UI state types (used in the review page)
// ---------------------------------------------------------------------------

export interface EditableIngredient {
  raw_text: string;
  status: 'matched' | 'unmatched';
  canonical_ingredient_id?: string;
  canonical_name?: string;
  display_name?: string;
}

export interface EditableDish {
  _id: string; // stable React key (client-generated UUID)
  name: string;
  price: string; // string for <input type="number"> handling
  description: string;
  dietary_tags: string[]; // dietary_tags.code values
  spice_level: 'none' | 'mild' | 'hot' | null;
  calories: number | null;
  dish_category_id: string | null;
  confidence: number;
  ingredients: EditableIngredient[];
  /** AI-suggested allergen codes — informational only, not saved to DB directly.
   *  The authoritative allergens are calculated by the DB trigger from dish_ingredients. */
  suggested_allergens?: string[];
}

export interface EditableCategory {
  name: string;
  dishes: EditableDish[];
}

export interface EditableMenu {
  name: string;
  menu_type: 'food' | 'drink';
  categories: EditableCategory[];
}

// ---------------------------------------------------------------------------
// Confirm payload types (sent to POST /api/menu-scan/confirm)
// ---------------------------------------------------------------------------

export interface ConfirmDish {
  name: string;
  price: number;
  description?: string;
  dietary_tags: string[];
  spice_level?: 'none' | 'mild' | 'hot' | null;
  calories?: number | null;
  dish_category_id?: string | null;
  canonical_ingredient_ids: string[];
}

export interface ConfirmCategory {
  name: string;
  dishes: ConfirmDish[];
}

export interface ConfirmMenu {
  name: string;
  menu_type: 'food' | 'drink';
  categories: ConfirmCategory[];
}

export interface ConfirmPayload {
  job_id: string;
  restaurant_id: string;
  menus: ConfirmMenu[];
}

// ---------------------------------------------------------------------------
// DB Job record type
// ---------------------------------------------------------------------------

export interface MenuScanJob {
  id: string;
  restaurant_id: string;
  created_by: string | null;
  image_count: number;
  image_filenames: string[];
  image_storage_paths: string[];
  status: 'processing' | 'needs_review' | 'completed' | 'failed';
  result_json: EnrichedResult | null;
  error_message: string | null;
  dishes_found: number;
  dishes_saved: number;
  processing_ms: number | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Country code → currency mapping
// ---------------------------------------------------------------------------

const COUNTRY_CURRENCY_MAP: Record<string, string> = {
  MX: 'MXN',
  US: 'USD',
  PL: 'PLN',
  GB: 'GBP',
  CA: 'CAD',
  AU: 'AUD',
  DE: 'EUR',
  FR: 'EUR',
  ES: 'EUR',
  IT: 'EUR',
};

export function getCurrencyForRestaurant(
  primaryCurrency: string | null | undefined,
  countryCode: string | null | undefined
): string {
  if (primaryCurrency) return primaryCurrency;
  if (countryCode && COUNTRY_CURRENCY_MAP[countryCode.toUpperCase()]) {
    return COUNTRY_CURRENCY_MAP[countryCode.toUpperCase()];
  }
  return 'USD';
}

// ---------------------------------------------------------------------------
// Dietary hint → dietary_tag code mapping
// ---------------------------------------------------------------------------

const DIETARY_HINT_MAP: Record<string, string> = {
  vegetarian: 'vegetarian',
  vegetariano: 'vegetarian',
  vegetariana: 'vegetarian',
  v: 'vegetarian',
  vegan: 'vegan',
  vegano: 'vegan',
  vegana: 'vegan',
  vg: 'vegan',
  'gluten-free': 'gluten_free',
  'gluten free': 'gluten_free',
  gluten_free: 'gluten_free',
  'sin gluten': 'gluten_free',
  gf: 'gluten_free',
  halal: 'halal',
  kosher: 'kosher',
  k: 'kosher',
  'dairy-free': 'dairy_free',
  'dairy free': 'dairy_free',
  dairy_free: 'dairy_free',
  'sin lactosa': 'dairy_free',
  'nut-free': 'nut_free',
  'nut free': 'nut_free',
  nut_free: 'nut_free',
  organic: 'organic',
  orgánico: 'organic',
  organico: 'organic',
};

export function mapDietaryHints(hints: string[]): string[] {
  const codes = new Set<string>();
  for (const hint of hints) {
    const normalized = hint.toLowerCase().trim();
    const code = DIETARY_HINT_MAP[normalized];
    if (code) codes.add(code);
  }
  return Array.from(codes);
}

// ---------------------------------------------------------------------------
// Multi-page merge logic
// ---------------------------------------------------------------------------

/**
 * Merges extraction results from multiple pages of the same menu.
 * Matching is done case-insensitively on menu name, then category name.
 * Duplicate dishes (same name in the same category) are deduplicated, keeping first.
 */
export function mergeExtractionResults(results: RawExtractionResult[]): RawExtractionResult {
  const mergedMenus: RawExtractedMenu[] = [];

  for (const result of results) {
    for (const incomingMenu of result.menus) {
      const incomingMenuName = (incomingMenu.name ?? '').toLowerCase().trim();
      const incomingKey = `${incomingMenu.menu_type}::${incomingMenuName}`;

      // Find existing menu with same name AND same type
      const existingMenu = mergedMenus.find(
        m => `${m.menu_type}::${(m.name ?? '').toLowerCase().trim()}` === incomingKey
      );

      if (!existingMenu) {
        // Deep clone and add
        mergedMenus.push({
          name: incomingMenu.name,
          menu_type: incomingMenu.menu_type,
          categories: incomingMenu.categories.map(cat => ({
            name: cat.name,
            dishes: [...cat.dishes],
          })),
        });
        continue;
      }

      // Merge categories into existing menu
      for (const incomingCat of incomingMenu.categories) {
        const incomingCatName = (incomingCat.name ?? '').toLowerCase().trim();

        const existingCat = existingMenu.categories.find(
          c => (c.name ?? '').toLowerCase().trim() === incomingCatName
        );

        if (!existingCat) {
          existingMenu.categories.push({ name: incomingCat.name, dishes: [...incomingCat.dishes] });
          continue;
        }

        // Merge dishes — skip exact-name duplicates
        const existingDishNames = new Set(existingCat.dishes.map(d => d.name.toLowerCase().trim()));
        for (const dish of incomingCat.dishes) {
          if (!existingDishNames.has(dish.name.toLowerCase().trim())) {
            existingCat.dishes.push(dish);
            existingDishNames.add(dish.name.toLowerCase().trim());
          }
        }
      }
    }
  }

  return { menus: mergedMenus };
}

// ---------------------------------------------------------------------------
// Convert enriched server result → editable client state
// ---------------------------------------------------------------------------

export function toEditableMenus(enriched: EnrichedResult): EditableMenu[] {
  return enriched.menus.map(menu => ({
    name: menu.name || 'Menu',
    menu_type: menu.menu_type,
    categories: menu.categories.map(cat => ({
      name: cat.name || 'General',
      dishes: cat.dishes.map(dish => ({
        _id: crypto.randomUUID(),
        name: dish.name,
        price: dish.price != null ? String(dish.price) : '',
        description: dish.description ?? '',
        dietary_tags: dish.mapped_dietary_tags ?? [],
        spice_level:
          dish.spice_level == null
            ? null
            : dish.spice_level === 0
              ? 'none'
              : dish.spice_level <= 2
                ? 'mild'
                : 'hot',
        calories: dish.calories ?? null,
        dish_category_id: null,
        confidence: dish.confidence,
        ingredients: (dish.matched_ingredients ?? []).map(ing => ({ ...ing })),
      })),
    })),
  }));
}

// ---------------------------------------------------------------------------
// Count total dishes across all menus
// ---------------------------------------------------------------------------

export function countDishes(menus: EditableMenu[]): number {
  return menus.reduce(
    (total, menu) => total + menu.categories.reduce((sum, cat) => sum + cat.dishes.length, 0),
    0
  );
}

// ---------------------------------------------------------------------------
// Build an empty new dish for manual addition in the review UI
// ---------------------------------------------------------------------------

export function newEmptyDish(): EditableDish {
  return {
    _id: crypto.randomUUID(),
    name: '',
    price: '',
    description: '',
    dietary_tags: [],
    spice_level: null,
    calories: null,
    dish_category_id: null,
    confidence: 1.0,
    ingredients: [],
    suggested_allergens: [],
  };
}
