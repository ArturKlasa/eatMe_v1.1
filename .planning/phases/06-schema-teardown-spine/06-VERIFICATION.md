---
phase: 06-schema-teardown-spine
verified: 2026-06-21T00:00:00Z
status: passed
score: 4/4
behavior_unverified: 0
overrides_applied: 0
---

# Phase 6: Schema Teardown Spine — Verification Report

**Phase Goal:** The orphaned ingredient pipeline and the now-isolated DishKind shims are removed in the one strictly-ordered, irreversible-aware sequence, and the generated DB types are regenerated exactly once to match the slimmed schema.
**Verified:** 2026-06-21
**Status:** passed
**Re-verification:** No — initial verification

## Reconciliation Context Applied

Per the critical reconciliation context provided with this task:

- SC1 "migration 151" reconciled to migration 171 (`171_retire_ingredient_triggers_reconciled.sql`). 171 supersedes 151 per D-06; its degenerate REVERSE is the SC1 deliverable for the reverse pair.
- Phase is STAGE-DON'T-APPLY: no Supabase CLI. Migrations 171/172/173/174 are AUTHORED, not applied by an agent.
- Operator ran the live-state probe on prod and pasted back a clean result (all ingredient tables/triggers/functions already GONE). Prod had drifted ahead of repo migration history. Migrations 171-174 are guaranteed no-ops; operator chose NOT to apply them. Real-world end-state confirmed.
- DEBT-04 (SC4) satisfied by VERIFICATION: `packages/database/src/types.ts` was already regenerated to the post-teardown schema. Re-grepping (zero residue) + turbo check-types (green) is the SC4 proof. No fresh regen commit needed or desired (re-generating would introduce drift against the already-correct file).

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Phase B (migration 171) drops the inert triggers with IF EXISTS, preceded by a clean git-grep pre-flight (zero hits in apps/ and infra/supabase/functions/), with its REVERSE pair authored | VERIFIED | 171 exists: 3 `DROP TRIGGER IF EXISTS` + 5 `DROP FUNCTION IF EXISTS`, 0 CASCADE, PRESERVE section for still-wanted enrich triggers. Live re-run of SC1 git-grep (excl. rough-idea.md prose) returns zero. 171_REVERSE is degenerate/marker-only — no executable CREATE FUNCTION/TRIGGER (count=0). Commits 4b4a3ad + 5d4d3ef. |
| 2 | Phase C is authored as staged migrations (snapshot → RESTRICT table drop → column drop) in explicit child-to-parent order using RESTRICT; preceded by a pg_depend dependency-audit query and a data snapshot; treated as one-way | VERIFIED | 172 (`CREATE SCHEMA IF NOT EXISTS ingredient_archive`, 9 `to_regclass`-guarded `CREATE TABLE AS SELECT` blocks), 173 (FK-sever at line 40 before first DROP TABLE at line 43; `canonical_ingredients` LAST at line 52; 10 `DROP TABLE IF EXISTS ... RESTRICT`, 0 CASCADE), 174 (2 `DROP COLUMN IF EXISTS`, 0 `canonical_ingredient_id`, 0 CASCADE). pg_depend DEPENDENCY-AUDIT SQL verbatim in 06-OPERATOR-HANDOFF.md. Reverses 173/174 are schema-only degenerate per 152_REVERSE precedent. 172 explicitly one-way (no reverse authored, documented in header). Commits 3618622 + 92fb431. |
| 3 | DishKind/DISH_KIND_META usage removed from apps/web-portal-v2 FIRST, then shims + dish-kinds.test.ts deleted from @eatme/shared, proven by a zero-importer consumer grep | VERIFIED | KindSelector.tsx DELETED; DishForm.tsx has 0 `dish_kind` / 0 `DishKind` references; DISH_KIND_META gone from constants/menu.ts (DINING_FORMATS preserved — count ≥1); DishKind type + legacy field gone from types/restaurant.ts; DishKind re-export gone from types/index.ts; dish-kinds.test.ts DELETED. Zero-importer grep `\bDishKind\b|\bDISH_KIND_META\b` across apps/** + packages/** (excl. .next/) returns 0. Commits d113e50 + cfcb7cc. |
| 4 | DB types contain zero dropped-object residue; inline edge-function enum copies reconciled; turbo check-types passes across all apps | VERIFIED | `grep -cE "dish_ingredients|canonical_ingredient|..."` on packages/database/src/types.ts returns 0. `git grep` for any dropped ingredient DB object across infra/supabase/functions/** returns 0. `pnpm turbo check-types` exits 0 (3 successful: admin + web-portal-v2 + @eatme/ui, 3 cached). DEBT-04 satisfied by verification, not a hand-edit — types were already regenerated to the post-teardown schema. |

**Score:** 4/4 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `infra/scripts/verify-phase6-teardown.ts` | Read-only REST probe for post-apply GONE check | VERIFIED | Exists; `createClient(process.env.SUPABASE_URL` present; covers 3 columns + 10 tables; `GONE ✓` count=3; read-only banner present; 0 prod-guard tokens. Commit 65a95f1. |
| `infra/supabase/migrations/171_retire_ingredient_triggers_reconciled.sql` | Reconciled Phase B trigger/function drop (DEBT-01) | VERIFIED | Exists; 3 DROP TRIGGER IF EXISTS; 5 DROP FUNCTION IF EXISTS; 0 CASCADE; PRESERVE section for enrich triggers. |
| `infra/supabase/migrations/171_REVERSE_ONLY_retire_ingredient_triggers_reconciled.sql` | Degenerate reverse (no recreation of dropped-object-referencing functions) | VERIFIED | Exists; 0 executable CREATE FUNCTION/TRIGGER; BEGIN/COMMIT wrapper present; header documents irreversibility. |
| `infra/supabase/migrations/172_snapshot_ingredient_archive.sql` | In-DB archive snapshot in non-public schema (DEBT-02, D-01/D-02/D-03) | VERIFIED | Exists; `CREATE SCHEMA IF NOT EXISTS ingredient_archive`; 9 to_regclass-guarded blocks; no `public.` archive targets; one-way (no reverse authored, documented). |
| `infra/supabase/migrations/173_drop_ingredient_tables_restrict.sql` | RESTRICT child-to-parent table drop with options FK-sever first (DEBT-02, SC2) | VERIFIED | Exists; FK-sever (line 40) precedes first DROP TABLE (line 43); canonical_ingredients LAST (line 52); 10 DROP TABLE IF EXISTS; ≥10 RESTRICT; 0 CASCADE. |
| `infra/supabase/migrations/173_REVERSE_ONLY_drop_ingredient_tables_restrict.sql` | Degenerate schema-only reverse | VERIFIED | Exists; 0 executable CREATE TABLE/DROP TABLE; no-op body with documented manual restore path. |
| `infra/supabase/migrations/174_drop_ingredient_columns_restrict.sql` | Dead dishes override column drop (DEBT-02) | VERIFIED | Exists; 2 DROP COLUMN IF EXISTS; 0 canonical_ingredient_id; 0 CASCADE. |
| `infra/supabase/migrations/174_REVERSE_ONLY_drop_ingredient_columns_restrict.sql` | Schema-only reverse re-adding both columns | VERIFIED | Exists; 2 ADD COLUMN IF NOT EXISTS with original text[] DEFAULT ARRAY[]::text[] defaults. |
| `.planning/phases/06-schema-teardown-spine/06-OPERATOR-HANDOFF.md` | Operator apply-and-verify runbook | VERIFIED | Exists; phase6_probe, phase6_depaudit, ingredient_archive landing check, 151/152/153 superseded note, verify-phase6-teardown reference, apply order 171→172→173→174 in sequence. |
| `apps/web-portal-v2/src/components/menu/DishForm.tsx` | Flat dish form with no kind discriminator (D-07) | VERIFIED | Exists; 0 `dish_kind` references; 0 `DishKind` references; flat buildDishInput. |
| `packages/shared/src/constants/menu.ts` | Menu constants without DISH_KIND_META (DINING_FORMATS preserved) | VERIFIED | DISH_KIND_META count=0; DINING_FORMATS count≥1. |
| `packages/database/src/types.ts` | Generated DB types confirmed residue-free (DEBT-04) | VERIFIED | Dropped-object residue grep returns 0. No edit performed (types already slimmed). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `171_retire_ingredient_triggers_reconciled.sql` | supersedes `151_retire_ingredient_triggers.sql` | IF EXISTS forward-drop set, D-06 reconciliation, degenerate REVERSE | VERIFIED | Header explicitly states it supersedes 151; same trigger/function drop targets; header warns against applying both. |
| `173_drop_ingredient_tables_restrict.sql` | `172_snapshot_ingredient_archive.sql` | snapshot must land BEFORE any drop (D-02); header references landing check | VERIFIED | 173 header pre-apply checklist item 2 requires confirming 172 landed; 06-OPERATOR-HANDOFF.md enforces 172 before 173 in the apply order. |
| `173_drop_ingredient_tables_restrict.sql` | `options.canonical_ingredient_id` | FK-sever first statement before canonical_ingredients drop under RESTRICT | VERIFIED | FK-sever at line 40 is the first DDL statement; first DROP TABLE at line 43; canonical_ingredients drop at line 52 (last). |
| `06-OPERATOR-HANDOFF.md` | `infra/scripts/verify-phase6-teardown.ts` | post-apply verification step references the verify script | VERIFIED | grep for "verify-phase6-teardown" in OPERATOR-HANDOFF.md returns a hit. |
| `apps/web-portal-v2/src/components/menu/DishForm.tsx` | `@eatme/shared` | import keeps DishV2Input + PRIMARY_PROTEINS, drops type DishKind | VERIFIED | 0 DishKind in DishForm.tsx; import from @eatme/shared still present (PRIMARY_PROTEINS used). |

### Data-Flow Trace (Level 4)

Not applicable. Phase deliverables are SQL migrations, a verification script, and TypeScript type/constant removals — not React components rendering dynamic data from an API.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| turbo check-types passes across all apps post-teardown | `pnpm turbo check-types` | "3 successful, 3 total; Cached: 3 cached, 3 total; Time: 73ms FULL TURBO" | PASS |
| types.ts has zero dropped-object residue | `grep -cE "dish_ingredients|canonical_ingredient|..."` on packages/database/src/types.ts | 0 | PASS |
| Zero DishKind/DISH_KIND_META importers in apps + packages | `git grep -nE "\bDishKind\b|\bDISH_KIND_META\b" -- 'apps/**' 'packages/**' ':!**/.next/**'` | 0 lines | PASS |
| SC1 pre-flight: zero live ingredient-trigger references in apps/ and edge functions | `git grep -nE "dish_ingredients|trg_dish_ingredients_refresh|..."` (excl. rough-idea.md) | 0 hits | PASS |
| Operator prod probe: all ingredient objects GONE | Operator paste-back from Supabase SQL editor (06-06-SUMMARY.md) | `ingredient_tables_present:[], ingredient_triggers_present:[], ingredient_functions_present:[], dead_columns_present:{}` | PASS |
| Operator dep-audit: no external FKs or dependents | Operator paste-back (06-06-SUMMARY.md) | `dependent_objects:[], external_fks_into_set:[]` | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| DEBT-01 | 06-02 | Ingredient-pipeline triggers dropped (Phase B) via staged, dry-run migration | SATISFIED | Migration 171 authors 3 trigger + 5 function drops with IF EXISTS, 0 CASCADE, degenerate REVERSE, SC1 pre-flight clean. |
| DEBT-02 | 06-03 | Orphaned ingredient-pipeline tables and columns dropped (Phase C) via staged migration with pg_depend pre-flight and ordered RESTRICT drops (child→parent); snapshot first | SATISFIED | Migrations 172 (snapshot), 173 (RESTRICT table drops — 10 tables, FK-sever carve-out), 174 (column drops) authored and op-verified against prod (all already GONE). |
| DEBT-03 | 06-04 | DishKind/DISH_KIND_META usage removed from apps/web-portal-v2 first, then shims + dish-kinds.test.ts deleted from @eatme/shared | SATISFIED | KindSelector.tsx DELETED; DishForm.tsx flat (0 dish_kind); DISH_KIND_META gone; DishKind type + field + re-export + test gone; zero-importer grep returns 0. |
| DEBT-04 | 06-05 | @eatme/database types regenerated in sync with current schema (post-teardown) and committed | SATISFIED | types.ts confirmed residue-free (grep=0); D-10 edge-function inline enum verified no-op for ingredients; turbo check-types green. Satisfied by verification not edit per reconciliation context (types already slimmed; re-generating would introduce drift). |

All 4 requirements mapped to Phase 6 in REQUIREMENTS.md are SATISFIED. No orphaned Phase 6 requirements detected.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/web-portal-v2/src/components/menu/MenuManager.tsx` | 24, 167, 204, 346 | `dish_kind: string` in local type; `dish_kind: 'standard'` in optimistic create/update rows; `{dish.dish_kind}` rendered as visible badge | Warning (code review WR-03) | On-ice v2 app; badge always shows "standard" (hardcoded constant string); no functional regression in prod. SC3's gate is zero DishKind/DISH_KIND_META importers, which passed — this is a `dish_kind` string property on a local interface, not the deleted enum type. Review flagged; not a blocker per code review WR-03 advisory. |
| `packages/shared/src/types/restaurant.ts:21-37`, `packages/shared/src/types/index.ts:7-8` | 21-37 / 7-8 | `DishCourse` / `DishCourseItem` types still exported, referencing dropped schema (dish_courses/dish_course_items dropped migration 163) | Warning (code review WR-04) | On-ice v2 app only; no live consumers in admin or mobile. No `@deprecated` annotation. Review flagged as advisory. Not a blocker for this phase's goal (DishKind removal is the SC3 target, not DishCourse). |

No `TBD`, `FIXME`, or `XXX` debt markers found in any file modified by this phase.

### Human Verification Required

None. All must-haves verified programmatically. Operator probe paste-back (documented in 06-06-SUMMARY.md) provides the real-world prod confirmation.

### Gaps Summary

No gaps. All 4 success criteria are satisfied:

- SC1: Migration 171 (reconciled Phase B) authors the trigger/function drop with a clean SC1 pre-flight and a degenerate REVERSE. The ROADMAP wording says "migration 151" but the reconciliation context explicitly names 171 as the SC1 deliverable (151 superseded per D-06).
- SC2: Migrations 172/173/174 author the Phase C teardown in strict child-to-parent RESTRICT order, snapshot-first, with a pg_depend audit in the OPERATOR-HANDOFF runbook and the prod operator confirmation (all objects already GONE — dep-audit clean).
- SC3: DishKind/DISH_KIND_META removed from web-portal-v2 first, then deleted from @eatme/shared; zero-importer grep confirmed empty; turbo check-types green. The WR-03 residual `dish_kind: string` field in MenuManager is a string property on a local interface (not the deleted enum symbol), acceptable per the reconciliation context ("SC3's gate is the zero-IMPORTER grep on DishKind/DISH_KIND_META, which passed").
- SC4: types.ts residue grep returns 0; D-10 edge-function inline enum verified no-op for ingredients; turbo check-types exits 0 across admin + web-portal-v2 + @eatme/ui.

The two code review warnings (WR-03, WR-04) are advisory and non-blocking per the 06-REVIEW.md (0 critical, 0 blockers). They concern dead UI in the on-ice web-portal-v2 app and orphaned-schema type exports — outside this phase's goal boundary.

---

_Verified: 2026-06-21_
_Verifier: Claude (gsd-verifier)_
