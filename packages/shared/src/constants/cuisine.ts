/**
 * Cuisine constants — canonical merged list from web-portal and mobile.
 *
 * The mobile app originally carried 4 extra entries (Asian, Comfort Food,
 * Fine Dining, International) that the web portal lacked. This merged list
 * is the single source of truth for both apps.
 */

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
] as const;

/**
 * Full alphabetical list of cuisine types shown in the expanded cuisine selector.
 *
 * Merged from web-portal CUISINES (67 items) and mobile ALL_CUISINES
 * (67 + 4 extras: Asian, Comfort Food, Fine Dining, International).
 */
export const ALL_CUISINES = [
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

/** Backward-compatible alias — web-portal code imports CUISINES. */
export const CUISINES = ALL_CUISINES;
