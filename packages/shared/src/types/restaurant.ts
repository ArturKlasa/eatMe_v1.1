/** Publishing / curation state for a restaurant or menu. */
export type RestaurantStatus = 'draft' | 'published' | 'archived';

/** Alias of RestaurantStatus — menus use the same state machine. */
export type MenuStatus = RestaurantStatus;

/** Processing state for a menu-scan job. */
export type MenuScanJobStatus = 'pending' | 'processing' | 'needs_review' | 'completed' | 'failed';

/** Geographic coordinate pair. Matches the PostGIS POINT(lng lat) layout used in Supabase. */
export interface Location {
  lat: number;
  lng: number;
}

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

/** Canonical 5-value dish composition kind. */
export type DishKind = 'standard' | 'bundle' | 'configurable' | 'course_menu' | 'buffet';

/** Publishing / curation state for a dish. */
export type DishStatus = 'published' | 'draft' | 'archived';

export interface DishCourse {
  id: string;
  parent_dish_id: string;
  course_number: number;
  course_name: string | null;
  required_count: number;
  choice_type: 'fixed' | 'one_of';
}

export interface DishCourseItem {
  id: string;
  course_id: string;
  option_label: string;
  price_delta: number;
  links_to_dish_id: string | null;
  sort_order: number;
}

/** How a menu's availability repeats: fixed weekly hours, varies day-by-day, or rotates periodically. */
export type ScheduleType = 'regular' | 'daily' | 'rotating';
/** How the base price should be labelled in the UI (e.g. "from 12 PLN", "per person", "market price"). */
export type DisplayPricePrefix = 'exact' | 'from' | 'per_person' | 'market_price' | 'ask_server';

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

/** Omitting a day means closed. Times are HH:MM local. */
export interface OperatingHours {
  monday?: { open: string; close: string };
  tuesday?: { open: string; close: string };
  wednesday?: { open: string; close: string };
  thursday?: { open: string; close: string };
  friday?: { open: string; close: string };
  saturday?: { open: string; close: string };
  sunday?: { open: string; close: string };
}

export interface DishCategory {
  id: string;
  name: string;
  parent_category_id?: string | null;
  is_drink: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** A menu item. parent_dish_id links variants; is_parent containers are excluded from the feed. */
export interface Dish {
  id?: string;
  menu_id?: string; // Reference to which menu this dish belongs to
  dish_category_id?: string | null; // Canonical category FK (e.g. "Pizza", "Pasta")

  // Parent-child variant relationship
  parent_dish_id?: string | null; // Links variant to its parent. null = standalone or parent.
  is_parent?: boolean; // true = display-only container, excluded from feed.

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
  serves?: number; // Number of people this dish feeds. Default 1.
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

export interface Menu {
  id: string;
  name: string;
  description?: string;
  category?: string; // all_day, breakfast, lunch, dinner, drinks, happy_hours
  menu_type?: 'food' | 'drink'; // food menu vs drink menu
  schedule_type?: ScheduleType; // Availability pattern: regular | daily | rotating
  is_active: boolean;
  display_order: number;
  available_start_time?: string | null;
  available_end_time?: string | null;
  available_days?: string[] | null;
  dishes: Dish[];
}

/** Must stay in sync with RESTAURANT_TYPES constant and Postgres enum. */
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

export type PaymentMethods = 'cash_only' | 'card_only' | 'cash_and_card';

export interface RestaurantOperations {
  operating_hours: OperatingHours;
  delivery_available: boolean;
  takeout_available: boolean;
  dine_in_available: boolean;
  service_speed?: 'fast-food' | 'regular';
  accepts_reservations: boolean;
  payment_methods?: PaymentMethods;
}

export interface RestaurantData {
  restaurant: RestaurantBasicInfo & RestaurantOperations;
  menus: Menu[];
  dishes: Dish[]; // Keep for backwards compatibility, but prefer using menus
}

export interface WizardStep {
  id: number;
  title: string;
  path: string;
  isComplete: boolean;
}

/** Persisted to localStorage under 'restaurant-draft'; allows wizard resume after refresh. */
export interface FormProgress {
  restaurant_id?: string; // Track existing restaurant for updates
  basicInfo: Partial<RestaurantBasicInfo>;
  operations: Partial<RestaurantOperations>;
  menus: Menu[];
  dishes: Dish[]; // Keep for backwards compatibility
  currentStep: number;
  lastSaved?: string;
}
