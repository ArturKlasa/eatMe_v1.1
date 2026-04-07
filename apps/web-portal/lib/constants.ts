/**
 * Shared UI constants for the web portal.
 *
 * Defines all static option lists used across the onboarding wizard and
 * restaurant dashboard (days, countries, restaurant types, menu categories,
 * allergens, dietary tags, etc.).
 *
 * Keep these in sync with the corresponding Postgres enum/check constraints
 * in infra/supabase/migrations/ whenever values are added or renamed.
 */
import { RestaurantType } from '@/types/restaurant';

// ─── Calendar ─────────────────────────────────────────────────────────────────

/** Ordered list of weekdays used for operating-hours form rendering. */
export const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
] as const;

/** Union of the seven day-name keys, matching the `operating_hours` JSONB structure. */
export type DayKey = (typeof DAYS_OF_WEEK)[number]['key'];

// ─── Geography ────────────────────────────────────────────────────────────────

/** Supported countries for phone-number and address validation. */
export const COUNTRIES = [
  { value: 'US', label: 'United States' },
  { value: 'CA', label: 'Canada' },
  { value: 'MX', label: 'Mexico' },
  { value: 'PL', label: 'Poland' },
];

// ─── Venue classification ─────────────────────────────────────────────────────

/** All restaurant venue types backed by the `restaurant_type` DB enum. */
export const RESTAURANT_TYPES: { value: RestaurantType; label: string; description: string }[] = [
  { value: 'restaurant', label: 'Restaurant', description: 'Full-service dining establishment' },
  { value: 'fine_dining', label: 'Fine Dining', description: 'Upscale, formal dining experience' },
  {
    value: 'self_service',
    label: 'Self-Service Restaurant',
    description: 'Self-service dining establishment',
  },
  { value: 'cafe', label: 'Café', description: 'Coffee shop or small eatery' },
  { value: 'food_truck', label: 'Food Truck', description: 'Mobile food service vehicle' },
  { value: 'food_stall', label: 'Food Stall', description: 'Street food or market stall' },
  { value: 'bakery', label: 'Bakery', description: 'Baked goods specialist' },
  { value: 'buffet', label: 'Buffet', description: 'All-you-can-eat style' },
  { value: 'ghost_kitchen', label: 'Ghost Kitchen', description: 'Delivery-only kitchen' },
  { value: 'other', label: 'Other', description: 'Other type of food establishment' },
];

/** Service-speed options (maps to `service_speed` DB column). */
export const SERVICE_SPEED_OPTIONS = [
  { value: 'regular', label: 'Regular Restaurant', description: 'Standard preparation time' },
  { value: 'fast-food', label: 'Fast Food', description: 'Food ready immediately' },
];

/** Accepted payment method options displayed on the operations form. */
export const PAYMENT_METHOD_OPTIONS = [
  {
    value: 'cash_and_card',
    label: 'Cash & Card',
    description: 'Accepts both cash and card payments',
    icon: '💵💳',
  },
  {
    value: 'card_only',
    label: 'Card Only',
    description: 'Card payments only (no cash)',
    icon: '💳',
  },
  {
    value: 'cash_only',
    label: 'Cash Only',
    description: 'Cash payments only (no cards)',
    icon: '💵',
  },
] as const;

/** Union of valid payment method string values. */
export type PaymentMethodValue = 'cash_and_card' | 'card_only' | 'cash_only';

// ─── Menus ────────────────────────────────────────────────────────────────────

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

// ─── Cuisines ─────────────────────────────────────────────────────────────────

/** Shorter curated list surfaced in the onboarding "quick-pick" cuisine chips. */
export const POPULAR_CUISINES = [
  'American',
  'Italian',
  'Mexican',
  'Chinese',
  'Japanese',
  'Thai',
  'Indian',
  'Mediterranean',
  'French',
  'BBQ',
  'Pizza',
  'Sushi',
];

