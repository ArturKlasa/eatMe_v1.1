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
  name: string;
  description: string;
  price: number;
  dietary_tags: string[];
  allergens: string[];
  ingredients: string[];
  photo_url?: string;
}

export interface RestaurantBasicInfo {
  name: string;
  description: string;
  address: string;
  location: Location;
  phone: string;
  website?: string;
  price_range: '$' | '$$' | '$$$' | '$$$$';
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
  dishes: Dish[];
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
  dishes: Dish[];
  currentStep: number;
  lastSaved?: string;
}
