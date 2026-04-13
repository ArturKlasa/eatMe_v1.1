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

export const DISH_KINDS = [
  {
    value: 'standard' as const,
    label: 'Standard',
    description: 'Single item, fixed composition',
    icon: '🍽️',
  },
  {
    value: 'template' as const,
    label: 'Template',
    description: 'Customer chooses components (protein, sauce…)',
    icon: '🔧',
  },
  {
    value: 'experience' as const,
    label: 'Experience',
    description: 'Multi-course or group dining (hot pot, tasting menu…)',
    icon: '✨',
  },
  {
    value: 'combo' as const,
    label: 'Combo',
    description: 'Bundle of multiple items (burger + fries + drink)',
    icon: '🎁',
  },
] as const;

/** Union of valid dish kind string values. */
export type DishKindValue = (typeof DISH_KINDS)[number]['value'];

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
