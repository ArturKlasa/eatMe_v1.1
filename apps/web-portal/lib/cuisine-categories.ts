/**
 * Cuisine-to-dish-category mapping for the web portal menu builder.
 *
 * Used on the /onboard/menu page to display quick-select dish name chips
 * when a partner starts adding dishes, reducing friction for common menus.
 *
 * Note: keys in CUISINE_CATEGORIES use underscores to separate words
 * (e.g. `Middle_Eastern`). `getCuisineCategories` normalises the incoming
 * `cuisine` string the same way before lookup, so "Middle Eastern" (with a
 * space) resolves correctly.
 */

// Popular dish categories by cuisine for quick-select buttons
export const CUISINE_CATEGORIES: Record<string, string[]> = {
  Mexican: ['Tacos', 'Burrito', 'Quesadilla', 'Enchiladas', 'Nachos'],
  Italian: ['Pizza', 'Pasta', 'Risotto', 'Lasagna', 'Antipasti'],
  Chinese: ['Fried rice', 'Noodles', 'Dumplings', 'Stir fry', 'Dim sum'],
  Japanese: ['Sushi', 'Ramen', 'Udon', 'Tempura', 'Donburi'],
  Indian: ['Curry', 'Naan', 'Biryani', 'Tandoori', 'Samosas'],
  Thai: ['Pad Thai', 'Curry', 'Tom Yum', 'Stir fry', 'Noodles'],
  American: ['Burger', 'Steak', 'Fried chicken', 'BBQ', 'Sandwich'],
  French: ['Crepes', 'Pastries', 'Steak', 'Salad', 'Dessert'],
  Greek: ['Gyro', 'Salad', 'Souvlaki', 'Moussaka', 'Mezze'],
  Korean: ['Korean BBQ', 'Bibimbap', 'Kimchi', 'Stir fry', 'Hot pot'],
  Vietnamese: ['Pho', 'Banh Mi', 'Spring Rolls', 'Noodle soup', 'Rice dish'],
  Spanish: ['Tapas', 'Paella', 'Churros', 'Tortilla', 'Gazpacho'],
  Middle_Eastern: ['Shawarma', 'Falafel', 'Hummus', 'Kebab', 'Mezze'],
  // Generic fallback
  _default: ['Appetizers', 'Salad', 'Sandwich', 'Pasta', 'Burger', 'Dessert'],
};

export function getCuisineCategories(cuisine?: string): string[] {
  if (!cuisine) return CUISINE_CATEGORIES._default;

  // Normalise cuisine name: replace spaces with underscores so "Middle Eastern"
  // matches the `Middle_Eastern` key (case-sensitive match against CUISINE_CATEGORIES).
  const normalized = cuisine.replace(/\s+/g, '_');

  return CUISINE_CATEGORIES[normalized] || CUISINE_CATEGORIES._default;
}
