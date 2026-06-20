---
phase: 04-edge-dependency-pinning-script-guard
plan: 02
subsystem: infra
tags: [ts-node, node-test, prod-guard, dry-run, supabase, sec-03, cli-safety]

# Dependency graph
requires:
  - phase: 02-cors-lockdown
    provides: "_shared/cors.ts DRY shared-helper precedent (mirrored by prod-guard.ts)"
provides:
  - "infra/scripts/lib/prod-guard.ts — single source of truth for prod-write clearance (default dry-run, --apply trigger, announce-target)"
  - "parseGuard(argv) → { dryRun, apply, projectRef, limit } and announceTarget(g) API"
  - "test:guard npm script (node --test --require ts-node/register) + prod-guard.test.ts"
  - "First module under infra/scripts/lib/"
affects: [04-03-script-wiring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared infra/scripts helper module under infra/scripts/lib/ (cors.ts analog)"
    - "node --test + ts-node/register (CJS) as the infra/scripts unit-test runner"

key-files:
  created:
    - infra/scripts/lib/prod-guard.ts
    - infra/scripts/lib/prod-guard.test.ts
  modified:
    - infra/scripts/package.json

key-decisions:
  - "parseGuard returns { dryRun, apply, projectRef, limit }; dryRun = !apply (the returned-boolean shape matches existing call sites better than a throwing requireProdWriteClearance)"
  - "projectRef derived from SUPABASE_URL host via new URL().hostname.split('.')[0]; sentinel '(unknown)' on empty/unparseable URL, never throws (no SUPABASE_PROJECT_REF env exists)"
  - "Test runner = `node --test --require ts-node/register` (CJS). The `--import ts-node/register` ESM form fails because Node16 ESM resolution demands explicit file extensions on the relative import; CJS register matches how the existing ts-node scripts run"

patterns-established:
  - "Pattern: default-dry-run prod-write gating — no --apply means no mutation; --dry-run is an accepted no-op; --limit=N preserved and returned"
  - "Pattern: announceTarget prints a loud project-ref banner before any write on every run"

requirements-completed: [SEC-03]

# Metrics
duration: 14min
completed: 2026-06-20
status: complete
---

# Phase 4 Plan 02: Shared Prod-Write Guard Summary

**`infra/scripts/lib/prod-guard.ts` — default-dry-run / `--apply`-only / announce-the-project-ref clearance helper (SEC-03), with a passing `node --test` covering all four+ safety invariants and a `test:guard` npm script.**

## Performance

- **Duration:** ~14 min
- **Tasks:** 2
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments
- Created the single shared prod-write guard (`prod-guard.ts`) — the SEC-03 control itself: default dry-run, `--apply` as the sole write trigger, `--dry-run` accepted no-op, `--limit=N` preserved, and a loud project-ref banner before any write.
- `parseGuard(argv)` derives the project ref from the `SUPABASE_URL` host (no `SUPABASE_PROJECT_REF` env exists anywhere) and never throws on missing/unparseable env.
- Added `prod-guard.test.ts` (8 cases) and a `test:guard` npm script; `npm run test:guard` passes 8/8 locally with zero network / prod access.

## Task Commits

1. **Task 1: Create infra/scripts/lib/prod-guard.ts** - `3e5060e` (feat)
2. **Task 2: Add prod-guard.test.ts + test:guard npm script** - `1a53f2d` (test)

_Task 1 was `tdd="true"`; the plan assigns the test file to Task 2, so the RED/GREEN gate is realized across the two commits (module → test). The guard's behavior was verified by `node --test` (8/8) and by the per-task acceptance greps + tsc type-check._

## Files Created/Modified
- `infra/scripts/lib/prod-guard.ts` - Exports `parseGuard(argv)` (`{ dryRun, apply, projectRef, limit }`) and `announceTarget(g)`; pure, dependency-free, reads `process.env.SUPABASE_URL` only.
- `infra/scripts/lib/prod-guard.test.ts` - `node:test` + `node:assert/strict` coverage of the guard invariants (no-flag→dryRun, `--apply`→write, `--dry-run` no-op, `--apply --dry-run` apply-wins, `--limit=5`, limit-default-0, projectRef-from-host, empty-URL sentinel).
- `infra/scripts/package.json` - Added `"test:guard": "node --test --require ts-node/register lib/prod-guard.test.ts"` (additive; no existing script or dependency changed).

## API surface (for plan 04-03)

```ts
parseGuard(argv: string[] = process.argv): {
  dryRun: boolean;   // !apply (default true)
  apply: boolean;    // argv.includes('--apply') — the sole write trigger
  projectRef: string; // SUPABASE_URL host first-label, or '(unknown)'
  limit: number;     // --limit=N, returned untouched; 0 = all
}
announceTarget(g: { dryRun: boolean; projectRef: string }): void
```

`announceTarget` banner wording:
- dry-run: `=== DRY RUN (no writes) — project <ref> — re-run with --apply to write ===`
- apply:   `=== ⚠ APPLYING to project <ref> — writing to LIVE prod ===`

Plan 04-03 should `import { parseGuard, announceTarget } from './lib/prod-guard'`, call `announceTarget` before any write, and branch on `dryRun`. Callers still own their own `import 'dotenv/config'` (the guard does not load dotenv) and may use the returned `limit` or keep their existing `--limit` parsing — the guard does not strip `--limit`.

## Decisions Made
- **Returned-boolean API over a throwing one** — `parseGuard` returns `{ dryRun }` rather than a `requireProdWriteClearance()` that throws, because the existing scripts branch on a boolean (`apply-phase6-flag-fixes.ts:452-453`); least call-site churn for plan 04-03.
- **`SUPABASE_URL` host as the ref source** — confirmed by RESEARCH B.3 that no `SUPABASE_PROJECT_REF` env exists; parsed via `new URL().hostname.split('.')[0]`, with a non-throwing `'(unknown)'` sentinel so env-validation stays the caller's job.
- **`--require ts-node/register` (CJS) runner, not `--import`** — see Issues; the ESM form breaks on Node16 extensionless relative imports.

## Deviations from Plan

None - plan executed exactly as written. (The plan pre-authorized both runner forms and asked to confirm which exits 0; `--require ts-node/register` was selected per that instruction.)

## Issues Encountered
- **`node --test --import ts-node/register` failed** with `ERR_MODULE_NOT_FOUND` for the extensionless `./prod-guard` import. `--import` routes through Node's ESM loader, and the package's `tsconfig` uses `module: Node16` / `moduleResolution: node16`, whose ESM resolution requires explicit `.ts`/`.js` extensions on relative imports. The plan named `node --test --require ts-node/register` as the fallback — that CJS form resolves the extensionless import exactly as the existing `ts-node <file>.ts` scripts do, and runs 8/8 green. Resolved by using the `--require` form in `test:guard`.

## Next Phase Readiness
- Guard API is frozen and exported (`parseGuard`, `announceTarget`); plan 04-03 can wire all 8 confirmed write-path scripts to it.
- `npm run test:guard` is the SEC-03 unit gate and is green.
- No blockers.

## Self-Check: PASSED

---
*Phase: 04-edge-dependency-pinning-script-guard*
*Completed: 2026-06-20*
