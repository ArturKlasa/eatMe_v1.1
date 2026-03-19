#!/usr/bin/env ts-node
/**
 * infra/scripts/batch-embed.ts
 *
 * One-time (and repeatable) script to embed all dishes that don't yet have
 * an embedding. Calls the enrich-dish Edge Function for each dish, respecting
 * OpenAI rate limits.
 *
 * Run AFTER migration 054 and 055 have been applied and the Edge Function
 * has been deployed.
 *
 * Usage (from project root):
 *   pnpm ts-node infra/scripts/batch-embed.ts
 *
 * Environment variables (can be in a .env file at project root):
 *   SUPABASE_URL              — e.g. https://abcdefgh.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY — service role key (bypasses RLS)
 *   ENRICH_DISH_URL           — https://<ref>.supabase.co/functions/v1/enrich-dish
 *   BATCH_CONCURRENCY         — parallel calls per tick (default: 5)
 *   BATCH_DELAY_MS            — ms between batches (default: 1000)
 *
 * What it does:
 *   1. Queries all dishes WHERE enrichment_status IN ('none', 'failed')
 *   2. Calls enrich-dish for each in batches of BATCH_CONCURRENCY
 *   3. Logs per-dish result + running totals
 *   4. Calls ANALYZE dishes after the run to refresh query planner stats
 *      (important for the partial HNSW index to be picked up)
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const ENRICH_DISH_URL = process.env.ENRICH_DISH_URL ?? '';
const BATCH_CONCURRENCY = parseInt(process.env.BATCH_CONCURRENCY ?? '5', 10);
const BATCH_DELAY_MS = parseInt(process.env.BATCH_DELAY_MS ?? '1000', 10);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ENRICH_DISH_URL) {
  console.error(
    '❌  Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ENRICH_DISH_URL'
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ── Types ─────────────────────────────────────────────────────────────────────

interface DishSummary {
  id: string;
  name: string;
  enrichment_status: string;
}

interface EnrichResult {
  dish_id: string;
  ok: boolean;
  enrichment_source?: string;
  enrichment_confidence?: string;
  error?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface EnrichApiResponse {
  dish_id?: string;
  skipped?: boolean;
  enrichment_source?: string;
  enrichment_confidence?: string;
  error?: string;
}

async function enrichDish(dishId: string): Promise<EnrichResult> {
  try {
    const res = await fetch(ENRICH_DISH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dish_id: dishId }),
    });

    const json = (await res.json()) as EnrichApiResponse;

    if (!res.ok) {
      return { dish_id: dishId, ok: false, error: json.error ?? `HTTP ${res.status}` };
    }

    if (json.skipped) {
      return { dish_id: dishId, ok: true, enrichment_source: 'skipped (debounce)' };
    }

    return {
      dish_id: dishId,
      ok: true,
      enrichment_source: json.enrichment_source,
      enrichment_confidence: json.enrichment_confidence,
    };
  } catch (err) {
    return { dish_id: dishId, ok: false, error: String(err) };
  }
}

async function processBatch(batch: DishSummary[]): Promise<EnrichResult[]> {
  return Promise.all(batch.map(d => enrichDish(d.id)));
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('🚀  EatMe batch-embed starting');
  console.log(`   ENRICH_DISH_URL:  ${ENRICH_DISH_URL}`);
  console.log(`   Concurrency:      ${BATCH_CONCURRENCY}`);
  console.log(`   Delay between batches: ${BATCH_DELAY_MS}ms\n`);

  // ── Fetch all unenriched dishes ──────────────────────────────────────────

  const { data: dishes, error } = await supabase
    .from('dishes')
    .select('id, name, enrichment_status')
    .in('enrichment_status', ['none', 'failed'])
    .order('created_at', { ascending: true });

  if (error) {
    console.error('❌  Failed to fetch dishes:', error.message);
    process.exit(1);
  }

  const total = (dishes ?? []).length;
  if (total === 0) {
    console.log('✅  All dishes already embedded — nothing to do.');
    return;
  }

  console.log(`📋  Found ${total} dishes to embed (status: none | failed)\n`);

  let succeeded = 0;
  let failed = 0;
  const startTime = Date.now();

  // ── Process in batches ────────────────────────────────────────────────────

  for (let i = 0; i < total; i += BATCH_CONCURRENCY) {
    const batch = (dishes ?? []).slice(i, i + BATCH_CONCURRENCY);
    const batchNum = Math.floor(i / BATCH_CONCURRENCY) + 1;
    const totalBatches = Math.ceil(total / BATCH_CONCURRENCY);

    console.log(`Batch ${batchNum}/${totalBatches} (${batch.length} dishes):`);

    const results = await processBatch(batch);

    for (const result of results) {
      const dish = batch.find((d: DishSummary) => d.id === result.dish_id);
      const name = dish?.name ?? result.dish_id;
      if (result.ok) {
        succeeded++;
        const src = result.enrichment_source ?? '';
        const conf = result.enrichment_confidence ? ` [${result.enrichment_confidence}]` : '';
        console.log(`  ✓ ${name} — ${src}${conf}`);
      } else {
        failed++;
        console.error(`  ✗ ${name} — ${result.error}`);
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `  Progress: ${succeeded + failed}/${total} | ✓ ${succeeded} ✗ ${failed} | ${elapsed}s\n`
    );

    // Delay between batches to avoid rate-limiting
    if (i + BATCH_CONCURRENCY < total) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────

  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('─'.repeat(60));
  console.log(`✅  Batch embed complete in ${totalElapsed}s`);
  console.log(`   Succeeded: ${succeeded}/${total}`);
  if (failed > 0) console.log(`   Failed:    ${failed}/${total}`);

  // ── ANALYZE dishes ────────────────────────────────────────────────────────
  // Refreshes query planner statistics so the partial HNSW index is used.
  console.log('\n📊  Running ANALYZE dishes ...');
  const { error: analyzeError } = await supabase.rpc('run_analyze_dishes');
  if (analyzeError) {
    // run_analyze_dishes is a helper function we define below.
    // If it doesn't exist yet, this is non-fatal — run manually in SQL editor:
    //   ANALYZE dishes;
    console.warn('⚠️  ANALYZE skipped (run_analyze_dishes function not found — run manually):');
    console.warn('    ANALYZE dishes;');
  } else {
    console.log('✅  ANALYZE complete — HNSW index stats updated.');
  }

  // ── Batch-update restaurant vectors ──────────────────────────────────────
  console.log('\n🏪  Updating restaurant vectors ...');
  const { data: restaurants, error: restError } = await supabase
    .from('restaurants')
    .select('id')
    .eq('is_active', true);

  if (!restError && restaurants) {
    let updated = 0;
    for (const r of restaurants) {
      const { error: rpcErr } = await supabase.rpc('update_restaurant_vector', {
        p_restaurant_id: r.id,
      });
      if (!rpcErr) updated++;
    }
    console.log(`✅  Restaurant vectors updated: ${updated}/${restaurants.length}`);
  }

  if (failed > 0) process.exit(1);
}

main().catch(err => {
  console.error('❌  Unexpected error:', err);
  process.exit(1);
});
