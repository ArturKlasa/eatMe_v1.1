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

// Redis is optional — if UPSTASH env vars are not configured, caching is skipped gracefully
let _redis: Redis | null = null;
function getRedis(): Redis | null {
  const url = Deno.env.get('UPSTASH_REDIS_REST_URL');
  const token = Deno.env.get('UPSTASH_REDIS_REST_TOKEN');
  if (!url || !token) return null;
  if (!_redis) _redis = new Redis({ url, token });
  return _redis;
}

interface FeedRequest {
  location: { lat: number; lng: number };
  radius?: number; // km, default 10
  /**
   * 'dishes'      — default; returns a ranked list of individual dishes
   * 'restaurants' — returns filtered + scored restaurants aggregated from dish results
   */
  mode?: 'dishes' | 'restaurants';
  filters: {
    priceRange?: [number, number];
    dietPreference?: string; // hard — permanent filters only
    preferredDiet?: string; // soft boost — daily diet filter
    calorieRange?: { min: number; max: number }; // NOW SOFT — boost only, no hard exclusion
    allergens?: string[]; // hard — absolute exclusion
    /** TEXT[] of dietary_tag codes — hard exclusion (e.g. ['halal'] excludes non-halal dishes) */
    religiousRestrictions?: string[];
    cuisines?: string[]; // soft boost
    /**
     * Daily spice preference: 'noSpicy' | 'eitherWay' | 'iLikeSpicy'
     * Mapped to boost logic in calculateScore
     */
    spiceLevel?: string;
    /** Permanent spice tolerance from user_preferences.spice_tolerance ('none'|'mild'|'hot') */
    spiceTolerance?: string;
    /** Permanent favorite cuisines from user_preferences.favorite_cuisines */
    favoriteCuisines?: string[];
    /** Sort order for restaurant mode */
    sortBy?: 'closest' | 'bestMatch' | 'highestRated';
    /** Hard filter for restaurant mode: exclude restaurants that are closed */
    openNow?: boolean;
    /**
     * canonical_ingredient_id UUIDs from the user's "Ingredients to Avoid" list.
     * Dishes containing these are still shown but annotated with flagged_ingredients
     * so the UI can display a warning instead of hiding the dish.
     */
    flagIngredients?: string[];
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
    const { location, radius = 10, mode = 'dishes', filters, userId, limit = 20 } = body;

    console.log('[Feed] Request:', { location, radius, mode, filters, userId, limit });

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

    // Check cache (only if Redis is configured)
    const redis = getRedis();
    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          console.log('[Feed] Cache hit');
          return new Response(
            JSON.stringify({ ...cached, metadata: { ...(cached as any).metadata, cached: true } }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
      } catch (cacheReadError) {
        console.error('[Feed] Cache read error (non-fatal):', cacheReadError);
      }
    }

    console.log('[Feed] Cache miss, querying database');

    // 1. Load user interaction history (if authenticated)
    let userLikes: string[] = [];
    let userDislikes: string[] = [];
    let userLikedCuisines: string[] = [];

    if (userId && userId !== 'anonymous') {
      try {
        const { data: interactions } = await supabase
          .from('user_dish_interactions')
          .select(
            'dish_id, interaction_type, dishes(cuisine_type, restaurant:restaurants(cuisine_types))'
          )
          .eq('user_id', userId)
          .in('interaction_type', ['liked', 'disliked']);

        if (interactions) {
          userLikes = interactions.filter(i => i.interaction_type === 'liked').map(i => i.dish_id);
          userDislikes = interactions
            .filter(i => i.interaction_type === 'disliked')
            .map(i => i.dish_id);

          // Extract cuisine preferences from liked dishes
          const cuisinesFromLikes = interactions
            .filter(i => i.interaction_type === 'liked' && i.dishes?.restaurant?.cuisine_types)
            .flatMap((i: any) => i.dishes.restaurant.cuisine_types);
          userLikedCuisines = [...new Set(cuisinesFromLikes)];

          console.log(
            `[Feed] User history: ${userLikes.length} likes, ${userDislikes.length} dislikes`
          );
          console.log(`[Feed] User prefers cuisines:`, userLikedCuisines);
        }
      } catch (err) {
        console.error('[Feed] Error loading user history (non-fatal):', err);
      }
    }

    // 1b. Load user preferences (spice tolerance, favourite cuisines, religious restrictions)
    //     These supplement filter values sent by the client.
    let dbSpiceTolerance: string | null = null;
    let dbFavoriteCuisines: string[] = [];
    let dbReligiousRestrictions: string[] = [];

    if (userId && userId !== 'anonymous') {
      try {
        const { data: prefs } = await supabase
          .from('user_preferences')
          .select('spice_tolerance, favorite_cuisines, religious_restrictions')
          .eq('user_id', userId)
          .maybeSingle();

        if (prefs) {
          dbSpiceTolerance = prefs.spice_tolerance ?? null;
          dbFavoriteCuisines = Array.isArray(prefs.favorite_cuisines)
            ? prefs.favorite_cuisines
            : [];
          // religious_restrictions is now TEXT[] after migration 051
          dbReligiousRestrictions = Array.isArray(prefs.religious_restrictions)
            ? prefs.religious_restrictions
            : [];
        }
      } catch (err) {
        console.error('[Feed] Error loading user preferences (non-fatal):', err);
      }
    }

    // Merge client-supplied preferences with DB values; client takes precedence
    const spiceTolerance = filters.spiceTolerance ?? dbSpiceTolerance;
    const favoriteCuisines =
      filters.favoriteCuisines && filters.favoriteCuisines.length > 0
        ? filters.favoriteCuisines
        : dbFavoriteCuisines;
    // Client-supplied religiousRestrictions override DB; fall back to DB if not supplied
    const religiousRestrictions =
      filters.religiousRestrictions && filters.religiousRestrictions.length > 0
        ? filters.religiousRestrictions
        : dbReligiousRestrictions;

    console.log(
      `[Feed] User prefs — spiceTolerance: ${spiceTolerance}, favCuisines: ${favoriteCuisines.length}, religious: ${religiousRestrictions.length}`
    );

    // 2. Find nearby restaurants — try PostGIS RPC first, fall back to JS haversine if unavailable
    let nearbyRestaurants: any[] = [];

    const { data: rpcResult, error: restaurantError } = await supabase.rpc(
      'restaurants_within_radius',
      { p_lat: location.lat, p_lng: location.lng, p_radius_km: radius }
    );

    if (restaurantError) {
      console.warn(
        '[Feed] PostGIS RPC failed, falling back to JS distance filter:',
        restaurantError.message
      );

      // Fallback: fetch all restaurants and filter by haversine distance in JS
      const { data: allRestaurants, error: allError } = await supabase
        .from('restaurants')
        .select('id, name, cuisine_types, rating, location');

      if (allError) {
        console.error('[Feed] Fallback restaurant query failed:', allError);
        throw allError;
      }

      nearbyRestaurants = (allRestaurants || [])
        .map((r: any) => {
          // location is JSONB {lat, lng} (after migration 007)
          const loc = r.location;
          let lat: number | null = null;
          let lng: number | null = null;
          if (loc && typeof loc === 'object' && loc.lat != null) {
            lat = parseFloat(loc.lat);
            lng = parseFloat(loc.lng);
          }
          if (lat === null || lng === null || isNaN(lat) || isNaN(lng)) return null;

          // Haversine formula
          const R = 6371;
          const dLat = ((lat - location.lat) * Math.PI) / 180;
          const dLng = ((lng - location.lng) * Math.PI) / 180;
          const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos((location.lat * Math.PI) / 180) *
              Math.cos((lat * Math.PI) / 180) *
              Math.sin(dLng / 2) ** 2;
          const distance_km = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

          return { ...r, distance_km };
        })
        .filter((r: any) => r !== null && r.distance_km <= radius);

      console.log(`[Feed] Fallback: ${nearbyRestaurants.length} restaurants within ${radius}km`);
    } else {
      nearbyRestaurants = rpcResult || [];
      console.log(`[Feed] PostGIS: ${nearbyRestaurants.length} restaurants within ${radius}km`);
    }

    if (nearbyRestaurants.length === 0) {
      const result = { dishes: [], metadata: { totalAvailable: 0, returned: 0, cached: false } };
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const restaurantIds = nearbyRestaurants.map((r: any) => r.id);
    console.log(`[Feed] Querying dishes for ${restaurantIds.length} restaurants`);

    // 3. Fetch dishes from nearby restaurants with analytics
    const { data: dishes, error: dishError } = await supabase
      .from('dishes')
      .select(
        `
        *,
        restaurant:restaurants(id, name, cuisine_types, rating),
        analytics:dish_analytics(view_count, right_swipe_count, popularity_score),
        dish_ingredients(ingredient_id)
      `
      )
      .in('restaurant_id', restaurantIds)
      .eq('is_available', true);

    if (dishError) {
      console.error('[Feed] Dish query error:', dishError);
      throw dishError;
    }

    console.log(`[Feed] Found ${dishes?.length || 0} available dishes`);

    // 4. Apply filters
    let filteredDishes = dishes || [];

    // Exclude already disliked dishes (if user is authenticated)
    if (userDislikes.length > 0) {
      const beforeCount = filteredDishes.length;
      filteredDishes = filteredDishes.filter((d: any) => !userDislikes.includes(d.id));
      console.log(
        `[Feed] Excluded ${beforeCount - filteredDishes.length} previously disliked dishes`
      );
    }

    // Price filter — NOW A SOFT BOOST in calculateScore, not a hard exclusion.
    // Removing dishes based on price harms discovery (the user may not have set the slider
    // intentionally tight). Dishes outside the range score lower but remain visible.
    // See calculateScore() for the boost logic.

    // Calorie filter — NOW A SOFT BOOST in calculateScore, not a hard exclusion.
    // Same rationale: many dishes have no calorie data, hard exclusion would remove too many.

    // Diet preference filter — HARD exclusion, permanent filters only.
    if (filters.dietPreference && filters.dietPreference !== 'all') {
      console.log(`[Feed] Filtering by diet preference: ${filters.dietPreference}`);
      filteredDishes = filteredDishes.filter((d: any) => {
        const dietaryTags = d.dietary_tags || [];

        // For vegan: dish must be explicitly tagged as vegan
        // For vegetarian: dish can be tagged as vegetarian OR vegan (vegan is also vegetarian)
        let matchesDiet = false;
        if (filters.dietPreference === 'vegan') {
          matchesDiet = dietaryTags.includes('vegan');
        } else if (filters.dietPreference === 'vegetarian') {
          matchesDiet = dietaryTags.includes('vegetarian') || dietaryTags.includes('vegan');
        }

        if (!matchesDiet) {
          console.log(
            `[Feed] Excluding dish "${d.name}" - not ${filters.dietPreference} (tags: ${JSON.stringify(dietaryTags)})`
          );
        }
        return matchesDiet;
      });
      console.log(`[Feed] After diet filter: ${filteredDishes.length}`);
    }

    // Allergen filter (exclude dishes with user's allergens)
    if (filters.allergens && filters.allergens.length > 0) {
      filteredDishes = filteredDishes.filter((d: any) => {
        const dishAllergens = d.allergens || [];
        return !filters.allergens!.some(allergen => dishAllergens.includes(allergen));
      });
      console.log(`[Feed] After allergen filter: ${filteredDishes.length}`);
    }

    // Religious restrictions filter — HARD exclusion.
    // Exclude dishes that don't carry the required dietary_tag(s).
    // e.g. religiousRestrictions = ['halal'] → only dishes where dietary_tags includes 'halal'
    if (religiousRestrictions.length > 0) {
      filteredDishes = filteredDishes.filter((d: any) => {
        const tags: string[] = d.dietary_tags || [];
        return religiousRestrictions.every(r => tags.includes(r));
      });
      console.log(
        `[Feed] After religious restrictions filter (${religiousRestrictions.join(', ')}): ${filteredDishes.length}`
      );
    }

    // Ingredient flag annotation — soft warning, NOT a hard exclusion.
    // For each dish, compute which of the user's avoided ingredients are present
    // and attach their display names as flagged_ingredients so the UI can warn
    // the user without hiding the dish.
    if (filters.flagIngredients && filters.flagIngredients.length > 0) {
      const flagSet = new Set(filters.flagIngredients);

      // Build a map of canonical_ingredient_id → display_name from the request.
      // The client sends UUIDs; we need display names for the UI.
      // We fetch the display names once for all flagged IDs.
      let flagDisplayNames: Record<string, string> = {};
      try {
        const { data: aliasRows } = await supabase
          .from('ingredient_aliases')
          .select('canonical_ingredient_id, display_name')
          .in('canonical_ingredient_id', Array.from(flagSet))
          .order('display_name', { ascending: true });

        // Pick one representative display_name per canonical_ingredient_id
        for (const row of aliasRows ?? []) {
          if (!flagDisplayNames[row.canonical_ingredient_id]) {
            flagDisplayNames[row.canonical_ingredient_id] = row.display_name;
          }
        }
      } catch (err) {
        console.error('[Feed] Could not fetch ingredient display names (non-fatal):', err);
      }

      filteredDishes = filteredDishes.map((d: any) => {
        const ingredientIds: string[] = (d.dish_ingredients ?? []).map(
          (row: any) => row.ingredient_id
        );
        const flagged = ingredientIds
          .filter(id => flagSet.has(id))
          .map(id => flagDisplayNames[id] ?? id); // fallback to UUID if name lookup failed
        return { ...d, flagged_ingredients: flagged };
      });

      const flaggedCount = filteredDishes.filter(
        (d: any) => d.flagged_ingredients.length > 0
      ).length;
      console.log(`[Feed] Flagged ingredients annotated on ${flaggedCount} dishes`);
    } else {
      // Ensure the field is always present on every dish
      filteredDishes = filteredDishes.map((d: any) => ({ ...d, flagged_ingredients: [] }));
    }

    // Cuisine preference — handled as a scoring boost below, not a hard filter.
    // This ensures that when no matching restaurants are nearby, other restaurants
    // still appear (matching ones are ranked first via the score bonus).

    // 5. Score and rank dishes (with personalization)
    const scoredDishes = filteredDishes.map((dish: any) => {
      const restaurant = nearbyRestaurants.find((r: any) => r.id === dish.restaurant_id);
      const distance_km = restaurant?.distance_km || 999;
      const score = calculateScore(
        dish,
        filters,
        distance_km,
        userId,
        userLikes,
        userLikedCuisines,
        { spiceTolerance, favoriteCuisines }
      );

      return {
        ...dish,
        score,
        distance_km,
        is_personalized: userLikes.length > 0,
      };
    });

    // Sort by score
    scoredDishes.sort((a: any, b: any) => b.score - a.score);

    // 6. Apply diversity (max 3 dishes per restaurant in results)
    const diversified = applyDiversity(scoredDishes, 3);

    // 7a. RESTAURANT MODE — aggregate dishes to restaurant level
    if (mode === 'restaurants') {
      const restaurantMap = new Map<string, any>();
      for (const dish of diversified) {
        const rid = dish.restaurant_id;
        if (!restaurantMap.has(rid)) {
          const r = nearbyRestaurants.find((nr: any) => nr.id === rid);
          restaurantMap.set(rid, {
            id: rid,
            name: dish.restaurant?.name,
            cuisine_types: dish.restaurant?.cuisine_types ?? [],
            rating: dish.restaurant?.rating ?? 0,
            distance_km: dish.distance_km,
            score: dish.score,
            // location available from nearbyRestaurants
            location: r?.location ?? null,
            is_open: r?.is_open ?? true,
          });
        } else {
          const existing = restaurantMap.get(rid);
          if (dish.score > existing.score) existing.score = dish.score;
        }
      }

      let restaurantList = Array.from(restaurantMap.values());

      // openNow hard filter — requires is_open flag from nearby-restaurants
      if (filters.openNow) {
        restaurantList = restaurantList.filter((r: any) => r.is_open);
      }

      // Sort for restaurant mode
      switch (filters.sortBy) {
        case 'closest':
          restaurantList.sort((a: any, b: any) => a.distance_km - b.distance_km);
          break;
        case 'highestRated':
          restaurantList.sort((a: any, b: any) => b.rating - a.rating);
          break;
        case 'bestMatch':
        default:
          restaurantList.sort((a: any, b: any) => b.score - a.score);
      }

      const restaurantResult = restaurantList.slice(0, limit);

      const restaurantResponse = {
        restaurants: restaurantResult,
        metadata: {
          totalAvailable: restaurantMap.size,
          returned: restaurantResult.length,
          cached: false,
          processingTime: Date.now() - startTime,
          personalized: !!(userId && userId !== 'anonymous'),
        },
      };

      if (redis) {
        try {
          await redis.setex(cacheKey, 300, JSON.stringify(restaurantResponse));
        } catch {}
      }

      console.log(
        `[Feed] Returning ${restaurantResult.length} restaurants (${Date.now() - startTime}ms)`
      );
      return new Response(JSON.stringify(restaurantResponse), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 7b. DISHES MODE (default)
    const result = diversified.slice(0, limit);

    const responseData = {
      dishes: result,
      metadata: {
        totalAvailable: filteredDishes.length,
        returned: result.length,
        cached: false,
        processingTime: Date.now() - startTime,
        personalized: userId && userId !== 'anonymous',
        userInteractions: userLikes.length + userDislikes.length,
      },
    };

    // 8. Cache result (5 minutes, only if Redis is configured)
    if (redis) {
      try {
        await redis.setex(cacheKey, 300, JSON.stringify(responseData));
        console.log('[Feed] Cached result');
      } catch (cacheError) {
        console.error('[Feed] Cache error (non-fatal):', cacheError);
      }
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

// Enhanced scoring function with personalization
function calculateScore(
  dish: any,
  filters: any,
  distance_km: number,
  userId?: string,
  userLikes: string[] = [],
  userLikedCuisines: string[] = [],
  userPrefs: { spiceTolerance?: string | null; favoriteCuisines?: string[] } = {}
): number {
  let score = 50; // Base score

  // Restaurant rating (0-20 points)
  if (dish.restaurant?.rating) {
    score += (dish.restaurant.rating / 5) * 20;
  }

  // Popularity (0-15 points)
  if (dish.analytics?.popularity_score) {
    score += dish.analytics.popularity_score * 15;
  } else if (dish.analytics?.right_swipe_count) {
    const popularity = Math.min(dish.analytics.right_swipe_count / 100, 1);
    score += popularity * 15;
  }

  // Distance bonus (0-15 points, closer is better)
  score += Math.max(0, 15 - distance_km * 2);

  // Has image (5 points)
  if (dish.image_url) score += 5;

  // Has description (3 points)
  if (dish.description && dish.description.length > 20) score += 3;

  // === SOFT: PRICE PROXIMITY (0-15 points) ===
  // Dishes close to the midpoint of the user's price range score higher.
  // No dish is excluded — those outside the range simply score 0 here.
  if (filters.priceRange && dish.price != null) {
    const [min, max] = filters.priceRange;
    const SLIDER_MIN = 10;
    const SLIDER_MAX = 50;
    const effectiveMin = min <= SLIDER_MIN ? 0 : min;
    const effectiveMax = max >= SLIDER_MAX ? Infinity : max;
    if (dish.price >= effectiveMin && dish.price <= effectiveMax) {
      const mid = (effectiveMin + effectiveMax) / 2 || dish.price;
      const deviation = Math.abs(dish.price - mid);
      const range = Math.max(effectiveMax - effectiveMin, 1);
      score += Math.max(0, 15 * (1 - deviation / range));
    }
    // Outside range: 0 bonus (still shown)
  }

  // === SOFT: CALORIE PROXIMITY (0-8 points) ===
  if (filters.calorieRange && dish.calories) {
    const { min, max } = filters.calorieRange;
    if (dish.calories >= min && dish.calories <= max) {
      const mid = (min + max) / 2;
      const deviation = Math.abs(dish.calories - mid);
      const range = Math.max(max - min, 1);
      score += Math.max(0, 8 * (1 - deviation / range));
    }
    // Outside range: 0 bonus (still shown — many dishes have no calorie data)
  }

  // === SOFT: DAILY DIET PREFERENCE BOOST (30 points) ===
  if (filters.preferredDiet && filters.preferredDiet !== 'all') {
    const tags: string[] = dish.dietary_tags || [];
    const matches =
      filters.preferredDiet === 'vegan'
        ? tags.includes('vegan')
        : tags.includes('vegetarian') || tags.includes('vegan');
    if (matches) score += 30;
  }

  // === SOFT: DAILY CUISINE BOOST (40 points) ===
  if (filters.cuisines && filters.cuisines.length > 0) {
    const restaurantCuisines: string[] = dish.restaurant?.cuisine_types || [];
    if (filters.cuisines.some((c: string) => restaurantCuisines.includes(c))) {
      score += 40;
    }
  }

  // === SOFT: DAILY SPICE LEVEL PREFERENCE (0-20 points) ===
  // spiceLevel: 'noSpicy' | 'eitherWay' | 'iLikeSpicy'
  // dish.spice_level: 'none' | 'mild' | 'hot'
  if (filters.spiceLevel && filters.spiceLevel !== 'eitherWay') {
    const dishSpice = dish.spice_level ?? 'none';
    if (filters.spiceLevel === 'noSpicy' && dishSpice === 'none') score += 20;
    if (filters.spiceLevel === 'iLikeSpicy' && dishSpice === 'hot') score += 20;
    if (filters.spiceLevel === 'iLikeSpicy' && dishSpice === 'mild') score += 10;
    if (filters.spiceLevel === 'noSpicy' && dishSpice === 'hot') score -= 15; // soft penalty
  }

  // === SOFT: PERMANENT SPICE TOLERANCE (0-15 points) ===
  // spiceTolerance: 'none' | 'mild' | 'hot' (matches dish.spice_level values)
  if (userPrefs.spiceTolerance) {
    const dishSpice = dish.spice_level ?? 'none';
    const toleranceOrder: Record<string, number> = { none: 0, mild: 1, hot: 2 };
    const dishLevel = toleranceOrder[dishSpice] ?? 0;
    const toleranceLevel = toleranceOrder[userPrefs.spiceTolerance] ?? 0;
    if (dishLevel <= toleranceLevel) {
      score += 15; // dish is within user's tolerance
    } else {
      score -= 10; // dish exceeds tolerance — soft penalty
    }
  }

  // === SOFT: FAVOURITE CUISINES FROM USER PREFERENCES (0-20 points) ===
  if (userPrefs.favoriteCuisines && userPrefs.favoriteCuisines.length > 0) {
    const restaurantCuisines: string[] = dish.restaurant?.cuisine_types || [];
    if (userPrefs.favoriteCuisines.some((c: string) => restaurantCuisines.includes(c))) {
      score += 20;
    }
  }

  // === PERSONALISATION: LIKED CUISINES FROM SWIPE HISTORY (0-20 points) ===
  if (userId && userId !== 'anonymous' && userLikedCuisines.length > 0) {
    const dishCuisines = dish.restaurant?.cuisine_types || [];
    if (dishCuisines.some((c: string) => userLikedCuisines.includes(c))) {
      score += 20;
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
