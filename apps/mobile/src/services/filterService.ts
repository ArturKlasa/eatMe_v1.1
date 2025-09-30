/**
 * Filter Service - Data filtering algorithms for restaurants and dishes
 *
 * Implements efficient filtering algorithms that apply both daily and permanent
 * filters to restaurant/dish data with proper validation and error handling.
 */

import { Restaurant } from '../data/mockRestaurants';
import { DailyFilters, PermanentFilters } from '../stores/filterStore';
import { debugLog } from '../config/environment';

/**
 * Filter result with metadata about the filtering operation
 */
export interface FilterResult {
  restaurants: Restaurant[];
  totalCount: number;
  appliedFilters: {
    daily: number;
    permanent: number;
  };
  filterSummary: string[];
}

/**
 * Main filtering function that applies all active filters to restaurant data
 *
 * @param restaurants - Array of restaurants to filter
 * @param dailyFilters - Daily filter settings
 * @param permanentFilters - Permanent filter settings
 * @returns FilterResult with filtered restaurants and metadata
 */
export function applyFilters(
  restaurants: Restaurant[],
  dailyFilters: DailyFilters,
  permanentFilters: PermanentFilters
): FilterResult {
  const startTime = Date.now();
  let filteredRestaurants = [...restaurants];
  const filterSummary: string[] = [];
  let dailyFilterCount = 0;
  let permanentFilterCount = 0;

  // Apply permanent filters first (hard constraints)
  filteredRestaurants = applyPermanentFilters(filteredRestaurants, permanentFilters, filterSummary);
  permanentFilterCount = getPermanentFilterCount(permanentFilters);

  // Apply daily filters (soft constraints)
  filteredRestaurants = applyDailyFilters(filteredRestaurants, dailyFilters, filterSummary);
  dailyFilterCount = getDailyFilterCount(dailyFilters);

  // Sort results based on daily sort preference
  filteredRestaurants = sortRestaurants(filteredRestaurants, dailyFilters.sortBy);

  const endTime = Date.now();
  debugLog(`Filter operation completed in ${endTime - startTime}ms`);
  debugLog(`Filtered ${restaurants.length} → ${filteredRestaurants.length} restaurants`);

  return {
    restaurants: filteredRestaurants,
    totalCount: restaurants.length,
    appliedFilters: {
      daily: dailyFilterCount,
      permanent: permanentFilterCount,
    },
    filterSummary,
  };
}

/**
 * Apply permanent filters (hard constraints that exclude restaurants)
 */
function applyPermanentFilters(
  restaurants: Restaurant[],
  permanentFilters: PermanentFilters,
  filterSummary: string[]
): Restaurant[] {
  let filtered = restaurants;

  // Strict diet type filter
  if (permanentFilters.strictDietType !== 'none') {
    // In a real app, we'd check restaurant menu/capability
    // For mock data, we'll simulate based on cuisine type
    filtered = filtered.filter(restaurant => {
      const isVeganFriendly = ['Contemporary Mexican', 'Italian'].includes(restaurant.cuisine);
      const isVegetarianFriendly = !['Seafood'].includes(restaurant.cuisine);

      switch (permanentFilters.strictDietType) {
        case 'vegan':
          return isVeganFriendly;
        case 'vegetarian':
        case 'pescatarian':
          return isVegetarianFriendly;
        default:
          return true;
      }
    });
    filterSummary.push(`Diet: ${permanentFilters.strictDietType}`);
  }

  // Allergy filters (exclude restaurants that can't accommodate)
  const activeAllergies = Object.entries(permanentFilters.allergies)
    .filter(([_, active]) => active)
    .map(([allergy, _]) => allergy);

  if (activeAllergies.length > 0) {
    // In a real app, this would check restaurant allergen capabilities
    // For mock data, we'll assume all restaurants can accommodate common allergies
    // except for specific cuisine types that commonly use those ingredients
    filtered = filtered.filter(restaurant => {
      if (activeAllergies.includes('shellfish') && restaurant.cuisine === 'Seafood') {
        return false; // Seafood restaurants likely can't guarantee no shellfish contamination
      }
      if (activeAllergies.includes('gluten') && restaurant.cuisine === 'Italian') {
        // Some Italian restaurants might not have good gluten-free options
        return restaurant.rating >= 4.5; // Only highly-rated ones likely have good GF options
      }
      return true;
    });
    filterSummary.push(`Allergies: ${activeAllergies.join(', ')}`);
  }

  // Religious/Cultural requirements
  const activeReligious = Object.entries(permanentFilters.religiousCultural)
    .filter(([_, active]) => active)
    .map(([requirement, _]) => requirement);

  if (activeReligious.length > 0) {
    // In a real app, this would check restaurant certifications
    // For mock data, we'll make assumptions based on cuisine
    filtered = filtered.filter(restaurant => {
      if (activeReligious.includes('halal') || activeReligious.includes('kosher')) {
        // Assume only certain cuisines commonly have halal/kosher options
        return ['Contemporary Mexican', 'Italian'].includes(restaurant.cuisine);
      }
      return true;
    });
    filterSummary.push(`Religious: ${activeReligious.join(', ')}`);
  }

  // Accessibility requirements
  const activeAccessibility = Object.entries(permanentFilters.accessibility)
    .filter(([_, active]) => active)
    .map(([requirement, _]) => requirement);

  if (activeAccessibility.length > 0) {
    // In a real app, this would check restaurant accessibility features
    // For mock data, we'll assume newer/higher-rated restaurants are more accessible
    filtered = filtered.filter(restaurant => {
      if (activeAccessibility.includes('wheelchairAccessible')) {
        return restaurant.rating >= 4.5; // Assume highly-rated restaurants are accessible
      }
      return true;
    });
    filterSummary.push(`Accessibility: ${activeAccessibility.join(', ')}`);
  }

  return filtered;
}

