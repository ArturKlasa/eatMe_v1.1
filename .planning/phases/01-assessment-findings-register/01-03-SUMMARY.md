---
phase: 01-assessment-findings-register
plan: 03
subsystem: planning
tags: [rls, pgvector, webhooks, supabase, prod-probe, live-state, operator-checkpoint, drift]

# Dependency graph
requires:
  - phase: 01-assessment-findings-register (Plan 01)
    provides: FINDINGS register with 3 PENDING live-state sections (F-11 RLS, F-13 pgvector, F-21 webhook)
  - phase: 01-assessment-findings-register (Plan 02)
    provides: assess-live-state.sql read-only prod probe (statically validated)
provides:
  - "FINDINGS.md three live-state sections FINAL from operator prod paste-back (zero PENDING markers)"
  - "Live RLS verdict: all 11 behavioral tables already RLS-protected in prod (descopes Phase 3)"
  - "Live pgvector extversion=0.8.0 -> hnsw.iterative_scan available (Phase 7 input)"
  - "Deployed webhook reconciliation: enrich INSERT+UPDATE agrees with code-first; feed-cache wiring flagged for Phase 7"
affects: [01-04 scope-propagation, phase-3-rls, phase-7-pgvector, phase-7-cache-webhooks]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Operator human-action checkpoint: orchestrator presents probe, operator runs once on prod, pastes back; continuation transcribes (no fabrication)"
    - "Supabase SQL editor returns only the LAST statement's result for a multi-statement run -> remaining blocks re-fetched as a single jsonb_build_object SELECT (one clean paste-back)"
    - "Migrations-vs-prod drift detection: prod catalog is source of truth for RLS/triggers; repo migrations re-checked against it"

key-files:
  created:
    - .planning/phases/01-assessment-findings-register/01-03-SUMMARY.md
  modified:
    - .planning/codebase/FINDINGS.md

key-decisions:
  - "F-11 verdict flipped confirmed -> already-resolved (prod): live state overturns the code-first 'gap exists' reading — all 11 behavioral tables have rowsecurity=true + owner policies; catch-all confirms only spatial_ref_sys (PostGIS) unprotected. Migrations<->prod drift recorded (zero ENABLE RLS in baseline) as the residual Phase-3 question."
  - "Phase 3 'enable RLS' work descoped; residual choice (codify prod RLS into a migration vs. empty Phase 3) deferred to the user-gated Plan 04 scope review — NOT pre-decided."
  - "F-21 feed-cache webhook left as an honestly-open sub-fact: the complete deployed trigger dump on restaurants/menus/dishes contains NO invalidate-cache/http_request trigger, so its INSERT/UPDATE/DELETE coverage cannot be confirmed from Block 3 — Phase 7 must locate the wiring. Not fabricated."

patterns-established:
  - "Read-only operator prod-probe checkpoint -> paste-back -> faithful transcription, with still-blocked sub-facts reported rather than guessed"

requirements-completed: [ASSESS-02, ASSESS-03]

# Metrics
duration: 1session (interrupted by session limit; finished inline by orchestrator)
completed: 2026-06-19
status: complete
---

# Phase 01 Plan 03: Operator Live-State Checkpoint Summary

**The operator ran `assess-live-state.sql` once on EatMe prod and pasted back all five blocks; the three PENDING live-state sections of FINDINGS.md (F-11 RLS, F-13 pgvector, F-21 webhook) are now FINAL — zero PENDING markers remain. The headline result: prod already has RLS enabled on every behavioral table, materially descoping Phase 3.**

## Live-State Captured (operator paste-back 2026-06-19)

- **F-11 RLS (Blocks 1 / 1b / 4):** All 11 behavioral tables (`favorites`, `dish_opinions`, `dish_photos`, `restaurant_experience_responses`, `session_views`, `user_behavior_profiles`, `user_dish_interactions`, `user_points`, `user_sessions`, `user_visits`, `dish_analytics`) have `rowsecurity=true` WITH owner/policy coverage (own-row CRUD via `auth.uid()=user_id`; `dish_analytics` = public-read + service-role-manage; `user_behavior_profiles` = own read/update + service-role-manage). Catch-all (Block 1b): only `spatial_ref_sys` (PostGIS system table) has RLS disabled — **no user-owned table is exposed.** Block 4 confirms 10 tables carry `user_id (uuid)`; `dish_analytics` absent (dish-keyed, not user-owned). **Verdict flip: confirmed -> already-resolved (prod).** Migrations<->prod **drift** recorded: repo baseline has ZERO `ENABLE ROW LEVEL SECURITY` for these tables, so prod was configured out-of-band.
- **F-13 pgvector (Block 2):** prod `vector` `extversion=0.8.0` (installed + default 0.8.0). 0.8.0 >= 0.8.0 -> **`hnsw.iterative_scan` IS available** -> Phase 7 may enable it (GUC, no extension upgrade).
- **F-21 webhook (Block 3):** deployed `trg_enrich_on_dish_change` fires AFTER **INSERT + UPDATE** on `dishes` -> **AGREES** with the migration-135 code-first baseline (no DELETE). The complete trigger dump on restaurants/menus/dishes contains **no** `invalidate-cache`/`http_request` cache-invalidation trigger -> the feed-cache webhook is not a deployed table trigger on the core feed tables. Recorded honestly as an open sub-fact for Phase 7 to resolve. Flush-all tension preserved (Phase 7 call).

