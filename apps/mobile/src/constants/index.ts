/**
 * Mobile App Constants
 *
 * Canonical lists shared across mobile screens and components.
 * Keep in sync with `apps/web-portal/lib/constants.ts` for any
 * cuisine/allergen lists that must match between the two apps.
 */

export { ALLERGEN_ICONS, DIETARY_TAG_ICONS, getAllergenIcon, getDietaryTagIcon } from './icons';

/**
 * Quick-pick cuisine list shown in the daily filter grid.
 * Mirrors the web portal's POPULAR_CUISINES array.
 */
export const POPULAR_CUISINES: readonly string[] = [
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
] as const;

/**
 * Full cuisine catalogue used in the "More cuisines" selection modal.
 * Mirrors the web portal's CUISINES array with a few additional entries
 * (Asian, Comfort Food, Fine Dining, International) that are relevant
 * to the mobile consumer experience.
 */
export const ALL_CUISINES: readonly string[] = [
  'Afghan',
  'African',
  'American',
  'Argentine',
  'Asian',
  'BBQ',
  'Bakery',
  'Brazilian',
  'British',
  'Café',
  'Cajun',
  'Caribbean',
  'Chinese',
  'Colombian',
  'Comfort Food',
  'Cuban',
  'Deli',
  'Ethiopian',
  'Fast Food',
  'Filipino',
  'Fine Dining',
  'French',
  'Fusion',
  'German',
  'Greek',
  'Halal',
  'Hawaiian',
  'Healthy',
  'Indian',
  'Indonesian',
  'International',
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
