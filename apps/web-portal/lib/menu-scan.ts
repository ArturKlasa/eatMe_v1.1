// ============================================================================
// Menu Scan — Shared Types & Pure Helper Functions
// ============================================================================
// This module contains:
//  1. Types for the AI extraction pipeline (server + client shared)
//  2. Pure functions for merging multi-page extraction results
//  3. Dietary hint → dietary_tag code mapping
//  4. Category synonym map + fuzzy matching helpers
//
// DB-dependent logic (ingredient matching, category lookup) lives in the
// API route to keep this file importable without Supabase.
// ============================================================================

import { compareTwoStrings } from 'string-similarity';

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
  is_parent: boolean;
  dish_kind: 'standard' | 'template' | 'combo' | 'experience';
  serves: number | null;
  display_price_prefix: 'exact' | 'from' | 'per_person' | 'market_price' | 'ask_server';
  variants: RawExtractedDish[] | null;
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
  /** Sub-ingredients for "choice" ingredients (e.g., meat → beef, chicken, pork) */
  sub_ingredients?: EditableIngredient[];
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
  dish_kind: 'standard' | 'template' | 'combo' | 'experience';
  is_parent: boolean;
  serves: number | null;
  display_price_prefix: 'exact' | 'from' | 'per_person' | 'market_price' | 'ask_server';
  variant_ids: string[]; // _ids of child EditableDish entries
  parent_id: string | null; // _id of parent EditableDish
  group_status: 'ai_proposed' | 'accepted' | 'rejected' | 'manual';
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

export interface ConfirmOptionGroup {
  name: string;
  selection_type: 'single' | 'multiple';
  options: {
    name: string;
    canonical_ingredient_id?: string;
  }[];
}

export interface ConfirmDish {
  name: string;
  price: number;
  description?: string;
  dietary_tags: string[];
  spice_level?: 'none' | 'mild' | 'hot' | null;
  calories?: number | null;
  dish_category_id?: string | null;
  canonical_ingredient_ids: string[];
  option_groups?: ConfirmOptionGroup[];
  dish_kind: 'standard' | 'template' | 'combo' | 'experience';
  is_parent: boolean;
  serves: number;
  display_price_prefix: 'exact' | 'from' | 'per_person' | 'market_price' | 'ask_server';
  variant_dishes?: ConfirmDish[];
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
// Flagged duplicate (merge-detected potential variant)
// ---------------------------------------------------------------------------

export interface FlaggedDuplicate {
  existingDish: RawExtractedDish;
  incomingDish: RawExtractedDish;
  categoryName: string | null;
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

/**
 * Resolves the display currency for a restaurant.
 * Uses `primaryCurrency` if set, falls back to the country→currency map, then defaults to USD.
 *
 * @param primaryCurrency - Explicit currency override stored on the restaurant row.
 * @param countryCode - ISO 3166-1 alpha-2 country code (e.g. "MX", "GB").
 * @returns ISO 4217 currency code (e.g. "MXN", "USD").
 */
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
  // --- Existing ---
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
  'orgánico': 'organic',
  organico: 'organic',

  // --- Regional spellings ---
  'végétarien': 'vegetarian',
  'végétarienne': 'vegetarian',
  'végétalien': 'vegan',
  'végétalienne': 'vegan',
  'senza glutine': 'gluten_free',
  'sin lácteos': 'dairy_free',
  'sans gluten': 'gluten_free',
  'sans lactose': 'dairy_free',

  // --- Common abbreviations ---
  'egg-free': 'egg_free',
  eggfree: 'egg_free',
  'egg free': 'egg_free',
  'soy-free': 'soy_free',
  soyfree: 'soy_free',
  'soy free': 'soy_free',
  paleo: 'paleo',
  keto: 'keto',
  'low-sodium': 'low_sodium',
  'low sodium': 'low_sodium',
  pescatarian: 'pescatarian',
  pescetarian: 'pescatarian',

