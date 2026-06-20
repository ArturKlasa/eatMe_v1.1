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

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// Pinned (not @latest) for deterministic cold starts — see §S8.
import { Redis } from 'https://esm.sh/@upstash/redis@1.38.0';
import { buildCorsHeaders } from '../_shared/cors.ts';

// ── Compression ───────────────────────────────────────────────────────────────

async function compressedJsonResponse(
  data: unknown,
  headers: Record<string, string>
): Promise<Response> {
  const json = JSON.stringify(data);
  const encoder = new TextEncoder();
  const body = encoder.encode(json);

  // Use ReadableStream.pipeThrough to avoid race conditions from unawaited
  // writer.write() / writer.close() calls.
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(body);
      controller.close();
    },
  }).pipeThrough(new CompressionStream('gzip'));

  const compressed = await new Response(stream).arrayBuffer();

  return new Response(compressed, {
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      'Content-Encoding': 'gzip',
    },
  });
}

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
//
// Tuning rationale: personalisation is the primary differentiator for food
// discovery; rating + popularity together match it to prevent viral-only bias.
// Distance is intentionally soft — hard radius filtering already happened in
// Stage 1, so here it only breaks ties between equidistant candidates.
// Quality is a last-resort tiebreaker for dishes with sparse data.

const W = {
  similarity: 0.4, // primary: personalised vector match from user taste profile
  rating: 0.2, // dish quality signal from aggregated opinions
  popularity: 0.15, // interaction count proxy for crowd-sourced quality
  distance: 0.15, // soft proximity boost (hard radius already applied in Stage 1)
  quality: 0.1, // content completeness: photos, descriptions, ingredient data
} as const;

// Protein families that disqualify a dish from "vegetarian". Eggs are intentionally
// excluded — egg-primary dishes count as (lacto-ovo) vegetarian. Used by both the
// soft daily diet boost and the hard-diet option filter now that dietary_tags is retired.
const MEAT_FAMILIES: string[] = ['meat', 'poultry', 'fish', 'shellfish'];

// ── Types ─────────────────────────────────────────────────────────────────────

interface FeedRequest {
  location: { lat: number; lng: number };
  radius?: number;
  mode?: 'dishes' | 'restaurants' | 'combined';
  filters: {
    /**
     * HARD daily price bound. `[min, max]` where either end may be null = "no bound".
     * Candidates whose base price falls outside the bounds are dropped before ranking.
     * The client sends null at the slider floor/ceiling so an untouched slider is a no-op.
     */
    priceRange?: [number | null, number | null];
    dietPreference?: string;
    preferredDiet?: string;
    calorieRange?: { min: number; max: number };
    cuisines?: string[];
    spiceLevel?: string;
    spiceTolerance?: string;
    favoriteCuisines?: string[];
    sortBy?: 'closest' | 'bestMatch' | 'highestRated';
    openNow?: boolean;
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
    /** Filter for daily/rotating menus only. null = all menus. */
    scheduleType?: 'daily' | 'rotating';
    /** When true, only return dishes with serves >= 2 (group/family meals). */
    groupMeals?: boolean;
    /** Current time in HH:MM format for time-based menu filtering. */
    currentTime?: string;
    /** Current day of week: 'mon'|'tue'|'wed'|'thu'|'fri'|'sat'|'sun' */
    currentDayOfWeek?: string;
    /** User's preferred primary protein (permanent filter). Dishes matching receive a +0.30 boost. */
    primaryProtein?: string;
  };
  userId?: string;
  limit?: number;
}

// Modifier shapes mirror the worker schema (infra/supabase/functions/menu-scan-worker/index.ts)
// and migration 142's modifier_groups jsonb aggregation in generate_candidates.
interface ModifierOption {
  id: string;
  name: string;
  price_delta: number;
  price_override: number | null;
  primary_protein: string | null;
  serves_delta: number;
  is_default: boolean;
}

