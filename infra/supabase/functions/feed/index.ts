// Feed Endpoint - Returns filtered and ranked dishes for user
// POST /functions/v1/feed
//
// Phase 5: Two-stage pipeline
//   Stage 1 (SQL / generate_candidates RPC):
//     PostGIS radius + hard permanent filters + vector ANN → 200 candidates
//   Stage 2 (JS / rankCandidates):
//     Weighted scoring: vector similarity + rating + popularity + distance +
//     content quality + soft daily boosts (cuisine, price, calorie, spice)
//     → diversity cap (max 3 per restaurant) → top N

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Redis } from 'https://esm.sh/@upstash/redis@latest';

// ── CORS ──────────────────────────────────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Clients ───────────────────────────────────────────────────────────────────

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

let _redis: Redis | null = null;
function getRedis(): Redis | null {
  const url = Deno.env.get('UPSTASH_REDIS_REST_URL');
  const token = Deno.env.get('UPSTASH_REDIS_REST_TOKEN');
  if (!url || !token) return null;
  if (!_redis) _redis = new Redis({ url, token });
  return _redis;
}

// ── Stage 2 weights ───────────────────────────────────────────────────────────

const W = {
  similarity: 0.4,
  rating: 0.2,
  popularity: 0.15,
  distance: 0.15,
  quality: 0.1,
} as const;

// ── Types ─────────────────────────────────────────────────────────────────────

interface FeedRequest {
  location: { lat: number; lng: number };
  radius?: number;
  mode?: 'dishes' | 'restaurants';
  filters: {
    priceRange?: [number, number];
    dietPreference?: string;
    preferredDiet?: string;
    calorieRange?: { min: number; max: number };
    allergens?: string[];
    religiousRestrictions?: string[];
    cuisines?: string[];
    spiceLevel?: string;
    spiceTolerance?: string;
    favoriteCuisines?: string[];
    sortBy?: 'closest' | 'bestMatch' | 'highestRated';
    openNow?: boolean;
    flagIngredients?: string[];
    /**
     * Dish/meal type keywords selected by the user (e.g. "Pizza", "Burger").
     * Dishes whose names contain any of these terms receive a strong score boost.
     */
    dishNames?: string[];
    /** Active protein type keys from daily filter (e.g. ['meat', 'fish', 'seafood', 'egg']). */
    proteinTypes?: string[];
    /** Active meat subtype keys from daily filter (e.g. ['chicken', 'beef', 'pork']). */
    meatTypes?: string[];
    /** Ingredient families to hard-exclude (permanent noMeat/noFish/noSeafood/noEggs/noDairy). */
    excludeFamilies?: string[];
    /** When true, dishes with spice_level='hot' are hard-excluded (permanent noSpicy). */
    excludeSpicy?: boolean;
  };
  userId?: string;
  limit?: number;
}

interface Candidate {
  id: string;
  restaurant_id: string;
  name: string;
  description: string | null;
  price: number;
  dietary_tags: string[];
  allergens: string[];
  calories: number | null;
  spice_level: string | null;
  image_url: string | null;
  is_available: boolean;
  dish_kind: string;
  display_price_prefix: string;
  enrichment_status: string;
  vector_distance: number | null;
  distance_m: number;
  restaurant_name: string;
  restaurant_cuisines: string[];
  restaurant_rating: number;
  restaurant_location: Record<string, unknown>;
  popularity_score: number;
  view_count: number;
  right_swipe_count: number;
  score?: number;
  flagged_ingredients?: string[];
  protein_families?: string[];
  protein_canonical_names?: string[];
}

// ── Stage 2 scoring ───────────────────────────────────────────────────────────

