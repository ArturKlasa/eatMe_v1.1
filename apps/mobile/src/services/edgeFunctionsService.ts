import { DailyFilters, PermanentFilters } from '../stores/filterStore';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const EDGE_FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;

export interface AppliedOption {
  option_id: string;
  group_name: string;
  group_display_in_card: boolean;
  name: string;
  primary_protein: string | null;
  price_delta: number;
}

export interface ServerDish {
  id: string;
  restaurant_id: string;
  name: string;
  description?: string;
  price: number;
  calories?: number;
  image_url?: string;
  spice_level?: 'none' | 'mild' | 'hot';
  is_available: boolean;

  // Phase 5 dish-model fields. The feed function applies default options +
  // user-preference selections and emits the resolved values here. Fallback to
  // base fields when absent (older feed function or non-customisable dish).
  effective_price?: number;
  effective_primary_protein?: string | null;
  applied_options?: AppliedOption[];
  dining_format?: string | null;
  bundled_items?: Array<{ name: string; note?: string | null }> | null;

  restaurant?: {
    id: string;
    name: string;
    cuisine_types: string[];
    rating: number;
    currency_code?: string;
  };

  distance_km?: number;
  score?: number;
}

/**
 * Compose the card-displayed dish name using the Hybrid A+C rule:
 *   A — group_display_in_card=true on the applied option's group, OR
 *   C — option's primary_protein is non-null (introducing protein → descriptive)
 *
 * "Pad Thai" with applied protein=Chicken → "Pad Thai with chicken"
 * "Margherita" with no descriptors → "Margherita"
 * Capped at 2 descriptors; further options collapse to "+N more".
 */
export function composeCardName(dish: ServerDish): string {
  const descriptors = (dish.applied_options ?? [])
    .filter(opt => opt.group_display_in_card || opt.primary_protein !== null)
    .map(opt => opt.name);
  if (descriptors.length === 0) return dish.name;
  if (descriptors.length === 1) return `${dish.name} with ${descriptors[0]}`;
  if (descriptors.length === 2) return `${dish.name} with ${descriptors[0]} and ${descriptors[1]}`;
  return `${dish.name} with ${descriptors[0]} (+${descriptors.length - 1} more)`;
}

export interface FeedRequest {
  location: { lat: number; lng: number };
  radius?: number; // km, default 10
  mode?: 'dishes' | 'restaurants' | 'combined';
  filters: {
    priceRange?: [number, number];
    dietPreference?: string; // hard — permanent
    preferredDiet?: string; // soft boost — daily
    calorieRange?: { min: number; max: number }; // soft boost
    cuisines?: string[]; // soft boost
    spiceLevel?: string; // soft boost — daily spice preference
    sortBy?: 'closest' | 'bestMatch' | 'highestRated';
    openNow?: boolean; // hard — restaurant mode only
    /**
     * Dish/meal type keywords selected by the user (e.g. "Pizza", "Burger").
     * Dishes whose names contain any of these terms receive a strong score boost.
     */
    dishNames?: string[];
    /**
     * Active protein type selections from the daily filter (e.g. ['meat', 'fish', 'seafood', 'egg']).
     * Mapped from daily.proteinTypes booleans. Dishes matching these families receive a +0.20 boost.
     */
    proteinTypes?: string[];
    /**
     * Active meat subtype selections from the daily filter (e.g. ['chicken', 'beef']).
     * Only relevant when 'meat' is in proteinTypes. Adds a further +0.10 boost for exact matches.
     */
    meatTypes?: string[];
    /**
     * Ingredient families to hard-exclude from the candidate pool (permanent permanent settings:
     * noMeat → ['meat','poultry'], noFish → ['fish'], noSeafood → ['shellfish'],
     * noEggs → ['eggs'], noDairy → ['dairy']). Matches dishes.protein_families.
     */
    excludeFamilies?: string[];
    /** When true, dishes with spice_level='hot' are hard-excluded (permanent noSpicy setting). */
    excludeSpicy?: boolean;
    /** Filter for daily/rotating menus only. null = all menus. */
    scheduleType?: 'daily' | 'rotating';
    /** When true, only return dishes with serves >= 2 (group/family meals). */
    groupMeals?: boolean;
    /** Current time in HH:MM format for time-based menu filtering. */
    currentTime?: string;
    /** Current day of week: 'mon'|'tue'|'wed'|'thu'|'fri'|'sat'|'sun' */
    currentDayOfWeek?: string;
  };
  userId?: string;
  limit?: number; // default 20
}

export interface ServerRestaurant {
  id: string;
  name: string;
  cuisine_types: string[];
  rating: number;
  distance_km: number;
  score: number;
  is_open?: boolean;
  location?: { lat: number; lng: number } | null;
}

export interface FeedResponse {
  dishes: ServerDish[];
  metadata: {
    totalAvailable: number;
    returned: number;
    cached: boolean;
    personalized?: boolean;
    userInteractions?: number;
    processingTime?: number;
  };
}

