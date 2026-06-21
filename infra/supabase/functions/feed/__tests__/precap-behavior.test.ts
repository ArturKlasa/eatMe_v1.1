// precap-behavior.test.ts — Wave-0 validation harness for the per-restaurant SQL
// pre-cap (Phase 7, Plan 02 target). Run with (from repo root):
//   deno test --node-modules-dir=none -A infra/supabase/functions/feed/__tests__/precap-behavior.test.ts
//
// Proves the SC#3 "measurably reduced" contract AND behavior-preservation WITHOUT
// prod access (nyquist_validation, Dimension 8):
//   1. row-count delta  — precap(pool, 8).length < pool.length (dominant restaurant trimmed)
//   2. byte delta       — JSON.stringify(precap).length < JSON.stringify(pool).length
//   3. behavior-preserving — the JS max-3 diversity cap (applyDiversity, feed/index.ts
//      :603-613 / :951) yields an IDENTICAL dish-ID list on the full pool vs the K=8
//      pre-capped pool. K=8 > 2.5× the max-3 cap, so the proxy pre-cap cannot change
//      which 3-per-restaurant survive.
//
// `precap` mirrors the planned SQL window:
//   ROW_NUMBER() OVER (PARTITION BY restaurant_id
//                      ORDER BY vector_distance ASC NULLS LAST,
//                               popularity_score DESC, distance_m ASC)
//   ... WHERE rn <= K
// (07-RESEARCH.md §3 — identical to the existing global ORDER BY, so the kept rows are
// the ones the function would have surfaced first, just bounded per restaurant.)

import { assert } from 'jsr:@std/assert@1.0.19';

interface CandidateRow {
  id: string;
  restaurant_id: string;
  vector_distance: number | null;
  popularity_score: number;
  distance_m: number;
  score?: number;
  [k: string]: unknown;
}

const POOL: CandidateRow[] = JSON.parse(
  Deno.readTextFileSync(
    new URL('./fixtures/multi-restaurant-pool.json', import.meta.url),
  ),
);

// The pre-cap ORDER BY key tuple. NULLS LAST for vector_distance (anon/cold-start),
// then popularity_score DESC, then distance_m ASC — identical to the global sort.
function precapCompare(a: CandidateRow, b: CandidateRow): number {
  const av = a.vector_distance, bv = b.vector_distance;
  // ASC NULLS LAST
  if (av === null && bv !== null) return 1;
  if (av !== null && bv === null) return -1;
  if (av !== null && bv !== null && av !== bv) return av - bv;
  if (b.popularity_score !== a.popularity_score) return b.popularity_score - a.popularity_score; // DESC
  return a.distance_m - b.distance_m; // ASC
}

/**
 * Pure mirror of the SQL ROW_NUMBER() pre-cap: group by restaurant_id, sort each
 * group by the key tuple, keep the first K. Returns the kept rows preserving the
 * input's relative order so a downstream global sort behaves identically.
 */
function precap(pool: CandidateRow[], K: number): CandidateRow[] {
  const groups = new Map<string, CandidateRow[]>();
  for (const row of pool) {
    const g = groups.get(row.restaurant_id) ?? [];
    g.push(row);
    groups.set(row.restaurant_id, g);
  }
  const keep = new Set<string>();
  for (const g of groups.values()) {
    [...g].sort(precapCompare).slice(0, K).forEach((r) => keep.add(r.id));
  }
  return pool.filter((r) => keep.has(r.id));
}

// Local replica of feed/index.ts applyDiversity(dishes, maxPerRestaurant) (:603-613):
// max-N-per-restaurant by the input's (already-scored) order.
function applyDiversity(dishes: CandidateRow[], maxPerRestaurant: number): CandidateRow[] {
  const result: CandidateRow[] = [];
  const restaurantCounts = new Map<string, number>();
  for (const d of dishes) {
    const rn = restaurantCounts.get(d.restaurant_id) ?? 0;
    if (rn >= maxPerRestaurant) continue;
    result.push(d);
    restaurantCounts.set(d.restaurant_id, rn + 1);
  }
  return result;
}

Deno.test('row-count delta: K=8 pre-cap drops rows (dominant restaurant trimmed)', () => {
  const capped = precap(POOL, 8);
  assert(
    capped.length < POOL.length,
    `expected K=8 pre-cap to drop rows, got ${capped.length} vs ${POOL.length}`,
  );
  console.log(`[precap] rows: ${POOL.length} → ${capped.length}`);
});

Deno.test('byte delta: K=8 pre-cap measurably reduces serialized bytes (SC#3)', () => {
  const beforeBytes = JSON.stringify(POOL).length;
  const afterBytes = JSON.stringify(precap(POOL, 8)).length;
  assert(
    afterBytes < beforeBytes,
    `expected byte reduction, got ${afterBytes} vs ${beforeBytes}`,
  );
  console.log(`[precap] bytes: ${beforeBytes} → ${afterBytes}`);
});

Deno.test('behavior-preserving: applyDiversity(_, 3) ID list identical full-pool vs K=8-capped', () => {
  // Build the representative scored ordering: sort by the same global key the feed
  // leads on (the precap key tuple). Then run the max-3 cap over BOTH the full pool
  // and the K=8 pre-capped pool and assert identical surviving dish-ID lists.
  const fullSorted = [...POOL].sort(precapCompare);
  const cappedSorted = [...precap(POOL, 8)].sort(precapCompare);

  const fullIds = applyDiversity(fullSorted, 3).map((d) => d.id);
  const cappedIds = applyDiversity(cappedSorted, 3).map((d) => d.id);

  assert(
    JSON.stringify(fullIds) === JSON.stringify(cappedIds),
    `diversified ID lists differ:\n full=${JSON.stringify(fullIds)}\n cap =${JSON.stringify(cappedIds)}`,
  );
  console.log(`[precap] diversified survivors (identical): ${fullIds.length}`);
});
