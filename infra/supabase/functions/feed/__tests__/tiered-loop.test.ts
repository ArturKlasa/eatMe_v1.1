// tiered-loop.test.ts — Wave-0 validation harness for the tiered-radius fetch loop
// (Phase 7, Plan 03 target). Run with (from repo root):
//   deno test --node-modules-dir=none -A infra/supabase/functions/feed/__tests__/tiered-loop.test.ts
//
// Encodes the loop contract from 07-RESEARCH.md §2 INDEPENDENTLY of the full edge
// function: a pure `runTieredFetch` reproduces the break-at-POOL_TARGET / replace-
// don't-merge / never-exceed-requested-radius logic so Plan 03 can wire the real
// `supabase.rpc('generate_candidates', ...)` call site (feed/index.ts :881-903) into
// the same shape and turn these assertions green against live source.
//
// Why a stub: nyquist_validation (Dimension 8) requires the behavior-preserving seam
// be validated WITHOUT prod access. Stubbing the rpc lets us assert call-count, the
// radius passed per tier, and the `Candidate[]`-shaped return without a DB.

import { assert, assertEquals } from 'jsr:@std/assert@1.0.19';

// ── Named constants under contract (RESEARCH §2). Referenced by these exact
//    names so a grep gate can confirm POOL_TARGET / [0.25, 0.5, 1.0] are present. ──
const TIER_FRACTIONS = [0.25, 0.5, 1.0]; // 25% → 50% → 100%
const POOL_TARGET = 100; // ~half of p_limit=200 (D-02)

// A row shaped like the `Candidate[]` rows generate_candidates returns. The harness
// only needs the identity fields to prove shape-parity round-trips; the full 32-column
// shape lives in the shared fixture and is exercised by precap-behavior.test.ts.
interface CandidateRow {
  id: string;
  restaurant_id: string;
  vector_distance: number | null;
  [k: string]: unknown;
}

/**
 * Pure reproduction of the tiered-fetch loop (RESEARCH §2, lines 165-190).
 *
 * For each fraction it calls `rpcStub(Math.round(requestedRadiusM * frac))`, REPLACES
 * the pool with that tier's result (each wider tier is a strict superset — no merge),
 * and breaks once the pool reaches POOL_TARGET. The 1.0 tier == requested radius, so
 * the loop never probes a radius larger than what the caller asked for (D-03).
 */
function runTieredFetch(
  rpcStub: (radiusM: number) => CandidateRow[],
  requestedRadiusM: number,
  tierFractions: number[],
  poolTarget: number,
): CandidateRow[] {
  let pool: CandidateRow[] = [];
  for (const frac of tierFractions) {
    const tierRadiusM = Math.round(requestedRadiusM * frac);
    const result = rpcStub(tierRadiusM);
    pool = result ?? []; // REPLACE, not merge (mirrors `pool = data ?? []` at :903)
    if (pool.length >= poolTarget) break; // healthy pool reached (D-02)
  }
  return pool;
}

// Small helper to build N distinct rows deterministically.
function makeRows(n: number, restaurantId = 'rest-stub'): CandidateRow[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `dish-${i}`,
    restaurant_id: restaurantId,
    vector_distance: 0.01 * i,
  }));
}

Deno.test('break-at-POOL_TARGET: stops after the tier that first reaches POOL_TARGET', () => {
  const requestedRadiusM = 10_000;
  const radiiSeen: number[] = [];
  let calls = 0;
  // 40 rows @ 0.25 (below target) → 120 rows @ 0.5 (>= target) → must NOT reach 1.0.
  const rpcStub = (radiusM: number): CandidateRow[] => {
    calls++;
    radiiSeen.push(radiusM);
    if (radiusM === Math.round(requestedRadiusM * 0.25)) return makeRows(40);
    if (radiusM === Math.round(requestedRadiusM * 0.5)) return makeRows(120);
    return makeRows(200); // 1.0 tier — should never be called here
  };

  const pool = runTieredFetch(rpcStub, requestedRadiusM, TIER_FRACTIONS, POOL_TARGET);

  assertEquals(calls, 2, 'loop must break after the 0.5 tier, never calling the 1.0 tier');
  assertEquals(
    radiiSeen[1],
    Math.round(requestedRadiusM * 0.5),
    'second tier radius must be requestedRadiusM * 0.5',
  );
  assertEquals(pool.length, 120, 'final pool is the 0.5 tier result (replace semantics)');
});

Deno.test('sparse fall-through: runs all 3 tiers, final radius == requested radius', () => {
  const requestedRadiusM = 8_000;
  const radiiSeen: number[] = [];
  let calls = 0;
  // 5 rows at every tier — never reaches POOL_TARGET, so all 3 tiers run.
  const rpcStub = (radiusM: number): CandidateRow[] => {
    calls++;
    radiiSeen.push(radiusM);
    return makeRows(5);
  };

  const pool = runTieredFetch(rpcStub, requestedRadiusM, TIER_FRACTIONS, POOL_TARGET);

  assertEquals(calls, 3, 'sparse pool runs all 3 tiers');
  // The final (1.0) tier == requested radius and the loop never exceeds it (D-03).
  assertEquals(radiiSeen[2], requestedRadiusM, 'final tier radius equals the requested radius');
  assert(
    radiiSeen.every((r) => r <= requestedRadiusM),
    'no tier probes a radius larger than the requested radius',
  );
  assertEquals(pool.length, 5, 'final pool is the last tier result (replace semantics)');
});

Deno.test('shape parity: returns a Candidate[] and a representative row round-trips unchanged', () => {
  // Load a representative row from the shared fixture and prove it passes through the
  // helper byte-identical — the helper imposes no transform, matching `:903` semantics.
  const fixture = JSON.parse(
    Deno.readTextFileSync(
      new URL('./fixtures/multi-restaurant-pool.json', import.meta.url),
    ),
  ) as CandidateRow[];
  const sampleTier = fixture.slice(0, 120); // >= POOL_TARGET so the first tier wins
  const rpcStub = (_radiusM: number): CandidateRow[] => sampleTier;

  const pool = runTieredFetch(rpcStub, 10_000, TIER_FRACTIONS, POOL_TARGET);

  assert(Array.isArray(pool), 'returned pool is an array (Candidate[] shape, like :903)');
  const before = JSON.stringify(fixture[0]);
  const after = JSON.stringify(pool[0]);
  assertEquals(after, before, 'a representative fixture row round-trips unchanged through the loop');
});