interface ModifierGroup {
  id: string;
  name: string;
  selection_type: 'single' | 'multiple';
  min_selections: number;
  max_selections: number;
  display_order: number;
  display_in_card: boolean;
  options: ModifierOption[];
}

// One auto-applied option, returned in the feed response so the mobile card
// renderer knows what config was scored against and which option(s) to surface
// in the dish-name suffix (when group_display_in_card=true).
interface AppliedOption {
  option_id: string;
  group_name: string;
  group_display_in_card: boolean;
  name: string;
  primary_protein: string | null;
  price_delta: number;
}

interface Candidate {
  id: string;
  restaurant_id: string;
  name: string;
  description: string | null;
  price: number;
  calories: number | null;
  spice_level: string | null;
  image_url: string | null;
  is_available: boolean;
  display_price_prefix: string;
  enrichment_status: string;
  vector_distance: number | null;
  distance_m: number;
  restaurant_name: string;
  restaurant_cuisines: string[];
  restaurant_rating: number;
  restaurant_location: Record<string, unknown>;
  restaurant_currency_code?: string;
  popularity_score: number;
  view_count: number;
  score?: number;
  protein_families?: string[];
  protein_canonical_names?: string[];
  primary_protein?: string | null;
  serves?: number;
  // Modifier-model fields surfaced by migration 142's generate_candidates rewrite.
  // `reachable_*` express the OR of base + every option (modifier reach), used
  // for "is there any way to consume this dish that matches user's daily filters?"
  // semantics.
  modifier_groups?: ModifierGroup[] | null;
  reachable_proteins?: string[];
  reachable_protein_families?: string[];
  dining_format?: string | null;
  bundled_items?: Array<{ name: string; note?: string | null }> | null;
  // Open-hours data folded into generate_candidates (§S3, migration 167) so the
  // feed no longer needs a second query to compute open-now per restaurant.
  open_hours?: Record<string, { open: string; close: string }> | null;
  timezone?: string | null;
  country_code?: string | null;
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
    /** Onboarding protein picks ('meat'|'fish'|'seafood'|'egg' — daily proteinTypes keyspace). */
    proteinPreferences?: string[];
    /** Onboarding favourite dish labels ('Tacos', 'Pizza', …) — matched against dish name. */
    favoriteDishes?: string[];
  },
  hasPreferenceVector: boolean,
  favoritedRestaurantIds: Set<string> = new Set()
): Candidate[] {
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

    // Daily price is now a HARD pre-rank filter (see applyHardPriceFilter), not a
    // soft boost — out-of-budget dishes are dropped before scoring, so nothing to do here.

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
    // Derived from primary_protein now that dietary_tags is retired: vegetarian =
    // no meat/poultry/fish/shellfish family (eggs allowed); vegan = primary_protein 'vegan'.
    // Uses the BASE protein_families (a veg dish with an optional meat add-on is still
    // fundamentally a veg dish), not the modifier-reach families.
    if (filters.preferredDiet && filters.preferredDiet !== 'all') {
      const families = d.protein_families ?? [];
      const matches =
        filters.preferredDiet === 'vegan'
          ? d.primary_protein === 'vegan'
          : !MEAT_FAMILIES.some(f => families.includes(f));
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

    // Onboarding favourite dishes (+0.10) — the dish name contains a favourite label
    // ('Tacos', 'Pizza', …). Mirrors the daily dishNames match; a positive taste
    // signal collected at onboarding, write-only until now.
    if (userPrefs.favoriteDishes?.length) {
      const nameLower = d.name.toLowerCase();
      if (userPrefs.favoriteDishes.some(fav => nameLower.includes(fav.toLowerCase()))) {
        score += 0.1;
      }
    }

    // Onboarding protein preferences (+0.10) — dish's base protein family overlaps a
    // preferred type. proteinPreferences use the daily proteinTypes keyspace, so reuse
    // the same family map. Only collected when dietType='all', so it's an additive
    // taste boost, never an exclusion.
    if (userPrefs.proteinPreferences?.length) {
      const familyMap: Record<string, string[]> = {
        meat: ['meat', 'poultry'],
        fish: ['fish'],
        seafood: ['shellfish'],
        egg: ['eggs'],
      };
      const wanted = new Set(userPrefs.proteinPreferences.flatMap(p => familyMap[p] ?? []));
      const fams = d.protein_families ?? [];
      if (wanted.size > 0 && fams.some(f => wanted.has(f))) score += 0.1;
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

    // Permanent primary protein preference boost (+0.30)
    if (filters.primaryProtein && d.primary_protein === filters.primaryProtein) {
      score += 0.3;
    }

    // Daily dish/meal type boost (+0.25) — explicit craving match
    if (filters.dishNames?.length) {
      const nameLower = d.name.toLowerCase();
      const matches = filters.dishNames.some(m => nameLower.includes(m.toLowerCase()));
      if (matches) score += 0.25;
    }

    // Soft daily protein type boost (+0.20)
    // Use reachable_protein_families when available — this is the OR of base + every option's
    // primary_protein-derived families, so dishes with a chicken modifier still match
    // proteinTypes='meat' even if the base is vegetarian. Falls back to protein_families
    // for legacy candidates.
    const proteinFamilies = d.reachable_protein_families?.length
      ? d.reachable_protein_families
      : d.protein_families;
    if (filters.proteinTypes?.length && proteinFamilies?.length) {
      const familyMap: Record<string, string[]> = {
        meat: ['meat', 'poultry'],
        fish: ['fish'],
        seafood: ['shellfish'],
        egg: ['eggs'],
      };
      const wantedFamilies = new Set(filters.proteinTypes.flatMap(p => familyMap[p] ?? []));
      if (proteinFamilies.some(f => wantedFamilies.has(f))) score += 0.2;
    }

    // Soft daily meat subtype boost (+0.10 additional on top of protein match)
    // Two-source matching: (a) base dish's protein_canonical_names for fine-grained matches
    // (beef_jerky vs beef, etc.), (b) reachable_proteins (primary_protein values from base
    // + every option) for coarse-but-modifier-aware matches. Mirror of phase-1-database.md §3.
    if (filters.meatTypes?.length && proteinFamilies?.length) {
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
        goat: ['goat'],
      };

      // Collect all concrete canonical names from named types (used for 'other' fallback)
      const allConcreteNames = new Set(Object.values(meatNameMap).flat());

      const namedTypes = filters.meatTypes.filter(m => m !== 'other');
      const wantedNames = new Set(namedTypes.flatMap(m => meatNameMap[m] ?? []));

      // Coarse-level set keyed by primary_protein value (chicken/beef/pork/lamb/goat)
      const wantedPrimaryProteins = new Set(
        namedTypes.filter(m => ['chicken', 'beef', 'pork', 'lamb', 'goat'].includes(m))
      );

      let matched =
        (wantedNames.size > 0 && d.protein_canonical_names?.some(n => wantedNames.has(n))) ||
        (wantedPrimaryProteins.size > 0 &&
          d.reachable_proteins?.some(p => wantedPrimaryProteins.has(p)));

      // 'other' = dish has meat/poultry protein but none of its canonical names are
      // in the known chicken/beef/pork/lamb/goat lists (turkey, veal, venison, etc.)
      if (!matched && filters.meatTypes.includes('other')) {
        const hasMeatFamily = proteinFamilies.some(f => f === 'meat' || f === 'poultry');
        const hasConcreteMatch = d.protein_canonical_names?.some(n => allConcreteNames.has(n));
        matched = hasMeatFamily && !hasConcreteMatch;
      }

      if (matched) score += 0.1;
    }

    return { ...d, score: Math.max(0, score) };
  });
}