export interface RestaurantFeedResponse {
  restaurants: ServerRestaurant[];
  metadata: {
    totalAvailable: number;
    returned: number;
    cached: boolean;
    personalized?: boolean;
    processingTime?: number;
  };
}

export interface CombinedFeedResponse {
  dishes: ServerDish[];
  restaurants: ServerRestaurant[];
  metadata: {
    totalAvailable: number;
    returnedDishes: number;
    returnedRestaurants: number;
    cached: boolean;
    personalized?: boolean;
    processingTime?: number;
    userInteractions?: number;
  };
}

async function callFeedFunction(request: FeedRequest): Promise<Response> {
  const response = await fetch(`${EDGE_FUNCTIONS_URL}/feed`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(errorData.error || 'Failed to fetch feed');
  }
  return response;
}

function buildFilters(
  dailyFilters: DailyFilters,
  permanentFilters: PermanentFilters
): FeedRequest['filters'] {
  // preferredDiet is a soft signal (+0.50 boost), NOT a hard block — non-matching dishes still fill the feed.
  const dailyDietKey =
    dailyFilters.dietPreference !== 'all' ? dailyFilters.dietPreference : undefined;

  return {
    priceRange: [dailyFilters.priceRange.min, dailyFilters.priceRange.max] as [number, number],
    dietPreference: permanentFilters.dietPreference,
    preferredDiet: dailyDietKey,
    calorieRange: dailyFilters.calorieRange.enabled
      ? { min: dailyFilters.calorieRange.min, max: dailyFilters.calorieRange.max }
      : undefined,
    cuisines: dailyFilters.cuisineTypes.length > 0 ? dailyFilters.cuisineTypes : undefined,
    spiceLevel: dailyFilters.spiceLevel !== 'eitherWay' ? dailyFilters.spiceLevel : undefined,
    dishNames: dailyFilters.meals.length > 0 ? dailyFilters.meals : undefined,
    proteinTypes: (() => {
      const active = (Object.entries(dailyFilters.proteinTypes) as [string, boolean][])
        .filter(([_, on]) => on)
        .map(([key]) => key);
      return active.length > 0 ? active : undefined;
    })(),
    meatTypes: (() => {
      const active = (Object.entries(dailyFilters.meatTypes) as [string, boolean][])
        .filter(([_, on]) => on)
        .map(([key]) => key);
      return active.length > 0 ? active : undefined;
    })(),
    excludeFamilies: (() => {
      const map: Record<string, string[]> = {
        noMeat: ['meat', 'poultry'],
        noFish: ['fish'],
        noSeafood: ['shellfish'],
        noEggs: ['eggs'],
      };
      const families = (Object.entries(permanentFilters.exclude) as [string, boolean][])
        .filter(([_, on]) => on)
        .flatMap(([key]) => map[key] ?? []);
      return families.length > 0 ? families : undefined;
    })(),
    excludeSpicy: permanentFilters.exclude.noSpicy || undefined,
    // openNow is intentionally omitted — restaurants without open_hours data
    // (null) would be treated as closed and filtered out, emptying the dish pool.
    // The isOpen flag is still computed and returned per-restaurant for display.
    groupMeals: dailyFilters.groupMeals || undefined,
    scheduleType: dailyFilters.scheduleType ?? undefined,
    currentTime: new Date().toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }),
    currentDayOfWeek: (['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const)[
      new Date().getDay()
    ],
  };
}

/** Get personalized dish feed (mode: 'dishes'). */
export async function getFeed(
  location: { lat: number; lng: number },
  dailyFilters: DailyFilters,
  permanentFilters: PermanentFilters,
  userId?: string,
  radius: number = 10
): Promise<FeedResponse> {
  const request: FeedRequest = {
    location,
    radius,
    mode: 'dishes',
    filters: buildFilters(dailyFilters, permanentFilters),
    userId,
    limit: 20,
  };
  const response = await callFeedFunction(request);
  return response.json();
}

/** Get filtered/scored restaurant list (mode: 'restaurants'). */
export async function getFilteredRestaurants(
  location: { lat: number; lng: number },
  dailyFilters: DailyFilters,
  permanentFilters: PermanentFilters,
  userId?: string,
  radius: number = 10
): Promise<RestaurantFeedResponse> {
  const request: FeedRequest = {
    location,
    radius,
    mode: 'restaurants',
    filters: {
      ...buildFilters(dailyFilters, permanentFilters),
      sortBy: dailyFilters.sortBy,
    },
    userId,
    limit: 50,
  };
  const response = await callFeedFunction(request);
  return response.json();
}

/** Get dishes + restaurants in a single call (mode: 'combined'). */
export async function getCombinedFeed(
  location: { lat: number; lng: number },
  dailyFilters: DailyFilters,
  permanentFilters: PermanentFilters,
  userId?: string,
  radius: number = 10
): Promise<CombinedFeedResponse> {
  const request: FeedRequest = {
    location,
    radius,
    mode: 'combined',
    filters: {
      ...buildFilters(dailyFilters, permanentFilters),
      sortBy: dailyFilters.sortBy,
    },
    userId,
    limit: 20,
  };
  const response = await callFeedFunction(request);
  return response.json();
}
