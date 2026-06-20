---
phase: 06-schema-teardown-spine
plan: 03
subsystem: database / migrations
tags: [DEBT-02, schema-teardown, ingredient-pipeline, RESTRICT-drop, archive-snapshot]
status: complete
requires:
  - "06-02 (reconciled Phase B trigger drop, migration 171) — drops dishes_override_refresh before the columns die"
provides:
  - "172_snapshot_ingredient_archive.sql — in-DB pre-drop archive in non-public schema (D-01/D-02/D-03)"
  - "173_drop_ingredient_tables_restrict.sql (+REVERSE) — child-to-parent RESTRICT table drop with options FK-sever carve-out (SUPERSEDES 152)"
  - "174_drop_ingredient_columns_restrict.sql (+REVERSE) — dead dishes.*_override column drop"
affects:
  - "operator handoff 06-06 (pg_depend audit + LIVE-STATE PROBE + apply order)"
tech-stack:
  added: []
  patterns:
    - "Presence-guarded CREATE TABLE AS SELECT (DO $$ + to_regclass) for idempotent in-DB archive"
    - "Child-to-parent RESTRICT drop ordering (loud-fail on unknown dependents per SC2)"
    - "FK-sever-first carve-out (ALTER ... DROP COLUMN before the parent table drop)"
    - "Degenerate schema-only REVERSE (152_REVERSE precedent) for multi-migration structural rollback"
key-files:
  created:
    - infra/supabase/migrations/172_snapshot_ingredient_archive.sql
    - infra/supabase/migrations/173_drop_ingredient_tables_restrict.sql
    - infra/supabase/migrations/173_REVERSE_ONLY_drop_ingredient_tables_restrict.sql
    - infra/supabase/migrations/174_drop_ingredient_columns_restrict.sql
    - infra/supabase/migrations/174_REVERSE_ONLY_drop_ingredient_columns_restrict.sql
  modified: []
decisions:
  - "Reworded plan-dictated header/comment prose to avoid the literal tokens to_regclass / CASCADE / canonical_ingredient_id where the plan's own acceptance greps required an exact count (the comment text and the count check conflicted). Meaning preserved; counts now match."
metrics:
  duration: ~8 min
  completed: 2026-06-20
  tasks: 2
  files: 5
---

# Phase 6 Plan 03: Phase C Teardown Migrations (DEBT-02) Summary

Authored the Phase C ingredient-pipeline teardown migrations in the locked spine order — snapshot-first (172), RESTRICT table drop with FK-sever carve-out (173), dead-column drop (174) — each forward drop paired with a schema-only reverse, superseding the CASCADE-based 152/153. Authored + dry-run only; not applied to prod.

## What Was Built

- **172_snapshot_ingredient_archive.sql** — Creates the non-`public` `ingredient_archive` schema (D-03: no PostgREST surface, no RLS) and archives the 9 snapshot-then-drop tables via presence-guarded (`DO $$ ... to_regclass ...`) `CREATE TABLE AS SELECT` blocks, so any table the LIVE-STATE PROBE reports absent is a silent no-op. Authored as a SEPARATE migration the operator applies + verifies BEFORE 173 (D-02). One-way archive — no reverse authored (documented in header; future cleanup is `DROP SCHEMA ingredient_archive`). Trailing operator landing-check comment included.
- **173_drop_ingredient_tables_restrict.sql** — Supersedes 152 (CASCADE→RESTRICT, SC2). First DDL statement severs `options.canonical_ingredient_id` (FK-sever carve-out, RESEARCH Pitfall 2) so `canonical_ingredients` can drop under RESTRICT. Then 10 `DROP TABLE IF EXISTS public.<t> RESTRICT` drops child-to-parent (`variant_translations` → ... → `canonical_ingredients` last). Zero CASCADE. One `BEGIN;...COMMIT;`. Header carries the operator pre-apply checklist (pg_depend audit + 172-landing confirm).
- **173_REVERSE_ONLY** — Degenerate schema-only reverse (152_REVERSE precedent): no-op body + header documenting structural rollback (re-run migrations 099-106 + re-add the options FK) and manual `INSERT ... SELECT FROM ingredient_archive.<t>` data restore.
- **174_drop_ingredient_columns_restrict.sql** — Drops `dishes.allergens_override` + `dishes.dietary_tags_override` with `DROP COLUMN IF EXISTS` (zero CASCADE). Explicitly does NOT touch the options FK column (severed in 173). Apply after 173.
- **174_REVERSE_ONLY** — Re-adds both columns with their original `text[] DEFAULT ARRAY[]::text[]` defaults (schema-only; columns were always empty/default).

## Verification

All `<automated>` gates and `<acceptance_criteria>` pass:

- Task 1: `TABLES_OK` — 172 has 9 presence guards + `CREATE SCHEMA IF NOT EXISTS ingredient_archive`, 0 `public.` archive targets; 173 has 10 `DROP TABLE IF EXISTS public` drops, ≥10 RESTRICT, 0 CASCADE, FK-sever (line 40) precedes first DROP TABLE (line 43), `canonical_ingredients` is the last table drop; 173 REVERSE is degenerate (0 CREATE/DROP TABLE).
- Task 2: `COLUMNS_OK` — 174 has 2 `DROP COLUMN IF EXISTS`, 0 `canonical_ingredient_id`, 0 CASCADE; 174 REVERSE has 2 `ADD COLUMN IF NOT EXISTS`.

Post-commit safety: no unexpected file deletions, no untracked residue.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking inconsistency] Plan-dictated comment prose collided with the plan's own acceptance greps**
- **Found during:** Task 1 (172/173) and Task 2 (174) verification.
- **Issue:** The plan's `<action>` text specified verbatim comment lines containing the literal tokens `to_regclass` (172 operator comment), `CASCADE` (173 SUPERSEDES + banner prose), and `canonical_ingredient_id` (174 NOTE). The plan's `<acceptance_criteria>` simultaneously required `grep -c to_regclass` == 9, `grep -cE "\bCASCADE\b"` == 0, and `grep -c canonical_ingredient_id` == 0 — which the dictated comment text would have failed.
- **Fix:** Reworded the conflicting prose to preserve meaning while removing the literal tokens ("presence guards" for to_regclass; "cascade mechanism / cascading / RESTRICT only" for CASCADE; "options FK column into canonical_ingredients" for canonical_ingredient_id). Migration bodies unchanged.
- **Files modified:** 172_snapshot_ingredient_archive.sql, 173_drop_ingredient_tables_restrict.sql, 174_drop_ingredient_columns_restrict.sql
- **Commits:** 3618622 (Task 1), 92fb431 (Task 2)

## Authentication Gates

None.

## Known Stubs

None. The 173/174 REVERSE files are intentionally degenerate/schema-only (D-05, 152_REVERSE precedent), not stubs — documented in their headers as one-way moves with manual data restore.

## Operator Handoff (deferred to 06-06)

Migrations are authored + dry-run only — NOT applied. Before applying, the operator must (per 173 header + 06-06): (1) run the LIVE-STATE PROBE + pg_depend dependency audit and confirm `external_fks_into_set` and `dependent_objects` are empty; (2) apply + verify 172 landed; (3) apply 173 then 174 in order.

## Self-Check: PASSED
