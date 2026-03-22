/**
 * Supabase Edge Functions API Client
 *
 * This service handles all communication with Supabase Edge Functions
 * for server-side filtering and recommendation.
 */

import { DailyFilters, PermanentFilters } from '../stores/filterStore';

// Get from environment variables
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const EDGE_FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;

/**
 * Dish from server (matches Edge Function response)
 */
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

  // Arrays from database
  allergens: string[];
  dietary_tags: string[];

  // Restaurant info (joined)
  restaurant?: {
    id: string;
    name: string;
    cuisine_types: string[];
    rating: number;
  };

  // Distance from user
  distance_km?: number;

  // Score from recommendation engine
  score?: number;

  /**
   * Display names of ingredients the user wants to avoid that are present
   * in this dish. Empty array = no flagged ingredients. The dish is still
   * shown — this is a soft warning, not a hard exclusion.
   */
  flagged_ingredients: string[];
}

/** Maps filterStore allergy keys to allergens.code values used in dishes.allergens TEXT[]. */
const ALLERGY_CODE_MAP: Partial<Record<keyof PermanentFilters['allergies'], string>> = {
  soy: 'soybeans',
  nuts: 'tree_nuts',
};

/**
 * Feed request parameters
 */
export interface FeedRequest {
  location: { lat: number; lng: number };
  radius?: number; // km, default 10
  mode?: 'dishes' | 'restaurants';
  filters: {
    priceRange?: [number, number];
    dietPreference?: string; // hard — permanent
    preferredDiet?: string; // soft boost — daily
    calorieRange?: { min: number; max: number }; // soft boost
    allergens?: string[]; // hard
    religiousRestrictions?: string[]; // hard
    cuisines?: string[]; // soft boost
    spiceLevel?: string; // soft boost — daily spice preference
    spiceTolerance?: string; // soft boost — permanent spice tolerance
    favoriteCuisines?: string[]; // soft boost — permanent favourite cuisines
    sortBy?: 'closest' | 'bestMatch' | 'highestRated';
    openNow?: boolean; // hard — restaurant mode only
    /**
     * canonical_ingredient_id UUIDs from the user's "Ingredients to Avoid" list.
     * Dishes containing these are annotated (flagged_ingredients), not excluded.
     */
    flagIngredients?: string[];
    /**
     * Dish/meal type keywords selected by the user (e.g. "Pizza", "Burger").
     * Dishes whose names contain any of these terms receive a strong score boost.
     */
    dishNames?: string[];
  };
  userId?: string;
  limit?: number; // default 20
}

/**
 * Restaurant returned in mode:'restaurants' response
 */
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

/**
 * Feed response from Edge Function (dishes mode)
 */
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

/**
 * Feed response from Edge Function (restaurants mode)
 */
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

/** Shared fetch helper to avoid repeating headers. */
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
    const errorData = await response.json().catch(() => ({}));
    throw new Error((errorData as any).error || 'Failed to fetch feed');
  }
  return response;
}

/** Build the shared filter payload from store filter state. */
function buildFilters(
  dailyFilters: DailyFilters,
  permanentFilters: PermanentFilters
): FeedRequest['filters'] {
  const activeReligious = (
    Object.entries(permanentFilters.religiousRestrictions) as [string, boolean][]
  )
    .filter(([_, active]) => active)
    .map(([key]) => key);

  return {
    priceRange: [dailyFilters.priceRange.min, dailyFilters.priceRange.max] as [number, number],
    dietPreference: permanentFilters.dietPreference,
    preferredDiet:
      Object.entries(dailyFilters.dietPreference)
        .filter(([_, active]) => active)
        .map(([key]) => key)[0] ?? undefined,
    calorieRange: dailyFilters.calorieRange.enabled
      ? { min: dailyFilters.calorieRange.min, max: dailyFilters.calorieRange.max }
      : undefined,
    allergens: Object.entries(permanentFilters.allergies)
      .filter(([_, active]) => active)
      .map(
        ([allergen]) =>
          ALLERGY_CODE_MAP[allergen as keyof PermanentFilters['allergies']] ?? allergen
      ),
    religiousRestrictions: activeReligious.length > 0 ? activeReligious : undefined,
    cuisines: dailyFilters.cuisineTypes.length > 0 ? dailyFilters.cuisineTypes : undefined,
    spiceLevel: dailyFilters.spiceLevel !== 'eitherWay' ? dailyFilters.spiceLevel : undefined,
    flagIngredients:
      permanentFilters.ingredientsToAvoid.length > 0
        ? permanentFilters.ingredientsToAvoid.map(i => i.canonicalIngredientId)
        : undefined,
    dishNames: dailyFilters.meals.length > 0 ? dailyFilters.meals : undefined,
  };
}

/**
 * Get personalized dish feed from server (mode: 'dishes')
 */
// trackSwipe(), SwipeRequest, and generateSessionId() have been shelved.
// See shelf/swipe-feature/services/swipeService.ts
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

/**
 * Get filtered and scored restaurant list from the Edge Function (mode: 'restaurants').
 * Replaces the client-side filterService.applyFilters() call in BasicMapScreen.
 */
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
      openNow: dailyFilters.openNow,
    },
    userId,
    limit: 50,
  };
  const response = await callFeedFunction(request);
  return response.json();
}
