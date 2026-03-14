/**
 * Filter Service - Data filtering algorithms for restaurants and dishes
 *
 * Implements efficient filtering algorithms that apply both daily and permanent
 * filters to restaurant/dish data with proper validation and error handling.
 */

import { DailyFilters, PermanentFilters } from '../stores/filterStore';
import { debugLog } from '../config/environment';

/**
 * Estimate an average spend (in the user's local currency) for a restaurant
 * when no explicit price_range data is available in the DB.
 *
 * The mapping is based on `service_speed` (primary signal) and
 * `restaurant_type` (secondary signal). Values are intentionally mid-range
 * so they sit inside the filter slider's default 10–50 window.
 *
 * @returns A number in the same currency unit used by the price-range filter.
 */
export function estimateAvgPrice(
  serviceSpeed?: string | null,
  restaurantType?: string | null
): number {
  if (serviceSpeed === 'fast-food') return 12;
  switch (restaurantType) {
    case 'fine_dining':
      return 55;
    case 'cafe':
    case 'bakery':
    case 'food_stall':
    case 'food_truck':
      return 15;
    case 'buffet':
      return 22;
    default:
      return 25; // restaurant / self_service / ghost_kitchen / other
  }
}

// Restaurant type used by filter service
export interface Restaurant {
  id: string;
  name: string;
  cuisine: string;
  /** Estimated average price in local currency */
  avgPrice: number;
  rating: number;
  coordinates: [number, number];
  address: string;
  isOpen: boolean;
  /** Distance from the user in kilometres — populated from the nearby-restaurants Edge Function. */
  distanceKm?: number;
  /**
   * Dietary certifications held by the restaurant (e.g. 'halal', 'kosher', 'vegan', 'vegetarian').
   * Sourced from the DB `dietary_certifications` column.
   */
  dietaryCertifications?: string[];
}

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
  permanentFilters: PermanentFilters,
  defaultPriceRange: { min: number; max: number } = { min: 10, max: 50 }
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
  dailyFilterCount = getDailyFilterCount(dailyFilters, defaultPriceRange);

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

  // Diet preference filter — uses the restaurant's dietary_certifications from the DB
  if (permanentFilters.dietPreference !== 'all') {
    filtered = filtered.filter(restaurant => {
      const certs = restaurant.dietaryCertifications ?? [];
      switch (permanentFilters.dietPreference) {
        case 'vegan':
          return certs.includes('vegan');
        case 'vegetarian':
          return certs.includes('vegetarian') || certs.includes('vegan');
        default:
          return true;
      }
    });
    filterSummary.push(`Diet: ${permanentFilters.dietPreference}`);
  }

  // Allergy filters (exclude restaurants that can't accommodate)
  const activeAllergies = Object.entries(permanentFilters.allergies)
    .filter(([_, active]) => active)
    .map(([allergy, _]) => allergy);

  if (activeAllergies.length > 0) {
    // Allergen filtering is enforced at dish level via the feed Edge Function.
    // At the restaurant level we surface the active constraints in the summary only.
    filterSummary.push(`Allergies: ${activeAllergies.join(', ')}`);
  }

  // Religious restrictions
  const activeReligious = Object.entries(permanentFilters.religiousRestrictions)
    .filter(([_, active]) => active)
    .map(([requirement, _]) => requirement);

  if (activeReligious.length > 0) {
    // Filter by dietary certifications stored on the restaurant record.
    filtered = filtered.filter(restaurant => {
      const certs = restaurant.dietaryCertifications ?? [];
      return activeReligious.every(r => certs.includes(r));
    });
    filterSummary.push(`Religious: ${activeReligious.join(', ')}`);
  }

  // Restaurant facilities
  const activeFacilities = Object.entries(permanentFilters.facilities)
    .filter(([_, active]) => active)
    .map(([facility, _]) => facility);

  if (activeFacilities.length > 0) {
    // Facility data is not yet available in the restaurant feed.
    // Constraint is surfaced in the summary for future enforcement.
    filterSummary.push(`Facilities: ${activeFacilities.join(', ')}`);
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

  // Price range filter — compare estimated restaurant avgPrice against slider values (10–50)
  if (dailyFilters.priceRange.min > 10 || dailyFilters.priceRange.max < 50) {
    filtered = filtered.filter(
      restaurant =>
        restaurant.avgPrice >= dailyFilters.priceRange.min &&
        restaurant.avgPrice <= dailyFilters.priceRange.max
    );
    filterSummary.push(`Price: ${dailyFilters.priceRange.min}–${dailyFilters.priceRange.max}`);
  }

  // Cuisine types filter
  if (dailyFilters.cuisineTypes.length > 0) {
    filtered = filtered.filter(restaurant =>
      dailyFilters.cuisineTypes.includes(restaurant.cuisine)
    );
    filterSummary.push(`Cuisines: ${dailyFilters.cuisineTypes.join(', ')}`);
  }

  // Diet preference filter — uses the restaurant's dietary_certifications from the DB
  const { vegetarian: wantsVegetarian, vegan: wantsVegan } = dailyFilters.dietPreference;
  if (wantsVegetarian || wantsVegan) {
    filtered = filtered.filter(restaurant => {
      const certs = restaurant.dietaryCertifications ?? [];
      if (wantsVegan) return certs.includes('vegan');
      if (wantsVegetarian) return certs.includes('vegetarian') || certs.includes('vegan');
      return true;
    });
    const labels = [wantsVegetarian && 'Vegetarian', wantsVegan && 'Vegan'].filter(Boolean);
    filterSummary.push(`Diet: ${labels.join(', ')}`);
  }

  // Protein type filters — applied at dish level via the feed Edge Function.
  // At the restaurant level we surface the active constraints in the summary only.
  const selectedProteins = Object.entries(dailyFilters.proteinTypes)
    .filter(([_, enabled]) => enabled)
    .map(([protein, _]) => protein);

  if (selectedProteins.length > 0) {
    filterSummary.push(`Proteins: ${selectedProteins.join(', ')}`);
  }

  // Open now filter
  if (dailyFilters.openNow) {
    filtered = filtered.filter(restaurant => restaurant.isOpen);
    filterSummary.push('Open now');
  }

  // Calorie range filter — applied at dish level via the feed Edge Function.
  // At the restaurant level we surface the active constraint in the summary only.
  if (dailyFilters.calorieRange.enabled) {
    filterSummary.push(
      `Calories: ${dailyFilters.calorieRange.min}–${dailyFilters.calorieRange.max}`
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
      // Sort by pre-computed distance from the nearby-restaurants Edge Function.
      // Restaurants without a distanceKm value are pushed to the end.
      return sorted.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));

    case 'highestRated':
      return sorted.sort((a, b) => b.rating - a.rating);

    case 'bestMatch':
    default:
      return sorted.sort((a, b) => {
        const aScore =
          a.rating * 2 + (a.isOpen ? 0.5 : 0) + (a.distanceKm != null ? 1 / (a.distanceKm + 1) : 0);
        const bScore =
          b.rating * 2 + (b.isOpen ? 0.5 : 0) + (b.distanceKm != null ? 1 / (b.distanceKm + 1) : 0);
        return bScore - aScore;
      });
  }
}

