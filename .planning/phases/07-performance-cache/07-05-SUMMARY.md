---
phase: 07-performance-cache
plan: 05
subsystem: database
tags: [supabase, postgres, pgvector, hnsw, triggers, vault, edge-functions, cache, redis]

# Dependency graph
requires:
  - phase: 07-02
    provides: "migration 175 (per-restaurant pre-cap K=8 in generate_candidates) + the hnsw GUC experiment"
  - phase: 07-03
    provides: "tiered-radius loop in feed/index.ts (PERF-01 SC#1 recall durability)"
  - phase: 07-04
    provides: "migration 176 cache-invalidation triggers + invalidate-cache DELETE-path fallback"
provides:
  - "07-OPERATOR-HANDOFF.md — single apply-and-verify runbook for migrations 175 + 176"
  - "Operator-confirmed prod apply of migrations 175 + 176 (direct-to-prod, no branch — Pro/branching unavailable)"
  - "PERF-03 SC#4 CONFIRMED — 9-row trigger-catalog coverage + smoke-test 200"
  - "PERF-02 SC#3 CONFIRMED — per-restaurant pre-cap K=8 shipped + applied"
  - "PERF-01 SC#2 DEFERRED decision (iterative_scan dropped, not beneficial at current corpus scale)"
affects: [phase-08, feed-performance, cache-invalidation, hnsw-tuning]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Runtime PERF set_config('hnsw.*', ..., is_local => true) inside a function body — the SET LOCAL / USERSET path, because ALTER FUNCTION ... SET hnsw.* fails with 42501 on the non-superuser postgres role"
    - "Direct-to-prod apply justified for schema-only, transactional, reversible, fail-soft migrations when branching is unavailable and there are zero real users"

key-files:
  created:
    - .planning/phases/07-performance-cache/07-OPERATOR-HANDOFF.md
  modified:
    - infra/supabase/migrations/175_generate_candidates_precap_iterative_scan.sql
    - infra/supabase/migrations/175_REVERSE_ONLY_generate_candidates_precap_iterative_scan.sql

key-decisions:
  - "iterative_scan GUC DROPPED (PERF-01 SC#2 DEFERRED) — operator latency validation rejected it at the production-representative 2.5km first tier; recall durability comes from the tiered-radius loop (SC#1), not the GUC"
  - "hnsw GUCs moved from ALTER FUNCTION (42501 permission denied) to runtime set_config(..., is_local => true) inside the function body"
  - "Direct-to-prod apply (no preview branch) was the agreed safe path: Supabase Pro/branching unavailable, zero real users, migrations schema-only + transactional + reversible + trigger fail-soft"

patterns-established:
  - "GUC-on-function on Supabase: use runtime set_config(..., true) in the body, never ALTER FUNCTION ... SET (catalog-persist requires superuser)"
  - "Defer-don't-force a query tuning knob: validate against the production-representative tier, keep the cheaper structural fix (pre-cap + tiered loop), revisit the GUC when the corpus grows sparse enough to under-return"

requirements-completed: [PERF-01, PERF-02, PERF-03]

# Metrics
duration: ~operator-gated (Task 1 authored prior session; Task 2 operator apply/verify on prod)
completed: 2026-06-21
---

# Phase 7 Plan 05: Operator Apply-and-Verify Handoff Summary

**Operator applied migrations 175 + 176 to prod: cache-invalidation triggers confirmed (9-row catalog + smoke 200), per-restaurant pre-cap K=8 shipped, and the hnsw iterative_scan GUC was dropped/deferred after live latency validation rejected it at the production tier.**

## Performance

- **Duration:** Operator-gated (Task 1 runbook authored in a prior session; Task 2 was an out-of-band operator apply + validation on prod)
- **Completed:** 2026-06-21
- **Tasks:** 2 (Task 1 authored runbook; Task 2 blocking-human checkpoint APPROVED)
- **Files modified:** 1 created (runbook) + 2 migration files revised in-flight during validation (175 + its REVERSE)

## Accomplishments