function rankCandidates(
  candidates: Candidate[],
  filters: FeedRequest['filters'],
  radiusKm: number,
  userLikedCuisines: string[],
  userPrefs: {
    spiceTolerance?: string | null;
    favoriteCuisines?: string[];
    preferredPriceRange?: [number, number] | null;
  },
  hasPreferenceVector: boolean,
  favoritedRestaurantIds: Set<string> = new Set()
): Candidate[] {
  const SLIDER_MIN = 10;
  const SLIDER_MAX = 50;

  return candidates.map(d => {
    const distKm = d.distance_m / 1000;

    // Core signals (0–1 each)
    const similarity =
      hasPreferenceVector && d.vector_distance !== null ? Math.max(0, 1 - d.vector_distance) : 0;

    const ratingNorm = (d.restaurant_rating ?? 0) / 5;
    const popularityNorm = Math.min(1, d.popularity_score ?? 0);
    const distanceNorm = Math.max(0, 1 - distKm / radiusKm);

    const hasImage = d.image_url ? 0.5 : 0;
    const hasDesc = d.description && d.description.length > 20 ? 0.3 : 0;
    const hasIngredients = d.enrichment_status === 'completed' ? 0.2 : 0;
    const qualityNorm = hasImage + hasDesc + hasIngredients;

    // Weighted base score
    let score: number;
    if (!hasPreferenceVector) {
      // Cold start: redistribute similarity weight into rating + popularity
      score =
        (W.similarity + W.rating / 2) * ratingNorm +
        (W.similarity / 2 + W.popularity) * popularityNorm +
        W.distance * distanceNorm +
        W.quality * qualityNorm;
    } else {
      score =
        W.similarity * similarity +
        W.rating * ratingNorm +
        W.popularity * popularityNorm +
        W.distance * distanceNorm +
        W.quality * qualityNorm;
    }

    // Soft daily price proximity boost (+0.08 max)
    if (filters.priceRange && d.price != null) {
      const [min, max] = filters.priceRange;
      const effMin = min <= SLIDER_MIN ? 0 : min;
      const effMax = max >= SLIDER_MAX ? Infinity : max;
      if (d.price >= effMin && d.price <= effMax) {
        const mid = (effMin + (effMax === Infinity ? d.price : effMax)) / 2;
        const range = Math.max((effMax === Infinity ? 1 : effMax) - effMin, 1);
        score += 0.08 * Math.max(0, 1 - Math.abs(d.price - mid) / range);
      }
    }

    // Soft daily calorie proximity boost (+0.05 max)
    if (filters.calorieRange && d.calories) {
      const { min, max } = filters.calorieRange;
      if (d.calories >= min && d.calories <= max) {
        const mid = (min + max) / 2;
        score += 0.05 * Math.max(0, 1 - Math.abs(d.calories - mid) / Math.max(max - min, 1));
      }
    }

    // Soft daily diet boost (+0.50)
    // Large enough that any decent vegetarian/vegan dish (base ~0.75) will
    // outrank even a top-rated non-veg dish (base ~1.10) when the daily
    // toggle is on. Only a genuinely poor veg option (base <0.35) would
    // lose to the very best non-veg dish, which is the desired behaviour.
    if (filters.preferredDiet && filters.preferredDiet !== 'all') {
      const tags = d.dietary_tags ?? [];
      const matches =
        filters.preferredDiet === 'vegan'
          ? tags.includes('vegan')
          : tags.includes('vegetarian') || tags.includes('vegan');
      if (matches) score += 0.5;
    }

    // Soft daily cuisine boost (+0.20)
    if (filters.cuisines?.length) {
      if (filters.cuisines.some(c => d.restaurant_cuisines?.includes(c))) score += 0.2;
    }

    // Soft daily spice level
    if (filters.spiceLevel && filters.spiceLevel !== 'eitherWay') {
      const dishSpice = d.spice_level ?? 'none';
      if (filters.spiceLevel === 'noSpicy') {
        if (dishSpice === 'none') score += 0.1;
        if (dishSpice === 'hot') score -= 0.08;
      } else if (filters.spiceLevel === 'iLikeSpicy') {
        if (dishSpice === 'hot') score += 0.1;
        if (dishSpice === 'mild') score += 0.05;
      }
    }

    // Permanent spice tolerance
    if (userPrefs.spiceTolerance) {
      const order: Record<string, number> = { none: 0, mild: 1, hot: 2 };
      const dishLevel = order[d.spice_level ?? 'none'] ?? 0;
      const tolLevel = order[userPrefs.spiceTolerance] ?? 0;
      if (dishLevel <= tolLevel) score += 0.08;
      else score -= 0.05;
    }

    // Permanent favourite cuisines (+0.10)
    if (userPrefs.favoriteCuisines?.length) {
      if (userPrefs.favoriteCuisines.some(c => d.restaurant_cuisines?.includes(c))) score += 0.1;
    }

    // Historical liked cuisines (+0.10)
    if (userLikedCuisines.length > 0) {
      if (userLikedCuisines.some(c => d.restaurant_cuisines?.includes(c))) score += 0.1;
    }

    // Favourited restaurant boost (+0.15)
    if (favoritedRestaurantIds.size > 0 && favoritedRestaurantIds.has(d.restaurant_id)) {
      score += 0.15;
    }

    // Learned price range soft boost (+0.06 max) — from user_behavior_profiles.preferred_price_range
    if (userPrefs.preferredPriceRange && d.price != null) {
      const [pMin, pMax] = userPrefs.preferredPriceRange;
      if (d.price >= pMin && d.price <= pMax) {
        const mid = (pMin + pMax) / 2;
        const range = Math.max(pMax - pMin, 1);
        score += 0.06 * Math.max(0, 1 - Math.abs(d.price - mid) / range);
      }
    }

    // Daily dish/meal type boost (+0.25) — explicit craving match
    if (filters.dishNames?.length) {
      const nameLower = d.name.toLowerCase();
      const matches = filters.dishNames.some(m => nameLower.includes(m.toLowerCase()));
      if (matches) score += 0.25;
    }

    // Soft daily protein type boost (+0.20)
    if (filters.proteinTypes?.length && d.protein_families?.length) {
      const familyMap: Record<string, string[]> = {
        meat: ['meat', 'poultry'],
        fish: ['fish'],
        seafood: ['shellfish'],
        egg: ['eggs'],
      };
      const wantedFamilies = new Set(filters.proteinTypes.flatMap(p => familyMap[p] ?? []));
      if (d.protein_families.some(f => wantedFamilies.has(f))) score += 0.2;
    }

    // Soft daily meat subtype boost (+0.10 additional on top of protein match)
    if (filters.meatTypes?.length && d.protein_families?.length) {
      const meatNameMap: Record<string, string[]> = {
        chicken: ['chicken', 'chicken_livers', 'chicken_fat'],
        beef: ['beef', 'beef_liver', 'beef_tongue', 'beef_fat', 'beef_jerky', 'oxtail'],
        pork: [
          'pork',
          'ham',
          'pancetta',
          'prosciutto',
          'pepperoni',
          'lard',
          'italian_sausage',
          'pork_ribs',
        ],
        lamb: ['lamb'],
        duck: ['duck', 'duck_fat'],
      };

      // Collect all concrete canonical names from named types (used for 'other' fallback)
      const allConcreteNames = new Set(Object.values(meatNameMap).flat());

      const namedTypes = filters.meatTypes.filter(m => m !== 'other');
      const wantedNames = new Set(namedTypes.flatMap(m => meatNameMap[m] ?? []));

      let matched =
        wantedNames.size > 0 && d.protein_canonical_names?.some(n => wantedNames.has(n));

      // 'other' = dish has meat/poultry protein but none of its canonical names are
      // in the known chicken/beef/pork/lamb/duck lists (turkey, veal, venison, etc.)
      if (!matched && filters.meatTypes.includes('other')) {
        const hasMeatFamily = d.protein_families.some(f => f === 'meat' || f === 'poultry');
        const hasConcreteMatch = d.protein_canonical_names?.some(n => allConcreteNames.has(n));
        matched = hasMeatFamily && !hasConcreteMatch;
      }

      if (matched) score += 0.1;
    }

    return { ...d, score: Math.max(0, score) };
  });
}