/**
 * Count active daily filters
 */
function getDailyFilterCount(
  dailyFilters: DailyFilters,
  defaultPriceRange: { min: number; max: number } = { min: 10, max: 50 }
): number {
  let count = 0;

  // Price range (not default)
  if (
    dailyFilters.priceRange.min !== defaultPriceRange.min ||
    dailyFilters.priceRange.max !== defaultPriceRange.max
  ) {
    count++;
  }

  // Cuisines
  if (dailyFilters.cuisineTypes.length > 0) {
    count++;
  }

  // Check diet preference (any enabled)
  if (Object.values(dailyFilters.dietPreference).some(Boolean)) {
    count++;
  }

  // Check protein types
  const hasProteinFilter = Object.values(dailyFilters.proteinTypes).some(Boolean);
  if (hasProteinFilter) {
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

  // Religious restrictions
  const activeReligious = Object.values(permanentFilters.religiousRestrictions).filter(Boolean);
  if (activeReligious.length > 0) {
    count++;
  }

  // Diet preference
  if (permanentFilters.dietPreference !== 'all') {
    count++;
  }

  // Restaurant facilities
  const activeFacilities = Object.values(permanentFilters.facilities).filter(Boolean);
  if (activeFacilities.length > 0) {
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
  // Check diet conflicts
  if (permanentFilters.dietPreference === 'vegan' && dailyFilters.proteinTypes.meat) {
    errors.push('Vegan diet conflicts with meat protein selection');
  }

  if (permanentFilters.dietPreference === 'vegetarian' && dailyFilters.proteinTypes.meat) {
    errors.push('Vegetarian diet conflicts with meat protein selection');
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

  // Note: Diet settings are optional, so no validation error needed

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

    // Price range filtering done server-side via Edge Functions
    const openIndex = new Map<boolean, Restaurant[]>();
    restaurants.forEach(restaurant => {
      if (!openIndex.has(restaurant.isOpen)) {
        openIndex.set(restaurant.isOpen, []);
      }
      openIndex.get(restaurant.isOpen)!.push(restaurant);
    });

    this.indexedRestaurants.set('cuisine', [...cuisineIndex.values()].flat());
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
