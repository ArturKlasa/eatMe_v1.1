import { DailyFilters, PermanentFilters } from '../stores/filterStore';
import { debugLog } from '../config/environment';

/** Estimate average spend when no explicit price_range is in the DB. Values fit the 10–50 slider default. */
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

/** Lightweight restaurant shape for filter/sort algorithms, decoupled from full Supabase response. */
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
}

export interface FilterResult {
  restaurants: Restaurant[];
  totalCount: number;
  appliedFilters: {
    daily: number;
    permanent: number;
  };
  filterSummary: string[];
}

/** Apply all active filters to restaurant data. */
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

  filteredRestaurants = applyPermanentFilters(filteredRestaurants, permanentFilters, filterSummary);
  permanentFilterCount = getPermanentFilterCount(permanentFilters);

  filteredRestaurants = applyDailyFilters(filteredRestaurants, dailyFilters, filterSummary);
  dailyFilterCount = getDailyFilterCount(dailyFilters, defaultPriceRange);

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

function applyPermanentFilters(
  restaurants: Restaurant[],
  permanentFilters: PermanentFilters,
  filterSummary: string[]
): Restaurant[] {
  let filtered = restaurants;

  if (permanentFilters.dietPreference !== 'all') {
    // Diet is enforced at dish level via the feed Edge Function (generate_candidates).
    // Surface the constraint in the summary only.
    filterSummary.push(`Diet: ${permanentFilters.dietPreference}`);
  }

  const activeAllergies = Object.entries(permanentFilters.allergies)
    .filter(([_, active]) => active)
    .map(([allergy, _]) => allergy);

  if (activeAllergies.length > 0) {
    // Allergen filtering is enforced at dish level via the feed Edge Function.
    // At the restaurant level we surface the active constraints in the summary only.
    filterSummary.push(`Allergies: ${activeAllergies.join(', ')}`);
  }

  const activeReligious = Object.entries(permanentFilters.religiousRestrictions)
    .filter(([_, active]) => active)
    .map(([requirement, _]) => requirement);

  if (activeReligious.length > 0) {
    // Religious restrictions are enforced at dish level via the feed Edge Function.
    filterSummary.push(`Religious: ${activeReligious.join(', ')}`);
  }

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

function applyDailyFilters(
  restaurants: Restaurant[],
  dailyFilters: DailyFilters,
  filterSummary: string[]
): Restaurant[] {
  let filtered = restaurants;

  if (dailyFilters.priceRange.min > 10 || dailyFilters.priceRange.max < 50) {
    filtered = filtered.filter(
      restaurant =>
        restaurant.avgPrice >= dailyFilters.priceRange.min &&
        restaurant.avgPrice <= dailyFilters.priceRange.max
    );
    filterSummary.push(`Price: ${dailyFilters.priceRange.min}–${dailyFilters.priceRange.max}`);
  }

  if (dailyFilters.cuisineTypes.length > 0) {
    filtered = filtered.filter(restaurant =>
      dailyFilters.cuisineTypes.includes(restaurant.cuisine)
    );
    filterSummary.push(`Cuisines: ${dailyFilters.cuisineTypes.join(', ')}`);
  }

  const { vegetarian: wantsVegetarian, vegan: wantsVegan } = dailyFilters.dietPreference;
  if (wantsVegetarian || wantsVegan) {
    // Enforced at dish level via the feed Edge Function; summary only here.
    const labels = [wantsVegetarian && 'Vegetarian', wantsVegan && 'Vegan'].filter(Boolean);
    filterSummary.push(`Diet: ${labels.join(', ')}`);
  }

  // Protein type filters — applied at dish level via the feed Edge Function, surfaced in summary only.
  const selectedProteins = Object.entries(dailyFilters.proteinTypes)
    .filter(([_, enabled]) => enabled)
    .map(([protein, _]) => protein);

  if (selectedProteins.length > 0) {
    filterSummary.push(`Proteins: ${selectedProteins.join(', ')}`);
  }

  if (dailyFilters.openNow) {
    filtered = filtered.filter(restaurant => restaurant.isOpen);
    filterSummary.push('Open now');
  }

  // Calorie range — applied at dish level via Edge Function, surfaced in summary only.
  if (dailyFilters.calorieRange.enabled) {
    filterSummary.push(
      `Calories: ${dailyFilters.calorieRange.min}–${dailyFilters.calorieRange.max}`
    );
  }

  return filtered;
}

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

function getDailyFilterCount(
  dailyFilters: DailyFilters,
  defaultPriceRange: { min: number; max: number } = { min: 10, max: 50 }
): number {
  let count = 0;

  if (
    dailyFilters.priceRange.min !== defaultPriceRange.min ||
    dailyFilters.priceRange.max !== defaultPriceRange.max
  ) {
    count++;
  }

  if (dailyFilters.cuisineTypes.length > 0) {
    count++;
  }

  if (Object.values(dailyFilters.dietPreference).some(Boolean)) {
    count++;
  }

  const hasProteinFilter = Object.values(dailyFilters.proteinTypes).some(Boolean);
  if (hasProteinFilter) {
    count++;
  }

  if (dailyFilters.calorieRange.enabled) {
    count++;
  }

  if (dailyFilters.openNow) {
    count++;
  }

  return count;
}

function getPermanentFilterCount(permanentFilters: PermanentFilters): number {
  let count = 0;

  const activeAllergies = Object.values(permanentFilters.allergies).filter(Boolean);
  if (activeAllergies.length > 0) {
    count++;
  }

  const activeReligious = Object.values(permanentFilters.religiousRestrictions).filter(Boolean);
  if (activeReligious.length > 0) {
    count++;
  }

  if (permanentFilters.dietPreference !== 'all') {
    count++;
  }

  const activeFacilities = Object.values(permanentFilters.facilities).filter(Boolean);
  if (activeFacilities.length > 0) {
    count++;
  }

  return count;
}

/** Validate filter combination for conflicts. */
export function validateFilters(
  dailyFilters: DailyFilters,
  permanentFilters: PermanentFilters
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (permanentFilters.dietPreference === 'vegan' && dailyFilters.proteinTypes.meat) {
    errors.push('Vegan diet conflicts with meat protein selection');
  }

  if (permanentFilters.dietPreference === 'vegetarian' && dailyFilters.proteinTypes.meat) {
    errors.push('Vegetarian diet conflicts with meat protein selection');
  }

  if (dailyFilters.priceRange.min > dailyFilters.priceRange.max) {
    errors.push('Minimum price cannot be higher than maximum price');
  }

  if (
    dailyFilters.calorieRange.enabled &&
    dailyFilters.calorieRange.min > dailyFilters.calorieRange.max
  ) {
    errors.push('Minimum calories cannot be higher than maximum calories');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/** Get filter suggestions based on current filters and result count. */
export function getFilterSuggestions(
  dailyFilters: DailyFilters,
  permanentFilters: PermanentFilters,
  resultCount: number
): string[] {
  const suggestions: string[] = [];

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

  if (resultCount > 20) {
    suggestions.push('Narrow your price range');
    suggestions.push('Select specific cuisines');
    suggestions.push('Enable "Open now" filter');
  }

  return suggestions;
}

/** Hash-based cache avoids re-running O(n) filter pipeline when data/filters haven't changed. */
export class FilterEngine {
  private indexedRestaurants: Map<string, Restaurant[]> = new Map();
  private lastFilterHash: string = '';
  private lastResult: FilterResult | null = null;

  /** Build indices for faster filtering. */
  buildIndices(restaurants: Restaurant[]): void {
    const cuisineIndex = new Map<string, Restaurant[]>();
    restaurants.forEach(restaurant => {
      if (!cuisineIndex.has(restaurant.cuisine)) {
        cuisineIndex.set(restaurant.cuisine, []);
      }
      cuisineIndex.get(restaurant.cuisine)!.push(restaurant);
    });

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

  /** Apply filters with caching. */
  filterWithCache(
    restaurants: Restaurant[],
    dailyFilters: DailyFilters,
    permanentFilters: PermanentFilters
  ): FilterResult {
    const filterHash = this.createFilterHash(dailyFilters, permanentFilters);

    if (filterHash === this.lastFilterHash && this.lastResult) {
      debugLog('Returning cached filter result');
      return this.lastResult;
    }

    const result = applyFilters(restaurants, dailyFilters, permanentFilters);

    this.lastFilterHash = filterHash;
    this.lastResult = result;

    return result;
  }

  private createFilterHash(dailyFilters: DailyFilters, permanentFilters: PermanentFilters): string {
    return JSON.stringify({ daily: dailyFilters, permanent: permanentFilters });
  }
}
