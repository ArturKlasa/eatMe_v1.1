// Supabase Edge Function: nearby-restaurants
// Purpose: Find restaurants near user's location with smart filtering
// Handles: Geospatial search using Haversine formula + price/cuisine filters

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// CORS headers for mobile app access
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Request interface
interface NearbyRestaurantsRequest {
  latitude: number;
  longitude: number;
  radiusKm?: number; // default: 5km
  limit?: number; // default: 50
  filters?: {
    cuisines?: string[];
    priceMin?: number;
    priceMax?: number;
    minRating?: number;
    serviceTypes?: string[]; // ['delivery', 'takeout', 'dine_in']
  };
}

// Response interface
interface RestaurantWithDistance {
  id: string;
  name: string;
  location: { lat: number; lng: number };
  address: string;
  city?: string;
  country_code?: string;
  // ISO 4217 (NOT NULL in DB after migration 147). Already streamed through
  // because the SELECT uses `*`; declared here so TS consumers can read it.
  currency_code?: string;
  cuisine_types: string[];
  restaurant_type: string;
  rating: number;
  phone?: string;
  website?: string;
  delivery_available: boolean;
  takeout_available: boolean;
  dine_in_available: boolean;
  service_speed?: string;
  distance: number; // in kilometers
  menus?: Array<{
    id: string;
    name: string;
    is_active: boolean;
    dishes?: Array<{
      id: string;
      name: string;
      price: number;
      spice_level?: 'none' | 'mild' | 'hot';
      is_available: boolean;
    }>;
  }>;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Check if restaurant matches service type filters
 */
function matchesServiceTypes(restaurant: any, serviceTypes?: string[]): boolean {
  if (!serviceTypes || serviceTypes.length === 0) return true;

  return serviceTypes.some(type => {
    switch (type) {
      case 'delivery':
        return restaurant.delivery_available;
      case 'takeout':
        return restaurant.takeout_available;
      case 'dine_in':
        return restaurant.dine_in_available;
      default:
        return false;
    }
  });
}

/**
 * Filter dishes to available items only.
 */
function filterDishes(dishes: any[]): any[] {
  if (!dishes) return [];
  return dishes.filter(dish => dish.is_available);
}

serve(async req => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // § Phase 2 telemetry gate: log every inbound request so we can monitor whether
  // any client still calls this endpoint after the feed Edge Function takes over
  // restaurant filtering. Once production traffic drops to zero for a full week,
  // this function can be removed from the registry.
  console.log('[nearby-restaurants] request received', {
    ts: new Date().toISOString(),
    ua: req.headers.get('user-agent'),
    referer: req.headers.get('referer'),
  });

  try {
    // Parse request body
    const {
      latitude,
      longitude,
      radiusKm = 5,
      limit = 50,
      filters,
    }: NearbyRestaurantsRequest = await req.json();

    // Validate required fields
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return new Response(
        JSON.stringify({
          error: 'Invalid request: latitude and longitude are required',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Build query - fetch restaurants with menus and dishes
    let query = supabase
      .from('restaurants')
      .select(
        `
        *,
        menus (
          id,
          name,
          is_active,
          dishes (
            id,
            name,
            price,
            spice_level,
            is_available
          )
        )
      `
      )
      .eq('status', 'published')
      .order('created_at', { ascending: false });

    // Apply cuisine filter if provided
    if (filters?.cuisines && filters.cuisines.length > 0) {
      query = query.overlaps('cuisine_types', filters.cuisines);
    }

    // Apply rating filter if provided
    if (filters?.minRating) {
      query = query.gte('rating', filters.minRating);
    }

    // Fetch data
    const { data: restaurants, error } = await query;

    if (error) {
      console.error('Database error:', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch restaurants' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!restaurants || restaurants.length === 0) {
      return new Response(
        JSON.stringify({
          restaurants: [],
          totalCount: 0,
          searchRadius: radiusKm,
          appliedFilters: filters || {},
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Calculate distances and filter by radius
    const restaurantsWithDistance: RestaurantWithDistance[] = restaurants
      .map((restaurant: any) => {
        const distance = calculateDistance(
          latitude,
          longitude,
          restaurant.location.lat,
          restaurant.location.lng
        );

        // Keep only available dishes per menu
        const filteredMenus = restaurant.menus?.map((menu: any) => ({
          ...menu,
          dishes: filterDishes(menu.dishes),
        }));

        return {
          ...restaurant,
          distance,
          menus: filteredMenus,
        };
      })
      .filter((restaurant: RestaurantWithDistance) => {
        // Filter by radius
        if (restaurant.distance > radiusKm) return false;

        // Filter by service types
        if (!matchesServiceTypes(restaurant, filters?.serviceTypes)) {
          return false;
        }

        return true;
      })
      .sort((a, b) => a.distance - b.distance) // Sort by distance
      .slice(0, limit); // Limit results

    // Return response
    return new Response(
      JSON.stringify({
        restaurants: restaurantsWithDistance,
        totalCount: restaurantsWithDistance.length,
        searchRadius: radiusKm,
        centerPoint: { latitude, longitude },
        appliedFilters: filters || {},
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    console.error('Unexpected error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error', details: err?.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