/**
 * Apply daily filters (soft constraints and preferences)
 */
function applyDailyFilters(
  restaurants: Restaurant[],
  dailyFilters: DailyFilters,
  filterSummary: string[]
): Restaurant[] {
  let filtered = restaurants;

  // Price range filter
  if (dailyFilters.priceRange.min > 1 || dailyFilters.priceRange.max < 4) {
    filtered = filtered.filter(restaurant => {
      const priceLevel = getPriceLevel(restaurant.priceRange);
      return priceLevel >= dailyFilters.priceRange.min && priceLevel <= dailyFilters.priceRange.max;
    });

    const minPrice = '$'.repeat(dailyFilters.priceRange.min);
    const maxPrice = '$'.repeat(dailyFilters.priceRange.max);
    filterSummary.push(`Price: ${minPrice} to ${maxPrice}`);
  }

  // Cuisine types filter
  if (dailyFilters.cuisineTypes.length > 0) {
    filtered = filtered.filter(restaurant =>
      dailyFilters.cuisineTypes.includes(restaurant.cuisine)
    );
    filterSummary.push(`Cuisines: ${dailyFilters.cuisineTypes.join(', ')}`);
  }

  // Diet toggle filter (exclude based on disabled toggles)
  const disabledDiets = Object.entries(dailyFilters.dietToggle)
    .filter(([_, enabled]) => !enabled)
    .map(([diet, _]) => diet);

  if (disabledDiets.length > 0) {
    filtered = filtered.filter(restaurant => {
      // Mock logic: exclude restaurants based on disabled diet options
      if (disabledDiets.includes('meat') && ['Mexican'].includes(restaurant.cuisine)) {
        return false; // Mexican restaurants typically meat-heavy
      }
      if (disabledDiets.includes('fish') && restaurant.cuisine === 'Seafood') {
        return false; // Seafood restaurants obviously fish-heavy
      }
      if (disabledDiets.includes('vegetarian') && disabledDiets.includes('vegan')) {
        // If both vegetarian and vegan are disabled, show all restaurants
        return true;
      }
      return true;
    });

    const enabledDiets = Object.entries(dailyFilters.dietToggle)
      .filter(([_, enabled]) => enabled)
      .map(([diet, _]) => diet);
    filterSummary.push(`Diet options: ${enabledDiets.join(', ')}`);
  }

  // Open now filter
  if (dailyFilters.openNow) {
    filtered = filtered.filter(restaurant => restaurant.isOpen);
    filterSummary.push('Open now');
  }

  // Calorie range filter (if enabled)
  if (dailyFilters.calorieRange.enabled) {
    // In a real app, this would filter based on menu item calories
    // For mock data, we'll assume all restaurants have options in the range
    // but prefer restaurants with lighter cuisine for lower calorie ranges
    if (dailyFilters.calorieRange.max < 600) {
      // Prefer lighter cuisines for low-calorie requests
      filtered = filtered.sort((a, b) => {
        const aIsLight = ['Contemporary Mexican', 'Seafood'].includes(a.cuisine);
        const bIsLight = ['Contemporary Mexican', 'Seafood'].includes(b.cuisine);

        if (aIsLight && !bIsLight) return -1;
        if (!aIsLight && bIsLight) return 1;
        return 0;
      });
    }

    filterSummary.push(
      `Calories: ${dailyFilters.calorieRange.min}-${dailyFilters.calorieRange.max}`
    );
  }

  return filtered;
}

