#!/usr/bin/env ts-node
/**
 * infra/scripts/backfill-cuisine-from-dishes.ts
 *
 * Phase 3a backfill for docs/plans/cuisine-data-integrity.md.
 *
 * Classifies `restaurants.cuisine_types` for rows that have an EMPTY cuisine but
 * DO have dishes already in the menu (the ~18 restaurants Google couldn't classify
 * in Phase 2b — generic `restaurant`/`bar` Place types — but whose actual menu
 * makes the cuisine obvious). For each, it reads up to MAX_DISHES dish names, asks
 * gpt-4o-mini for 1–3 cuisines drawn ONLY from the canonical list, runs the result
 * through normalizeCuisines (the safety gate that drops any hallucinated value),
 * and writes the canonical result back. Never overwrites a non-empty cuisine.
 *
 * Restaurants with ZERO dishes are skipped entirely — there's nothing to infer
 * from. Those self-heal later via the menu-scan-worker change (Phase 3b).
 *
 * Usage (from infra/scripts/):
 *   ts-node backfill-cuisine-from-dishes.ts --dry-run --limit=5   # sample preview
 *   ts-node backfill-cuisine-from-dishes.ts --dry-run             # full preview (calls OpenAI)
 *   ts-node backfill-cuisine-from-dishes.ts                       # apply (writes)
 *
 * Flags:
 *   --dry-run     Infer and log what WOULD be written, but write nothing.
 *   --limit=N     Process only the first N candidates (sampling; 0 = all).
 *
 * Env (infra/scripts/.env):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY
 *   BATCH_CONCURRENCY (default 3), BATCH_DELAY_MS (default 500)
 *
 * NOTE: normalizeCuisines / ALL_CUISINES are copies of
 * packages/shared/src/constants/cuisine.ts. A standalone ts-node script cannot
 * cleanly import @eatme/shared (its main is raw TS). Keep in sync.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';
const BATCH_CONCURRENCY = parseInt(process.env.BATCH_CONCURRENCY ?? '3', 10);
const BATCH_DELAY_MS = parseInt(process.env.BATCH_DELAY_MS ?? '500', 10);
const MODEL = 'gpt-4o-mini';
const MAX_DISHES = 40; // dish names sampled per restaurant (cap prompt size)
const DRY_RUN = process.argv.includes('--dry-run');
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1] ?? '0', 10) : 0;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !OPENAI_API_KEY) {
  console.error(
    '❌  Missing required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY'
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

// ── Cuisine inference from dish names (gpt-4o-mini, raw fetch — no SDK dep) ──────

const CANONICAL_LIST = ALL_CUISINES.join(', ');

const SYSTEM_PROMPT = `You classify a restaurant's cuisine(s) from its dish names.
Choose the 1 to 3 cuisines that BEST describe the restaurant overall, ordered most representative first.

STRICT RULES:
- Choose ONLY from this exact canonical list, copying values verbatim (case-sensitive, keep accents):
${CANONICAL_LIST}
- Prefer a specific national cuisine (e.g. "Mexican", "Italian", "Lebanese") over a broad one ("International", "Other") when the dishes clearly point to it.
- Use at most 3. Use exactly 1 when the restaurant is clearly single-cuisine.
- If the dishes don't clearly indicate any cuisine (e.g. a bar listing only spirits/cocktails, or an unreadable set), return an empty array. Do NOT guess.
- Respond ONLY with JSON of the form: {"cuisines": ["X", "Y"]}`;

interface OpenAIChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
}

async function inferCuisinesFromDishes(name: string, dishNames: string[]): Promise<string[]> {
  const userContent = `Restaurant name: "${name}"\nDish names:\n${dishNames
    .map(d => `- ${d}`)
    .join('\n')}`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenAI HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  const json = (await res.json()) as OpenAIChatResponse;
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI returned empty content');

  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    throw new Error(`OpenAI returned non-JSON: ${content.slice(0, 120)}`);
  }
  const arr = (raw as { cuisines?: unknown }).cuisines;
  const list = Array.isArray(arr) ? (arr.filter(x => typeof x === 'string') as string[]) : [];
  // normalize (drops hallucinated / non-canonical values, dedupes) then cap at 3
  return normalizeCuisines(list).slice(0, 3);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface RestaurantRow {
  id: string;
  name: string;
  cuisine_types: string[] | null;
}

type Outcome = 'populated' | 'still_empty' | 'failed';

interface Result {
  name: string;
  outcome: Outcome;
  cuisines?: string[];
  sampleDishes?: string[];
  error?: string;
}

async function fetchDishNames(restaurantId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('dishes')
    .select('name')
    .eq('restaurant_id', restaurantId)
    .eq('is_parent', false) // skip display-only variant containers
    .order('created_at', { ascending: true })
    .limit(MAX_DISHES);
  if (error) throw new Error(`fetch dishes: ${error.message}`);
  return (data ?? []).map(d => (d.name ?? '').trim()).filter(Boolean);
}

async function backfillOne(row: RestaurantRow): Promise<Result> {
  try {
    const dishNames = await fetchDishNames(row.id);
    if (dishNames.length === 0) {
      return { name: row.name, outcome: 'still_empty', sampleDishes: [] };
    }

    const cuisines = await inferCuisinesFromDishes(row.name, dishNames);

    if (cuisines.length === 0) {
      return { name: row.name, outcome: 'still_empty', sampleDishes: dishNames.slice(0, 5) };
    }

    if (!DRY_RUN) {
      const { error } = await supabase
        .from('restaurants')
        .update({ cuisine_types: cuisines })
        .eq('id', row.id);
      if (error) return { name: row.name, outcome: 'failed', error: error.message };
    }
    return { name: row.name, outcome: 'populated', cuisines, sampleDishes: dishNames.slice(0, 5) };
  } catch (err) {
    return { name: row.name, outcome: 'failed', error: String(err) };
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('🚀  EatMe cuisine inference from dishes (Phase 3a)');
  console.log(`   Mode:        ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);
  console.log(`   Model:       ${MODEL}`);
  console.log(`   Limit:       ${LIMIT > 0 ? LIMIT : 'all'}`);
  console.log(`   Concurrency: ${BATCH_CONCURRENCY}, delay ${BATCH_DELAY_MS}ms\n`);

  // 1. All restaurants → keep the empty-cuisine ones.
  const { data, error } = await supabase
    .from('restaurants')
    .select('id, name, cuisine_types')
    .order('created_at', { ascending: true });
  if (error) {
    console.error('❌  Failed to fetch restaurants:', error.message);
    process.exit(1);
  }
  const empty = ((data ?? []) as RestaurantRow[]).filter(r => (r.cuisine_types ?? []).length === 0);

  // 2. Narrow to those that actually have dishes (chunked .in()).
  const emptyIds = empty.map(r => r.id);
  const withDishes = new Set<string>();
  for (let i = 0; i < emptyIds.length; i += 100) {
    const chunk = emptyIds.slice(i, i + 100);
    const { data: dishes, error: dErr } = await supabase
      .from('dishes')
      .select('restaurant_id')
      .in('restaurant_id', chunk);
    if (dErr) {
      console.error('❌  Failed to fetch dish ownership:', dErr.message);
      process.exit(1);
    }
    for (const d of dishes ?? []) withDishes.add(d.restaurant_id);
  }

  let candidates = empty.filter(r => withDishes.has(r.id));
  const skippedNoDishes = empty.length - candidates.length;
  if (LIMIT > 0) candidates = candidates.slice(0, LIMIT);
  const total = candidates.length;

  console.log(
    `📋  ${empty.length} empty-cuisine restaurant(s); ${skippedNoDishes} have no dishes (skipped — Phase 3b).`
  );
  if (total === 0) {
    console.log('✅  No empty-cuisine restaurants with dishes — nothing to do.');
    return;
  }
  console.log(`    Processing ${total} restaurant(s) with dishes.\n`);

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
        console.log(`      dishes: ${(r.sampleDishes ?? []).join(', ')}`);
      } else if (r.outcome === 'still_empty') {
        stillEmpty++;
        console.log(`  – ${r.name} — no canonical cuisine inferred`);
        if ((r.sampleDishes ?? []).length > 0) {
          console.log(`      dishes: ${(r.sampleDishes ?? []).join(', ')}`);
        }
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
