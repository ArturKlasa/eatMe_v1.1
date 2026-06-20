---
phase: 04-edge-dependency-pinning-script-guard
plan: 03
subsystem: infra
tags: [prod-guard, dry-run, supabase, sec-03, cli-safety, backfill, ts-node]

# Dependency graph
requires:
  - phase: 04-edge-dependency-pinning-script-guard
    provides: "infra/scripts/lib/prod-guard.ts — parseGuard/announceTarget (plan 04-02)"
provides:
  - "All 8 infra/scripts prod-write paths gated by the shared prod-guard (default dry-run, --apply to write, announce project ref, --limit preserved)"
  - "batch-embed.ts net-new default-dry-run gate (previously wrote to prod on a bare run)"
  - "apply-phase6-flag-fixes.ts consumes the shared guard instead of its inline copy"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Every infra/scripts write path imports lib/prod-guard and branches on dryRun; no inline LIVE-default idiom remains"

key-files:
  created: []
  modified:
    - infra/scripts/backfill-cuisine-from-dishes.ts
    - infra/scripts/backfill-cuisine-from-google.ts
    - infra/scripts/backfill-cuisine-types.ts
    - infra/scripts/backfill-open-hours.ts
    - infra/scripts/backfill-restaurant-currency.ts
    - infra/scripts/backfill-restaurant-timezone.ts
    - infra/scripts/seed-cold-start-vectors.ts
    - infra/scripts/batch-embed.ts
    - infra/scripts/apply-phase6-flag-fixes.ts

key-decisions:
  - "Aliased the guard's dryRun back to the existing DRY_RUN const (`const { dryRun: DRY_RUN } = parseGuard()`) on the 7 LIVE-default scripts — least churn, existing `!DRY_RUN` mutation guards keep working with the flipped (now default-true) polarity"
  - "batch-embed gates via an early `return` in the `if (dryRun)` branch BEFORE the enrich fetch loop and both writing RPCs — makes the entire write path unreachable without --apply; dry-run reports the dish + active-restaurant counts that WOULD run"
  - "Reconciled each script's existing `Mode: DRY RUN / LIVE` log line into the single announceTarget banner; updated stale `Re-run without --dry-run` footers to `Re-run with --apply`"

requirements-completed: [SEC-03]

# Metrics
duration: ~12min
completed: 2026-06-20
status: complete
---

# Phase 4 Plan 03: Wire infra/scripts to the Shared Prod-Guard Summary

**All 8 confirmed prod-write scripts in `infra/scripts` now default to dry-run via the shared `lib/prod-guard.ts` — no write path reaches a prod mutation without `--apply`, every run announces the target project ref before any write, and the dry-run → sample (`--limit`) → full workflow is preserved (SEC-03 closed).**

## Performance
- **Duration:** ~12 min
- **Tasks:** 2
- **Files modified:** 9 scripts

## Accomplishments
- **7 LIVE-default backfill scripts flipped to default-dry-run** (`backfill-cuisine-from-dishes`, `backfill-cuisine-from-google`, `backfill-cuisine-types`, `backfill-open-hours`, `backfill-restaurant-currency`, `backfill-restaurant-timezone`, `seed-cold-start-vectors`): each replaces `const DRY_RUN = process.argv.includes('--dry-run')` (write-unless-flagged) with `const { dryRun: DRY_RUN, projectRef, limit: LIMIT } = parseGuard()` (dry-run-unless-`--apply`). Existing `!DRY_RUN` mutation guards (`.update` / `.upsert`) keep working; `--limit` (and `--all` on timezone) preserved.
- **`batch-embed.ts` net-new gate** (D-11): it had NO dry-run path and wrote to prod on a bare run. Now imports the guard, announces the ref, and on dry-run reports the dish count + active-restaurant count that WOULD run, then returns before the write-causing enrich fetch loop and both writing RPCs (`run_analyze_dishes`, `update_restaurant_vector`).
- **`apply-phase6-flag-fixes.ts` refactored** (D-07): the inline `apply`/`dryRun`/`SUPABASE_URL` banner (the reference shape that 04-02 generalized) is replaced with `parseGuard()` + `announceTarget()`. Behavior unchanged (was already default-dry-run + `--apply`); the `FIXES.length` count is preserved in a follow-up log line.
- **`announceTarget` prints the resolved project ref before any write** on every script (net-new for the 8 that never printed a ref).
- **Read-only scripts untouched**: the 11 read-only scripts (`replay-menu-scan-ab`, `preview-phase6-conversion`, `verify-phase6/7`, `check-favorites-duplicates`, `generate-phase6-flag-checklist`, all `diagnose-*`) show zero diff.

