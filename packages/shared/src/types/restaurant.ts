/**
 * Restaurant Domain Types
 *
 * Core interfaces for the EatMe data model: locations, ingredients, dishes,
 * menus, restaurants, and the onboarding wizard state. These are the types
 * shared between the mobile app and the web portal.
 *
 * Relationship overview:
 *   RestaurantData  — top-level container for one onboarding submission
 *     ├── restaurant: RestaurantBasicInfo & RestaurantOperations
 *     └── menus: Menu[]
 *           └── dishes: Dish[]
 *                 └── option_groups?: OptionGroup[]
 *                       └── options: Option[]
 */

/** Geographic coordinate pair. Matches the PostGIS POINT(lng lat) layout used in Supabase. */
export interface Location {
  lat: number;
  lng: number;
}

/** Canonical ingredient alias returned from the ingredient_aliases table. */
export interface Ingredient {
  id: string; // ingredient_alias.id
  display_name: string; // ingredient_alias.display_name
  canonical_ingredient_id: string;
  canonical_name?: string; // flattened from canonical_ingredient.canonical_name
  ingredient_family_name?: string; // flattened from canonical_ingredient.ingredient_family_name
  is_vegetarian?: boolean; // flattened from canonical_ingredient.is_vegetarian
  is_vegan?: boolean; // flattened from canonical_ingredient.is_vegan
  quantity?: string; // optional quantity when added to a dish
}

/** UI-only: ingredient selected via IngredientAutocomplete, with optional quantity. */
export interface SelectedIngredient extends Ingredient {
  quantity?: string;
}

/** How a dish is composed: single item, customisable template, tasting experience, or combo bundle. */
export type DishKind = 'standard' | 'template' | 'experience' | 'combo';
/** How a menu's availability repeats: fixed weekly hours, varies day-by-day, or rotates periodically. */
export type ScheduleType = 'regular' | 'daily' | 'rotating';
/** How the base price should be labelled in the UI (e.g. "from 12 PLN", "per person", "market price"). */
export type DisplayPricePrefix = 'exact' | 'from' | 'per_person' | 'market_price' | 'ask_server';

/** A single selectable choice within an option group (e.g. "extra cheese +2 PLN"). */
export interface Option {
  id?: string;
  option_group_id?: string;
  name: string;
  description?: string;
  /** Price adjustment in the restaurant's local currency; positive = surcharge, negative = discount. */
  price_delta: number;
  calories_delta?: number | null;
  canonical_ingredient_id?: string | null;
  is_available?: boolean;
  display_order?: number;
}

/**
 * A named group of options shown to the guest at order time (e.g. "Choose your size").
 * Attached to dishes with `dish_kind = 'template'` or `'experience'`, or applied
 * category-wide via `menu_category_id`.
 */
export interface OptionGroup {
  id?: string;
  restaurant_id?: string;
  dish_id?: string | null;
  menu_category_id?: string | null;
  name: string;
  description?: string;
  /** Controls how many options a guest may pick: single = radio, multiple = checkbox, quantity = stepper. */
  selection_type: 'single' | 'multiple' | 'quantity';
  min_selections?: number;
  max_selections?: number | null;
  display_order?: number;
  is_active?: boolean;
  options: Option[];
}

/**
 * Weekly operating schedule. Each day is optional — omitting a day means the
 * restaurant is closed that day. Times are HH:MM strings in local time.
 */
export interface OperatingHours {
  monday?: { open: string; close: string };
  tuesday?: { open: string; close: string };
  wednesday?: { open: string; close: string };
  thursday?: { open: string; close: string };
  friday?: { open: string; close: string };
  saturday?: { open: string; close: string };
  sunday?: { open: string; close: string };
}

/**
 * Canonical dish category from the `dish_categories` table (e.g. "Pizza", "Salads").
 * Categories form a two-level hierarchy via `parent_category_id`.
 */
export interface DishCategory {
  id: string;
  name: string;
  parent_category_id?: string | null;
  is_drink: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * A single menu item. Dishes can be standalone, parent containers (display-only),
 * or variant children (e.g. different sizes of the same pizza).
 *
 * Variant hierarchy: a `parent_dish_id` links a variant to its parent.
 * Parents with `is_parent = true` are display-only containers and are excluded
 * from the consumer-facing feed — only their variant children appear.
 */
export interface Dish {
  id?: string;
  menu_id?: string; // Reference to which menu this dish belongs to
  dish_category_id?: string | null; // Canonical category FK (e.g. "Pizza", "Pasta")

