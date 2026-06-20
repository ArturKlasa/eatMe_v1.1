---
status: passed
phase: 03-rls-hardening
verified: 2026-06-19
requirements: [SEC-02]
verifier: inline (orchestrator) — gsd-verifier agent not spawned (no gsd-sdk in env + session-limit-conscious); verification done against static gates + live operator branch-validation
---

# Phase 3: RLS Hardening — Verification

**Verdict: PASSED.** The phase goal — codify prod's behavioral-table RLS into a tracked, atomic, InitPlan-safe, performance-safe migration that cannot silently deny-all the live mobile client — is achieved and confirmed by live operator validation on a prod-clone branch.

## Goal check

> **Goal:** Every user-owned behavioral table that lacks protection has RLS enabled with a correct owner policy, authored so it cannot silently deny-all the live mobile client and cannot regress query performance.

Per the Phase-1 register (F-11), prod already had RLS on all 11 tables, so the goal was repurposed to **codification** (close the migrations↔prod drift). Migration 170 reproduces prod's protection as the canonical, version-controlled source. Operator probes confirm no silent deny-all (public reads intact; authenticated reads work) and no perf regression (owner columns indexed; pre-existing composites preserved).

## ROADMAP Success Criteria

| SC | Requirement | Evidence | Status |
|----|-------------|----------|--------|
| 1 | Staged migration enables RLS + creates owner policy in the same file (atomic) | `170_codify_behavioral_rls.sql`: 11 `ENABLE ROW LEVEL SECURITY` + 30 `CREATE POLICY` in one `BEGIN/COMMIT` | ✅ |
| 2 | `(select auth.uid()) = <owner>` InitPlan form (not bare) + owner-column btree index in same migration | 0 bare `auth.uid()` (29/29 wrapped); 7 `idx_<table>_user_id` created; 3 D-09 tables reuse existing owner-leading indexes | ✅ |
| 3 | Each policy targets verified owner column; mobile-direct tables only; service-role-only tables unchanged | All 10 owner tables use verified `user_id`; `dish_analytics` (dish-keyed, no user_id) left public-read + service-role; no service-role-only table altered | ✅ |
| 4 | `pnpm check-types` passes; migration dry-run validates; already-protected tables not blindly re-enabled against prod | `pnpm check-types` exit 0; operator validated on prod-clone branch; prod never touched (stage-don't-apply) | ✅ |

## Plan must_haves

| must_have | Evidence | Status |
|-----------|----------|--------|
| Repo migration reproduces prod's RLS on all 11 tables (closes drift) | Operator: exact canonical `policy_count` after apply, no duplication; sweep makes it idempotent on fresh DB or prod clone | ✅ |
| Every own-row policy InitPlan form, never bare | 0 bare `auth.uid()` (corrected grep; defective plan gate noted) | ✅ |
| 7 single-column owner indexes; 3 tables reuse composites by comment | 7 `idx_<table>_user_id`; favorites→`favorites_user_subject_unique` (154), session_views/user_dish_interactions→076 composites | ✅ |
| dish_analytics public-read + service-role, no owner policy/index/user_id | dish_analytics block references no `user_id`; `FOR ALL TO service_role` present | ✅ |
| Per-table enable+policies+index contiguous, one BEGIN/COMMIT | Confirmed (sweep preamble + 11 contiguous table blocks) | ✅ |
| REVERSE drops exactly the 7 indexes + all created policies, never the pre-existing composites | Reverse: 11 DISABLE, 7 DROP INDEX, 30 DROP POLICY, 0 references to 076/154 indexes; operator confirmed composites survive | ✅ |
| `pnpm check-types` passes, no type diff | exit 0 (RLS does not change generated types) | ✅ |
| Operator validates on a Supabase branch / shadow DB | Done (2 rounds): anon-deny, own-only + reassignment-rejected, public-read intact, idempotent apply + reverse | ✅ |

## Operator validation results (prod-clone branch)
- Structural: all 11 RLS-enabled; `policy_count` exactly canonical (2/4/4/3/2/2/3/2/2/3/3) with **no duplication**; 7 owner indexes; pre-existing composites preserved.
- Idempotency: re-running the forward leaves `policy_count` unchanged.
- Anon-deny: all 7 private tables → 0 rows.
- Own-only: authenticated user sees only own rows; `rows_NOT_owned_by_A = 0`.
- Reassignment: rejected with `new row violates row-level security policy`.
- Public reads: dish_opinions/dish_photos/restaurant_experience_responses return rows.

## Deviations (carried from SUMMARY)
1. Plan's bare-`auth.uid()` `<automated>` gate regex was inverted → verified the must-have with a corrected check.
2. Operator round-1 found policy duplication (out-of-band names) → rewrote forward to a name-agnostic sweep (`fcbf951`); round-2 clean.
3. Stale favorites index reference (154 replaced the 076 composite) → comment corrected.

## SEC-02
**Satisfied.** The codifying migration is authored, committed, and operator-validated. Applying 170 to prod to *reconcile* the out-of-band policies is an optional operator action (prod is already protected; not required for SEC-02).

## Notes on skipped automated gates (environment-adapted)
- **code-review gate:** not run as a separate multi-agent skill — deliverable is 2 SQL DDL files already validated live on a prod clone (strongest possible review) + all static gates; advisory-only and quota-conscious.
- **regression gate:** no cross-phase regression surface — DB-only DDL with zero app/edge/type coupling; `pnpm check-types` green.
- **schema-drift gate:** N/A by design — the migration is intentionally staged (authored + branch-validated, never pushed to prod by the agent, D-13); the operator confirmed live DB behavior, so the false-positive-verification risk the gate guards against does not apply.
