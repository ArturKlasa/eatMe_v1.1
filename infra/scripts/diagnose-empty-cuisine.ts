#!/usr/bin/env ts-node
/**
 * diagnose-empty-cuisine.ts — READ-ONLY diagnostic (no writes).
 *
 * Answers the pivotal Phase 3 question: of the restaurants that still have an
 * empty cuisine_types, how many already have dishes (→ inferable from their
 * menu NOW via a backfill) vs. how many are bare stubs with no dishes (→ can
 * only be classified if/when a menu is scanned)?
 *
 * Pure SELECTs. Hits live prod via infra/scripts/.env service-role creds.
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env');
  process.exit(1);
}

const supa = createClient(SUPABASE_URL, SERVICE_ROLE);

function isEmpty(c: unknown): boolean {
  return !Array.isArray(c) || c.length === 0;
}

async function main() {
  // 1. All restaurants with their cuisine + a couple of context columns.
  const { data: restaurants, error } = await supa
    .from('restaurants')
    .select('id, name, cuisine_types, google_place_id');
  if (error) throw error;
  const all = restaurants ?? [];

  const empty = all.filter(r => isEmpty(r.cuisine_types));
  const populated = all.length - empty.length;
  const emptyIds = empty.map(r => r.id);

  // 2. Dish counts for the empty-cuisine restaurants (single query, tally in JS).
  const dishCount = new Map<string, number>();
  // chunk the .in() to stay well under URL limits
  for (let i = 0; i < emptyIds.length; i += 100) {
    const chunk = emptyIds.slice(i, i + 100);
    const { data: dishes, error: dErr } = await supa
      .from('dishes')
      .select('restaurant_id')
      .in('restaurant_id', chunk);
    if (dErr) throw dErr;
    for (const d of dishes ?? []) {
      dishCount.set(d.restaurant_id, (dishCount.get(d.restaurant_id) ?? 0) + 1);
    }
  }

  const emptyWithDishes = empty.filter(r => (dishCount.get(r.id) ?? 0) > 0);
  const emptyWithoutDishes = empty.length - emptyWithDishes.length;
  const emptyWith3Plus = empty.filter(r => (dishCount.get(r.id) ?? 0) >= 3);
  const emptyWithGoogleNoDishes = empty.filter(
    r => (dishCount.get(r.id) ?? 0) === 0 && r.google_place_id
  );

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  CUISINE COVERAGE DIAGNOSTIC (read-only)');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Total restaurants:              ${all.length}`);
  console.log(
    `  with cuisine_types:           ${populated}  (${Math.round((populated / all.length) * 100)}%)`
  );
  console.log(
    `  EMPTY cuisine_types:          ${empty.length}  (${Math.round((empty.length / all.length) * 100)}%)`
  );
  console.log('───────────────────────────────────────────────────────────');
  console.log('  Of the EMPTY-cuisine restaurants:');
  console.log(`   • have ≥1 dish (backfillable from dishes NOW): ${emptyWithDishes.length}`);
  console.log(`        …of those, ≥3 dishes:                     ${emptyWith3Plus.length}`);
  console.log(`   • have 0 dishes (need a future scan to classify): ${emptyWithoutDishes}`);
  console.log(`        …of those, are Google stubs:             ${emptyWithGoogleNoDishes.length}`);
  console.log('───────────────────────────────────────────────────────────');
  console.log('  Sample of empty-cuisine restaurants WITH dishes');
  console.log('  (name → first dish names — is cuisine inferable?):');
  const sample = emptyWithDishes
    .sort((a, b) => (dishCount.get(b.id) ?? 0) - (dishCount.get(a.id) ?? 0))
    .slice(0, 8);
  for (const r of sample) {
    const { data: dishes } = await supa
      .from('dishes')
      .select('name')
      .eq('restaurant_id', r.id)
      .limit(8);
    const names = (dishes ?? []).map(d => d.name).join(', ');
    console.log(`   • ${r.name} (${dishCount.get(r.id)} dishes): ${names}`);
  }
  console.log('═══════════════════════════════════════════════════════════');
}

main().catch(err => {
  console.error('Diagnostic failed:', err);
  process.exit(1);
});
