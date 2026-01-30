// Feed Endpoint - Returns filtered and ranked dishes for user
// POST /functions/v1/feed

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Redis } from 'https://esm.sh/@upstash/redis@latest';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize clients
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const redis = new Redis({
  url: Deno.env.get('UPSTASH_REDIS_REST_URL')!,
  token: Deno.env.get('UPSTASH_REDIS_REST_TOKEN')!,
});

interface FeedRequest {
  location: { lat: number; lng: number };
  radius?: number; // km, default 10
  filters: {
    priceRange?: [number, number];
    dietPreference?: string;
    calorieRange?: { min: number; max: number };
    allergens?: string[];
    cuisines?: string[];
  };
  userId?: string;
  limit?: number; // default 20
}

serve(async req => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // Parse request
    const body: FeedRequest = await req.json();
    const { location, radius = 10, filters, userId, limit = 20 } = body;

    console.log('[Feed] Request:', { location, radius, filters, userId, limit });

    // Validate location
    if (!location || !location.lat || !location.lng) {
      return new Response(JSON.stringify({ error: 'Invalid location' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate cache key
    const filterHash = JSON.stringify(filters);
    const cacheKey = `feed:${userId || 'anon'}:${location.lat.toFixed(3)}:${location.lng.toFixed(3)}:${filterHash}`;

    // Check cache
    const cached = await redis.get(cacheKey);
    if (cached) {
      console.log('[Feed] Cache hit');
      return new Response(
        JSON.stringify({ ...cached, metadata: { ...cached.metadata, cached: true } }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[Feed] Cache miss, querying database');

    // 1. Find nearby restaurants using PostGIS
    const { data: nearbyRestaurants, error: restaurantError } = await supabase.rpc(
      'restaurants_within_radius',
      {
        p_lat: location.lat,
        p_lng: location.lng,
        p_radius_km: radius,
      }
    );

    if (restaurantError) {
      console.error('[Feed] Restaurant query error:', restaurantError);
      throw restaurantError;
    }

    if (!nearbyRestaurants || nearbyRestaurants.length === 0) {
      const result = { dishes: [], metadata: { totalAvailable: 0, returned: 0, cached: false } };
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const restaurantIds = nearbyRestaurants.map((r: any) => r.id);
    console.log(`[Feed] Found ${restaurantIds.length} restaurants within ${radius}km`);

    // 2. Fetch dishes from nearby restaurants with analytics
    const { data: dishes, error: dishError } = await supabase
      .from('dishes')
      .select(
        `
        *,
        restaurant:restaurants(id, name, cuisine_types, rating),
        analytics:dish_analytics(view_count, right_swipe_count, popularity_score)
      `
      )
      .in('restaurant_id', restaurantIds)
      .eq('is_available', true);

    if (dishError) {
      console.error('[Feed] Dish query error:', dishError);
      throw dishError;
    }

    console.log(`[Feed] Found ${dishes?.length || 0} available dishes`);

    // 3. Apply filters
    let filteredDishes = dishes || [];

    // Price filter
    if (filters.priceRange) {
      const [min, max] = filters.priceRange;
      const minPrice = min * 5; // Rough conversion: 1=$5, 2=$10, etc.
      const maxPrice = max * 15;
      filteredDishes = filteredDishes.filter(
        (d: any) => d.price >= minPrice && d.price <= maxPrice
      );
      console.log(`[Feed] After price filter: ${filteredDishes.length}`);
    }

    // Diet preference filter
    if (filters.dietPreference && filters.dietPreference !== 'all') {
      filteredDishes = filteredDishes.filter((d: any) =>
        d.dietary_tags?.includes(filters.dietPreference)
      );
      console.log(`[Feed] After diet filter: ${filteredDishes.length}`);
    }

    // Calorie filter
    if (filters.calorieRange) {
      filteredDishes = filteredDishes.filter(
        (d: any) =>
          d.calories &&
          d.calories >= filters.calorieRange!.min &&
          d.calories <= filters.calorieRange!.max
      );
      console.log(`[Feed] After calorie filter: ${filteredDishes.length}`);
    }

    // Allergen filter (exclude dishes with user's allergens)
    if (filters.allergens && filters.allergens.length > 0) {
      filteredDishes = filteredDishes.filter((d: any) => {
        const dishAllergens = d.allergens || [];
        return !filters.allergens!.some(allergen => dishAllergens.includes(allergen));
      });
      console.log(`[Feed] After allergen filter: ${filteredDishes.length}`);
    }

    // Cuisine filter
    if (filters.cuisines && filters.cuisines.length > 0) {
      filteredDishes = filteredDishes.filter((d: any) => {
        const restaurantCuisines = d.restaurant?.cuisine_types || [];
        return filters.cuisines!.some(cuisine => restaurantCuisines.includes(cuisine));
      });
      console.log(`[Feed] After cuisine filter: ${filteredDishes.length}`);
    }

    // 4. Score and rank dishes
    const scoredDishes = filteredDishes.map((dish: any) => {
      const restaurant = nearbyRestaurants.find((r: any) => r.id === dish.restaurant_id);
      const distance_km = restaurant?.distance_km || 999;
      const score = calculateScore(dish, filters, distance_km);

      return {
        ...dish,
        score,
        distance_km,
      };
    });

    // Sort by score
    scoredDishes.sort((a: any, b: any) => b.score - a.score);

    // 5. Apply diversity (max 3 dishes per restaurant in results)
    const diversified = applyDiversity(scoredDishes, 3);

    // 6. Take top N
    const result = diversified.slice(0, limit);

    const responseData = {
      dishes: result,
      metadata: {
        totalAvailable: filteredDishes.length,
        returned: result.length,
        cached: false,
        processingTime: Date.now() - startTime,
      },
    };

    // 7. Cache result (5 minutes)
    try {
      await redis.setex(cacheKey, 300, JSON.stringify(responseData));
      console.log('[Feed] Cached result');
    } catch (cacheError) {
      console.error('[Feed] Cache error (non-fatal):', cacheError);
    }

    console.log(`[Feed] Returning ${result.length} dishes (${Date.now() - startTime}ms)`);

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Feed] Error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Simple scoring function
function calculateScore(dish: any, filters: any, distance_km: number): number {
  let score = 50; // Base score

  // Restaurant rating (0-20 points)
  if (dish.restaurant?.rating) {
    score += (dish.restaurant.rating / 5) * 20;
  }

  // Popularity (0-15 points)
  if (dish.analytics?.popularity_score) {
    score += dish.analytics.popularity_score * 15;
  } else if (dish.analytics?.right_swipe_count) {
    // Fallback: calculate from swipes
    const popularity = Math.min(dish.analytics.right_swipe_count / 100, 1);
    score += popularity * 15;
  }

  // Distance bonus (0-15 points, closer is better)
  const distanceScore = Math.max(0, 15 - distance_km * 2);
  score += distanceScore;

  // Has image (5 points)
  if (dish.image_url) {
    score += 5;
  }

  // Has description (3 points)
  if (dish.description && dish.description.length > 20) {
    score += 3;
  }

  // Calorie preference match (bonus)
  if (filters.calorieRange && dish.calories) {
    const targetMid = (filters.calorieRange.min + filters.calorieRange.max) / 2;
    const deviation = Math.abs(dish.calories - targetMid);
    if (deviation < 100) {
      score += 5; // Close to target
    }
  }

  return Math.round(score);
}

// Prevent too many dishes from same restaurant
function applyDiversity(dishes: any[], maxPerRestaurant: number): any[] {
  const result: any[] = [];
  const restaurantCounts = new Map<string, number>();

  for (const dish of dishes) {
    const restaurantId = dish.restaurant_id;
    const count = restaurantCounts.get(restaurantId) || 0;

    if (count < maxPerRestaurant) {
      result.push(dish);
      restaurantCounts.set(restaurantId, count + 1);
    }
  }

  return result;
}
