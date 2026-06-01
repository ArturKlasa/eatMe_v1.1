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

export const ALL_CUISINES = [
  'Afghan',
  'African',
  'American',
  'Argentine',
  'Asian',
  'BBQ',
  'Bakery',
  'Brazilian',
  'Breakfast',
  'British',
  'Café',
  'Cajun',
  'Caribbean',
  'Chinese',
  'Colombian',
  'Comfort Food',
  'Cuban',
  'Deli',
  'Desserts',
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
  'Taiwanese',
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

/**
 * Folds a cuisine string for accent/case-insensitive matching:
 * "CAFÉ" / "café " → "cafe".
 */
const foldCuisine = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/** Folded canonical key → canonical-cased value (e.g. "cafe" → "Café"). */
const CANONICAL_BY_FOLD = new Map<string, string>(ALL_CUISINES.map(c => [foldCuisine(c), c]));

/**
 * Normalizes arbitrary cuisine strings to canonical {@link ALL_CUISINES} values:
 * accent/case-insensitive, order-preserving, deduplicated; unknown values are dropped.
 * The single gate every import/backfill path should run cuisine data through.
 */
export function normalizeCuisines(input: readonly string[] | null | undefined): string[] {
  const out: string[] = [];
  for (const raw of input ?? []) {
    if (typeof raw !== 'string') continue;
    const canonical = CANONICAL_BY_FOLD.get(foldCuisine(raw));
    if (canonical && !out.includes(canonical)) out.push(canonical);
  }
  return out;
}
