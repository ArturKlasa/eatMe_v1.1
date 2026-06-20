/** Menu time-slot categories (maps to the `category` column on the `menus` table). */
export const MENU_CATEGORIES = [
  { value: 'all_day', label: 'All-Day', description: 'Available all day' },
  { value: 'breakfast', label: 'Breakfast', description: 'Morning menu' },
  { value: 'lunch', label: 'Lunch', description: 'Midday menu' },
  { value: 'dinner', label: 'Dinner', description: 'Evening menu' },
  { value: 'drinks', label: 'Drinks', description: 'Beverages' },
  { value: 'happy_hours', label: 'Happy Hours', description: 'Special offers' },
] as const;

/** Union of valid menu category string values. */
export type MenuCategory = (typeof MENU_CATEGORIES)[number]['value'];

/**
 * Dining-format UX hint for dishes that are dining experiences rather than
 * regular plated dishes. Persisted to `dishes.dining_format` (migration 141).
 * Null for standard dishes.
 */
export const DINING_FORMATS = [
  'buffet',
  'course_menu',
  'interactive_table',
  'shared_plates',
  'sampler',
] as const;

export type DiningFormat = (typeof DINING_FORMATS)[number];

export const DINING_FORMAT_META: Record<
  DiningFormat,
  { label: string; icon: string; description: string }
> = {
  buffet: { label: 'Buffet', icon: '🍽️', description: 'Flat-rate unlimited access' },
  course_menu: { label: 'Course menu', icon: '🍷', description: 'Multi-course sequenced meal' },
  interactive_table: {
    label: 'Interactive dining',
    icon: '🔥',
    description: 'Hot pot, Korean BBQ, fondue',
  },
  shared_plates: {
    label: 'Small / shared plates',
    icon: '🥢',
    description: 'Tapas, dim sum, mezze',
  },
  sampler: { label: 'Sampler / platter', icon: '🍢', description: 'Fixed selection on one plate' },
};

/**
 * Selection types for option groups within a dish.
 *
 * The `'quantity'` variant was removed 2026-05-18 (migration 140 tightens the
 * DB CHECK to `('single','multiple')`). Prod query confirmed zero rows. UI for
 * quantity selection lived only in the retired v1 portal.
 */
export const SELECTION_TYPES = [
  { value: 'single' as const, label: 'Single choice', description: 'Pick exactly one option' },
  { value: 'multiple' as const, label: 'Multiple choice', description: 'Pick one or more options' },
] as const;

export const OPTION_PRESETS: Record<
  string,
  {
    label: string;
    groups: {
      name: string;
      selection_type: 'single' | 'multiple';
      min_selections: number;
      max_selections: number | null;
    }[];
  }
> = {
  dish_with_extras: {
    label: 'Dish with extras',
    groups: [
      { name: 'Extras', selection_type: 'multiple', min_selections: 0, max_selections: null },
    ],
  },
  base_preparation: {
    label: 'Base + preparation',
    groups: [
      { name: 'Base', selection_type: 'single', min_selections: 1, max_selections: 1 },
      { name: 'Preparation', selection_type: 'single', min_selections: 1, max_selections: 1 },
    ],
  },
  build_your_own: {
    label: 'Build your own',
    groups: [
      { name: 'Base', selection_type: 'single', min_selections: 1, max_selections: 1 },
      { name: 'Proteins', selection_type: 'multiple', min_selections: 1, max_selections: 3 },
      { name: 'Toppings', selection_type: 'multiple', min_selections: 0, max_selections: null },
      { name: 'Sauce', selection_type: 'single', min_selections: 1, max_selections: 1 },
    ],
  },
  combo_set: {
    label: 'Combo / set',
    groups: [
      { name: 'Main', selection_type: 'single', min_selections: 1, max_selections: 1 },
      { name: 'Sides', selection_type: 'multiple', min_selections: 0, max_selections: 2 },
    ],
  },
  sushi_matrix: {
    label: 'Sushi matrix',
    groups: [
      { name: 'Fish', selection_type: 'single', min_selections: 1, max_selections: 1 },
      { name: 'Style', selection_type: 'single', min_selections: 1, max_selections: 1 },
    ],
  },
  hot_pot: {
    label: 'Hot Pot',
    groups: [
      { name: 'Broth', selection_type: 'single', min_selections: 1, max_selections: 1 },
      { name: 'Proteins', selection_type: 'multiple', min_selections: 1, max_selections: null },
      { name: 'Vegetables', selection_type: 'multiple', min_selections: 0, max_selections: null },
    ],
  },
};
