/**
 * Cuisine → emoji lookup for compact dish/restaurant cards (e.g. MapFooter).
 *
 * Keys are the canonical {@link ALL_CUISINES} values from `@eatme/shared`.
 * Unmapped or empty cuisines fall back to a generic plate. The lookup is
 * exact-match first, then a case-insensitive substring match so combined or
 * lowercased values ("mexican", "Modern Mexican") still resolve sensibly.
 */

const CUISINE_EMOJI: Record<string, string> = {
  Afghan: '🥘',
  African: '🍲',
  American: '🍔',
  Argentine: '🥩',
  Asian: '🥢',
  BBQ: '🍖',
  Bakery: '🥖',
  Brazilian: '🍢',
  Breakfast: '🍳',
  British: '🥧',
  Café: '☕',
  Cajun: '🦞',
  Caribbean: '🍹',
  Chinese: '🥡',
  Colombian: '🫓',
  'Comfort Food': '🍲',
  Cuban: '🥪',
  Deli: '🥪',
  Desserts: '🍰',
  Ethiopian: '🍛',
  'Fast Food': '🍟',
  Filipino: '🍚',
  'Fine Dining': '🍽️',
  French: '🥐',
  Fusion: '🍽️',
  German: '🥨',
  Greek: '🥙',
  Halal: '🧆',
  Hawaiian: '🍍',
  Healthy: '🥗',
  Indian: '🍛',
  Indonesian: '🍜',
  International: '🌍',
  Irish: '🍀',
  Italian: '🍝',
  Jamaican: '🍢',
  Japanese: '🍣',
  Korean: '🍲',
  Kosher: '🥯',
  'Latin American': '🌮',
  Lebanese: '🥙',
  Malaysian: '🍜',
  Mediterranean: '🫒',
  Mexican: '🌮',
  'Middle Eastern': '🧆',
  Moroccan: '🍲',
  Nepalese: '🍛',
  Pakistani: '🍛',
  Peruvian: '🐟',
  Pizza: '🍕',
  Polish: '🥟',
  Portuguese: '🐟',
  Russian: '🥟',
  Salad: '🥗',
  Sandwiches: '🥪',
  Seafood: '🐟',
  'Soul Food': '🍗',
  Southern: '🍗',
  Spanish: '🥘',
  Steakhouse: '🥩',
  Sushi: '🍣',
  Taiwanese: '🧋',
  Tapas: '🍤',
  Thai: '🍜',
  Turkish: '🧆',
  Vegan: '🌱',
  Vegetarian: '🥦',
  Vietnamese: '🍜',
  Other: '🍽️',
};

const DEFAULT_EMOJI = '🍽️';

export function cuisineEmoji(cuisine?: string | null): string {
  if (!cuisine) return DEFAULT_EMOJI;
  if (CUISINE_EMOJI[cuisine]) return CUISINE_EMOJI[cuisine];
  const lower = cuisine.toLowerCase();
  for (const [key, emoji] of Object.entries(CUISINE_EMOJI)) {
    if (lower.includes(key.toLowerCase())) return emoji;
  }
  return DEFAULT_EMOJI;
}
