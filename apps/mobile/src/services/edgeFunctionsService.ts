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
  spice_level?: number;
  is_available: boolean;

  // Arrays from database
  allergens: string[];
  dietary_tags: string[];
  ingredients: string[];

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
}

/**
 * Feed request parameters
 */
export interface FeedRequest {
  location: {
    lat: number;
    lng: number;
  };
  radius?: number; // km, default 10
  filters: {
    priceRange?: [number, number];
    dietPreference?: string; // hard filter — permanent filters
    preferredDiet?: string; // soft boost — daily filters
    calorieRange?: { min: number; max: number };
    allergens?: string[];
    cuisines?: string[];
  };
  userId?: string;
  limit?: number; // default 20
}

/**
 * Feed response from Edge Function
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
 * Swipe request parameters
 */
export interface SwipeRequest {
  userId: string;
  dishId: string;
  action: 'left' | 'right' | 'super';
  viewDuration?: number; // milliseconds
  position?: number; // position in feed
  sessionId?: string;
}

/**
 * Get personalized dish feed from server
 */
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
    filters: {
      priceRange: [dailyFilters.priceRange.min, dailyFilters.priceRange.max],
      // Permanent diet preference → hard filter (excludes non-matching dishes)
      dietPreference: permanentFilters.dietPreference,
      // Daily diet preference → soft boost (dishes matching get scored higher)
      preferredDiet: dailyFilters.dietPreference,
      calorieRange: dailyFilters.calorieRange.enabled
        ? { min: dailyFilters.calorieRange.min, max: dailyFilters.calorieRange.max }
        : undefined,
      allergens: Object.entries(permanentFilters.allergies)
        .filter(([_, active]) => active)
        .map(([allergen]) => allergen),
      cuisines: dailyFilters.cuisineTypes,
    },
    userId,
    limit: 20,
  };

  const response = await fetch(`${EDGE_FUNCTIONS_URL}/feed`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to fetch feed');
  }

  return response.json();
}

/**
 * Track user swipe action
 */
export async function trackSwipe(
  userId: string,
  dishId: string,
  action: 'left' | 'right' | 'super',
  viewDuration?: number,
  position?: number,
  sessionId?: string
): Promise<{ success: boolean }> {
  const request: SwipeRequest = {
    userId,
    dishId,
    action,
    viewDuration,
    position,
    sessionId,
  };

  const response = await fetch(`${EDGE_FUNCTIONS_URL}/swipe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to track swipe');
  }

  return response.json();
}

/**
 * Generate unique session ID
 */
export function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
