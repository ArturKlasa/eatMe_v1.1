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

export interface Dish {
  id?: string;
  menu_id?: string; // Reference to which menu this dish belongs to
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
}

export interface Menu {
  id: string;
  name: string;
  description?: string;
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
  address: string;
  location: Location;
  phone?: string;
  website?: string;
  price_range?: '$' | '$$' | '$$$' | '$$$$';
  cuisines: string[];
}

export interface RestaurantOperations {
  operating_hours: OperatingHours;
  delivery_available: boolean;
  takeout_available: boolean;
  dine_in_available: boolean;
  average_prep_time_minutes: number;
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
  basicInfo: Partial<RestaurantBasicInfo>;
  operations: Partial<RestaurantOperations>;
  menus: Menu[];
  dishes: Dish[]; // Keep for backwards compatibility
  currentStep: number;
  lastSaved?: string;
}