// ── Modifier auto-selection ───────────────────────────────────────────────────
//
// `selectConfigForUser` picks ONE option per required group so the feed has a
// canonical "what would this dish actually look like for this user" view. The
// scoring rule for each option mirrors the dish-level scoring: protein match
// dominates, then price-delta as a tiebreaker, then is_default as a fallback.
// Optional groups (min_selections=0) are skipped — they default to "not applied".
//
// The user's hard diet filter (dietPreference) drops protein-overriding options
// from the pool BEFORE scoring, so the auto-selected config stays diet-consistent.
// The dish itself is filtered at SQL-level by required_groups_safe in
// generate_candidates, so a required group should always have a survivor; if it
// doesn't, the group is silently skipped (defensive).

function proteinToFamilies(protein: string | null | undefined): string[] {
  if (!protein) return [];
  if (protein === 'chicken') return ['meat', 'poultry'];
  if (['beef', 'pork', 'lamb', 'goat', 'other_meat'].includes(protein)) return ['meat'];
  if (protein === 'fish') return ['fish'];
  if (protein === 'shellfish') return ['shellfish'];
  if (protein === 'eggs') return ['eggs'];
  return [];
}

function matchesDailyProteinFamily(
  opt: ModifierOption,
  proteinTypes: string[] | undefined
): boolean {
  if (!proteinTypes?.length || !opt.primary_protein) return false;
  const familyMap: Record<string, string[]> = {
    meat: ['meat', 'poultry'],
    fish: ['fish'],
    seafood: ['shellfish'],
    egg: ['eggs'],
  };
  const wantedFamilies = new Set(proteinTypes.flatMap(p => familyMap[p] ?? []));
  return proteinToFamilies(opt.primary_protein).some(f => wantedFamilies.has(f));
}

