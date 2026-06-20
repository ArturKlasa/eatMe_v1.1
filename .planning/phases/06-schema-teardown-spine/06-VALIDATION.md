---
phase: 6
slug: schema-teardown-spine
status: planned
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-20
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> This phase is **stage-don't-apply**: DB drops are authored + dry-run only; the operator applies in prod. Validation therefore leans on grep pre-flights, a read-only verify script, `turbo check-types`, and operator paste-back probes — not unit tests (DDL is not unit-testable here, consistent with the project's minimal-test posture).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None for DB drops (DDL). TS: Vitest (admin / web-portal-v2 / shared). Edge: Deno test. |
| **Config file** | per-app vitest config; `deno` for edge functions |
| **Quick run command** | `git grep` pre-flights + per-migration `IF EXISTS` idempotency reasoning |
| **Full suite command** | `turbo check-types` (apps) + operator paste-back probes (LIVE-STATE PROBE + DEP-AUDIT) |
| **Estimated runtime** | ~30s (`turbo check-types`); grep instant; operator probes out-of-band |

---

## Sampling Rate

- **After every task commit:** relevant `git grep` pre-flight + `turbo check-types` (for any TS-touching commit)
- **After every plan wave:** full `turbo check-types`; for DB waves, the authored migration + dry-run reasoning (operator applies separately)
- **Before `/gsd-verify-work`:** `turbo check-types` green; zero-importer grep green; `verify-phase6-teardown.ts` written
- **Phase gate (operator):** paste-back of LIVE-STATE PROBE + DEP-AUDIT shows clean post-apply state
- **Max feedback latency:** ~30 seconds (in-repo); operator probe is out-of-band

---

## Per-Task Verification Map

> Planner fills this row-by-row as plans/tasks are authored. Seed mapping from research below.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-T1 | 06-01 | 1 | DEBT-01/02 | T-06-01/02 | read-only REST verify script (GONE/STILL-EXISTS) exists; writes nothing | tsc + grep | `tsc --noEmit --skipLibCheck` on the script + grep for createClient/full-table-list/read-only banner | ❌→✅ W0: this plan writes `verify-phase6-teardown.ts` | ⬜ pending |
| 06-02-T1 | 06-02 | 1 | DEBT-01 | T-06-03/05 | inert triggers/functions dropped; pre-flight clean; zero CASCADE | grep + operator probe | `git grep -nE "dish_ingredients_refresh\|trg_dish_ingredients_refresh\|refresh_dish_dietary" -- 'apps/**' 'infra/supabase/functions/**'` (zero) + `grep -c "DROP TRIGGER IF EXISTS" 171...` =3 + zero CASCADE | ✅ existing tooling | ⬜ pending |
| 06-02-T2 | 06-02 | 1 | DEBT-01 | T-06-04 | degenerate REVERSE — no recreation of 156-broken functions | grep | `grep -v '^--' 171_REVERSE... \| grep -cE "CREATE FUNCTION\|CREATE TRIGGER"` =0 | ✅ existing tooling | ⬜ pending |
| 06-03-T1 | 06-03 | 2 | DEBT-02 | T-06-06/07/08/09 | snapshot-first (non-public schema); options FK sever first; RESTRICT child→parent; zero CASCADE | grep | `grep -cE "\bCASCADE\b" 173...` =0 + `grep -c RESTRICT 173...` ≥10 + `CREATE SCHEMA IF NOT EXISTS ingredient_archive` present + FK-sever precedes first DROP TABLE | ✅ existing tooling | ⬜ pending |
| 06-03-T2 | 06-03 | 2 | DEBT-02 | T-06-06 | dead override columns dropped; options FK not re-dropped; reverse re-adds | grep | `grep -c "DROP COLUMN IF EXISTS" 174...` =2 + canonical_ingredient_id count =0 + reverse ADD COLUMN =2 | ✅ existing tooling | ⬜ pending |
| 06-04-T1 | 06-04 | 1 | DEBT-03 | T-06-10/12 | v2 severed FIRST (KindSelector deleted, DishForm flat, MenuManager reconciled) | grep + tsc | `test ! -f KindSelector.tsx` + v2 DishKind grep zero + `cd apps/web-portal-v2 && npx tsc --noEmit` | ✅ existing tooling | ⬜ pending |
| 06-04-T2 | 06-04 | 1 | DEBT-03 | T-06-10/11 | shims + test deleted from @eatme/shared; DINING_FORMATS kept; zero importers | grep + check-types | `git grep -nE "\bDishKind\b\|\bDISH_KIND_META\b" -- 'apps/**' 'packages/**' ':!**/.next/**'` (zero) + `turbo check-types` | ✅ existing tooling | ⬜ pending |
| 06-05-T1 | 06-05 | 3 | DEBT-04 | T-06-13/14/15 | types.ts residue-free; edge enums reconciled (no-op for ingredients); check-types passes | grep + check-types | residue grep on types.ts (expect zero) + edge-fn grep (comments only) + `turbo check-types` | ✅ existing tooling | ⬜ pending |
| 06-06-T1 | 06-06 | 4 | DEBT-01/02 | T-06-16..19 | operator runbook bundles probe+dep-audit, apply order, post-apply verify | grep (doc) | `grep -q phase6_probe/phase6_depaudit/verify-phase6-teardown/superseded` in 06-OPERATOR-HANDOFF.md | ✅ existing tooling | ⬜ pending |
| 06-06-T2 | 06-06 | 4 | DEBT-01/02 | T-06-16..19 | BLOCKING operator apply-and-verify gate (paste-back clean post-apply probe) | manual (operator) | operator paste-back: verify-phase6-teardown.ts all GONE + re-run probe all-empty | manual (stage-don't-apply) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `infra/scripts/verify-phase6-teardown.ts` — read-only REST probe mirroring `infra/scripts/verify-phase7.ts`; asserts each dropped table/column errors on `select` (= GONE). Covers DEBT-01 / DEBT-02 post-apply verification. **Authored by plan 06-01 (Wave 1).** NOTE: it is READ-ONLY, so it is NOT wired through `prod-guard.ts` (the guard is for write scripts; PATTERNS.md explicitly warns against wiring it into a read-only script).
- [x] (No test-framework install needed — DDL drops are validated by operator probe + verify script, not unit tests; consistent with the project's stage-don't-apply DB posture.)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live prod schema state (which ingredient_* tables/triggers/functions actually exist post-156) | DEBT-01 / DEBT-02 | REST-only env — no psql/DB shell; agent cannot query live prod | Operator pastes the bundled `jsonb_build_object` LIVE-STATE PROBE + DEPENDENCY-AUDIT (from 06-RESEARCH.md) into the Supabase dashboard SQL editor and pastes results back before any drop is applied |
| Migration drop application | DEBT-01 / DEBT-02 | Stage-don't-apply — operator applies drops via dashboard, not the agent | Operator applies authored migrations in order, then re-runs the probe + `verify-phase6-teardown.ts` to confirm GONE state |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify (grep / check-types / verify-script) or Wave 0 dependencies (06-06-T2 is the one operator-manual gate — stage-don't-apply, documented in Manual-Only Verifications)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (only the final operator gate is manual)
- [x] Wave 0 covers the verify-phase6-teardown.ts MISSING reference (plan 06-01)
- [x] No watch-mode flags (all gates are run-once: grep, tsc --noEmit, turbo check-types)
- [x] Feedback latency < 30s (in-repo gates; operator probe is out-of-band by design)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved (planner) 2026-06-20
