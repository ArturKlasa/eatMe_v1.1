---
phase: 01-assessment-findings-register
plan: 04
subsystem: planning
tags: [scope-propagation, roadmap, requirements, rls, drift, user-gated, no-renumber]

# Dependency graph
requires:
  - phase: 01-assessment-findings-register (Plan 03)
    provides: FINDINGS.md with all live-state sections FINAL (scope-impact cells now complete)
provides:
  - "ROADMAP.md scope annotations on Phases 3, 5, 7 (verdict-driven, user-approved)"
  - "REQUIREMENTS.md footer documenting the gated scope review; SEC-02 confirmed Pending (codify path)"
  - "Phase 3 repurposed: CODIFY existing prod RLS into a migration (closes migrations<->prod drift)"
affects: [phase-3-rls, phase-5-cleanup, phase-7-perf-cache]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "User-gated scope propagation (D-11): candidate edits built from FINDINGS scope-impact cells, presented for sign-off, ONLY approved edits applied"
    - "D-12 no-renumber: scope changes are annotations + status, never phase/requirement renumber (10 phases / 21 requirements invariant held)"

key-files:
  created:
    - .planning/phases/01-assessment-findings-register/01-04-SUMMARY.md
  modified:
    - .planning/ROADMAP.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "USER DECISION (decision checkpoint): Phase 3 = CODIFY existing prod RLS into a tracked migration (not empty). Rationale: prod has RLS on all 11 behavioral tables but the repo migrations have zero ENABLE RLS, so a fresh DB from migrations would be unprotected — codifying closes that drift. SEC-02 therefore stays Pending (satisfied when the migration is authored in Phase 3), NOT flipped to Satisfied."
  - "USER DECISION: apply ALL candidate annotations (Phase 5 narrow-to-residual-docs, Phase 7 pgvector + webhook notes, Phase 3 codify note)."
  - "Phase 5 annotated NOT descoped — only SC#2's web-portal deletion is already done (c1a7e3f); CLEAN-01 + CLEAN-03 remain in scope."

patterns-established:
  - "Assessment-first scope trimming: a Phase-1 verdict (prod RLS already enabled) re-shapes a downstream phase (Phase 3 enable -> codify) at a single gated review, with full FINDINGS audit trail"

requirements-completed: [ASSESS-01]

# Metrics
duration: inline (orchestrator decision checkpoint)
completed: 2026-06-19
status: complete
---

# Phase 01 Plan 04: User-Gated Scope Propagation Summary

**At Phase-1 close, presented the verdict-driven scope changes for sign-off and applied ONLY the approved set: three `Scope note (per FINDINGS)` annotations on ROADMAP Phases 3/5/7 plus a REQUIREMENTS footer documenting the review. The consequential outcome — Phase 3 is repurposed from "enable RLS" to "CODIFY existing prod RLS into a migration", because Phase 1 proved prod already has RLS on every behavioral table while the repo migrations do not (drift). No phase or requirement was renumbered.**

## Decision Checkpoint (Task 1) — user sign-off

Presented the candidate edit set built from the final FINDINGS.md scope-impact cells. User responses:

- **Phase 3 disposition:** **Codify prod RLS into a migration** (chosen over "empty Phase 3" and "leave unannotated"). Closes the migrations↔prod drift with zero prod risk (authored + dry-run only).
- **Remaining annotations:** **Apply all.**

## Applied Edits (Task 2) — approved set only, scoped Edits (never whole-file Write)

**ROADMAP.md** — three `**Scope note (per FINDINGS):**` lines added inside the phase detail blocks:
- **Phase 3 (RLS Hardening):** F-11 — all 11 behavioral tables already RLS-protected in prod (catch-all: only `spatial_ref_sys` unprotected); SEC-02 enable-gap does not exist → phase **repurposed to CODIFY** prod RLS into a tracked migration (baseline has zero `ENABLE RLS` → drift; fresh DB would be unprotected). `dish_analytics` dish-keyed → not a per-user policy. SEC-02 open until the migration is authored.
- **Phase 5 (Dead Code & Doc Cleanup):** F-03/04/08 — `apps/web-portal` already deleted+committed (`c1a7e3f`) → SC#2 narrows to residual-doc cleanup; SC#1 (CLEAN-01) + SC#3 (CLEAN-03) remain in scope — **NOT descoped**.
- **Phase 7 (Performance & Cache):** F-13 — pgvector `0.8.0` → `hnsw.iterative_scan` available (SC#2). F-21 — enrich webhook covers INSERT+UPDATE (agrees w/ migration 135); feed-cache `invalidate-cache` webhook not in deployed trigger catalog → SC#4 must locate the wiring first; flush-all tension is the SC#4 design call.

**REQUIREMENTS.md** — SEC-02 left `Pending` (codify path, not satisfied yet); ASSESS-01/02/03 already `Complete` (genuinely satisfied post-Plan-03); `Last updated` footer rewritten to document the gated review outcome.

## Acceptance-Criteria Evidence
- `grep -cE '^\- \[[ x]\] \*\*Phase [0-9]+:'` ROADMAP → **10** (no renumber)
- `grep -c 'Scope note (per FINDINGS'` ROADMAP → **3**
- `grep -cE '^\| (ASSESS|SEC|CLEAN|DEBT|PERF|RFCT)-[0-9]+ \|'` REQUIREMENTS → **21** (requirement set intact)
- `| SEC-02 | Phase 3 | Pending |` still present → SEC-02 correctly NOT flipped (codify chosen)
- `git diff --stat` → ROADMAP (6 insertions) + REQUIREMENTS (1 line replaced) only — annotations + footer, no structural change, no deletions of phase/requirement lines

## Task Commits
1. **Task 1: Present proposed scope changes for sign-off** — decision checkpoint, cleared (user chose codify + apply-all; no code change).
2. **Task 2: Apply ONLY approved annotations** — `afcae35` (docs).

## Files Created/Modified
- `.planning/ROADMAP.md` — 3 scope-note annotations (Phases 3/5/7).
- `.planning/REQUIREMENTS.md` — footer documents the gated review; SEC-02 stays Pending.

## Deviations from Plan
- **[Process] Executed inline by the orchestrator** rather than via a spawned executor — Task 1 is a decision checkpoint that requires user input, so an executor would immediately bounce. The orchestrator built the candidate set, ran the checkpoint (AskUserQuestion), and applied only the approved edits. No deviation from the plan's Task 1/Task 2 intent.

## Issues Encountered
None. The diff is annotations-only; the no-renumber invariant held.

## User Setup Required
None.

## Next Phase Readiness
- Later phases now read already-trimmed scope from ROADMAP: Phase 3 knows to codify (not enable), Phase 5 knows the deletion is done, Phase 7 has the pgvector/webhook facts.
- SEC-02 remains the live tracker for the Phase 3 codifying migration.

## Self-Check: PASSED
- FOUND: .planning/ROADMAP.md (3 scope notes; 10 phases)
- FOUND: .planning/REQUIREMENTS.md (21 requirements; SEC-02 Pending; footer updated)
- FOUND: .planning/phases/01-assessment-findings-register/01-04-SUMMARY.md
- FOUND: commit afcae35 (Task 2 annotations)

---
*Phase: 01-assessment-findings-register*
*Completed: 2026-06-19*