interface SelectedConfig {
  applied_options: AppliedOption[];
  effective_price: number;
  effective_primary_protein: string | null;
}

// A modifier option violates a hard diet filter when its primary_protein override
// would push the dish outside the diet. vegan → only 'vegan' (or no override) is safe;
// vegetarian → meat/poultry/fish/shellfish overrides are unsafe (eggs/veg/vegan OK).
function violatesDietHard(protein: string | null | undefined, dietHard: string | null): boolean {
  if (!dietHard || !protein) return false;
  if (dietHard === 'vegan') return protein !== 'vegan';
  return proteinToFamilies(protein).some(f => MEAT_FAMILIES.includes(f));
}

function selectConfigForUser(dish: Candidate, filters: FeedRequest['filters']): SelectedConfig {
  const applied: AppliedOption[] = [];
  let proteinOverride: string | null = null;
  let totalDelta = 0;
  let overridePrice: number | null = null;

  const dietHard =
    filters.dietPreference && filters.dietPreference !== 'all' ? filters.dietPreference : null;

  const groups = Array.isArray(dish.modifier_groups) ? dish.modifier_groups : [];
  const sortedGroups = [...groups].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));

  for (const group of sortedGroups) {
    // Optional groups (min_selections=0) default to "not applied". The feed shows
    // the dish at its base configuration; mobile UI lets the user toggle optional
    // add-ons in the dish detail screen.
    if ((group.min_selections ?? 0) < 1) continue;

    // Drop options whose protein override would break the user's hard diet filter,
    // so the auto-selected config the feed scores against stays diet-consistent.
    // (Unavailable options are already pre-filtered by the SQL options subquery.)
    const surviving = (group.options ?? []).filter(
      opt => !violatesDietHard(opt.primary_protein, dietHard)
    );

    // SQL (required_groups_safe) already guarantees a survivor for required groups;
    // skip defensively if an in-JS edge case eliminates them all.
    if (surviving.length === 0) continue;

    const scored = surviving.map(opt => {
      let s = 0;
      if (opt.primary_protein && opt.primary_protein === filters.primaryProtein) s += 100;
      if (opt.primary_protein && filters.meatTypes?.includes(opt.primary_protein)) s += 50;
      if (matchesDailyProteinFamily(opt, filters.proteinTypes)) s += 30;
      s -= (opt.price_delta ?? 0) * 0.5; // tie-break: cheaper wins
      if (opt.is_default) s += 1;
      return { opt, s };
    });
    scored.sort((a, b) => b.s - a.s);
    const winner = scored[0].opt;

    applied.push({
      option_id: winner.id,
      group_name: group.name,
      group_display_in_card: group.display_in_card ?? false,
      name: winner.name,
      primary_protein: winner.primary_protein ?? null,
      price_delta: winner.price_delta ?? 0,
    });

    if (winner.primary_protein) proteinOverride = winner.primary_protein;

    if (winner.price_override !== null && winner.price_override !== undefined) {
      overridePrice = winner.price_override;
    } else {
      totalDelta += winner.price_delta ?? 0;
    }
  }

  const basePrice = dish.price ?? 0;
  const effective_price = overridePrice !== null ? overridePrice : basePrice + totalDelta;

  return {
    applied_options: applied,
    effective_price,
    effective_primary_protein: proteinOverride ?? dish.primary_protein ?? null,
  };
}

