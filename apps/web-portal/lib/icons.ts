/**
 * Client-side icon maps for allergens and dietary tags.
 *
 * Icons are a display-layer concern — they live here, NOT in the database.
 * The DB stores only the `code` string (e.g. "milk", "vegan").
 * Keep in sync with apps/mobile/src/constants/icons.ts.
 */

/** Maps allergen `code` → emoji */
export const ALLERGEN_ICONS: Readonly<Record<string, string>> = {
  milk: '🥛',
  eggs: '🥚',
  fish: '🐟',
  shellfish: '🦐',
  tree_nuts: '🌰',
  peanuts: '🥜',
  wheat: '🌾',
  soybeans: '🫘',
  sesame: '🌰',
  gluten: '🌾',
  lactose: '🥛',
  sulfites: '🍷',
  mustard: '🌭',
  celery: '🥬',
};

/** Maps dietary tag `code` → emoji */
export const DIETARY_TAG_ICONS: Readonly<Record<string, string>> = {
  vegetarian: '🥗',
  vegan: '🌱',
  pescatarian: '🐟',
  keto: '🥑',
  paleo: '🥩',
  low_carb: '📉',
  gluten_free: '🌾',
  dairy_free: '🚫',
  halal: '☪️',
  kosher: '✡️',
  hindu: '🕉️',
  jain: '☸️',
  organic: '🌿',
  raw: '🥗',
  diabetic_friendly: '🩺',
  heart_healthy: '❤️',
};

/** Returns the emoji icon for an allergen code, or ⚠️ as a fallback. */
export function getAllergenIcon(code: string): string {
  return ALLERGEN_ICONS[code] ?? '⚠️';
}

/** Returns the emoji icon for a dietary tag code, or 🏷️ as a fallback. */
export function getDietaryTagIcon(code: string): string {
  return DIETARY_TAG_ICONS[code] ?? '🏷️';
}
