#!/usr/bin/env ts-node
/**
 * verify-phase6-teardown.ts — READ-ONLY. Confirms the ingredient teardown
 * (Phase B triggers + Phase C tables/columns) is live in prod.
 *
 * Usage:  cd infra/scripts && pnpm exec ts-node verify-phase6-teardown.ts
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) as any;

async function main() {
  console.log(
    `\n=== Phase 6 teardown verification (read-only) — ${process.env.SUPABASE_URL} ===\n`
  );

  // 1. Dead columns should be GONE (selecting them must error).
  for (const col of ['allergens_override', 'dietary_tags_override']) {
    const { error } = await sb.from('dishes').select(col).limit(1);
    console.log(`dishes.${col.padEnd(20)}: ${error ? 'GONE ✓' : 'STILL EXISTS ✗'}`);
  }

  // FK-sever column on options.
  const { error: optErr } = await sb.from('options').select('canonical_ingredient_id').limit(1);
  console.log(`options.canonical_ingredient_id: ${optErr ? 'GONE ✓' : 'STILL EXISTS ✗'}`);

  // 2. Doomed ingredient tables should be GONE (full reconciled drop list).
  for (const t of [
    'dish_ingredients',
    'canonical_ingredients',
    'canonical_ingredient_allergens',
    'canonical_ingredient_dietary_tags',
    'ingredient_aliases',
    'ingredient_aliases_v2',
    'ingredient_concepts',
    'ingredient_variants',
    'concept_translations',
    'variant_translations',
  ]) {
    const { error } = await sb.from(t).select('id').limit(1);
    console.log(`table ${t.padEnd(34)}: ${error ? 'GONE ✓' : 'STILL EXISTS ✗'}`);
  }

  console.log('\n(read-only — nothing written)');
}

main();