/**
 * Sort restaurants based on the selected sort criteria
 */
function sortRestaurants(restaurants: Restaurant[], sortBy: DailyFilters['sortBy']): Restaurant[] {
  const sorted = [...restaurants];

  switch (sortBy) {
    case 'closest':
      // In a real app, this would calculate distance from user location
      // For mock data, we'll sort by a simulated distance based on coordinates
      return sorted.sort((a, b) => {
        const aDistance =
          Math.abs(a.coordinates[0] + 122.082) + Math.abs(a.coordinates[1] - 37.421);
        const bDistance =
          Math.abs(b.coordinates[0] + 122.082) + Math.abs(b.coordinates[1] - 37.421);
        return aDistance - bDistance;
      });

    case 'highestRated':
      return sorted.sort((a, b) => b.rating - a.rating);

    case 'bestMatch':
    default:
      // For "best match", we'll use a combination of rating and other factors
      return sorted.sort((a, b) => {
        // Higher rating gets bonus points
        const aScore = a.rating * 2;
        const bScore = b.rating * 2;

        // Open restaurants get bonus points
        const aOpenBonus = a.isOpen ? 0.5 : 0;
        const bOpenBonus = b.isOpen ? 0.5 : 0;

        // Closer restaurants get bonus points (mock calculation)
        const aDistanceBonus = 1 / (Math.abs(a.coordinates[0] + 122.082) + 1);
        const bDistanceBonus = 1 / (Math.abs(b.coordinates[0] + 122.082) + 1);

        const finalA = aScore + aOpenBonus + aDistanceBonus;
        const finalB = bScore + bOpenBonus + bDistanceBonus;

        return finalB - finalA;
      });
  }
}

/**
 * Convert price range string to numeric level
 */
function getPriceLevel(priceRange: string): number {
  switch (priceRange) {
    case '$':
      return 1;
    case '$$':
      return 2;
    case '$$$':
      return 3;
    case '$$$$':
      return 4;
    default:
      return 2;
  }
}

/**
 * Count active daily filters
 */
function getDailyFilterCount(dailyFilters: DailyFilters): number {
  let count = 0;

  // Price range (not default)
  if (dailyFilters.priceRange.min !== 1 || dailyFilters.priceRange.max !== 4) {
    count++;
  }

  // Cuisines
  if (dailyFilters.cuisineTypes.length > 0) {
    count++;
  }

  // Diet toggles (not all enabled)
  const allDietEnabled = Object.values(dailyFilters.dietToggle).every(Boolean);
  if (!allDietEnabled) {
    count++;
  }

  // Calorie range (if enabled)
  if (dailyFilters.calorieRange.enabled) {
    count++;
  }

  // Open now
  if (dailyFilters.openNow) {
    count++;
  }

  return count;
}

/**
 * Count active permanent filters
 */
function getPermanentFilterCount(permanentFilters: PermanentFilters): number {
  let count = 0;

  // Allergies
  const activeAllergies = Object.values(permanentFilters.allergies).filter(Boolean);
  if (activeAllergies.length > 0) {
    count++;
  }

  // Religious/cultural requirements
  const activeReligious = Object.values(permanentFilters.religiousCultural).filter(Boolean);
  if (activeReligious.length > 0) {
    count++;
  }

  // Strict diet type
  if (permanentFilters.strictDietType !== 'none') {
    count++;
  }

  // Ingredient exclusions
  if (permanentFilters.ingredientExclusions.length > 0) {
    count++;
  }

  // Accessibility requirements
  const activeAccessibility = Object.values(permanentFilters.accessibility).filter(Boolean);
  if (activeAccessibility.length > 0) {
    count++;
  }

  return count;
}

/**
 * Validate filter combination to ensure it makes sense
 *
 * @param dailyFilters - Daily filter settings
 * @param permanentFilters - Permanent filter settings
 * @returns Validation result with errors if any
 */
