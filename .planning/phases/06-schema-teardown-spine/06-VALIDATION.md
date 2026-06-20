---
phase: 6
slug: schema-teardown-spine
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| 6-XX-XX | XX | 1 | DEBT-01 | — | inert triggers/functions dropped; pre-flight clean | grep + operator probe | `git grep -nE "dish_ingredients\|canonical_ingredient" -- apps/ infra/supabase/functions/` (zero) | ✅ existing tooling | ⬜ pending |
| 6-XX-XX | XX | 2 | DEBT-02 | — | tables+columns dropped child→parent RESTRICT; deps audited; snapshot first | operator probe + dep-audit + verify script | LIVE-STATE PROBE + DEP-AUDIT (paste-back) + `verify-phase6-teardown.ts` | ❌ W0: write `verify-phase6-teardown.ts` | ⬜ pending |
| 6-XX-XX | XX | 1 | DEBT-03 | — | DishKind/DISH_KIND_META gone; v2 importers first; zero importers | grep + check-types | `git grep -nE "DishKind\|DISH_KIND_META" -- apps/ packages/ ':!**/.next/**'` (zero) + `turbo check-types` | ✅ existing tooling | ⬜ pending |
| 6-XX-XX | XX | 3 | DEBT-04 | — | types.ts has no dropped objects; edge enums reconciled; check-types passes | grep + check-types | residue grep (expect zero) + `turbo check-types` | ✅ existing tooling | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `infra/scripts/verify-phase6-teardown.ts` — read-only REST probe mirroring `infra/scripts/verify-phase7.ts`; asserts each dropped table/column errors on `select` (= GONE). Covers DEBT-01 / DEBT-02 post-apply verification. Wire through `infra/scripts/lib/prod-guard.ts`.
- [ ] (No test-framework install needed — DDL drops are validated by operator probe + verify script, not unit tests; consistent with the project's stage-don't-apply DB posture.)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live prod schema state (which ingredient_* tables/triggers/functions actually exist post-156) | DEBT-01 / DEBT-02 | REST-only env — no psql/DB shell; agent cannot query live prod | Operator pastes the bundled `jsonb_build_object` LIVE-STATE PROBE + DEPENDENCY-AUDIT (from 06-RESEARCH.md) into the Supabase dashboard SQL editor and pastes results back before any drop is applied |
| Migration drop application | DEBT-01 / DEBT-02 | Stage-don't-apply — operator applies drops via dashboard, not the agent | Operator applies authored migrations in order, then re-runs the probe + `verify-phase6-teardown.ts` to confirm GONE state |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify (grep / check-types / verify-script) or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers the verify-phase6-teardown.ts MISSING reference
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s (in-repo gates)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
