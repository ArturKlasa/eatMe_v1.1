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

  // Normalize cuisine name (remove spaces, lowercase)
  const normalized = cuisine.replace(/\s+/g, '_');

  return CUISINE_CATEGORIES[normalized] || CUISINE_CATEGORIES._default;
}