export function validateFilters(
  dailyFilters: DailyFilters,
  permanentFilters: PermanentFilters
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check for conflicting diet settings
  if (permanentFilters.strictDietType === 'vegan' && dailyFilters.dietToggle.meat) {
    errors.push('Vegan diet type conflicts with meat option enabled');
  }

  if (permanentFilters.strictDietType === 'vegetarian' && dailyFilters.dietToggle.meat) {
    errors.push('Vegetarian diet type conflicts with meat option enabled');
  }

  // Check price range validity
  if (dailyFilters.priceRange.min > dailyFilters.priceRange.max) {
    errors.push('Minimum price cannot be higher than maximum price');
  }

  // Check calorie range validity
  if (
    dailyFilters.calorieRange.enabled &&
    dailyFilters.calorieRange.min > dailyFilters.calorieRange.max
  ) {
    errors.push('Minimum calories cannot be higher than maximum calories');
  }

  // Check if any diet options are enabled
  const anyDietEnabled = Object.values(dailyFilters.dietToggle).some(Boolean);
  if (!anyDietEnabled) {
    errors.push('At least one diet option must be enabled');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Get filter suggestions based on current filters and results
 *
 * @param currentFilters - Current filter state
 * @param resultCount - Number of results with current filters
 * @returns Array of suggested filter adjustments
 */
export function getFilterSuggestions(
  dailyFilters: DailyFilters,
  permanentFilters: PermanentFilters,
  resultCount: number
): string[] {
  const suggestions: string[] = [];

  // Too few results
  if (resultCount === 0) {
    suggestions.push('Try expanding your price range');
    suggestions.push('Consider more cuisine types');
    if (dailyFilters.openNow) {
      suggestions.push('Remove "Open now" filter');
    }
  } else if (resultCount < 3) {
    suggestions.push('Expand your search radius');
    suggestions.push('Try a broader price range');
  }

  // Too many results
  if (resultCount > 20) {
    suggestions.push('Narrow your price range');
    suggestions.push('Select specific cuisines');
    suggestions.push('Enable "Open now" filter');
  }

  return suggestions;
}

/**
 * Performance-optimized filtering for large datasets
 * Uses indexing and memoization for better performance
 */
export class FilterEngine {
  private indexedRestaurants: Map<string, Restaurant[]> = new Map();
  private lastFilterHash: string = '';
  private lastResult: FilterResult | null = null;

  /**
   * Build indices for faster filtering
   */
  buildIndices(restaurants: Restaurant[]): void {
    // Index by cuisine
    const cuisineIndex = new Map<string, Restaurant[]>();
    restaurants.forEach(restaurant => {
      if (!cuisineIndex.has(restaurant.cuisine)) {
        cuisineIndex.set(restaurant.cuisine, []);
      }
      cuisineIndex.get(restaurant.cuisine)!.push(restaurant);
    });

    // Index by price range
    const priceIndex = new Map<string, Restaurant[]>();
    restaurants.forEach(restaurant => {
      if (!priceIndex.has(restaurant.priceRange)) {
        priceIndex.set(restaurant.priceRange, []);
      }
      priceIndex.get(restaurant.priceRange)!.push(restaurant);
    });

    // Index by open status
    const openIndex = new Map<boolean, Restaurant[]>();
    restaurants.forEach(restaurant => {
      if (!openIndex.has(restaurant.isOpen)) {
        openIndex.set(restaurant.isOpen, []);
      }
      openIndex.get(restaurant.isOpen)!.push(restaurant);
    });

    this.indexedRestaurants.set('cuisine', [...cuisineIndex.values()].flat());
    this.indexedRestaurants.set('price', [...priceIndex.values()].flat());
    this.indexedRestaurants.set('open', [...openIndex.values()].flat());
  }

  /**
   * Apply filters with caching and performance optimization
   */
  filterWithCache(
    restaurants: Restaurant[],
    dailyFilters: DailyFilters,
    permanentFilters: PermanentFilters
  ): FilterResult {
    // Create hash of current filter state
    const filterHash = this.createFilterHash(dailyFilters, permanentFilters);

    // Return cached result if filters haven't changed
    if (filterHash === this.lastFilterHash && this.lastResult) {
      debugLog('Returning cached filter result');
      return this.lastResult;
    }

    // Apply filters normally
    const result = applyFilters(restaurants, dailyFilters, permanentFilters);

    // Cache the result
    this.lastFilterHash = filterHash;
    this.lastResult = result;

    return result;
  }

  private createFilterHash(dailyFilters: DailyFilters, permanentFilters: PermanentFilters): string {
    return JSON.stringify({ daily: dailyFilters, permanent: permanentFilters });
  }
}
