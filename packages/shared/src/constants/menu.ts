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
 * Metadata for the 5 canonical dish kinds (Step 2 onwards).
 * Use this in new components; DISH_KINDS below is kept for legacy consumers only.
 */
export const DISH_KIND_META = {
  standard: { label: 'Standard', description: 'Single fixed dish', icon: '🍽️' },
  bundle: { label: 'Bundle', description: 'N items together at one price', icon: '🎁' },
  configurable: { label: 'Configurable', description: 'Customer selects from slots', icon: '🔧' },
  course_menu: { label: 'Course Menu', description: 'Multi-course sequenced', icon: '🍷' },
  buffet: { label: 'Buffet', description: 'Flat-rate unlimited access', icon: '🍱' },
} as const;

/** Selection types available for option groups within a dish. */
export const SELECTION_TYPES = [
  { value: 'single' as const, label: 'Single choice', description: 'Pick exactly one option' },
  { value: 'multiple' as const, label: 'Multiple choice', description: 'Pick one or more options' },
  { value: 'quantity' as const, label: 'Quantity', description: 'Set amount per option' },
] as const;

export const OPTION_PRESETS: Record<
  string,
  {
    label: string;
    groups: {
      name: string;
      selection_type: 'single' | 'multiple' | 'quantity';
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
