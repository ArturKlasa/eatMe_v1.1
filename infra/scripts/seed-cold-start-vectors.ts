#!/usr/bin/env ts-node
/**
 * infra/scripts/seed-cold-start-vectors.ts
 *
 * Phase 4B backfill for docs/plans/mobile-ux-fixes-batch-2.md (Item 3B).
 *
 * Seeds a cold-start `user_behavior_profiles.preference_vector` for EXISTING users
 * who completed onboarding (so they have favourite dishes/cuisines) but never built
 * a vector — because they have no interactions yet, so the real-time
 * update-preference-vector path always returned `skipped: no_interactions`.
 *
 * It mirrors the seed math now baked into the update-preference-vector Edge Function
 * (seedFromFavourites): average the embeddings of EXISTING dishes that match the
 * user's favourite dish-labels (name ILIKE) and favourite cuisines (dishes at
 * restaurants of that cuisine), normalise, and upsert. Staying in the dish-embedding
 * space means no OpenAI call. New users get seeded live via the Edge Function; this
 * script is the one-time catch-up for the back catalogue.
 *
 * Never overwrites an existing vector — only users whose preference_vector IS NULL
 * are candidates, so any interaction-based or already-seeded vector is left alone.
 *
 * Usage (from infra/scripts/):
 *   ts-node seed-cold-start-vectors.ts --limit=5            # sample preview (DEFAULT dry-run, no writes)
 *   ts-node seed-cold-start-vectors.ts                      # full preview (DEFAULT dry-run, no writes)
 *   ts-node seed-cold-start-vectors.ts --apply --limit=5    # apply to first 5 (writes to LIVE prod)
 *   ts-node seed-cold-start-vectors.ts --apply              # apply to all (writes to LIVE prod)
 *
 * CLI contract (SEC-03, shared prod-guard): this script now DEFAULTS to dry-run.
 * No flag means no writes — it requires the explicit `--apply` flag to mutate
 * prod. `--dry-run` is still accepted as an affirming no-op (never errors). The
 * resolved target project ref (from SUPABASE_URL) is announced before any write.
 *
 * Flags:
 *   --apply       Required to write. Absent it, the run is a no-write preview.
 *   --dry-run     Accepted no-op — re-affirms the default; writes nothing.
 *   --limit=N     Process only the first N candidates (sampling; 0 = all).
 *
 * Env (infra/scripts/.env):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { parseGuard, announceTarget } from './lib/prod-guard';

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
// Default dry-run via the shared prod-guard (SEC-03): writes require --apply.
const { dryRun: DRY_RUN, projectRef, limit: LIMIT } = parseGuard();

// Must match the Edge Function (seedFromFavourites) so the script and live path agree.
const DIMS = 1536;
const SEED_SAMPLE_PER_LABEL = 25;
const SEED_DISH_WEIGHT = 1.0;
const SEED_CUISINE_WEIGHT = 0.5;
const CALL_DELAY_MS = 100; // gentle pacing between users

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌  Missing required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ── Vector helpers (mirror of update-preference-vector) ─────────────────────────

function addWeighted(acc: Float64Array, vec: number[], weight: number): void {
  for (let i = 0; i < DIMS; i++) acc[i] += vec[i] * weight;
}

function normalise(vec: Float64Array): number[] {
  let mag = 0;
  for (let i = 0; i < DIMS; i++) mag += vec[i] * vec[i];
  mag = Math.sqrt(mag);
  if (mag === 0) return Array(DIMS).fill(0);
  const out: number[] = new Array(DIMS);
  for (let i = 0; i < DIMS; i++) out[i] = vec[i] / mag;
  return out;
}

function parseEmbedding(raw: unknown): number[] | null {
  if (!raw) return null;
  const vec = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return Array.isArray(vec) && vec.length === DIMS ? (vec as number[]) : null;
}

// ── Seed one user ───────────────────────────────────────────────────────────────

interface SeedResult {
  vector: number[];
  dishesUsed: number;
}

async function buildSeedVector(
  favoriteDishes: string[],
  favoriteCuisines: string[]
): Promise<SeedResult | null> {
  const acc = new Float64Array(DIMS);
  let totalWeight = 0;
  let dishesUsed = 0;

  for (const label of favoriteDishes) {
    const { data: matches } = await supabase
      .from('dishes')
      .select('embedding')
      .ilike('name', `%${label}%`)
      .not('embedding', 'is', null)
      .limit(SEED_SAMPLE_PER_LABEL);
    for (const m of matches ?? []) {
      const vec = parseEmbedding((m as { embedding: unknown }).embedding);
      if (!vec) continue;
      addWeighted(acc, vec, SEED_DISH_WEIGHT);
      totalWeight += SEED_DISH_WEIGHT;
      dishesUsed++;
    }
  }

  for (const cuisine of favoriteCuisines) {
    const { data: rests } = await supabase
      .from('restaurants')
      .select('id')
      .contains('cuisine_types', [cuisine])
      .limit(50);
    const restIds = (rests ?? []).map(r => (r as { id: string }).id);
    if (restIds.length === 0) continue;
    const { data: matches } = await supabase
      .from('dishes')
      .select('embedding')
      .in('restaurant_id', restIds)
      .not('embedding', 'is', null)
      .limit(SEED_SAMPLE_PER_LABEL);
    for (const m of matches ?? []) {
      const vec = parseEmbedding((m as { embedding: unknown }).embedding);
      if (!vec) continue;
      addWeighted(acc, vec, SEED_CUISINE_WEIGHT);
      totalWeight += SEED_CUISINE_WEIGHT;
      dishesUsed++;
    }
  }

  if (totalWeight === 0) return null;
  return { vector: normalise(acc), dishesUsed };
}

// ── Main ────────────────────────────────────────────────────────────────────────

const asArray = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);

async function main(): Promise<void> {
  console.log('\n🌱  Cold-start preference-vector seed');
  announceTarget({ dryRun: DRY_RUN, projectRef });
  if (LIMIT) console.log(`   Limit: ${LIMIT}\n`);

  // 1. Onboarded users + their favourites.
  const { data: prefs, error: prefErr } = await supabase
    .from('user_preferences')
    .select('user_id, favorite_dishes, favorite_cuisines')
    .eq('onboarding_completed', true);
  if (prefErr) throw prefErr;

  const withFavourites = (prefs ?? []).filter(
    p => asArray(p.favorite_dishes).length > 0 || asArray(p.favorite_cuisines).length > 0
  );
  console.log(`Onboarded users: ${prefs?.length ?? 0} · with favourites: ${withFavourites.length}`);
  if (withFavourites.length === 0) {
    console.log('Nothing to seed.\n');
    return;
  }

  // 2. Exclude anyone who already has a vector (never overwrite).
  const userIds = withFavourites.map(p => p.user_id as string);
  const { data: profiles, error: profErr } = await supabase
    .from('user_behavior_profiles')
    .select('user_id, preference_vector')
    .in('user_id', userIds);
  if (profErr) throw profErr;

  const alreadySeeded = new Set(
    (profiles ?? [])
      .filter(p => (p as { preference_vector: unknown }).preference_vector != null)
      .map(p => (p as { user_id: string }).user_id)
  );

  let candidates = withFavourites.filter(p => !alreadySeeded.has(p.user_id as string));
  console.log(
    `Already have a vector (skipped): ${alreadySeeded.size} · candidates to seed: ${candidates.length}`
  );
  if (LIMIT > 0) candidates = candidates.slice(0, LIMIT);

  // 3. Seed each candidate.
  let seeded = 0;
  let noMatch = 0;
  let errors = 0;

  for (const p of candidates) {
    const userId = p.user_id as string;
    const favoriteDishes = asArray(p.favorite_dishes);
    const favoriteCuisines = asArray(p.favorite_cuisines);

    try {
      const result = await buildSeedVector(favoriteDishes, favoriteCuisines);
      if (!result) {
        noMatch++;
        console.log(
          `  ∅  ${userId}  — no matching dish embeddings (dishes=${favoriteDishes.length}, cuisines=${favoriteCuisines.length})`
        );
        continue;
      }

      if (DRY_RUN) {
        console.log(`  ✎  ${userId}  — would seed from ${result.dishesUsed} dish embeddings`);
        seeded++;
      } else {
        const now = new Date().toISOString();
        const { error } = await supabase.from('user_behavior_profiles').upsert(
          {
            user_id: userId,
            preference_vector: JSON.stringify(result.vector),
            preference_vector_updated_at: now,
            preferred_cuisines: favoriteCuisines.slice(0, 5),
            last_active_at: now,
            profile_updated_at: now,
          },
          { onConflict: 'user_id' }
        );
        if (error) throw error;
        console.log(`  ✓  ${userId}  — seeded from ${result.dishesUsed} dish embeddings`);
        seeded++;
      }
    } catch (e) {
      errors++;
      console.error(`  ✗  ${userId}  — ${(e as Error).message}`);
    }

    await sleep(CALL_DELAY_MS);
  }

  console.log(
    `\nDone — ${DRY_RUN ? 'would seed' : 'seeded'}: ${seeded}, no-match: ${noMatch}, errors: ${errors}\n`
  );
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