// ── Hard daily price filter ───────────────────────────────────────────────────
//
// The daily price slider is a HARD bound (was a soft +0.08 boost until batch 2).
// `priceRange = [min, max]`, either end null = "no bound" (slider at floor/ceiling).
// Filters on BASE price; the effective price (default modifier options applied) is
// computed later in selectConfigForUser, so a dish whose default options push it over
// budget can still slip through — accepted for v1 (most dishes have no positive default
// delta). Dishes with a null price are kept rather than hidden on missing data.

function applyHardPriceFilter(
  dishes: Candidate[],
  priceRange: [number | null, number | null] | undefined
): Candidate[] {
  if (!priceRange) return dishes;
  const [minP, maxP] = priceRange;
  if (minP == null && maxP == null) return dishes;
  return dishes.filter(d => {
    if (d.price == null) return true;
    if (minP != null && d.price < minP) return false;
    if (maxP != null && d.price > maxP) return false;
    return true;
  });
}

// ── Diversity cap ─────────────────────────────────────────────────────────────

function applyDiversity(dishes: Candidate[], maxPerRestaurant: number): Candidate[] {
  const result: Candidate[] = [];
  const restaurantCounts = new Map<string, number>();
  for (const d of dishes) {
    const rn = restaurantCounts.get(d.restaurant_id) ?? 0;
    if (rn >= maxPerRestaurant) continue;
    result.push(d);
    restaurantCounts.set(d.restaurant_id, rn + 1);
  }
  return result;
}

// ── Open-now (timezone-correct) ──────────────────────────────────────────────
//
// open_hours are stored in each restaurant's LOCAL time. The Edge runtime clock
// is UTC, so "now" must be evaluated in the restaurant's own IANA zone via Intl —
// otherwise a CDMX (UTC-6) restaurant reads as closed every evening once UTC
// rolls past midnight, and the map loses all its dishes. tz comes from
// restaurants.timezone, falling back to country_code below.
//
// COUNTRY_TO_TZ mirrors the SQL backfill in migration 149 — keep in lockstep.
const COUNTRY_TO_TZ: Record<string, string> = {
  MX: 'America/Mexico_City',
  US: 'America/New_York',
  CA: 'America/Toronto',
  BR: 'America/Sao_Paulo',
  CO: 'America/Bogota',
  AR: 'America/Argentina/Buenos_Aires',
  CL: 'America/Santiago',
  EC: 'America/Guayaquil',
  SV: 'America/El_Salvador',
  PA: 'America/Panama',
  GB: 'Europe/London',
  IE: 'Europe/Dublin',
  PT: 'Europe/Lisbon',
  ES: 'Europe/Madrid',
  FR: 'Europe/Paris',
  DE: 'Europe/Berlin',
  IT: 'Europe/Rome',
  NL: 'Europe/Amsterdam',
  BE: 'Europe/Brussels',
  AT: 'Europe/Vienna',
  GR: 'Europe/Athens',
  FI: 'Europe/Helsinki',
  PL: 'Europe/Warsaw',
  AU: 'Australia/Sydney',
  JP: 'Asia/Tokyo',
};