  // Parent-child variant relationship
  parent_dish_id?: string | null; // Links variant to its parent. null = standalone or parent.
  is_parent?: boolean;            // true = display-only container, excluded from feed.

  name: string;
  description?: string;
  price: number;
  calories?: number;
  dietary_tags: string[];
  allergens: string[];
  spice_level?: 'none' | 'mild' | 'hot' | null;
  photo_url?: string;
  is_available?: boolean;

  // Serving size
  serves?: number;           // Number of people this dish feeds. Default 1.
  price_per_person?: number; // Computed: price / serves. Read-only (generated column).

  /** Where the description is shown in the mobile app. Defaults to 'menu'. */
  description_visibility?: 'menu' | 'detail';
  /** Where ingredients are shown in the mobile app. Defaults to 'detail'. */
  ingredients_visibility?: 'menu' | 'detail' | 'none';
  /** Dish composition type. 'standard' = single item (default). */
  dish_kind?: DishKind;
  /** How the base price should be displayed. 'exact' = show as-is (default). */
  display_price_prefix?: DisplayPricePrefix;
  /** Option groups attached to this dish (template/experience types). */
  option_groups?: OptionGroup[];
  /** UI-only: canonical ingredients selected via autocomplete; not persisted on this object. */
  selectedIngredients?: SelectedIngredient[];
  /** UI-only: variant children loaded for menu display grouping (not persisted on this object). */
  variants?: Dish[];
}

/**
 * A named collection of dishes offered by a restaurant (e.g. "Lunch Menu", "Drinks").
 * Each menu has a schedule type that controls when it is available.
 */
export interface Menu {
  id: string;
  name: string;
  description?: string;
  category?: string; // all_day, breakfast, lunch, dinner, drinks, happy_hours
  menu_type?: 'food' | 'drink'; // food menu vs drink menu
  schedule_type?: ScheduleType;  // Availability pattern: regular | daily | rotating
  is_active: boolean;
  display_order: number;
  available_start_time?: string | null;
  available_end_time?: string | null;
  available_days?: string[] | null;
  dishes: Dish[];
}

/**
 * Venue classification used for filtering and display.
 * Must stay in sync with the `RESTAURANT_TYPES` constant and the Postgres enum.
 */
export type RestaurantType =
  | 'restaurant'
  | 'cafe'
  | 'food_truck'
  | 'food_stall'
  | 'bakery'
  | 'buffet'
  | 'fine_dining'
  | 'self_service'
  | 'ghost_kitchen'
  | 'other';

/** Identity and location fields collected on Step 1 of the onboarding wizard. */
export interface RestaurantBasicInfo {
  name: string;
  restaurant_type?: RestaurantType;
  description?: string;
  country?: string;
  city?: string;
  postal_code?: string;
  neighbourhood?: string;
  state?: string;
  address: string;
  location: Location;
  phone?: string;
  website?: string;
  cuisines: string[];
}

/** Accepted payment methods; shown as a badge on the restaurant detail screen. */
export type PaymentMethods = 'cash_only' | 'card_only' | 'cash_and_card';

/** Operational attributes collected on Step 1 (cont.) of the onboarding wizard. */
export interface RestaurantOperations {
  operating_hours: OperatingHours;
  delivery_available: boolean;
  takeout_available: boolean;
  dine_in_available: boolean;
  service_speed?: 'fast-food' | 'regular';
  accepts_reservations: boolean;
  payment_methods?: PaymentMethods;
}

/**
 * Top-level container for a complete restaurant submission.
 * Combines the restaurant profile (identity + operations) with its full
 * menu hierarchy. This is the shape persisted during onboarding and read
 * back by the admin portal when editing an existing restaurant.
 */
export interface RestaurantData {
  restaurant: RestaurantBasicInfo & RestaurantOperations;
  menus: Menu[];
  dishes: Dish[]; // Keep for backwards compatibility, but prefer using menus
}

/** Metadata for a single step in the onboarding wizard sidebar navigator. */
export interface WizardStep {
  id: number;
  title: string;
  path: string;
  isComplete: boolean;
}

/**
 * In-progress onboarding state persisted to localStorage under the
 * `restaurant-draft` key. Allows the wizard to resume after a page refresh.
 */
export interface FormProgress {
  restaurant_id?: string; // Track existing restaurant for updates
  basicInfo: Partial<RestaurantBasicInfo>;
  operations: Partial<RestaurantOperations>;
  menus: Menu[];
  dishes: Dish[]; // Keep for backwards compatibility
  currentStep: number;
  lastSaved?: string;
}
