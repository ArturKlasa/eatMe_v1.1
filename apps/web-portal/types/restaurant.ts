export interface Location {
  lat: number;
  lng: number;
}

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

export interface Dish {
  id?: string;
  menu_id?: string; // Reference to which menu this dish belongs to
  dish_category_id?: string | null; // Canonical category FK (e.g. "Pizza", "Pasta")
  name: string;
  description?: string;
  price: number;
  calories?: number;
  dietary_tags: string[];
  allergens: string[];
  ingredients: string[];
  spice_level?: number; // 0-4 scale
  photo_url?: string;
  is_available?: boolean;
  /** Where the description is shown in the mobile app. Defaults to 'menu'. */
  description_visibility?: 'menu' | 'detail';
  /** Where ingredients are shown in the mobile app. Defaults to 'detail'. */
  ingredients_visibility?: 'menu' | 'detail' | 'none';
}

export interface Menu {
  id: string;
  name: string;
  description?: string;
  category?: string; // all_day, breakfast, lunch, dinner, drinks, happy_hours
  menu_type?: 'food' | 'drink'; // food menu vs drink menu
  is_active: boolean;
  display_order: number;
  dishes: Dish[];
}

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

export interface RestaurantOperations {
  operating_hours: OperatingHours;
  delivery_available: boolean;
  takeout_available: boolean;
  dine_in_available: boolean;
  service_speed?: 'fast-food' | 'regular';
  accepts_reservations: boolean;
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

export interface FormProgress {
  restaurant_id?: string; // Track existing restaurant for updates
  basicInfo: Partial<RestaurantBasicInfo>;
  operations: Partial<RestaurantOperations>;
  menus: Menu[];
  dishes: Dish[]; // Keep for backwards compatibility
  currentStep: number;
  lastSaved?: string;
}