function resolveTimezone(
  timezone: string | null | undefined,
  countryCode: string | null | undefined
): string | null {
  return timezone ?? COUNTRY_TO_TZ[(countryCode ?? '').toUpperCase()] ?? null;
}

// Current weekday (lowercase) + minutes-since-midnight in the given IANA zone.
function localNowInZone(tz: string): { weekday: string; minutes: number } | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date());
    const weekday = parts.find(p => p.type === 'weekday')?.value.toLowerCase() ?? '';
    let hh = Number(parts.find(p => p.type === 'hour')?.value ?? '0');
    const mm = Number(parts.find(p => p.type === 'minute')?.value ?? '0');
    if (hh === 24) hh = 0; // some ICU builds emit "24" at midnight
    if (!weekday || Number.isNaN(hh) || Number.isNaN(mm)) return null;
    return { weekday, minutes: hh * 60 + mm };
  } catch {
    return null; // invalid / unknown tz id
  }
}

function isOpenNow(
  openHours: Record<string, { open: string; close: string }> | null | undefined,
  tz: string | null | undefined
): boolean {
  if (!openHours) return false; // no/empty hours → closed (intentional; see places.ts import)
  if (!tz) return true; // hours known but zone unknown → show rather than mis-evaluate
  const now = localNowInZone(tz);
  if (!now) return true; // bad tz id → show rather than hide
  const entry = openHours[now.weekday];
  if (!entry) return false; // closed that day
  const [oh, om] = entry.open.split(':').map(Number);
  const [ch, cm] = entry.close.split(':').map(Number);
  const openMin = oh * 60 + om;
  const closeMin = ch * 60 + cm;
  // Handle overnight spans (e.g. open 22:00, close 02:00)
  if (closeMin < openMin) return now.minutes >= openMin || now.minutes < closeMin;
  return now.minutes >= openMin && now.minutes < closeMin;
}

// ── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const corsHeaders = buildCorsHeaders(req.headers.get('Origin'));
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const body: FeedRequest = await req.json();
    // `filters` defaults to {} — a request without a filters field must not crash.
    // Every filters.* access downstream is on an optional property, so {} is safe.
    const { location, radius = 10, mode = 'combined', filters = {}, userId, limit = 20 } = body;

    console.log('[Feed] Request:', { location, radius, mode, userId, limit });

    if (!location?.lat || !location?.lng) {
      return new Response(JSON.stringify({ error: 'Invalid location' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Cache check ───────────────────────────────────────────────────────────

    // v2: cache key bumped after modifier-aware rewrite so legacy cached responses
    // without applied_options/effective_* fields are not returned. Old entries
    // expire naturally via TTL (5 min) — no manual flush needed.
    //
    // currentTime is deliberately EXCLUDED from the key: it changes every minute and
    // would shatter the cache (≥4 misses per 5-min TTL window — hit rate ≈ 0). The RPC
    // still applies time filtering server-side via p_current_time, and the 300s TTL
    // bounds any open/closed drift to ≤5 min. currentDayOfWeek is kept — it changes
    // only daily and correctly separates each day's open-hours / daily menus.
    const { currentTime: _ignoredInCacheKey, ...cacheFilters } = filters ?? {};
    const cacheKey = `feed:v2:${userId ?? 'anon'}:${location.lat.toFixed(3)}:${location.lng.toFixed(3)}:${JSON.stringify(cacheFilters)}`;
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
    let dbPreferredPriceRange: [number, number] | null = null;
    let dbProteinPreferences: string[] = [];
    let dbFavoriteDishes: string[] = [];

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
          .select('spice_tolerance, favorite_cuisines, protein_preferences, favorite_dishes')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('user_behavior_profiles')
          .select('preference_vector, preferred_cuisines, preferred_price_range')
          .eq('user_id', userId)
          .maybeSingle(),
        // Load favourited restaurants to boost their dishes in scoring (join cuisine_types)
        supabase
          .from('favorites')
          .select('subject_id, restaurant:restaurants(cuisine_types)')
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

      // Favourited restaurants → boost their dishes + extract cuisine types (from join)
      if (favoritesRes.data && favoritesRes.data.length > 0) {
        const favIds = favoritesRes.data.map((f: any) => f.subject_id);
        favoritedRestaurantIds = new Set(favIds);
        const favCuisines = favoritesRes.data.flatMap(
          (f: any) => (f.restaurant?.cuisine_types as string[]) ?? []
        );
        if (favCuisines.length > 0) {
          userLikedCuisines = [...new Set([...userLikedCuisines, ...favCuisines])];
        }
      }

      if (prefsRes.data) {
        dbSpiceTolerance = prefsRes.data.spice_tolerance ?? null;
        dbFavoriteCuisines = Array.isArray(prefsRes.data.favorite_cuisines)
          ? prefsRes.data.favorite_cuisines
          : [];
        dbProteinPreferences = Array.isArray(prefsRes.data.protein_preferences)
          ? prefsRes.data.protein_preferences
          : [];
        dbFavoriteDishes = Array.isArray(prefsRes.data.favorite_dishes)
          ? prefsRes.data.favorite_dishes
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
    const preferredPriceRange = dbPreferredPriceRange;
    const proteinPreferences = dbProteinPreferences;
    const favoriteDishes = dbFavoriteDishes;
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
      p_diet_tag: hardDietTag,
      p_exclude_families: filters.excludeFamilies?.length ? filters.excludeFamilies : null,
      p_exclude_spicy: filters.excludeSpicy ?? false,
      p_limit: 200,
      // Universal dish structure: new filter parameters
      p_current_time: filters.currentTime ?? null,
      p_current_day: filters.currentDayOfWeek ?? null,
      p_schedule_type: filters.scheduleType ?? null,
      p_group_meals: filters.groupMeals ?? false,
    })) as { data: Candidate[] | null; error: unknown };

    if (candidateError) {
      console.error('[Feed] generate_candidates failed:', candidateError);
      throw candidateError;
    }

    const pool = candidates ?? [];
    console.log(`[Feed] Stage 1: ${pool.length} candidates`);

    if (pool.length === 0) {
      return new Response(
        JSON.stringify({
          dishes: [],
          restaurants: [],
          metadata: { totalAvailable: 0, returned: 0, cached: false },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const annotated: Candidate[] = pool;

    // ── Protein family annotation ─────────────────────────────────────────────
    // protein_families and protein_canonical_names are now precomputed columns
    // on dishes, returned directly by generate_candidates() (migration 070).
    // No extra DB query needed here — rankCandidates() uses d.protein_families
    // and d.protein_canonical_names that are already present in the candidate rows.

    // ── Hard daily price filter (pre-rank) ────────────────────────────────────
    // Applied to the candidate pool before scoring so out-of-budget dishes never
    // surface. Note: runs AFTER generate_candidates' 200-row cap, so a very tight
    // band could thin results — acceptable for v1 (escalation = push the bound into
    // the SQL). null result is impossible here; an empty result returns [] cleanly.

    const inBudget = applyHardPriceFilter(annotated, filters.priceRange);
    if (filters.priceRange) {
      console.log(`[Feed] Price filter: ${annotated.length} → ${inBudget.length} candidates`);
    }

    // ── Stage 2: rank ─────────────────────────────────────────────────────────

    console.log('[Feed] Stage 2: scoring');

    const scored = rankCandidates(
      inBudget,
      filters,
      radius,
      userLikedCuisines,
      { spiceTolerance, favoriteCuisines, preferredPriceRange, proteinPreferences, favoriteDishes },
      preferenceVector !== null,
      favoritedRestaurantIds
    );

    scored.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const diversified = applyDiversity(scored, 3);

    // ── Build open-now map from candidate rows (no extra query) ──────────────
    // open_hours / timezone / country_code are returned by generate_candidates
    // (§S3, migration 167), so the per-restaurant open-now data is already in
    // memory on the candidate rows — the second DB round-trip is gone.

    const openInfoMap = new Map<
      string,
      { openHours: Record<string, { open: string; close: string }> | null; tz: string | null }
    >();
    for (const d of diversified) {
      if (openInfoMap.has(d.restaurant_id)) continue;
      openInfoMap.set(d.restaurant_id, {
        openHours: d.open_hours ?? null,
        tz: resolveTimezone(d.timezone, d.country_code),
      });
    }

    // ── Build dishes result ──────────────────────────────────────────────────

    // Always exclude closed restaurants from recommendations — a dish you can't
    // buy right now is not a useful recommendation. The `filters.openNow` toggle
    // is redundant but preserved for API compatibility.
    const dishPool = diversified.filter(d => {
      const info = openInfoMap.get(d.restaurant_id);
      return isOpenNow(info?.openHours, info?.tz);
    });

    const dishResult =
      mode === 'restaurants'
        ? []
        : dishPool.slice(0, limit).map(d => {
            const config = selectConfigForUser(d, filters);
            return {
              id: d.id,
              restaurant_id: d.restaurant_id,
              name: d.name,
              description: d.description,
              price: d.price,
              display_price_prefix: d.display_price_prefix,
              calories: d.calories,
              image_url: d.image_url,
              spice_level: d.spice_level,
              is_available: d.is_available,
              serves: d.serves,
              // v2 modifier-aware fields
              dining_format: d.dining_format ?? null,
              bundled_items: d.bundled_items ?? null,
              modifier_groups: d.modifier_groups ?? [],
              applied_options: config.applied_options,
              effective_price: config.effective_price,
              effective_primary_protein: config.effective_primary_protein,
              restaurant: {
                id: d.restaurant_id,
                name: d.restaurant_name,
                cuisine_types: d.restaurant_cuisines,
                rating: d.restaurant_rating,
                currency_code: d.restaurant_currency_code ?? 'USD',
              },
              distance_km: d.distance_m / 1000,
              score: d.score,
            };
          });

    // ── Build restaurants result ─────────────────────────────────────────────

    let restaurantResult: any[] = [];
    if (mode !== 'dishes') {
      const restaurantMap = new Map<string, any>();
      for (const d of diversified) {
        const rid = d.restaurant_id;
        if (!restaurantMap.has(rid)) {
          const info = openInfoMap.get(rid);
          restaurantMap.set(rid, {
            id: rid,
            name: d.restaurant_name,
            cuisine_types: d.restaurant_cuisines ?? [],
            rating: d.restaurant_rating ?? 0,
            distance_km: d.distance_m / 1000,
            score: d.score ?? 0,
            location: d.restaurant_location ?? null,
            is_open: isOpenNow(info?.openHours, info?.tz),
          });
        } else {
          const ex = restaurantMap.get(rid);
          if ((d.score ?? 0) > ex.score) ex.score = d.score;
        }
      }

      let restaurantList = Array.from(restaurantMap.values());

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

      // Restaurant limit is higher than dish limit (spatial coverage for map pins)
      restaurantResult = restaurantList.slice(0, Math.max(limit, 50));
    }

    // ── Response ─────────────────────────────────────────────────────────────

    const responseData = {
      dishes: dishResult,
      restaurants: restaurantResult,
      metadata: {
        totalAvailable: pool.length,
        returnedDishes: dishResult.length,
        returnedRestaurants: restaurantResult.length,
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

    console.log(
      `[Feed] Returning ${dishResult.length} dishes + ${restaurantResult.length} restaurants (${Date.now() - startTime}ms)`
    );

    // Compress response if client supports gzip
    const acceptEncoding = req.headers.get('Accept-Encoding') ?? '';
    if (acceptEncoding.includes('gzip')) {
      return compressedJsonResponse(responseData, corsHeaders);
    }

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
