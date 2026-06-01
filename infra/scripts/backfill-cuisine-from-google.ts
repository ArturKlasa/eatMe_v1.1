#!/usr/bin/env ts-node
/**
 * infra/scripts/backfill-cuisine-from-google.ts
 *
 * Phase 2b backfill for docs/plans/cuisine-data-integrity.md.
 *
 * Re-infers `restaurants.cuisine_types` from the Google Places API for rows that
 * have an EMPTY cuisine but DO have a `google_place_id` (i.e. Google-imported
 * restaurants that lost their cuisine before the Phase 1 import fix). For each,
 * it fetches `types` + `primaryType`, runs the (expanded) inference + normalizer,
 * and writes the canonical result back.
 *
 * Usage (from infra/scripts/):
 *   ts-node backfill-cuisine-from-google.ts --dry-run --limit=25   # sample preview
 *   ts-node backfill-cuisine-from-google.ts --dry-run              # full preview (calls API)
 *   ts-node backfill-cuisine-from-google.ts                        # apply (writes)
 *
 * Flags:
 *   --dry-run     Fetch + infer and log what WOULD be written, but write nothing.
 *   --limit=N     Process only the first N candidates (sampling; 0 = all).
 *
 * Env (infra/scripts/.env):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_PLACES_API_KEY
 *   BATCH_CONCURRENCY (default 5), BATCH_DELAY_MS (default 500)
 *
 * NOTE: GOOGLE_TYPE_TO_CUISINE / inferCuisineFromGoogleTypes are copies of
 * apps/web-portal/lib/google-places.ts, and normalizeCuisines / ALL_CUISINES are
 * copies of packages/shared/src/constants/cuisine.ts. A standalone ts-node script
 * cannot cleanly import either. Keep in sync.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY ?? '';
const BATCH_CONCURRENCY = parseInt(process.env.BATCH_CONCURRENCY ?? '5', 10);
const BATCH_DELAY_MS = parseInt(process.env.BATCH_DELAY_MS ?? '500', 10);
const DRY_RUN = process.argv.includes('--dry-run');
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1] ?? '0', 10) : 0;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !GOOGLE_PLACES_API_KEY) {
  console.error(
    '❌  Missing required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_PLACES_API_KEY'
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ── normalizeCuisines (copy of packages/shared/src/constants/cuisine.ts) ────────

const ALL_CUISINES = [
  'Afghan',
  'African',
  'American',
  'Argentine',
  'Asian',
  'BBQ',
  'Bakery',
  'Brazilian',
  'Breakfast',
  'British',
  'Café',
  'Cajun',
  'Caribbean',
  'Chinese',
  'Colombian',
  'Comfort Food',
  'Cuban',
  'Deli',
  'Desserts',
  'Ethiopian',
  'Fast Food',
  'Filipino',
  'Fine Dining',
  'French',
  'Fusion',
  'German',
  'Greek',
  'Halal',
  'Hawaiian',
  'Healthy',
  'Indian',
  'Indonesian',
  'International',
  'Irish',
  'Italian',
  'Jamaican',
  'Japanese',
  'Korean',
  'Kosher',
  'Latin American',
  'Lebanese',
  'Malaysian',
  'Mediterranean',
  'Mexican',
  'Middle Eastern',
  'Moroccan',
  'Nepalese',
  'Pakistani',
  'Peruvian',
  'Pizza',
  'Polish',
  'Portuguese',
  'Russian',
  'Salad',
  'Sandwiches',
  'Seafood',
  'Soul Food',
  'Southern',
  'Spanish',
  'Steakhouse',
  'Sushi',
  'Taiwanese',
  'Tapas',
  'Thai',
  'Turkish',
  'Vegan',
  'Vegetarian',
  'Vietnamese',
  'Other',
] as const;

const DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g');
const foldCuisine = (s: string): string =>
  s.normalize('NFD').replace(DIACRITICS, '').trim().toLowerCase();
const CANONICAL_BY_FOLD = new Map<string, string>(ALL_CUISINES.map(c => [foldCuisine(c), c]));

function normalizeCuisines(input: readonly string[] | null | undefined): string[] {
  const out: string[] = [];
  for (const raw of input ?? []) {
    if (typeof raw !== 'string') continue;
    const canonical = CANONICAL_BY_FOLD.get(foldCuisine(raw));
    if (canonical && !out.includes(canonical)) out.push(canonical);
  }
  return out;
}

// ── inferCuisineFromGoogleTypes (copy of apps/web-portal/lib/google-places.ts) ──

const GOOGLE_TYPE_TO_CUISINE: Record<string, string> = {
  mexican_restaurant: 'Mexican',
  italian_restaurant: 'Italian',
  chinese_restaurant: 'Chinese',
  japanese_restaurant: 'Japanese',
  thai_restaurant: 'Thai',
  indian_restaurant: 'Indian',
  french_restaurant: 'French',
  korean_restaurant: 'Korean',
  vietnamese_restaurant: 'Vietnamese',
  greek_restaurant: 'Greek',
  turkish_restaurant: 'Turkish',
  lebanese_restaurant: 'Lebanese',
  spanish_restaurant: 'Spanish',
  brazilian_restaurant: 'Brazilian',
  american_restaurant: 'American',
  mediterranean_restaurant: 'Mediterranean',
  seafood_restaurant: 'Seafood',
  steak_house: 'Steakhouse',
  sushi_restaurant: 'Sushi',
  pizza_restaurant: 'Pizza',
  hamburger_restaurant: 'American',
  barbecue_restaurant: 'BBQ',
  vegan_restaurant: 'Vegan',
  vegetarian_restaurant: 'Vegetarian',
  ramen_restaurant: 'Japanese',
  breakfast_restaurant: 'Breakfast',
  brunch_restaurant: 'Breakfast',
  bakery: 'Bakery',
  ice_cream_shop: 'Desserts',
  dessert_shop: 'Desserts',
  dessert_restaurant: 'Desserts',
  cafe: 'Café',
  coffee_shop: 'Café',
  coffee_roastery: 'Café',
  coffee_stand: 'Café',
  tea_house: 'Café',
  deli: 'Deli',
  sandwich_shop: 'Sandwiches',
  salad_shop: 'Salad',
  fast_food_restaurant: 'Fast Food',
  fine_dining_restaurant: 'Fine Dining',
  halal_restaurant: 'Halal',
  fusion_restaurant: 'Fusion',
  asian_fusion_restaurant: 'Fusion',
  afghani_restaurant: 'Afghan',
  african_restaurant: 'African',
  argentinian_restaurant: 'Argentine',
  asian_restaurant: 'Asian',
  british_restaurant: 'British',
  cajun_restaurant: 'Cajun',
  caribbean_restaurant: 'Caribbean',
  colombian_restaurant: 'Colombian',
  cuban_restaurant: 'Cuban',
  ethiopian_restaurant: 'Ethiopian',
  filipino_restaurant: 'Filipino',
  german_restaurant: 'German',
  hawaiian_restaurant: 'Hawaiian',
  indonesian_restaurant: 'Indonesian',
  irish_restaurant: 'Irish',
  irish_pub: 'Irish',
  latin_american_restaurant: 'Latin American',
  malaysian_restaurant: 'Malaysian',
  middle_eastern_restaurant: 'Middle Eastern',
  persian_restaurant: 'Middle Eastern',
  israeli_restaurant: 'Middle Eastern',
  moroccan_restaurant: 'Moroccan',
  pakistani_restaurant: 'Pakistani',
  peruvian_restaurant: 'Peruvian',
  polish_restaurant: 'Polish',
  portuguese_restaurant: 'Portuguese',
  russian_restaurant: 'Russian',
  soul_food_restaurant: 'Soul Food',
  taiwanese_restaurant: 'Taiwanese',
  tapas_restaurant: 'Tapas',
  cantonese_restaurant: 'Chinese',
  dim_sum_restaurant: 'Chinese',
  chinese_noodle_restaurant: 'Chinese',
  dumpling_restaurant: 'Chinese',
  hot_pot_restaurant: 'Chinese',
  japanese_izakaya_restaurant: 'Japanese',
  japanese_curry_restaurant: 'Japanese',
  tonkatsu_restaurant: 'Japanese',
  yakitori_restaurant: 'Japanese',
  yakiniku_restaurant: 'Japanese',
  north_indian_restaurant: 'Indian',
  south_indian_restaurant: 'Indian',
  taco_restaurant: 'Mexican',
  burrito_restaurant: 'Mexican',
  tex_mex_restaurant: 'Mexican',
  korean_barbecue_restaurant: 'Korean',
  gyro_restaurant: 'Middle Eastern',
  shawarma_restaurant: 'Middle Eastern',
  falafel_restaurant: 'Middle Eastern',
  kebab_shop: 'Middle Eastern',
  fish_and_chips_restaurant: 'British',
  chicken_restaurant: 'American',
  hot_dog_restaurant: 'American',
  chicken_wings_restaurant: 'American',
};

function inferCuisineFromGoogleTypes(types: string[], primaryType?: string): string[] {
  const cuisines: string[] = [];
  const allTypes = primaryType ? [primaryType, ...types] : types;
  for (const type of allTypes) {
    const cuisine = GOOGLE_TYPE_TO_CUISINE[type];
    if (cuisine && !cuisines.includes(cuisine)) cuisines.push(cuisine);
  }
  return cuisines;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface RestaurantRow {
  id: string;
  name: string;
  cuisine_types: string[] | null;
  google_place_id: string;
}

type Outcome = 'populated' | 'still_empty' | 'failed';

interface Result {
  name: string;
  outcome: Outcome;
  cuisines?: string[];
  googleTypes?: string[];
  error?: string;
}

async function fetchPlaceTypes(
  placeId: string
): Promise<{ types: string[]; primaryType?: string }> {
  const res = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
    {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask': 'types,primaryType',
      },
    }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Places Details HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { types?: string[]; primaryType?: string };
  return { types: json.types ?? [], primaryType: json.primaryType };
}

async function backfillOne(row: RestaurantRow): Promise<Result> {
  try {
    const { types, primaryType } = await fetchPlaceTypes(row.google_place_id);
    const cuisines = normalizeCuisines(inferCuisineFromGoogleTypes(types, primaryType));
    const googleTypes = primaryType ? [primaryType, ...types] : types;

    if (cuisines.length === 0) {
      return { name: row.name, outcome: 'still_empty', googleTypes };
    }

    if (!DRY_RUN) {
      const { error } = await supabase
        .from('restaurants')
        .update({ cuisine_types: cuisines })
        .eq('id', row.id);
      if (error) return { name: row.name, outcome: 'failed', error: error.message };
    }
    return { name: row.name, outcome: 'populated', cuisines };
  } catch (err) {
    return { name: row.name, outcome: 'failed', error: String(err) };
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('🚀  EatMe cuisine re-inference from Google (Phase 2b)');
  console.log(`   Mode:        ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);
  console.log(`   Limit:       ${LIMIT > 0 ? LIMIT : 'all'}`);
  console.log(`   Concurrency: ${BATCH_CONCURRENCY}, delay ${BATCH_DELAY_MS}ms\n`);

  const { data, error } = await supabase
    .from('restaurants')
    .select('id, name, cuisine_types, google_place_id')
    .not('google_place_id', 'is', null)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('❌  Failed to fetch restaurants:', error.message);
    process.exit(1);
  }

  let candidates = ((data ?? []) as RestaurantRow[]).filter(
    r => (r.cuisine_types ?? []).length === 0
  );
  if (LIMIT > 0) candidates = candidates.slice(0, LIMIT);
  const total = candidates.length;

  if (total === 0) {
    console.log('✅  No empty-cuisine restaurants with a Place ID — nothing to do.');
    return;
  }

  console.log(`📋  Processing ${total} empty-cuisine restaurant(s) with a Place ID\n`);

  let populated = 0;
  let stillEmpty = 0;
  let failed = 0;
  const startTime = Date.now();

  for (let i = 0; i < total; i += BATCH_CONCURRENCY) {
    const batch = candidates.slice(i, i + BATCH_CONCURRENCY);
    const results = await Promise.all(batch.map(backfillOne));

    for (const r of results) {
      if (r.outcome === 'populated') {
        populated++;
        const verb = DRY_RUN ? 'would set' : 'set';
        console.log(`  ✓ ${r.name} — ${verb} ${JSON.stringify(r.cuisines)}`);
      } else if (r.outcome === 'still_empty') {
        stillEmpty++;
        console.log(`  – ${r.name} — no cuisine (google: ${JSON.stringify(r.googleTypes)})`);
      } else {
        failed++;
        console.error(`  ✗ ${r.name} — ${r.error}`);
      }
    }

    if (i + BATCH_CONCURRENCY < total) await sleep(BATCH_DELAY_MS);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const hitRate = total > 0 ? ((populated / total) * 100).toFixed(0) : '0';
  console.log('\n' + '─'.repeat(60));
  console.log(`✅  ${DRY_RUN ? 'Dry run' : 'Backfill'} complete in ${elapsed}s`);
  console.log(`   Populated:   ${populated}/${total}  (${hitRate}% hit rate)`);
  console.log(`   Still empty: ${stillEmpty}/${total}`);
  if (failed > 0) console.log(`   Failed:      ${failed}/${total}`);
  if (DRY_RUN) console.log('\n   Re-run without --dry-run to apply these changes.');
}

main().catch(err => {
  console.error('❌  Fatal error:', err);
  process.exit(1);
});