## Task Commits
1. **Task 1: Flip the 7 LIVE-default scripts to default-dry-run** — `0841c77` (feat)
2. **Task 2: batch-embed net-new gate + apply-phase6 refactor** — `3028107` (feat)

## Files Modified
- `backfill-cuisine-from-dishes.ts`, `backfill-cuisine-from-google.ts`, `backfill-cuisine-types.ts`, `backfill-open-hours.ts`, `backfill-restaurant-currency.ts`, `backfill-restaurant-timezone.ts`, `seed-cold-start-vectors.ts` — import the guard, default-dry-run, announce ref, preserve `--limit`/`--all`, header CLI-contract docs updated.
- `batch-embed.ts` — net-new default-dry-run gate around the enrich fetch loop + both writing RPCs.
- `apply-phase6-flag-fixes.ts` — inline guard replaced by the shared import; behavior unchanged.

## Verification Results
All local, no prod path. Smokes run with a throwaway `SUPABASE_URL` so no real prod is reachable (the only errors are expected network failures on the read `.select`, which occur strictly before any write).

- **Wiring**: all 8 write scripts import `lib/prod-guard` (apply-phase6 matches twice — import + header comment); 0 inline `process.argv.includes('--dry-run')` LIVE-defaults remain.
- **Default dry-run smokes (zero writes, ref printed)**: `backfill-cuisine-from-dishes`, `seed-cold-start-vectors`, `batch-embed`, `apply-phase6-flag-fixes` all print `=== DRY RUN (no writes) — project throwaway — re-run with --apply to write ===` before reaching any mutation. `grep -iq "dry run"` PASS for each.
- **`--dry-run` accepted as no-op**: `backfill-cuisine-from-dishes --dry-run` exits without an arg-parse error.
- **`--limit` preserved**: present in `backfill-cuisine-from-dishes` (6 matches) and `seed-cold-start-vectors` (9 matches).
- **Type-check**: `npx tsc --noEmit -p tsconfig.json` → exit 0.
- **Guard unit test**: `npm run test:guard` → 8/8 pass (no regression in the shared guard).
- **Read-only scripts**: `git diff --stat HEAD~2 -- <11 read-only scripts>` → empty.

## CLI-contract change (documented in each script header)
- Dry-run is now the **DEFAULT** on all 8 scripts.
- `--apply` is **required** to write.
- `--dry-run` is an **accepted no-op** affirmation (never errors).
- `--limit=N` (and `--all` on timezone) sampling is preserved.

## Operator note (NOT a phase gate)
The real `--apply` prod-write runs are operational — the operator runs each script with `--apply` only when a backfill is next needed, and confirms the `announceTarget` project-ref banner shows the correct target before any write. This plan authored + locally dry-run-verified only; it ran NO real `--apply` prod write.

## Decisions Made
- **`const { dryRun: DRY_RUN } = parseGuard()` alias** — keeps the existing `!DRY_RUN` mutation-guard sites byte-identical; only the default flips (D-07/D-09).
- **batch-embed early-return dry-run branch** — simplest correct net-new gate; the enrich fetch loop and both RPCs are unreachable without `--apply` (D-11).
- **Banner reconciliation** — folded each script's inline `Mode:` line into the single `announceTarget` banner so there is one clear mode statement; corrected stale `--dry-run` footer wording to `--apply`.

## Deviations from Plan
None — plan executed exactly as written.

## Known Stubs
None.

## Threat Flags
None — no new security surface introduced; this plan strictly tightens existing write paths.

## Issues Encountered
None.

## Self-Check: PASSED

---
*Phase: 04-edge-dependency-pinning-script-guard*
*Completed: 2026-06-20*
