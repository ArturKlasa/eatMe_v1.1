import { RestaurantType } from '@/types/restaurant';

export const COUNTRIES = [
  { value: 'US', label: 'United States' },
  { value: 'CA', label: 'Canada' },
  { value: 'MX', label: 'Mexico' },
  { value: 'PL', label: 'Poland' },
];

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

export const SERVICE_SPEED_OPTIONS = [
  { value: 'regular', label: 'Regular Restaurant', description: 'Standard preparation time' },
  { value: 'fast-food', label: 'Fast Food', description: 'Food ready immediately' },
];

export const MENU_CATEGORIES = [
  { value: 'all_day', label: 'All-Day', description: 'Available all day' },
  { value: 'breakfast', label: 'Breakfast', description: 'Morning menu' },
  { value: 'lunch', label: 'Lunch', description: 'Midday menu' },
  { value: 'dinner', label: 'Dinner', description: 'Evening menu' },
  { value: 'drinks', label: 'Drinks', description: 'Beverages' },
  { value: 'happy_hours', label: 'Happy Hours', description: 'Special offers' },
] as const;

export type MenuCategory = (typeof MENU_CATEGORIES)[number]['value'];

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

export const DIETARY_TAGS = [
  { value: 'vegetarian', label: 'Vegetarian', icon: '🥗' },
  { value: 'vegan', label: 'Vegan', icon: '🌱' },
  { value: 'diabetic', label: 'Diabetic', icon: '🩺' },
  { value: 'keto', label: 'Keto', icon: '🥑' },
  { value: 'paleo', label: 'Paleo', icon: '🥩' },
  { value: 'low-carb', label: 'Low-Carb', icon: '📉' },
  { value: 'halal', label: 'Halal', icon: '☪️' },
  { value: 'hindu', label: 'Hindu', icon: '🕉️' },
  { value: 'kosher', label: 'Kosher', icon: '✡️' },
  { value: 'jain', label: 'Jain', icon: '☸️' },
] as const;

export const RELIGIOUS_REQUIREMENTS = ['halal', 'hindu', 'kosher', 'jain'] as const;

export const ALLERGENS = [
  { value: 'lactose', label: 'Lactose', icon: '🥛' },
  { value: 'gluten', label: 'Gluten', icon: '🌾' },
  { value: 'peanuts', label: 'Peanuts', icon: '🥜' },
  { value: 'soy', label: 'Soy', icon: '🫘' },
  { value: 'sesame', label: 'Sesame', icon: '🌰' },
  { value: 'shellfish', label: 'Shellfish', icon: '🦐' },
  { value: 'nuts', label: 'Nuts', icon: '🌰' },
] as const;

export const PRICE_RANGES = ['$', '$$', '$$$', '$$$$'] as const;

export const SPICE_LEVELS = [
  { value: 0, label: 'No spicy', icon: '🥛' },
  { value: 1, label: 'Spicy', icon: '🌶️' },
] as const;

export const DAYS_OF_WEEK = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export const WIZARD_STEPS = [
  { id: 1, title: 'Basic Information', path: '/onboard/basic-info' },
  { id: 2, title: 'Operations', path: '/onboard/operations' },
  { id: 3, title: 'Menu Entry', path: '/onboard/menu' },
  { id: 4, title: 'Review & Submit', path: '/onboard/review' },
] as const;