// ── Diversity cap ─────────────────────────────────────────────────────────────

function applyDiversity(dishes: Candidate[], maxPerRestaurant: number): Candidate[] {
  const result: Candidate[] = [];
  const counts = new Map<string, number>();
  for (const d of dishes) {
    const n = counts.get(d.restaurant_id) ?? 0;
    if (n < maxPerRestaurant) {
      result.push(d);
      counts.set(d.restaurant_id, n + 1);
    }
  }
  return result;
}

// ── isOpenNow helper ─────────────────────────────────────────────────────────
// Ported from apps/mobile/src/utils/i18nUtils.ts — same logic, no dependency.

function isOpenNow(
  openHours: Record<string, { open: string; close: string }> | null | undefined
): boolean {
  if (!openHours) return false;
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const today = days[new Date().getDay()];
  const entry = openHours[today];
  if (!entry) return false;
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  const [oh, om] = entry.open.split(':').map(Number);
  const [ch, cm] = entry.close.split(':').map(Number);
  const openMin = oh * 60 + om;
  const closeMin = ch * 60 + cm;
  // Handle overnight spans (e.g. open 22:00, close 02:00)
  if (closeMin < openMin) return cur >= openMin || cur < closeMin;
  return cur >= openMin && cur < closeMin;
}

// ── Main handler ─────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const body: FeedRequest = await req.json();
    const { location, radius = 10, mode = 'dishes', filters, userId, limit = 20 } = body;

    console.log('[Feed] Request:', { location, radius, mode, userId, limit });

    if (!location?.lat || !location?.lng) {
      return new Response(JSON.stringify({ error: 'Invalid location' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Cache check ───────────────────────────────────────────────────────────

    const cacheKey = `feed:${userId ?? 'anon'}:${location.lat.toFixed(3)}:${location.lng.toFixed(3)}:${JSON.stringify(filters)}`;
    const redis = getRedis();
    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          console.log('[Feed] Cache hit');
          return new Response(
            JSON.stringify({
              ...(cached as object),
              metadata: { ...(cached as any).metadata, cached: true },
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (e) {
        console.error('[Feed] Cache read error (non-fatal):', e);
      }
    }

    // ── Load user context (parallel) ──────────────────────────────────────────

    let preferenceVector: number[] | null = null;
    let userDislikes: string[] = [];
    let userLikedCuisines: string[] = [];
    let dbSpiceTolerance: string | null = null;
    let dbFavoriteCuisines: string[] = [];
    let dbReligiousRestrictions: string[] = [];
    let dbPreferredPriceRange: [number, number] | null = null;

    let favoritedRestaurantIds = new Set<string>();

    if (userId && userId !== 'anonymous') {
      const [interactionsRes, prefsRes, behaviorRes, favoritesRes] = await Promise.all([
        supabase
          .from('user_dish_interactions')
          .select('dish_id, interaction_type, dishes(restaurant:restaurants(cuisine_types))')
          .eq('user_id', userId)
          .in('interaction_type', ['liked', 'disliked']),
        supabase
          .from('user_preferences')
          .select('spice_tolerance, favorite_cuisines, religious_restrictions')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('user_behavior_profiles')
          .select('preference_vector, preferred_cuisines, preferred_price_range')
          .eq('user_id', userId)
          .maybeSingle(),
        // Load favourited restaurants to boost their dishes in scoring
        supabase
          .from('favorites')
          .select('subject_id')
          .eq('user_id', userId)
          .eq('subject_type', 'restaurant'),
      ]);

      if (interactionsRes.data) {
        userDislikes = interactionsRes.data
          .filter((i: any) => i.interaction_type === 'disliked')
          .map((i: any) => i.dish_id);
        userLikedCuisines = [
          ...new Set<string>(
            interactionsRes.data
              .filter(
                (i: any) => i.interaction_type === 'liked' && i.dishes?.restaurant?.cuisine_types
              )
              .flatMap((i: any) => i.dishes.restaurant.cuisine_types as string[])
          ),
        ];
      }

      // Favourited restaurants → boost their dishes + extract cuisine types
      if (favoritesRes.data && favoritesRes.data.length > 0) {
        const favIds = favoritesRes.data.map((f: any) => f.subject_id);
        favoritedRestaurantIds = new Set(favIds);
        // Fetch cuisine types of favourited restaurants
        try {
          const { data: favRestaurants } = await supabase
            .from('restaurants')
            .select('cuisine_types')
            .in('id', favIds);
          if (favRestaurants) {
            const favCuisines = favRestaurants.flatMap((r: any) => r.cuisine_types ?? []);
            userLikedCuisines = [...new Set([...userLikedCuisines, ...favCuisines])];
          }
        } catch (e) {
          console.error('[Feed] Favourites cuisine lookup failed (non-fatal):', e);
        }
      }

      if (prefsRes.data) {
        dbSpiceTolerance = prefsRes.data.spice_tolerance ?? null;
        dbFavoriteCuisines = Array.isArray(prefsRes.data.favorite_cuisines)
          ? prefsRes.data.favorite_cuisines
          : [];
        dbReligiousRestrictions = Array.isArray(prefsRes.data.religious_restrictions)
          ? prefsRes.data.religious_restrictions
          : [];
      }

      if (behaviorRes.data?.preference_vector) {
        const raw = behaviorRes.data.preference_vector;
        preferenceVector = typeof raw === 'string' ? JSON.parse(raw) : raw;
      }

      if (
        Array.isArray(behaviorRes.data?.preferred_cuisines) &&
        behaviorRes.data.preferred_cuisines.length > 0
      ) {
        dbFavoriteCuisines = [
          ...new Set([...dbFavoriteCuisines, ...behaviorRes.data.preferred_cuisines]),
        ];
      }

      if (
        Array.isArray(behaviorRes.data?.preferred_price_range) &&
        behaviorRes.data.preferred_price_range.length === 2
      ) {
        dbPreferredPriceRange = behaviorRes.data.preferred_price_range as [number, number];
      }

      console.log('[Feed] User context:', {
        userId,
        hasPrefVector: preferenceVector !== null,
        dislikeCount: userDislikes.length,
        likedCuisineCount: userLikedCuisines.length,
        favRestaurantCount: favoritedRestaurantIds.size,
        hasFavCuisines: dbFavoriteCuisines.length > 0,
        hasSpiceTolerance: dbSpiceTolerance !== null,
        hasPriceRange: dbPreferredPriceRange !== null,
      });
    }

    const spiceTolerance = filters.spiceTolerance ?? dbSpiceTolerance;
    const favoriteCuisines = filters.favoriteCuisines?.length
      ? filters.favoriteCuisines
      : dbFavoriteCuisines;
    const religiousRestrictions = filters.religiousRestrictions?.length
      ? filters.religiousRestrictions
      : dbReligiousRestrictions;
    const preferredPriceRange = dbPreferredPriceRange;
    const hardDietTag =
      filters.dietPreference && filters.dietPreference !== 'all' ? filters.dietPreference : null;

    // ── Stage 1: generate_candidates ─────────────────────────────────────────

    console.log('[Feed] Stage 1: generate_candidates');

    const { data: candidates, error: candidateError } = (await supabase.rpc('generate_candidates', {
      p_lat: location.lat,
      p_lng: location.lng,
      p_radius_m: radius * 1000,
      p_preference_vector: preferenceVector ? JSON.stringify(preferenceVector) : null,
      p_disliked_dish_ids: userDislikes.length ? userDislikes : null,
      p_allergens: filters.allergens?.length ? filters.allergens : null,
      p_diet_tag: hardDietTag,
      p_religious_tags: religiousRestrictions.length ? religiousRestrictions : null,
      p_exclude_families: filters.excludeFamilies?.length ? filters.excludeFamilies : null,
      p_exclude_spicy: filters.excludeSpicy ?? false,
      p_limit: 200,
    })) as { data: Candidate[] | null; error: unknown };

    if (candidateError) {
      console.error('[Feed] generate_candidates failed:', candidateError);
      throw candidateError;
    }

    const pool = candidates ?? [];
    console.log(`[Feed] Stage 1: ${pool.length} candidates`);

    if (pool.length === 0) {
      return new Response(
        JSON.stringify({ dishes: [], metadata: { totalAvailable: 0, returned: 0, cached: false } }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Ingredient flag annotation ────────────────────────────────────────────

    let annotated: Candidate[] = pool;
    if (filters.flagIngredients?.length) {
      const flagSet = new Set(filters.flagIngredients);

      let flagNames: Record<string, string> = {};
      try {
        const { data: aliasRows } = await supabase
          .from('ingredient_aliases')
          .select('canonical_ingredient_id, display_name')
          .in('canonical_ingredient_id', Array.from(flagSet));
        for (const row of aliasRows ?? []) {
          if (!flagNames[row.canonical_ingredient_id]) {
            flagNames[row.canonical_ingredient_id] = row.display_name;
          }
        }
      } catch (e) {
        console.error('[Feed] Flag name lookup failed (non-fatal):', e);
      }

      const dishIds = pool.map(d => d.id);
      let dishIngredientMap: Record<string, string[]> = {};
      try {
        const { data: diRows } = await supabase
          .from('dish_ingredients')
          .select('dish_id, ingredient_id')
          .in('dish_id', dishIds);
        for (const row of diRows ?? []) {
          if (!dishIngredientMap[row.dish_id]) dishIngredientMap[row.dish_id] = [];
          dishIngredientMap[row.dish_id].push(row.ingredient_id);
        }
      } catch (e) {
        console.error('[Feed] dish_ingredients lookup failed (non-fatal):', e);
      }

      annotated = pool.map(d => {
        const ids = dishIngredientMap[d.id] ?? [];
        const flagged = ids.filter(id => flagSet.has(id)).map(id => flagNames[id] ?? id);
        return { ...d, flagged_ingredients: flagged };
      });
    } else {
      annotated = pool.map(d => ({ ...d, flagged_ingredients: [] }));
    }

    // ── Protein family annotation ─────────────────────────────────────────────
    // protein_families and protein_canonical_names are now precomputed columns
    // on dishes, returned directly by generate_candidates() (migration 070).
    // No extra DB query needed here — rankCandidates() uses d.protein_families
    // and d.protein_canonical_names that are already present in the candidate rows.

    // ── Stage 2: rank ─────────────────────────────────────────────────────────

    console.log('[Feed] Stage 2: scoring');

    const scored = rankCandidates(
      annotated,
      filters,
      radius,
      userLikedCuisines,
      { spiceTolerance, favoriteCuisines, preferredPriceRange },
      preferenceVector !== null,
      favoritedRestaurantIds
    );

    scored.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const diversified = applyDiversity(scored, 3);

    // ── Restaurant mode ───────────────────────────────────────────────────────

    if (mode === 'restaurants') {
      const restaurantMap = new Map<string, any>();
      for (const d of diversified) {
        const rid = d.restaurant_id;
        if (!restaurantMap.has(rid)) {
          restaurantMap.set(rid, {
            id: rid,
            name: d.restaurant_name,
            cuisine_types: d.restaurant_cuisines ?? [],
            rating: d.restaurant_rating ?? 0,
            distance_km: d.distance_m / 1000,
            score: d.score ?? 0,
            location: d.restaurant_location ?? null,
          });
        } else {
          const ex = restaurantMap.get(rid);
          if ((d.score ?? 0) > ex.score) ex.score = d.score;
        }
      }

      // ── Fetch open_hours and annotate is_open for all result restaurants ────
      // This also powers the openNow hard filter below.
      const rIds = Array.from(restaurantMap.keys());
      const openHoursMap = new Map<
        string,
        Record<string, { open: string; close: string }> | null
      >();
      try {
        const { data: hourRows } = await supabase
          .from('restaurants')
          .select('id, open_hours')
          .in('id', rIds);
        for (const row of hourRows ?? []) {
          openHoursMap.set(row.id, row.open_hours ?? null);
        }
      } catch (e) {
        console.error('[Feed] open_hours fetch failed (non-fatal):', e);
      }

      for (const [rid, r] of restaurantMap) {
        r.is_open = isOpenNow(openHoursMap.get(rid));
      }

      let restaurantList = Array.from(restaurantMap.values());

      // Apply openNow hard filter after is_open is set
      if (filters.openNow) {
        restaurantList = restaurantList.filter(r => r.is_open);
      }

      switch (filters.sortBy) {
        case 'closest':
          restaurantList.sort((a, b) => a.distance_km - b.distance_km);
          break;
        case 'highestRated':
          restaurantList.sort((a, b) => b.rating - a.rating);
          break;
        default:
          restaurantList.sort((a, b) => b.score - a.score);
      }

      const restaurantResult = restaurantList.slice(0, limit);
      const restaurantResponse = {
        restaurants: restaurantResult,
        metadata: {
          totalAvailable: restaurantMap.size,
          returned: restaurantResult.length,
          cached: false,
          processingTime: Date.now() - startTime,
          personalized: preferenceVector !== null,
          stage1Candidates: pool.length,
        },
      };

      if (redis) {
        try {
          await redis.set(cacheKey, JSON.stringify(restaurantResponse), { ex: 300 });
        } catch {}
      }

      console.log(
        `[Feed] Returning ${restaurantResult.length} restaurants (${Date.now() - startTime}ms)`
      );
      return new Response(JSON.stringify(restaurantResponse), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Dishes mode ───────────────────────────────────────────────────────────

    const result = diversified.slice(0, limit).map(d => ({
      id: d.id,
      restaurant_id: d.restaurant_id,
      name: d.name,
      description: d.description,
      price: d.price,
      calories: d.calories,
      image_url: d.image_url,
      spice_level: d.spice_level,
      is_available: d.is_available,
      allergens: d.allergens,
      dietary_tags: d.dietary_tags,
      dish_kind: d.dish_kind,
      restaurant: {
        id: d.restaurant_id,
        name: d.restaurant_name,
        cuisine_types: d.restaurant_cuisines,
        rating: d.restaurant_rating,
      },
      distance_km: d.distance_m / 1000,
      score: d.score,
      flagged_ingredients: d.flagged_ingredients ?? [],
    }));
    const responseData = {
      dishes: result,
      metadata: {
        totalAvailable: pool.length,
        returned: result.length,
        cached: false,
        processingTime: Date.now() - startTime,
        personalized: preferenceVector !== null,
        stage1Candidates: pool.length,
        userInteractions: userDislikes.length,
      },
    };

    if (redis) {
      try {
        await redis.set(cacheKey, JSON.stringify(responseData), { ex: 300 });
      } catch {}
    }

    console.log(`[Feed] Returning ${result.length} dishes (${Date.now() - startTime}ms)`);
    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[Feed] Error:', error);
    return new Response(JSON.stringify({ error: error?.message ?? 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