- **07-OPERATOR-HANDOFF.md** — a single numbered apply-and-verify runbook (Vault secret → apply 175+176 → 9-row catalog assertion → iterative_scan recall/latency validation → dashboard-webhook disable → post-apply smoke). Authored 46c7888, updated af8667c for the set_config fix.
- **Operator applied migrations 175 + 176 to prod** (direct-to-prod — see Deviations). Both parsed + applied clean.
- **PERF-03 (cache invalidation) fully validated:** Vault secret `invalidate_cache_service_key` created (copied from the existing `enrich_dish_service_key`); trigger-catalog assertion returned exactly **9 rows** (restaurants/menus/dishes × INSERT/UPDATE/DELETE, all AFTER) → **SC#4 CONFIRMED**; a dish UPDATE produced a `net._http_post` to invalidate-cache returning **status_code 200** (trigger→edge→cache-flush works end-to-end). No old dashboard webhook existed (verified via pg_trigger — only the 3 new `public._trg_invalidate_feed_cache` triggers; no `supabase_functions.http_request` trigger) → nothing to disable, no double-flush.
- **PERF-02 (Stage-1→Stage-2 payload):** per-restaurant pre-cap K=8 shipped + applied + behavior-preserving (Deno gate 3/3) → **SC#3 CONFIRMED**.
- **PERF-01 (feed recall):** SC#1 (tiered-radius loop) SHIPPED in 07-03 and delivers the recall guarantee; SC#2 (iterative_scan) **DEFERRED** after live validation (see Deviation B).

## Task Commits

1. **Task 1: Author operator apply/validation runbook** — `46c7888` (docs), then `af8667c` (docs — updated Step 1A + Step 3 for the runtime set_config fix)
2. **Task 2: Operator apply-and-verify checkpoint (blocking-human)** — operator action on prod; APPROVED. No agent commit.

**In-flight migration revisions during operator validation:**
- `36f51cf` (fix) — apply hnsw GUCs via runtime `set_config` in the `generate_candidates` body (42501 fix)
- `40aa09d` (fix) — drop the iterative_scan GUC from migration 175, keep the pre-cap (latency-validation outcome)

**Plan metadata:** this SUMMARY commit (docs: operator apply-verify complete + iterative_scan deferral).

## Files Created/Modified

- `.planning/phases/07-performance-cache/07-OPERATOR-HANDOFF.md` — the apply-and-verify runbook (Vault → 175+176 → 9-row catalog → iterative_scan validation → webhook disable → smoke)
- `infra/supabase/migrations/175_generate_candidates_precap_iterative_scan.sql` — revised twice in-flight: (1) GUCs moved to runtime `set_config(..., true)` to dodge 42501; (2) iterative_scan GUC removed, leaving the per-restaurant pre-cap K=8 only. The filename still says `precap_iterative_scan` but the iterative_scan part is intentionally absent.
- `infra/supabase/migrations/175_REVERSE_ONLY_generate_candidates_precap_iterative_scan.sql` — REVERSE comments updated to document the pre-cap-only final state.

## Decisions Made

