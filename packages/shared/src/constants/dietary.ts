/**
 * Dietary restriction, allergen, and religious requirement constants.
 *
 * Values must match the corresponding `dietary_tags.code` and `allergens.code`
 * columns in the database (see infra/supabase/migrations/).
 */

/**
 * Dietary tags displayed as badges on dish cards (vegetarian, vegan, halal, etc.).
 * Values must match `dietary_tags.code` in the database.
 */
export const DIETARY_TAGS = [
  { value: 'vegetarian', label: 'Vegetarian', icon: '🥗' },
  { value: 'vegan', label: 'Vegan', icon: '🌱' },
  { value: 'diabetic_friendly', label: 'Diabetic-Friendly', icon: '🩺' },
  { value: 'keto', label: 'Keto', icon: '🥑' },
  { value: 'paleo', label: 'Paleo', icon: '🥩' },
  { value: 'low_carb', label: 'Low-Carb', icon: '📉' },
  { value: 'halal', label: 'Halal', icon: '☪️' },
  { value: 'hindu', label: 'Hindu', icon: '🕉️' },
  { value: 'kosher', label: 'Kosher', icon: '✡️' },
  { value: 'jain', label: 'Jain', icon: '☸️' },
] as const;

/** Subset of dietary tag codes that represent religious dietary laws. */
export const RELIGIOUS_REQUIREMENTS = ['halal', 'hindu', 'kosher', 'jain'] as const;

/**
 * Allergen options displayed as warnings on dish detail views.
 * Values must match `allergens.code` in the database.
 */
export const ALLERGENS = [
  { value: 'lactose', label: 'Lactose', icon: '🥛' },
  { value: 'gluten', label: 'Gluten', icon: '🌾' },
  { value: 'peanuts', label: 'Peanuts', icon: '🥜' },
  { value: 'soy', label: 'Soy', icon: '🫘' },
  { value: 'sesame', label: 'Sesame', icon: '🌰' },
  { value: 'shellfish', label: 'Shellfish', icon: '🦐' },
  { value: 'nuts', label: 'Nuts', icon: '🌰' },
] as const;