/** Full alphabetical list of cuisine types shown in the expanded cuisine selector. */
export const CUISINES = [
  'Afghan',
  'African',
  'American',
  'Argentine',
  'BBQ',
  'Bakery',
  'Brazilian',
  'British',
  'Café',
  'Cajun',
  'Caribbean',
  'Chinese',
  'Colombian',
  'Cuban',
  'Deli',
  'Ethiopian',
  'Fast Food',
  'Filipino',
  'French',
  'Fusion',
  'German',
  'Greek',
  'Halal',
  'Hawaiian',
  'Healthy',
  'Indian',
  'Indonesian',
  'Irish',
  'Italian',
  'Jamaican',
  'Japanese',
  'Korean',
  'Kosher',
  'Latin American',
  'Lebanese',
  'Malaysian',
  'Mediterranean',
  'Mexican',
  'Middle Eastern',
  'Moroccan',
  'Nepalese',
  'Pakistani',
  'Peruvian',
  'Pizza',
  'Polish',
  'Portuguese',
  'Russian',
  'Salad',
  'Sandwiches',
  'Seafood',
  'Soul Food',
  'Southern',
  'Spanish',
  'Steakhouse',
  'Sushi',
  'Tapas',
  'Thai',
  'Turkish',
  'Vegan',
  'Vegetarian',
  'Vietnamese',
  'Other',
] as const;

// ─── Dietary & allergen tags ───────────────────────────────────────────────────

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

// ─── Pricing & spice ──────────────────────────────────────────────────────────

/** Dollar-sign price-tier indicators used in filter and display UI. */
export const PRICE_RANGES = ['$', '$$', '$$$', '$$$$'] as const;

/** Spice level options (maps to the `spice_level` DB enum). */
export const SPICE_LEVELS = [
  { value: 'none' as const, label: 'No spice', icon: '' },
  { value: 'mild' as const, label: '🌶️', icon: '🌶️' },
  { value: 'hot' as const, label: '🌶️🌶️🌶️', icon: '🌶️🌶️🌶️' },
] as const;

/** Union of valid spice level string values. */
export type SpiceLevel = (typeof SPICE_LEVELS)[number]['value'];

/** Map a spice_level text value to its chilli-icon string. */
export function spiceIcon(level: string | null | undefined): string {
  return SPICE_LEVELS.find(l => l.value === level)?.icon ?? '';
}

// ─── Dish configuration ──────────────────────────────────────────────────────

/**
 * Dish kind options controlling how a dish is presented and customised.
 *  - standard:   Single fixed item (most dishes).
 *  - template:   Customer builds from components (e.g. "build-your-own bowl").
 *  - experience: Multi-course or group format (e.g. hot pot, tasting menu).
 */
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

/** How the dish price is labelled on the menu (exact, from, per-person, etc.). */
export const DISPLAY_PRICE_PREFIXES = [
  { value: 'exact' as const, label: 'Exact price', example: '$14.00' },
  { value: 'from' as const, label: 'From', example: 'from $14.00' },
  { value: 'per_person' as const, label: 'Per person', example: '$14.00 / person' },
  { value: 'market_price' as const, label: 'Market price', example: 'Market price' },
  { value: 'ask_server' as const, label: 'Ask server', example: 'Ask server' },
] as const;

/** Union of valid display price prefix string values. */
export type DisplayPricePrefixValue = (typeof DISPLAY_PRICE_PREFIXES)[number]['value'];

/** Selection types available for option groups within a dish. */
export const SELECTION_TYPES = [
  { value: 'single' as const, label: 'Single choice', description: 'Pick exactly one option' },
  { value: 'multiple' as const, label: 'Multiple choice', description: 'Pick one or more options' },
  { value: 'quantity' as const, label: 'Quantity', description: 'Set amount per option' },
] as const;

// ─── Onboarding wizard ────────────────────────────────────────────────────────

/**
 * Dish-type presets — skeleton option groups pre-populated when a partner
 * picks a template or experience dish kind.
 */
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

/** Step definitions for the restaurant onboarding wizard progress indicator. */
export const WIZARD_STEPS = [
  { id: 1, title: 'Basic Information', path: '/onboard/basic-info' },
  { id: 2, title: 'Operations', path: '/onboard/operations' },
  { id: 3, title: 'Menu Entry', path: '/onboard/menu' },
  { id: 4, title: 'Review & Submit', path: '/onboard/review' },
] as const;