  // --- Emoji variants ---
  '🌿': 'vegetarian',
  '🌱': 'vegan',
  '♻️': 'organic',
};

/** Strips brackets, asterisks, and periods before dietary hint lookup. */
export function normalizeDietaryHint(hint: string): string {
  return hint
    .replace(/[[\]().*]/g, '')
    .trim()
    .toLowerCase();
}

/**
 * Converts raw AI dietary hint strings into canonical `dietary_tags.code` values.
 * Handles multi-language variants, emoji, and common abbreviations.
 * Automatically adds 'vegetarian' when 'vegan' is present.
 *
 * @param hints - Raw strings as returned by GPT-4o (e.g. ["V", "GF", "🌱"]).
 * @returns Deduplicated array of `dietary_tags.code` values (e.g. ["vegan", "vegetarian", "gluten_free"]).
 */
export function mapDietaryHints(hints: string[]): string[] {
  const codes = new Set<string>();
  for (const hint of hints) {
    const normalized = normalizeDietaryHint(hint);
    const code = DIETARY_HINT_MAP[normalized];
    if (code) codes.add(code);
  }
  // Vegan always implies vegetarian
  if (codes.has('vegan') && !codes.has('vegetarian')) {
    codes.add('vegetarian');
  }
  return Array.from(codes);
}

// ---------------------------------------------------------------------------
// Category synonym map for multi-page merge
// ---------------------------------------------------------------------------

const CATEGORY_SYNONYMS: Record<string, string> = {
  appetizers: 'appetizers',
  starters: 'appetizers',
  entradas: 'appetizers',
  aperitivos: 'appetizers',
  botanas: 'appetizers',
  tapas: 'appetizers',
  snacks: 'appetizers',
  antojitos: 'appetizers',

  'main courses': 'main courses',
  mains: 'main courses',
  'platos principales': 'main courses',
  'platos fuertes': 'main courses',
  entrees: 'main courses',

  desserts: 'desserts',
  postres: 'desserts',
  dulces: 'desserts',
  sweets: 'desserts',

  beverages: 'beverages',
  drinks: 'beverages',
  bebidas: 'beverages',
  refrescos: 'beverages',

  sides: 'sides',
  accompaniments: 'sides',
  guarniciones: 'sides',
  'acompañamientos': 'sides',
  extras: 'sides',

  soups: 'soups',
  sopas: 'soups',

  salads: 'salads',
  ensaladas: 'salads',

  'soups and salads': 'soups and salads',
  'sopas y ensaladas': 'soups and salads',
  'soups & salads': 'soups and salads',

  breakfast: 'breakfast',
  desayunos: 'breakfast',
  desayuno: 'breakfast',

  lunch: 'lunch',
  comidas: 'lunch',
  comida: 'lunch',

  dinner: 'dinner',
  cenas: 'dinner',
  cena: 'dinner',

  seafood: 'seafood',
  mariscos: 'seafood',
  pescados: 'seafood',
  'pescados y mariscos': 'seafood',

  pizza: 'pizza',
  pizzas: 'pizza',

  pasta: 'pasta',
  pastas: 'pasta',

  sandwiches: 'sandwiches',
  tortas: 'sandwiches',

  tacos: 'tacos',

  burgers: 'burgers',
  hamburguesas: 'burgers',

  wines: 'wines',
  vinos: 'wines',
  'carta de vinos': 'wines',

  cocktails: 'cocktails',
  cocteles: 'cocktails',
  'cócteles': 'cocktails',

  coffee: 'coffee',
  'café': 'coffee',
  cafe: 'coffee',
};

// ---------------------------------------------------------------------------
// Category normalization helpers
// ---------------------------------------------------------------------------

/** Normalize a category name: lowercase, strip accents, replace & / + with "and". */
function normalizeCategory(name: string | null): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accent marks
    .replace(/[&+]/g, ' and ')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Find the best string similarity match among existing categories. */
function findBestMatch(
  normalized: string,
  existingNormalized: string[]
): { index: number; score: number } {
  let bestIndex = -1;
  let bestScore = 0;
  for (let i = 0; i < existingNormalized.length; i++) {
    const score = compareTwoStrings(normalized, existingNormalized[i]);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }
  return { index: bestIndex, score: bestScore };
}

/** 3-layer category matching: normalize → synonym → string similarity. */
function matchCategory(
  incoming: string | null,
  existingNames: string[],
  pageIndex: number
): { matched: string | null; isNew: boolean } {
  // Null handling: page-indexed placeholder
  if (!incoming) {
    return { matched: `Uncategorized (page ${pageIndex + 1})`, isNew: true };
  }

  const normalized = normalizeCategory(incoming);

  // Layer 1: Exact normalized match
  const exactMatch = existingNames.find(e => normalizeCategory(e) === normalized);
  if (exactMatch) return { matched: exactMatch, isNew: false };

  // Layer 2: Synonym map
  const canonical = CATEGORY_SYNONYMS[normalized];
  if (canonical) {
    const synMatch = existingNames.find(e => {
      const eNorm = normalizeCategory(e);
      return CATEGORY_SYNONYMS[eNorm] === canonical;
    });
    if (synMatch) return { matched: synMatch, isNew: false };
  }

  // Layer 3: String similarity (> 0.85)
  const existingNormalized = existingNames.map(normalizeCategory);
  const best = findBestMatch(normalized, existingNormalized);
  if (best.score > 0.85) {
    return { matched: existingNames[best.index], isNew: false };
  }

  return { matched: incoming, isNew: true };
}

// ---------------------------------------------------------------------------
// Multi-page merge logic
// ---------------------------------------------------------------------------

/**
 * Merges extraction results from multiple pages of the same menu.
 * Uses 3-layer category matching (normalize → synonym → string similarity).
 * Duplicate dishes with different prices are flagged as potential variants.
 * Null categories get page-indexed placeholders.
 */
export function mergeExtractionResults(
  results: RawExtractionResult[]
): { merged: RawExtractionResult; flaggedDuplicates: FlaggedDuplicate[] } {
  const mergedMenus: RawExtractedMenu[] = [];
  const flaggedDuplicates: FlaggedDuplicate[] = [];

  for (let pageIndex = 0; pageIndex < results.length; pageIndex++) {
    const result = results[pageIndex];

    for (const incomingMenu of result.menus) {
      const incomingMenuName = (incomingMenu.name ?? '').toLowerCase().trim();
      const incomingKey = `${incomingMenu.menu_type}::${incomingMenuName}`;

      // Find existing menu with same name AND same type
      const existingMenu = mergedMenus.find(
        m => `${m.menu_type}::${(m.name ?? '').toLowerCase().trim()}` === incomingKey
      );

      if (!existingMenu) {
        // Deep clone and add, handling null categories with page-indexed placeholders
        mergedMenus.push({
          name: incomingMenu.name,
          menu_type: incomingMenu.menu_type,
          categories: incomingMenu.categories.map(cat => ({
            name: cat.name ?? `Uncategorized (page ${pageIndex + 1})`,
            dishes: cat.dishes.map(d => ({ ...d })),
          })),
        });
        continue;
      }

      // Merge categories into existing menu using 3-layer matching
      const existingCatNames = existingMenu.categories.map(c => c.name ?? '');

      for (const incomingCat of incomingMenu.categories) {
        const { matched, isNew } = matchCategory(incomingCat.name, existingCatNames, pageIndex);

        if (isNew) {
          existingMenu.categories.push({
            name: matched ?? `Uncategorized (page ${pageIndex + 1})`,
            dishes: incomingCat.dishes.map(d => ({ ...d })),
          });
          existingCatNames.push(matched ?? `Uncategorized (page ${pageIndex + 1})`);
          continue;
        }

        // Find the matched existing category
        const existingCat = existingMenu.categories.find(c => c.name === matched)!;

        // Merge dishes — detect duplicates with different prices as potential variants
        const existingDishMap = new Map<string, RawExtractedDish>();
        for (const d of existingCat.dishes) {
          existingDishMap.set(d.name.toLowerCase().trim(), d);
        }

        for (const dish of incomingCat.dishes) {
          const dishKey = dish.name.toLowerCase().trim();
          const existing = existingDishMap.get(dishKey);

          if (!existing) {
            // New dish — add it
            existingCat.dishes.push({ ...dish });
            existingDishMap.set(dishKey, dish);
          } else if (
            existing.price !== dish.price &&
            existing.price != null &&
            dish.price != null
          ) {
            // Same name, different price → flag as potential variant
            flaggedDuplicates.push({
              existingDish: existing,
              incomingDish: dish,
              categoryName: existingCat.name,
            });
          }
          // Same name, same price → true duplicate, skip
        }
      }
    }
  }

  return { merged: { menus: mergedMenus }, flaggedDuplicates };
}

// ---------------------------------------------------------------------------
// Convert enriched server result → editable client state
// ---------------------------------------------------------------------------

/**
 * Converts the enriched server-side extraction result into the flat editable
 * client state used by the menu scan review page.
 *
 * Parent dishes and their variant children are flattened into a single array
 * with `parent_id`/`variant_ids` cross-references. Spice level integers are
 * mapped to string literals ('none' | 'mild' | 'hot').
 *
 * @param enriched - Server result from the `/api/menu-scan` endpoint.
 * @returns Array of editable menus ready to bind to the review UI.
 */
export function toEditableMenus(enriched: EnrichedResult): EditableMenu[] {
  return enriched.menus.map(menu => ({
    name: menu.name || 'Menu',
    menu_type: menu.menu_type,
    categories: menu.categories.map(cat => ({
      name: cat.name || 'General',
      dishes: flattenDishesForEditing(cat.dishes),
    })),
  }));
}

/** Flatten parent-child variant groups into a flat list with parent_id/variant_ids linkage. */
function flattenDishesForEditing(dishes: EnrichedDish[]): EditableDish[] {
  const result: EditableDish[] = [];

  for (const dish of dishes) {
    const parentId = crypto.randomUUID();
    const variantIds: string[] = [];

    // Process variant children first to collect their IDs
    if (dish.is_parent && dish.variants && dish.variants.length > 0) {
      for (const variant of dish.variants) {
        const childId = crypto.randomUUID();
        variantIds.push(childId);
        result.push(enrichedToEditable(variant as EnrichedDish, childId, parentId, false));
      }
    }

    result.push(enrichedToEditable(dish, parentId, null, dish.is_parent, variantIds));
  }

  return result;
}

function enrichedToEditable(
  dish: EnrichedDish,
  id: string,
  parentId: string | null,
  isParent: boolean,
  variantIds: string[] = []
): EditableDish {
  return {
    _id: id,
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
    dish_kind: dish.dish_kind ?? 'standard',
    is_parent: isParent,
    serves: dish.serves ?? null,
    display_price_prefix: dish.display_price_prefix ?? 'exact',
    variant_ids: variantIds,
    parent_id: parentId,
    group_status: isParent ? 'ai_proposed' : parentId ? 'ai_proposed' : 'manual',
  };
}

// ---------------------------------------------------------------------------
// Build confirm payload from editable state
// ---------------------------------------------------------------------------

/**
 * Builds the {@link ConfirmPayload} to POST to `/api/menu-scan/confirm`.
 *
 * Rejected variant groups are excluded. Parent dishes carry their children
 * in `variant_dishes`; child entries are not emitted at the top level.
 *
 * @param menus - Current editable menu state from the review UI.
 * @param jobId - ID of the `menu_scan_jobs` record to mark as completed.
 * @param restaurantId - Restaurant the dishes will be inserted under.
 * @returns Payload ready to send to the confirm endpoint.
 */
export function buildConfirmPayload(
  menus: EditableMenu[],
  jobId: string,
  restaurantId: string
): ConfirmPayload {
  return {
    job_id: jobId,
    restaurant_id: restaurantId,
    menus: menus.map(menu => ({
      name: menu.name,
      menu_type: menu.menu_type,
      categories: menu.categories.map(cat => ({
        name: cat.name,
        dishes: buildConfirmDishes(cat.dishes),
      })),
    })),
  };
}

/** Build ConfirmDish[] from EditableDish[], grouping parents with their children. */
function buildConfirmDishes(dishes: EditableDish[]): ConfirmDish[] {
  const result: ConfirmDish[] = [];
  const childMap = new Map<string, EditableDish[]>();

  // Group children by parent_id
  for (const dish of dishes) {
    if (dish.parent_id) {
      const children = childMap.get(dish.parent_id) ?? [];
      children.push(dish);
      childMap.set(dish.parent_id, children);
    }
  }

  // Process dishes: parents get variant_dishes, standalone go as-is
  for (const dish of dishes) {
    if (dish.parent_id) continue; // children are nested under parents
    if (dish.group_status === 'rejected') continue; // rejected groups are not saved

    const confirmDish = editableToConfirm(dish);

    if (dish.is_parent) {
      const children = childMap.get(dish._id) ?? [];
      confirmDish.variant_dishes = children.map(c => editableToConfirm(c));
    }

    result.push(confirmDish);
  }

  return result;
}

function editableToConfirm(dish: EditableDish): ConfirmDish {
  return {
    name: dish.name,
    price: dish.price ? parseFloat(dish.price) : 0,
    description: dish.description || undefined,
    dietary_tags: dish.dietary_tags,
    spice_level: dish.spice_level,
    calories: dish.calories,
    dish_category_id: dish.dish_category_id,
    canonical_ingredient_ids: dish.ingredients
      .filter(i => i.status === 'matched' && i.canonical_ingredient_id)
      .map(i => i.canonical_ingredient_id!),
    dish_kind: dish.dish_kind,
    is_parent: dish.is_parent,
    serves: dish.serves ?? 1,
    display_price_prefix: dish.display_price_prefix,
  };
}

// ---------------------------------------------------------------------------
// Count total dishes across all menus
// ---------------------------------------------------------------------------

/**
 * Counts non-rejected dishes across all menus and categories.
 * Used to show the total dish count in the review UI header.
 *
 * @param menus - Current editable menu state.
 * @returns Total number of non-rejected dishes.
 */
export function countDishes(menus: EditableMenu[]): number {
  return menus.reduce(
    (total, menu) =>
      total +
      menu.categories.reduce(
        (sum, cat) => sum + cat.dishes.filter(d => d.group_status !== 'rejected').length,
        0
      ),
    0
  );
}

// ---------------------------------------------------------------------------
// Build an empty new dish for manual addition in the review UI
// ---------------------------------------------------------------------------

/**
 * Creates a blank {@link EditableDish} with sensible defaults.
 * Used when the admin manually adds a dish in the review UI.
 *
 * @returns A new dish with a fresh UUID `_id` and `group_status: 'manual'`.
 */
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
    dish_kind: 'standard',
    is_parent: false,
    serves: null,
    display_price_prefix: 'exact',
    variant_ids: [],
    parent_id: null,
    group_status: 'manual',
  };
}
