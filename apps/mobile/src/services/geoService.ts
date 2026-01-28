/**
 * Geospatial Service - Supabase Edge Function Integration
 *
 * Handles communication with the nearby-restaurants Edge Function
 * for efficient server-side geospatial queries and filtering.
 */

import { supabase } from '../lib/supabase';
import { DailyFilters, PermanentFilters } from '../stores/filterStore';

export interface NearbyRestaurantsRequest {
  latitude: number;
  longitude: number;
  radiusKm?: number;
  limit?: number;
  filters?: {
    cuisines?: string[];
    priceMin?: number;
    priceMax?: number;
    minRating?: number;
    dietaryTags?: string[];
    excludeAllergens?: string[];
    serviceTypes?: string[];
  };
}

export interface RestaurantWithDistance {
  id: string;
  name: string;
  location: { lat: number; lng: number };
  address: string;
  city?: string;
  country_code?: string;
  cuisine_types: string[];
  restaurant_type: string;
  rating: number;
  phone?: string;
  website?: string;
  delivery_available: boolean;
  takeout_available: boolean;
  dine_in_available: boolean;
  service_speed?: string;
  distance: number;
  menus?: Array<{
    id: string;
    name: string;
    is_active: boolean;
    dishes?: Array<{
      id: string;
      name: string;
      price: number;
      dietary_tags?: string[];
      allergens?: string[];
      spice_level?: number;
      is_available: boolean;
    }>;
  }>;
}

export interface NearbyRestaurantsResponse {
  restaurants: RestaurantWithDistance[];
  totalCount: number;
  searchRadius: number;
  centerPoint: { latitude: number; longitude: number };
  appliedFilters: any;
}

/**
 * Convert app filters to Edge Function filter format
 */
function buildEdgeFunctionFilters(daily: DailyFilters, permanent: PermanentFilters) {
  const filters: any = {};

  // Cuisines filter
  if (daily.cuisines && daily.cuisines.length > 0) {
    filters.cuisines = daily.cuisines;
  }

  // Price range filter
  if (daily.priceRange) {
    filters.priceMin = daily.priceRange.min;
    filters.priceMax = daily.priceRange.max;
  }

  // Dietary tags (from permanent filters)
  const dietaryTags: string[] = [];
  if (permanent.dietPreference === 'vegan') {
    dietaryTags.push('vegan');
  } else if (permanent.dietPreference === 'vegetarian') {
    dietaryTags.push('vegetarian');
  }

  // Add protein type preferences as dietary tags
  if (permanent.proteinTypes && permanent.proteinTypes.length > 0) {
    // This is a simplification - you may want more sophisticated mapping
    if (!permanent.proteinTypes.includes('meat') && !permanent.proteinTypes.includes('poultry')) {
      dietaryTags.push('vegetarian');
    }
  }

  if (dietaryTags.length > 0) {
    filters.dietaryTags = dietaryTags;
  }

  // Allergens to exclude (from permanent filters)
  if (permanent.allergies && permanent.allergies.length > 0) {
    filters.excludeAllergens = permanent.allergies;
  }

  // Service types (from daily filters - what's available)
  const serviceTypes: string[] = [];
  if (daily.serviceTypes) {
    if (daily.serviceTypes.delivery) serviceTypes.push('delivery');
    if (daily.serviceTypes.takeout) serviceTypes.push('takeout');
    if (daily.serviceTypes.dineIn) serviceTypes.push('dine_in');
  }
  if (serviceTypes.length > 0) {
    filters.serviceTypes = serviceTypes;
  }

  return Object.keys(filters).length > 0 ? filters : undefined;
}

/**
 * Fetch nearby restaurants using Supabase Edge Function
 */
export async function fetchNearbyRestaurants(
  latitude: number,
  longitude: number,
  radiusKm: number = 5,
  dailyFilters?: DailyFilters,
  permanentFilters?: PermanentFilters,
  limit: number = 50
): Promise<NearbyRestaurantsResponse> {
  try {
    // Build filters from app state
    const filters = buildEdgeFunctionFilters(
      dailyFilters || ({} as DailyFilters),
      permanentFilters || ({} as PermanentFilters)
    );

    // Call Edge Function
    const { data, error } = await supabase.functions.invoke('nearby-restaurants', {
      body: {
        latitude,
        longitude,
        radiusKm,
        limit,
        filters,
      },
    });

    if (error) {
      console.error('[GeoService] Edge Function error:', error);
      throw new Error(`Failed to fetch nearby restaurants: ${error.message}`);
    }

    if (!data) {
      throw new Error('No data returned from Edge Function');
    }

    console.log(`[GeoService] Found ${data.totalCount} restaurants within ${radiusKm}km`);

    return data as NearbyRestaurantsResponse;
  } catch (err) {
    console.error('[GeoService] Unexpected error:', err);
    throw err;
  }
}

/**
 * Fetch nearby restaurants with automatic current location
 * Uses device geolocation
 */
export async function fetchNearbyRestaurantsFromCurrentLocation(
  getCurrentLocation: () => Promise<{ latitude: number; longitude: number }>,
  radiusKm: number = 5,
  dailyFilters?: DailyFilters,
  permanentFilters?: PermanentFilters,
  limit: number = 50
): Promise<NearbyRestaurantsResponse> {
  try {
    // Get current location
    const location = await getCurrentLocation();

    // Fetch restaurants
    return await fetchNearbyRestaurants(
      location.latitude,
      location.longitude,
      radiusKm,
      dailyFilters,
      permanentFilters,
      limit
    );
  } catch (err) {
    console.error('[GeoService] Failed to get location or fetch restaurants:', err);
    throw err;
  }
}

/**
 * Convert distance in kilometers to human-readable string
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)}m`;
  }
  return `${distanceKm.toFixed(1)}km`;
}
