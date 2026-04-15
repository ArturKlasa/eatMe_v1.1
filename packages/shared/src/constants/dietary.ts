/** Values must match dietary_tags.code in the DB. See migration 090 for seed. */
export const DIETARY_TAGS = [
  { value: 'vegetarian', label: 'Vegetarian', icon: '🥗' },
  { value: 'vegan', label: 'Vegan', icon: '🌱' },
  { value: 'pescatarian', label: 'Pescatarian', icon: '🐟' },
  { value: 'diabetic_friendly', label: 'Diabetic-Friendly', icon: '🩺' },
  { value: 'keto', label: 'Keto', icon: '🥑' },
  { value: 'paleo', label: 'Paleo', icon: '🥩' },
  { value: 'low_carb', label: 'Low-Carb', icon: '📉' },
  { value: 'low_sodium', label: 'Low-Sodium', icon: '🧂' },
  { value: 'organic', label: 'Organic', icon: '♻️' },
  { value: 'gluten_free', label: 'Gluten-Free', icon: '🌾' },
  { value: 'dairy_free', label: 'Dairy-Free', icon: '🥛' },
  { value: 'nut_free', label: 'Nut-Free', icon: '🥜' },
  { value: 'egg_free', label: 'Egg-Free', icon: '🥚' },
  { value: 'soy_free', label: 'Soy-Free', icon: '🫘' },
  { value: 'halal', label: 'Halal', icon: '☪️' },
  { value: 'hindu', label: 'Hindu', icon: '🕉️' },
  { value: 'kosher', label: 'Kosher', icon: '✡️' },
  { value: 'jain', label: 'Jain', icon: '☸️' },
] as const;

export type DietaryTagCode = (typeof DIETARY_TAGS)[number]['value'];

/** Subset of dietary tag codes that represent religious dietary laws. */
export const RELIGIOUS_REQUIREMENTS = ['halal', 'hindu', 'kosher', 'jain'] as const;

/** Values must match allergens.code in the DB. */
export const ALLERGENS = [
  { value: 'lactose', label: 'Lactose', icon: '🥛' },
  { value: 'gluten', label: 'Gluten', icon: '🌾' },
  { value: 'peanuts', label: 'Peanuts', icon: '🥜' },
  { value: 'soy', label: 'Soy', icon: '🫘' },
  { value: 'sesame', label: 'Sesame', icon: '🌰' },
  { value: 'shellfish', label: 'Shellfish', icon: '🦐' },
  { value: 'nuts', label: 'Nuts', icon: '🌰' },
] as const;