## Scope Impacts (candidates for the Plan 04 user-gated review)

1. **Phase 3 (RLS) — major descope.** No prod RLS security gap exists. Original "enable RLS" work has nothing to enable. Residual question (user-gated): CODIFY the existing prod RLS into a tracked migration to close the migrations<->prod drift, vs. empty Phase 3 entirely. SEC-02 candidate -> Satisfied.
2. **Phase 7 (pgvector) — unknown resolved positively.** `hnsw.iterative_scan` available on 0.8.0.
3. **Phase 7 (cache webhook) — coverage question sharpened.** Enrich webhook agrees with baseline; feed-cache invalidation wiring not visible in the deployed trigger catalog -> Phase 7 must locate it and confirm INSERT/DELETE coverage.

## Task Commits

1. **Task 1: Operator runs the prod probe + pastes back** — human-action checkpoint, cleared (operator ran the probe on EatMe prod via the Supabase SQL editor; no code change).
2. **Task 2: Transcribe paste-back into FINDINGS.md** — `3d14bfb` (docs).

## Files Created/Modified
- `.planning/codebase/FINDINGS.md` — three live-state sections (F-11, F-13, F-21) + their summary-table rows filled from the prod paste-back; zero `PENDING — live-state` markers remain.

## Acceptance-Criteria Evidence
- `grep -c 'PENDING — live-state' FINDINGS.md` -> **0** (all live-state sections filled)
- F-11 contains `rowsecurity` per-table true/false + `mobile-direct`/`service-role` caller labels (12 mobile-direct labels)
- F-13 records concrete `extversion=0.8.0`
- F-21 has BOTH code-first (invalidate-cache UPDATE-only) AND deployed-trigger result + explicit `AGREES` reconciliation word
- `dish_analytics` still flagged NOT user-owned (5 occurrences)

## Deviations from Plan

**1. [Process] Session limit interrupted the transcription executor; orchestrator finished inline.**
- The spawned continuation executor (Plan 03 Task 2) hit the session usage limit after partial progress (summary rows + F-11 detail + F-13 summary done; 2 detail-section Evidence lines still PENDING, uncommitted, no SUMMARY).
- The orchestrator completed the remaining two detail-section edits (F-13 Evidence/verdict, F-21 Evidence) inline, verified acceptance criteria, committed, and authored this SUMMARY. No content deviation from the plan's Task 2 intent.

**2. [Tooling] Supabase SQL editor returned only Block 4 on the first multi-statement run.**
- The editor shows only the LAST statement's result set. Block 4 (the last SELECT before ROLLBACK) was all that came back initially.
- Resolved by handing the operator a single `SELECT jsonb_pretty(jsonb_build_object(...))` that bundled the remaining four blocks (1/1b/2/3) into one read-only result -> one clean paste-back. Still strictly read-only (one SELECT under the READ ONLY guard). No change to the committed probe file.

## Issues Encountered
- The feed-cache `invalidate-cache` webhook is not present in the deployed trigger catalog for restaurants/menus/dishes. Left as an honestly-open sub-fact for Phase 7 (not fabricated).

## User Setup Required
None further — the operator paste-back is captured.

## Next Phase Readiness
- All three live-state sections FINAL; Phases 3/6/7 can now scope from real prod state (D-10 fully satisfied).
- Plan 04 (user-gated scope propagation) can build its candidate edit set from the now-final FINDINGS scope-impact cells — chiefly the Phase 3 descope decision.

## Self-Check: PASSED
- FOUND: .planning/codebase/FINDINGS.md (0 PENDING markers)
- FOUND: .planning/phases/01-assessment-findings-register/01-03-SUMMARY.md
- FOUND: commit 3d14bfb (Task 2 transcription)

---
*Phase: 01-assessment-findings-register*
*Completed: 2026-06-19*
