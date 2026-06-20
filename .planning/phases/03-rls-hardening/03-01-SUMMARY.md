---
phase: 03-rls-hardening
plan: 01
subsystem: database
tags: [postgres, rls, supabase, migration, security, row-level-security]

# Dependency graph
requires:
  - phase: 01-assessment-findings-register
    provides: F-11 prod RLS probe (per-table cmd→role→predicate map) — the source of truth for what RLS to codify
provides:
  - "Migration 170 (forward + reverse) codifying prod's behavioral-table RLS into version control — closes the migrations↔prod drift (SEC-02)"
  - "Name-agnostic policy-sweep pattern for reconciling out-of-band RLS into a canonical, idempotent migration"
affects: [phase-06-schema-teardown, future-rls-work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RLS codification via name-agnostic policy sweep (DO loop over pg_policies) → canonical CREATE POLICY set, so the migration yields one canonical set on a fresh DB OR a prod clone"
    - "InitPlan-form own-row predicate (select auth.uid()) = user_id; own-row TO authenticated; genuine public reads USING (true) open to public"

key-files:
  created:
    - infra/supabase/migrations/170_codify_behavioral_rls.sql
    - infra/supabase/migrations/170_REVERSE_ONLY_codify_behavioral_rls.sql
  modified: []

key-decisions:
  - "Self-cleaning sweep over name-keyed DROP IF EXISTS — operator validation found prod's out-of-band policies use different names, so a name-keyed drop duplicated the policy set; a name-agnostic sweep guarantees exactly the canonical set"
  - "favorites/session_views/user_dish_interactions reuse existing owner-leading indexes (favorites_user_subject_unique from 154; idx_*_user_type from 076) — no redundant single-column index (D-09)"
  - "dish_analytics left public-read + service-role only — dish-keyed, no user_id (D-07)"
  - "user_behavior_profiles UPDATE gains WITH CHECK (prod omitted it) — tightening per Pitfall 5, not an access expansion"

patterns-established:
  - "Codification migrations sweep pre-existing out-of-band policies before recreating the canonical set, making them drift-closing AND idempotent"
  - "Stage-don't-apply: migration authored + operator-validated on a prod-clone branch; never applied to prod by the agent (D-13)"

requirements-completed: [SEC-02]

# Metrics
duration: ~2h (incl. 2 operator validation rounds)
completed: 2026-06-19
---

# Phase 3: RLS Hardening Summary

**Migration 170 codifies prod's behavioral-table RLS into version control via a name-agnostic policy sweep + canonical InitPlan-form owner/public/service-role policies on all 11 mobile-direct tables — operator-validated on a prod-clone branch, closing the migrations↔prod drift (SEC-02).**

## Performance

- **Duration:** ~2h (including two operator branch-validation rounds)
- **Started:** 2026-06-19T22:28Z (plan ready)
- **Completed:** 2026-06-19
- **Tasks:** 3 (2 auto + 1 blocking human-verify checkpoint)
- **Files modified:** 2 (both new SQL migrations)

## Accomplishments
- Authored `170_codify_behavioral_rls.sql` — enables RLS + canonical policies (+ 7 owner indexes) on all 11 behavioral tables in one `BEGIN/COMMIT`, fronted by a name-agnostic policy sweep so it yields exactly the canonical set on any DB state.
- Authored `170_REVERSE_ONLY_codify_behavioral_rls.sql` — drops the 30 canonical policies + 7 created indexes and disables RLS (reverse order), preserving the pre-existing 076/154 owner-lookup indexes.
- Operator validated on a Supabase prod-clone branch: clean idempotent apply, exact canonical `policy_count` (no duplication), anon-deny on private tables, own-only on authenticated reads, owner-reassignment rejected, public reads intact, reverse round-trip clean.
- Cross-checked the canonical set against prod's 30 out-of-band policies (dumped via `pg_policies`) — semantically equivalent, with only the documented deliberate improvements; zero access expansions.

## Task Commits

1. **Task 1: Author 170 forward migration** - `57c1761` (feat)
2. **Task 2: Author 170 reverse migration + pnpm check-types** - `06e7b0a` (feat)
3. **Self-cleaning revision (gap closure from operator round-1)** - `fcbf951` (fix)
4. **Task 3: Operator branch-validation** — human-verify checkpoint, PASSED (round 2: exact canonical counts, idempotent, anon-deny 0)

**Tracking commits:** `c267640`, `ccc9e75` (checkpoint state)

## Files Created/Modified
- `infra/supabase/migrations/170_codify_behavioral_rls.sql` - Forward: name-agnostic policy sweep → enable RLS + canonical owner/public/service-role policies + 7 owner indexes on 11 tables, one transaction.
- `infra/supabase/migrations/170_REVERSE_ONLY_codify_behavioral_rls.sql` - Reverse: drop canonical policies + 7 created indexes, disable RLS; rolls back to no-RLS (does not restore the retired out-of-band policies).

## Decisions Made
- **Self-cleaning sweep** (round-2 fix): see Deviations below. Prod's out-of-band policy names differ from the canonical names, so the original name-keyed `DROP POLICY IF EXISTS` could not replace them and the migration duplicated the policy set. Replaced per-policy drops with a name-agnostic `DO` sweep over `pg_policies`.
- **Index reuse** for favorites/session_views/user_dish_interactions per D-09 (favorites covered by `favorites_user_subject_unique` from migration 154, not the dropped 076 composite).
- **dish_analytics** public-read + service-role only (D-07); **user_behavior_profiles UPDATE** tightened with WITH CHECK (Pitfall 5).

## Deviations from Plan

### Auto-fixed Issues

**1. [Defective verification command] Plan's bare-`auth.uid()` grep gate was inverted**
- **Found during:** Task 1 verification
- **Issue:** The plan's `<automated>` gate `grep -oE '[^(]auth\.uid\(\)'` matches the *mandated* InitPlan form `(select auth.uid())` (the call is preceded by a space, satisfying `[^(]`) and misses an actual bare `(auth.uid()` form — it would fail correct SQL and pass wrong SQL.
- **Fix:** Verified the underlying must-have ("zero bare `auth.uid()`") with a corrected check: every non-comment `auth.uid()` is wrapped in `(select …)` → 29 calls / 29 wrapped / 0 bare. All other plan gates pass as written.
- **Files modified:** none (verification-only)
- **Verification:** corrected grep; operator live behavioral probes confirm enforcement.
- **Committed in:** n/a

**2. [Gap closure from operator validation] Policy duplication → self-cleaning sweep**
- **Found during:** Task 3 (operator round-1 branch validation)
- **Issue:** Prod was configured out-of-band with RLS policies under different names than the canonical set. The original name-keyed `DROP POLICY IF EXISTS "<canonical name>"` did not match them, so applying 170 to the prod clone ADDED a parallel set (policy_count doubled). Behavior stayed correct (permissive policies OR together; all probes passed) but the drift was not cleanly closed.
- **Fix:** Rewrote the forward migration to sweep every pre-existing policy off the 11 tables (name-agnostic `DO` loop over `pg_policies`) before creating the canonical set, and updated the reverse's rollback-semantics note. Cross-checked equivalence against the dumped prod policies first.
- **Files modified:** both 170 SQL files
- **Verification:** operator round-2 — `policy_count` exactly canonical (no doubling), idempotent on re-run, anon-deny still 0.
- **Committed in:** `fcbf951`

**3. [Stale reference] favorites owner-index comment**
- **Found during:** Task 3 (round-1 structural check showed only 2 of the expected 3 "076 composites")
- **Issue:** Plan referenced `idx_favorites_user_subject` (076), but migration 154 dropped it and replaced it with the `favorites_user_subject_unique` UNIQUE index (leading user_id).
- **Fix:** Updated the favorites comment to reference the real covering index. No functional/perf gap — the owner lookup is still indexed.
- **Committed in:** `fcbf951`

---

**Total deviations:** 3 (1 defective-gate workaround, 1 gap-closure rewrite from live validation, 1 stale-comment fix)
**Impact on plan:** The gap-closure rewrite is the substance of SEC-02 being met cleanly — without it the migration documented the right policies but duplicated them on apply. No scope creep; the canonical access semantics are unchanged from prod (plus the documented deliberate improvements).

## Issues Encountered
- Initial spawned `gsd-executor` subagent hit a session limit before doing any work (0 tokens); the plan was executed inline by the orchestrator instead (single-plan phase — permitted for ≤3-plan phases).

## User Setup Required
None - no external service configuration required. (Operator branch-validation is complete; applying 170 to prod to *reconcile* the out-of-band policies is an optional operator action — prod is already protected, so it is not required.)

## Next Phase Readiness
- SEC-02 satisfied: the canonical RLS now lives in version control and reproduces prod's protection on a fresh build; the migration safely reconciles a prod clone with no duplication.
- Phase 4 (Edge Dependency Pinning & Script Guard) and Phase 5/6 are unblocked; this DB-only migration has no app/edge/type coupling.

---
*Phase: 03-rls-hardening*
*Completed: 2026-06-19*
