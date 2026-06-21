---
phase: 06-schema-teardown-spine
plan: 06
subsystem: database / operator-handoff
tags: [teardown, runbook, operator-gate, stage-dont-apply, DEBT-01, DEBT-02]
status: awaiting-operator
requires:
  - "06-01: verify-phase6-teardown.ts (read-only post-apply probe)"
  - "06-02: migration 171 (reconciled Phase B trigger/function drop)"
  - "06-03: migrations 172 (snapshot) / 173 (tables RESTRICT) / 174 (columns)"
  - "06-05: types.ts confirmed already slimmed (DEBT-04)"
provides:
  - "06-OPERATOR-HANDOFF.md: the apply-and-verify runbook (replaces CLI schema-push)"
  - "blocking-human gate: phase completion deferred to operator clean post-apply paste-back"
affects:
  - "prod Postgres (operator applies 171->172->173->174; agent applies nothing)"
tech-stack:
  added: []
  patterns:
    - "stage-don't-apply operator handoff as the load-bearing real-world gate"
    - "bundled jsonb_build_object probe + pg_depend audit paste-back (single-result convention)"
key-files:
  created:
    - ".planning/phases/06-schema-teardown-spine/06-OPERATOR-HANDOFF.md"
  modified: []
decisions:
  - "Phase completion is gated on the operator's clean post-apply probe + verify-script paste-back, not on build/check-types (which pass without applying drops)."
  - "Agent applies nothing to prod — no Supabase CLI in env; operator is the sole apply path."
metrics:
  duration: ~3 min
  completed: pending-operator
status_note: "Task 1 complete + committed; Task 2 is a blocking-human checkpoint — phase NOT complete until operator paste-back."
---

# Phase 6 Plan 6: Operator Apply-and-Verify Handoff Summary

Authored `06-OPERATOR-HANDOFF.md` — the stage-don't-apply runbook that hands the
operator the full safe path to apply the authored ingredient-teardown migrations
(171 triggers → 172 snapshot → 173 tables RESTRICT → 174 columns) and verify them,
replacing the standard CLI schema-push gate (no Supabase CLI in this env).

## What Was Built

**Task 1 (auto, committed `fd41428`):** `.planning/phases/06-schema-teardown-spine/06-OPERATOR-HANDOFF.md`, containing:

1. **PRE-FLIGHT (paste-back required):** the verbatim LIVE-STATE PROBE
   (`phase6_probe` single `jsonb_build_object` SELECT) and the verbatim pg_depend
   DEPENDENCY-AUDIT (`phase6_depaudit`), both copied exactly from 06-RESEARCH.md.
   Explicit STOP conditions: do not apply if `external_fks_into_set` or
   `dependent_objects` is non-empty. Reading guide for `archive_row_counts`
   (`-1` = already absent / no-op; `>= 0` = rows to archive).
2. **APPLY ORDER (one at a time):** Step A 171 → Step B 172 + the
   `ingredient_archive` LANDING CHECK (D-02: archive must land before any drop) →
   Step C 173 (FK-sever then child→parent RESTRICT, STOP on a RESTRICT error) →
   Step D 174. Rollback note pointing at the paired `*_REVERSE_ONLY_*.sql`
   (schema-only; data restored from `ingredient_archive`) and noting 172 has no reverse.
3. **SUPERSEDED-MIGRATION NOTE:** 151 / 152 / 153 are MUST-NOT-apply (151_REVERSE
   broken post-156; 152/153 CASCADE violates SC2), apply only 171→172→173→174.
4. **POST-APPLY VERIFICATION (paste-back required):** run
   `verify-phase6-teardown.ts` (expect all `GONE ✓`) + re-run the LIVE-STATE PROBE
   (expect all empty / `{}` / `-1`). Phase not complete until clean paste-back.

**Task 2 (checkpoint:human-verify, gate=blocking-human):** the blocking operator
gate. The agent applied **nothing** to prod (stage-don't-apply). Awaiting the
operator's clean post-apply paste-back before the phase can be marked complete.

## Deviations from Plan

None — plan executed exactly as written. Task 1 delivered the runbook with all
required sections; Task 2 surfaced as the blocking-human checkpoint per the plan.

## Verification

- Task 1 `<automated>` gate: `HANDOFF_OK` (file exists; contains LIVE-STATE PROBE,
  `phase6_depaudit`, `verify-phase6-teardown`, and the 171/173 filenames).
- All acceptance criteria greps pass: `phase6_probe`, `phase6_depaudit`,
  `ingredient_archive` (172 landing check), superseded note, verify step, and the
  171 → 172 → 173 → 174 apply order in sequence.

## Operator Gate (pending)

The phase real-world gate is in place but NOT yet satisfied. The operator must:
1. Run + paste back the PRE-FLIGHT probe + dep-audit (dep-audit arrays must be empty).
2. Apply 171 → 172 (+landing check) → 173 → 174 (not 151/152/153).
3. Run + paste back `verify-phase6-teardown.ts` (all `GONE ✓`) + re-run probe (all empty).

Until that clean paste-back arrives, this plan — and the phase — is `awaiting-operator`.

## Self-Check: PASSED
- FOUND: .planning/phases/06-schema-teardown-spine/06-OPERATOR-HANDOFF.md
- FOUND: commit fd41428 (operator handoff runbook)
