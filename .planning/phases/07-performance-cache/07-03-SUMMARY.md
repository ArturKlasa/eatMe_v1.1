---
phase: 07-performance-cache
plan: 03
subsystem: api
tags: [supabase, edge-function, deno, generate_candidates, postgis, performance]

# Dependency graph
requires:
  - phase: 07-01
    provides: Wave-0 tiered-loop validation harness (tiered-loop.test.ts) encoding the break/replace/shape contract
provides:
  - Tiered/expanding-radius loop wrapping the generate_candidates RPC in feed/index.ts
  - Dense-urban requests bail early at a narrow radius; sparse requests fall through to the full requested radius (worst case == today's single-shot)
affects: [feed, performance-cache, mobile-feed]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tiered-radius candidate fetch: loop fractions [0.25, 0.5, 1.0] of the requested radius, break at POOL_TARGET, replace-not-merge"

key-files:
  created: []
  modified:
    - infra/supabase/functions/feed/index.ts

key-decisions:
  - "Replace pool per tier (strict superset) instead of merge/dedup — wider radius is always a superset of narrower"
  - "Final tier == requested radius (fraction 1.0) so worst-case sparse path is never slower/wider than today's single-shot"
  - "POOL_TARGET=100 (~half of p_limit=200) chosen as the healthy-pool break threshold"

patterns-established:
  - "Tiered-radius RPC loop: named tunable constants (TIER_FRACTIONS, POOL_TARGET), only p_radius_m varies per tier, all other 12 RPC params identical"

requirements-completed: [PERF-01]

# Metrics
duration: ~5min
completed: 2026-06-21
---

# Phase 7 Plan 03: Tiered-Radius Candidate Loop Summary

**Wrapped the single generate_candidates RPC call in an expanding-radius loop over fractions [0.25, 0.5, 1.0] of the requested radius — dense areas bail early at POOL_TARGET=100, sparse areas fall through to the full requested radius — with the downstream response path byte-identical.**

## Performance

- **Duration:** ~5 min
- **Completed:** 2026-06-21T16:00:31Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Replaced the single-shot `generate_candidates` call-site (`feed/index.ts:881-903`) with a tiered/expanding-radius loop (D-01..D-03, PERF-01 SC#1)
- Loop probes 25% → 50% → 100% of the client-requested radius via `Math.round(requestedRadiusM * frac)`; only `p_radius_m` varies, the other 12 RPC params are identical
- Pool is REPLACED each tier (wider tier is a strict superset, never merged/deduped); loop breaks once `pool.length >= POOL_TARGET` (100)
- Final tier == requested radius, so worst-case sparse/rural request is bounded by today's single-shot behavior (never slower or wider)
- Everything from the candidate-count `console.log` downstream (empty-pool early return, `const annotated`, response assembly) is byte-identical — confirmed by scoped git diff
- Wave-0 tiered-loop harness stays green against the implemented loop (break-at-POOL_TARGET, sparse fall-through, Candidate[] shape parity)

## Task Commits

Each task was committed atomically:

1. **Task 1: Wrap the generate_candidates RPC in the tiered-radius loop** - `b351794` (feat)
2. **Task 2: Confirm response-shape parity against the Wave-0 harness** - no production code (parity gate only; harness unchanged, ran green)

## Files Created/Modified
- `infra/supabase/functions/feed/index.ts` - Replaced the single-shot RPC call-site with the tiered-radius loop (TIER_FRACTIONS, POOL_TARGET, replace-not-merge, break-on-target)

## Decisions Made
None beyond those locked in the plan (D-01..D-03). Implemented exactly to the plan's loop spec.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. The first Edit targeted the shared-checkout path and was redirected to the worktree copy (worktree isolation guard); re-applied to the worktree copy with no change in content.

## Threat Mitigations Applied
- **T-07-06 (Tampering — tier exceeding requested radius):** `TIER_FRACTIONS` max is `1.0` and `requestedRadiusM = radius * 1000`; `Math.round(requestedRadiusM * frac)` can never exceed the requested radius. Harness asserts the final tier == requested radius.
- **T-07-07 (Tampering — response shape drift):** Diff scoped to `:881-903`; everything downstream of the final `pool` assignment untouched (git-diff verified). Harness asserts `Candidate[]` shape parity.

## Next Phase Readiness
- The tiered loop is live in the feed edge function source; no migration and no mobile change required.
- Deployment of the edge function (infra/supabase) is the operator step to activate the loop in prod.
- Operator fallback documented in the threat register: a 2-tier `[0.5, 1.0]` schedule if 3 round-trips prove too costly on sparse data.

## Self-Check: PASSED

- FOUND: `infra/supabase/functions/feed/index.ts` (TIER_FRACTIONS + POOL_TARGET present)
- FOUND: commit `b351794`
- FOUND: `.planning/phases/07-performance-cache/07-03-SUMMARY.md`

---
*Phase: 07-performance-cache*
*Completed: 2026-06-21*