- **Drop iterative_scan, keep the pre-cap (PERF-01 SC#2 DEFERRED).** Operator latency validation on the live corpus rejected the GUC at the production-representative tier. Recall durability is delivered by the tiered-radius loop (SC#1, 07-03), not the GUC. iterative_scan is deferred until the corpus grows sparse/large enough that the 2.5km first tier under-returns, at which point a TUNED GUC (lower `ef_search`/`max_scan_tuples`) is the move.
- **Runtime set_config over ALTER FUNCTION** for the hnsw GUCs — forced by Supabase's non-superuser `postgres` role (42501 on catalog-persisted GUCs).
- **Direct-to-prod apply** — agreed safe path given branching is unavailable, zero real users, and the migrations are schema-only / transactional / reversible / fail-soft.

## Deviations from Plan

The plan assumed a prod BRANCH/CLONE apply and an iterative_scan KEEP-or-RESET decision. Reality diverged on three points.

### Deviation 0 — apply target: direct-to-prod, not a branch/clone

- **Found during:** Task 2 (operator apply)
- **Issue:** The runbook's apply discipline assumed a Supabase prod branch/clone. Supabase Pro / database branching is not available on this project, so no isolated apply target existed.
- **Resolution:** Operator applied 175 + 176 directly to prod. Justified because there are **zero real users yet**, and the migrations are schema-only, transactional (single statement / idempotent `CREATE OR REPLACE` + `DROP IF EXISTS`/`CREATE TRIGGER`), reversible (paired REVERSE files), and the trigger is fail-soft (logs a WARNING and skips on missing Vault secret — never blocks a write).
- **Impact:** None negative — both migrations applied clean and were validated live.

### Deviation A — 42501 on ALTER FUNCTION ... SET hnsw.* → runtime set_config

- **Found during:** Task 2 (applying migration 175)
- **Issue:** The original `ALTER FUNCTION generate_candidates(...) SET hnsw.*` form failed on Supabase with `ERROR: 42501: permission denied to set parameter "hnsw.iterative_scan"`. The `postgres` role is not a superuser and cannot persist GUCs onto a function in the catalog.
- **Fix:** Moved the GUCs to runtime `PERFORM set_config('hnsw.*', ..., is_local => true)` inside the function body — the `SET LOCAL` equivalent (function-scoped, auto-reverts at exit, USERSET privilege path). Operator verified session-level `SET hnsw.iterative_scan` succeeds for the role.
- **Files modified:** `infra/supabase/migrations/175_...sql` (and the runbook Step 1A / Step 3, af8667c)
- **Committed in:** `36f51cf`

### Deviation B — iterative_scan GUC DROPPED (PERF-01 SC#2 DEFERRED)

- **Found during:** Task 2 (operator latency validation on the live corpus)
- **Context:** ~15k dishes, few restaurants concentrated in a couple of dense Mexico City neighborhoods, still being added to.
- **Measurements:** At 10km / 200-limit: 4.7s WITH the GUCs vs 10.4s WITHOUT (the GUC forced HNSW index usage at large radius). BUT at the production-representative **first tier (2.5km** — the tiered loop starts at 0.25× requested radius and breaks at POOL_TARGET=100), the query caps at 200 candidates (no under-return) and runs **~1.4s warm WITHOUT the GUC**, while the GUC's `max_scan_tuples=20000` would over-scan the small in-range set.
- **Decision:** **Drop the iterative_scan GUC, keep the per-restaurant pre-cap (K=8, PERF-02 SC#3).** Recall durability comes from the tiered-radius loop (PERF-01 SC#1, plan 07-03). iterative_scan is **DEFERRED** until the corpus grows sparse/large enough that the 2.5km tier under-returns — at which point a TUNED GUC (lower `ef_search`/`max_scan_tuples`) is the move.
- **Files modified:** `infra/supabase/migrations/175_...sql` + its REVERSE (comments document the deferral). Final committed state is pre-cap only, no GUC.
- **Committed in:** `40aa09d`
- **Note:** The migration filename still reads `precap_iterative_scan` but the iterative_scan part is intentionally absent. **iterative_scan did NOT ship.**

---

**Total deviations:** 3 (1 apply-target change, 1 blocking-fix `[Rule 3]`, 1 measurement-driven scope reduction). All operator-gated and recorded.
**Impact on plan:** All three requirements reach a confirmed disposition. PERF-01 is still delivered (via SC#1). No regression; the dropped GUC is a deliberate, data-backed deferral, not a gap.

## Issues Encountered

- **42501 permission denied** on `ALTER FUNCTION ... SET hnsw.*` — resolved via runtime `set_config` (Deviation A).
- **iterative_scan over-scans at the production tier** — resolved by dropping the GUC and relying on the structural fixes (Deviation B).
- **Feed first-tier latency ~1.4s warm** (production 2.5km tier, behind a 5-min Redis cache so most requests are cache hits). Acceptable for pre-launch; **flagged as a revisit-with-real-traffic item.**

## Requirement Status (net)

| Req | SC | Status |
|-----|-----|--------|
| PERF-01 (feed recall) | SC#1 tiered-radius loop | SHIPPED (07-03) |
| PERF-01 (feed recall) | SC#2 iterative_scan | **DEFERRED** — validated as not beneficial at current scale; revisit when corpus grows sparse |
| PERF-02 (Stage-1→Stage-2 payload) | SC#3 per-restaurant pre-cap K=8 | SHIPPED + applied + behavior-preserving (Deno 3/3) |
| PERF-03 (cache invalidation) | SC#4 INSERT/UPDATE/DELETE triggers | SHIPPED + applied + 9-row coverage CONFIRMED + smoke 200 |

## User Setup Required

None — the operator already completed all apply + verification on prod (Vault secret created, both migrations applied, smoke-tested). No further operator action for this plan.

## Next Phase Readiness

- Phase 7 closes: PERF-02 + PERF-03 confirmed live; PERF-01 delivered via the tiered loop with iterative_scan deliberately deferred.
- **Carry-forward:** revisit feed latency + the iterative_scan deferral once real traffic and a larger/sparser corpus arrive — at that point a tuned GUC (lower `ef_search`/`max_scan_tuples`) is the candidate fix.

## Self-Check: PASSED

---
*Phase: 07-performance-cache*
*Completed: 2026-06-21*
