---
phase: 07-performance-cache
plan: 01
subsystem: validation-scaffolding
status: complete
tags: [deno-test, fixture, nyquist-validation, edge-functions, wave-0]
requires:
  - "infra/supabase/functions/feed/index.ts (Candidate interface, applyDiversity, rpc call site)"
  - "infra/supabase/functions/invalidate-cache/index.ts (record resolution)"
  - "infra/supabase/migrations/169_generate_candidates_pushdown.sql (32-col RETURNS TABLE shape)"
provides:
  - "Wave-0 validation harnesses backing Plans 02 (pre-cap), 03 (tiered loop), 04 (DELETE path)"
  - "Representative multi-restaurant candidate fixture (28 rows, 3 restaurants)"
affects:
  - "07-VALIDATION.md (wave_0_complete: false → true)"
tech-stack:
  added: []
  patterns:
    - "Deno.test + jsr:@std/assert@1.0.19 (matches incumbent _shared/cors.test.ts)"
    - "rpc-stub harness: pure helper reproduces edge-function seam without prod/DB"
    - "fixture import via new URL('./fixtures/...', import.meta.url) + Deno.readTextFileSync"
key-files:
  created:
    - "infra/supabase/functions/feed/__tests__/fixtures/multi-restaurant-pool.json"
    - "infra/supabase/functions/feed/__tests__/tiered-loop.test.ts"
    - "infra/supabase/functions/feed/__tests__/precap-behavior.test.ts"
    - "infra/supabase/functions/invalidate-cache/__tests__/delete-path.test.ts"
  modified:
    - ".planning/phases/07-performance-cache/07-VALIDATION.md"
decisions:
  - "Generated the 28-row fixture deterministically via a throwaway Node script (no random) so the harnesses can assert exact dish-ID lists; the script output is committed, not the script."
  - "Encoded the EXPECTED contracts as pure helper mirrors (runTieredFetch / precap / resolveRecord) rather than importing the real edge source — Wave 0 source is unchanged, later plans wire the real call sites into the same shape to turn these green."
metrics:
  duration: "~25m"
  completed: "2026-06-21"
  tasks: 3
  files-created: 4
  files-modified: 1
  tests: "9 Deno tests, all green, 816ms wall-clock"
---

# Phase 7 Plan 01: Wave-0 Validation Scaffolding Summary

Authored the Wave-0 validation harness every later Phase 7 plan depends on: a deterministic 28-row multi-restaurant candidate fixture plus three pure-helper Deno test files that lock the tiered-loop break logic, the per-restaurant SQL pre-cap byte/row/behavior-preservation contract, and the invalidate-cache DELETE `old_record` fallback — all validated without prod access by stubbing the edge seams.

## What Was Built

**Task 1 — Fixture** (`multi-restaurant-pool.json`): a 28-row `Candidate[]` pool across 3 restaurants. `rest-1` dominates with 12 dishes (so the K=8 pre-cap and the JS max-3 diversity cap both bite), `rest-2`/`rest-3` carry 8 each. Rows are interleaved in a globally monotonically-increasing `vector_distance` order (realistic ANN ordering, not grouped-by-restaurant), with populated `modifier_groups` (3 option_groups × 3-4 options on rest-1 rows, 2 groups elsewhere) so the serialized-byte delta from trimming is non-trivial. Carries the full 32-column projection from migration 169 including the migration-167 fold columns (`open_hours`, `timezone`, `country_code`).

**Task 2 — `tiered-loop.test.ts`**: pure `runTieredFetch(rpcStub, requestedRadiusM, TIER_FRACTIONS, POOL_TARGET)` reproducing the RESEARCH §2 loop (`TIER_FRACTIONS=[0.25,0.5,1.0]`, `POOL_TARGET=100`, replace-don't-merge). 3 tests assert: break-at-POOL_TARGET (40 rows @0.25 → 120 @0.5 → stops; call-count=2, 2nd radius = round(R*0.5)); sparse fall-through (5 rows every tier → all 3 tiers, final radius == requested radius, never exceeds it — D-03); shape parity (returns an array, a fixture row round-trips byte-identical).

**Task 3 — `precap-behavior.test.ts` + `delete-path.test.ts`**:
- Pre-cap: pure `precap(pool, K)` mirroring `ROW_NUMBER() OVER (PARTITION BY restaurant_id ORDER BY vector_distance ASC NULLS LAST, popularity_score DESC, distance_m ASC) WHERE rn <= K`. Asserts row drop (28→24), serialized-byte drop (73311→61109, the SC#3 "measurably reduced" gate), and that `applyDiversity(_, 3)` yields an IDENTICAL dish-ID list (9 survivors) on the full pool vs the K=8-capped pool — proving the proxy pre-cap is behavior-preserving.
- DELETE path: pure `resolveRecord(body) = body.record ?? body.old_record ?? {}`. Asserts DELETE resolves from `old_record`, UPDATE from `record`, and the `feed:v2:*` flush-all is event-independent.

## Verification

- `~/.deno/bin/deno test --node-modules-dir=none -A` over all 3 files: **9 passed, 0 failed, 816ms** (well under the 15s budget).
- Fixture Task-1 node assertion green: 28 rows, ≥3 restaurants, dominant ≥8, every row has `modifier_groups` + `vector_distance`, monotonic non-decreasing.
- Grep gates satisfied: `POOL_TARGET` + `[0.25, 0.5, 1.0]` (tiered-loop), `applyDiversity` + `multi-restaurant-pool` (precap), `old_record` (delete-path).
- Source isolation confirmed: `git diff --name-only base..HEAD` touches only `__tests__/` files and the VALIDATION.md flag — no `feed/` or `invalidate-cache/` runtime source modified.

## Deviations from Plan

None — plan executed exactly as written. No deviation rules triggered; no auth gates; no checkpoints.

## Commits

- `86cd292` test(07-01): add multi-restaurant candidate fixture
- `aeb4558` test(07-01): add tiered-loop break-logic Deno harness
- `0171b8d` test(07-01): add pre-cap behavior + DELETE-path Deno harnesses

(SUMMARY + VALIDATION.md flag commit follows.)

## Notes for Later Plans

- Plan 02 (pre-cap) makes `precap-behavior.test.ts` green against the real `generate_candidates` SQL — the K=8 window must use the exact key tuple `(vector_distance ASC NULLS LAST, popularity_score DESC, distance_m ASC)`.
- Plan 03 (tiered loop) wires the real `supabase.rpc('generate_candidates', ...)` at `feed/index.ts:881` into the `runTieredFetch` shape; the empty-pool early return (`:906-915`) must stay untouched.
- Plan 04 (DELETE path) adds the `body.record ?? body.old_record ?? {}` fallback at `invalidate-cache/index.ts:54`; keep the unconditional `feed:v2:*` flush event-independent.

## Self-Check: PASSED

All 4 created files and the SUMMARY exist on disk; all 3 task commits (`86cd292`, `aeb4558`, `0171b8d`) present in git log.
