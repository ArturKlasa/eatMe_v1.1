#!/usr/bin/env ts-node
/**
 * infra/scripts/backfill-cuisine-types.ts
 *
 * Phase 2a backfill for docs/plans/cuisine-data-integrity.md.
 *
 * Normalizes existing `restaurants.cuisine_types` to canonical values:
 *   - folds accent/case variants  ('Cafe' / 'CAFÉ' → 'Café')
 *   - drops unknown / junk values
 *   - deduplicates
 *
 * It does NOT populate EMPTY cuisine_types — that needs Google re-inference
 * (Phase 2b). It reports how many rows are empty (and how many of those have a
 * google_place_id) so Phase 2b can be sized.
 *
 * Usage (from infra/scripts/):
 *   ts-node backfill-cuisine-types.ts --dry-run   # report only, write nothing
 *   ts-node backfill-cuisine-types.ts             # apply changes
 *
 * Env (infra/scripts/.env):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * NOTE: `normalizeCuisines` + `ALL_CUISINES` below are a deliberate copy of
 * packages/shared/src/constants/cuisine.ts — a standalone ts-node script cannot
 * cleanly import the workspace package (its main is raw TS). Keep the two in sync.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 50;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌  Missing required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
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

// Combining diacritical marks U+0300–U+036F (built via string to avoid editor
// escaping pitfalls). Strips accents after NFD normalization.
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

// ── Backfill ────────────────────────────────────────────────────────────────

interface RestaurantRow {
  id: string;
  name: string;
  cuisine_types: string[] | null;
  google_place_id: string | null;
}

function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  console.log('🚀  EatMe cuisine_types normalize backfill (Phase 2a)');
  console.log(`   Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);
  console.log(
    `   fold sanity: ${JSON.stringify(normalizeCuisines(['cafe', 'CAFÉ', 'Italian', 'junk']))} (expect ["Café","Italian"])\n`
  );

  const { data, error } = await supabase
    .from('restaurants')
    .select('id, name, cuisine_types, google_place_id')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('❌  Failed to fetch restaurants:', error.message);
    process.exit(1);
  }

  const rows = (data ?? []) as RestaurantRow[];
  const total = rows.length;

  const toChange: Array<{ row: RestaurantRow; before: string[]; after: string[] }> = [];
  let alreadyCanonical = 0;
  let empty = 0;
  let emptyWithPlaceId = 0;

  for (const row of rows) {
    const before = row.cuisine_types ?? [];
    if (before.length === 0) {
      empty++;
      if (row.google_place_id) emptyWithPlaceId++;
      continue;
    }
    const after = normalizeCuisines(before);
    if (arraysEqual(before, after)) {
      alreadyCanonical++;
    } else {
      toChange.push({ row, before, after });
    }
  }

  console.log(`📋  ${total} restaurants scanned`);
  console.log(`   Already canonical: ${alreadyCanonical}`);
  console.log(
    `   Empty cuisine:     ${empty}  (${emptyWithPlaceId} have a google_place_id → Phase 2b candidates)`
  );
  console.log(`   Would change:      ${toChange.length}\n`);

  if (toChange.length > 0) {
    console.log('── Changes ' + '─'.repeat(48));
    for (const { row, before, after } of toChange) {
      console.log(`  ${row.name}`);
      console.log(`     ${JSON.stringify(before)}  →  ${JSON.stringify(after)}`);
    }
    console.log('');
  }

  if (DRY_RUN) {
    console.log(
      `✅  Dry run complete. ${toChange.length} row(s) would change. Re-run without --dry-run to apply.`
    );
    return;
  }

  let updated = 0;
  let failed = 0;
  for (let i = 0; i < toChange.length; i += BATCH_SIZE) {
    const batch = toChange.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async ({ row, after }) => {
        const { error: upErr } = await supabase
          .from('restaurants')
          .update({ cuisine_types: after })
          .eq('id', row.id);
        return upErr;
      })
    );
    for (const upErr of results) {
      if (upErr) {
        failed++;
        console.error(`  ✗ update failed: ${upErr.message}`);
      } else {
        updated++;
      }
    }
    if (i + BATCH_SIZE < toChange.length) await sleep(200);
  }

  console.log('─'.repeat(60));
  console.log(`✅  Backfill complete. Updated ${updated}, failed ${failed}.`);
}

main().catch(err => {
  console.error('❌  Fatal error:', err);
  process.exit(1);
});
