import { compareTwoStrings } from 'string-similarity';

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

export interface ExtractionNote {
  type:
    | 'likely_ocr_error'
    | 'price_outlier'
    | 'unreadable_section'
    | 'ingredient_mismatch'
    | 'dish_category_mismatch';
  /** Human-readable path: "Menu > Category > Dish" or "page_N" for page-scoped issues */
  path: string;
  message: string;
  /** Optional proposed fix (e.g. "looks like 'Pad Thai'") */
  suggestion: string | null;
}

export interface RawExtractionResult {
  menus: RawExtractedMenu[];
  /** AI-reported quality issues detected during extraction */
  extraction_notes?: ExtractionNote[];
}

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
  /** AI-reported quality issues from extraction (merged across pages) */
  extractionNotes?: ExtractionNote[];
}

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

export interface ConfirmOptionGroup {
  name: string;
  selection_type: 'single' | 'multiple';
  min_selections?: number;
  max_selections?: number | null;
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
  /** AI-suggested allergen codes. Supplementary until DB trigger computes from ingredients. */
  allergens?: string[];
  /** GPT-4o extraction confidence [0–1]. Used to populate enrichment_confidence at confirm. */
  confidence?: number;
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

export interface FlaggedDuplicate {
  existingDish: RawExtractedDish;
  incomingDish: RawExtractedDish;
  categoryName: string | null;
}

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

import type { DietaryTagCode } from '@eatme/shared';

const DIETARY_HINT_MAP: Record<string, DietaryTagCode> = {
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
  orgánico: 'organic',
  organico: 'organic',

  // --- Regional spellings ---
  végétarien: 'vegetarian',
  végétarienne: 'vegetarian',
  végétalien: 'vegan',
  végétalienne: 'vegan',
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

/** Maps raw AI dietary hints to canonical dietary_tags.code values.
 *  Returns matched canonical codes plus any hints that had no mapping entry
 *  so callers can surface them (e.g. as extraction_notes) instead of dropping silently. */
export function mapDietaryHints(hints: string[]): { codes: string[]; unmapped: string[] } {
  const codes = new Set<string>();
  const unmapped: string[] = [];
  for (const hint of hints) {
    const normalized = normalizeDietaryHint(hint);
    if (!normalized) continue;
    const code = DIETARY_HINT_MAP[normalized];
    if (code) {
      codes.add(code);
    } else {
      unmapped.push(hint);
    }
  }
  if (codes.has('vegan') && !codes.has('vegetarian')) {
    codes.add('vegetarian');
  }
  return { codes: Array.from(codes), unmapped };
}

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
  acompañamientos: 'sides',
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
  cócteles: 'cocktails',

  coffee: 'coffee',
  café: 'coffee',
  cafe: 'coffee',
};

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

/** Merges extraction results from multiple pages using 3-layer category matching. */
export function mergeExtractionResults(results: RawExtractionResult[]): {
  merged: RawExtractionResult;
  flaggedDuplicates: FlaggedDuplicate[];
  extractionNotes: ExtractionNote[];
} {
  const mergedMenus: RawExtractedMenu[] = [];
  const flaggedDuplicates: FlaggedDuplicate[] = [];
  const extractionNotes: ExtractionNote[] = [];

  for (let pageIndex = 0; pageIndex < results.length; pageIndex++) {
    const result = results[pageIndex];

    // Collect extraction notes, prefixing path with page number when it's page-scoped
    for (const note of result.extraction_notes ?? []) {
      const prefixed: ExtractionNote =
        results.length > 1 && /^page_\d+/.test(note.path)
          ? { ...note, path: note.path.replace(/^page_\d+/, `page_${pageIndex + 1}`) }
          : note;
      extractionNotes.push(prefixed);
    }

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

  return {
    merged: { menus: mergedMenus, extraction_notes: extractionNotes },
    flaggedDuplicates,
    extractionNotes,
  };
}

/** Converts enriched server result to editable client state for the review page. */
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

/** Builds the ConfirmPayload from editable state, excluding rejected variant groups. */
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
    allergens: dish.suggested_allergens ?? [],
    confidence: dish.confidence,
  };
}

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
