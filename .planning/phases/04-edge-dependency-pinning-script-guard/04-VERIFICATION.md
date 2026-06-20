---
phase: 04-edge-dependency-pinning-script-guard
verified: 2026-06-20T10:15:00Z
status: human_needed
score: 3/4
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Deploy the 8 migrated edge functions from infra/supabase/ and smoke-test one real call per function (feed, enrich-dish, invalidate-cache, app-config, group-recommendations, batch-update-preference-vectors, update-preference-vector, menu-scan-worker) to confirm each cold-starts on the new pinned dependencies in the live Supabase edge runtime."
    expected: "Each function cold-starts without a module-resolution error and returns a valid response; the pinned supabase-js@2.39.3 and upstash/redis@1.38.0 specifiers resolve correctly on esm.sh from the edge runtime."
    why_human: "The local deno check and deno test exercises the compile path, but the Deno Deploy edge runtime resolves specifiers independently at cold-start. A specifier that compiles locally may fail to resolve in the edge environment. SC#4 explicitly designates this as an operator-gated smoke-test. The tooling note classifies it as human_verification by design (stage-don't-apply project)."
---

# Phase 4: Edge Dependency Pinning + Script Guard — Verification Report

**Phase Goal:** Edge functions run on pinned, non-deprecated dependencies and `infra/scripts` cannot reach a prod write path without explicit confirmation.
**Verified:** 2026-06-20T10:15:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | The `deno.land/std@0.168.0/http/server` import is replaced with native `Deno.serve` across all edge functions, and the `std@0.168.0/testing/asserts` test import is migrated | VERIFIED | `grep -rn "std@0.168.0/http/server" infra/supabase/functions/` → 0 matches. `grep -rln "Deno.serve" infra/supabase/functions/*/index.ts` lists all 8 functions. `grep -rn "testing/asserts" infra/supabase/functions/` → 0 matches. Both test files import `jsr:@std/assert@1.0.19`. Confirmed via git commits 688b995 + 71357e3. |
| 2 | `@supabase/supabase-js` is pinned to one exact version with a single specifier style; `@upstash/redis` is exact-pinned everywhere including `invalidate-cache` | VERIFIED | All 8 functions import `https://esm.sh/@supabase/supabase-js@2.39.3` — grep of all `*/index.ts` shows 0 violations. `@upstash/redis@1.38.0` in both `feed` and `invalidate-cache` (was `@latest`); `grep -rn "upstash/redis@latest" infra/supabase/functions/` → 0 matches. `deno-globals.d.ts` shim keys aligned to `@2.39.3` and `@1.38.0`; dead `npm:@supabase/supabase-js@2` block deleted. Confirmed via git commit 5de8d18. |
| 3 | `infra/scripts` write paths default to dry-run, refuse to mutate prod without `--apply`, print the target project ref before any mutation, and preserve `--limit` | VERIFIED | All 9 confirmed write scripts (7 LIVE-default backfills + batch-embed + apply-phase6-flag-fixes) import `lib/prod-guard`. `grep -rn "process.argv.includes('--dry-run')" infra/scripts/backfill-*.ts infra/scripts/seed-cold-start-vectors.ts` → 0 matches (inline LIVE-default gone). All 9 call `announceTarget` (each file returns count ≥ 2 from grep). batch-embed gates both RPCs and the enrich fetch loop behind an early `if (dryRun) { return; }` at line 166. `--limit` confirmed present in backfill-cuisine-from-dishes (4 matches) and seed-cold-start-vectors (7 matches). Guard unit test passes 8/8 (`npm run test:guard`). Read-only scripts show no diff in git. Commits 0841c77 + 3028107. |
| 4 | Each migrated function compiles in the local edge runtime and its Deno tests pass; operator smoke-tests one real call per function on deploy | PRESENT_BEHAVIOR_UNVERIFIED — codebase-checkable half VERIFIED; operator deploy half awaits human | `deno check --node-modules-dir=none` exits 0 for all 6 non-test functions (app-config, group-recommendations, invalidate-cache, enrich-dish, batch-update-preference-vectors, update-preference-vector). `cors.test.ts`: 4/4 passed. `menu-scan-worker/test.ts`: 45/45 passed. The operator smoke-test on the live edge runtime is out-of-band (stage-don't-apply; tooling note designates this as human_verification). |

**Score:** 3/4 truths fully verified (1 is split: local half VERIFIED, deploy half human-gated)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `infra/supabase/functions/feed/index.ts` | feed on Deno.serve + supabase-js@2.39.3, CORS seam intact | VERIFIED | `Deno.serve` at line 701; `supabase-js@2.39.3` at line 12; `buildCorsHeaders` import at line 15 + call at line 702 |
| `infra/supabase/functions/_shared/cors.test.ts` | CORS unit test on jsr:@std/assert | VERIFIED | `jsr:@std/assert@1.0.19` at line 11; 4/4 tests pass |
| `infra/supabase/functions/deno-globals.d.ts` | IDE shim aligned to new specifiers | VERIFIED | Contains `@supabase/supabase-js@2.39.3` and `@upstash/redis@1.38.0`; no `std@0.168.0` or `npm:@supabase` blocks |
| `infra/scripts/lib/prod-guard.ts` | Shared default-dry-run / --apply / announce-target guard | VERIFIED | Exports `parseGuard` and `announceTarget`; derives `projectRef` from `SUPABASE_URL`; uses `SUPABASE_URL` only (0 refs to `SUPABASE_PROJECT_REF`); `--limit=N` returned; 91 lines |
| `infra/scripts/lib/prod-guard.test.ts` | node --test coverage of guard invariants | VERIFIED | 8 test cases; all pass via `npm run test:guard`; references `parseGuard` |
| `infra/scripts/package.json` | `test:guard` script | VERIFIED | `"test:guard": "node --test --require ts-node/register lib/prod-guard.test.ts"` present at line 16 |
| `infra/scripts/batch-embed.ts` | Net-new dry-run gate around writing RPCs | VERIFIED | Imports `lib/prod-guard`; `dryRun` guards early-return at line 166 before both RPCs and the enrich fetch loop |
| `infra/scripts/backfill-cuisine-from-dishes.ts` | Default-dry-run via shared guard | VERIFIED | Imports `lib/prod-guard`; calls `announceTarget`; 0 inline `--dry-run` LIVE-default |
| `infra/scripts/apply-phase6-flag-fixes.ts` | Inline guard replaced by shared prod-guard import | VERIFIED | Imports `lib/prod-guard`; 0 inline `process.argv.includes('--apply')` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `feed/index.ts` | `_shared/cors.ts` | `import { buildCorsHeaders } from '../_shared/cors.ts'` | WIRED | Import at line 15; `buildCorsHeaders(req.headers.get('Origin'))` at line 702 |
| `_shared/cors.test.ts` | `jsr:@std/assert@1.0.19` | test assertion imports | WIRED | `from 'jsr:@std/assert@1.0.19'` at line 11; 4/4 tests pass |
| `backfill-cuisine-from-dishes.ts` | `infra/scripts/lib/prod-guard.ts` | `import { parseGuard, announceTarget } from './lib/prod-guard'` | WIRED | `lib/prod-guard` present; `announceTarget` called (2 matches) |
| `batch-embed.ts` | `infra/scripts/lib/prod-guard.ts` | dryRun gate around the two writing RPCs | WIRED | `lib/prod-guard` imported; `dryRun` referenced at lines 52, 136, 166 (early-return gate) |
| `infra/scripts/package.json` | `infra/scripts/lib/prod-guard.test.ts` | `test:guard` runs node --test on the guard test | WIRED | Script present at line 16; `npm run test:guard` exits 0 with 8/8 pass |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| cors.test.ts: 4 CORS allowlist cases pass on jsr:@std/assert | `deno test --node-modules-dir=none -A infra/supabase/functions/_shared/cors.test.ts` | 4 passed, 0 failed | PASS |
| menu-scan-worker/test.ts: 45 tests pass on jsr:@std/assert | `deno test --node-modules-dir=none -A infra/supabase/functions/menu-scan-worker/test.ts` | 45 passed, 0 failed | PASS |
| Guard invariants: 8 cases pass | `cd infra/scripts && npm run test:guard` | 8/8 pass | PASS |
| deno check: all 6 non-test functions compile | `for f in app-config group-recommendations invalidate-cache enrich-dish batch-update-preference-vectors update-preference-vector; do deno check ...` | All exit 0 | PASS |
| Edge deploy cold-start on pinned deps | Operator: deploy from infra/supabase/, call each function | Not runnable by verifier (stage-don't-apply) | SKIP — human_verification |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| DEBT-05 | 04-01 | Edge-function dependencies pinned — std serve replaced, supabase-js + upstash exact-pinned | SATISFIED | 0 `std@0.168.0/http/server` refs; all 8 functions on `supabase-js@2.39.3`; `upstash/redis@1.38.0` everywhere; Deno tests pass |
| SEC-03 | 04-02, 04-03 | `infra/scripts` prod-mutation scripts refuse write path without explicit confirmation | SATISFIED | All 8 write scripts import shared guard; default dry-run; `--apply` sole write trigger; `announceTarget` prints ref; guard unit test 8/8 pass |

Both requirements mapped to Phase 4 in REQUIREMENTS.md traceability table are covered. No orphaned requirements.

### Anti-Patterns Found

No `TBD`, `FIXME`, or `XXX` markers found in any file modified during this phase. No placeholder returns, no stub patterns. No remaining `@latest` or floating `@2` specifiers in the edge functions.

### Human Verification Required

#### 1. Operator edge-function smoke-test on live deploy

**Test:** After deploying all 8 edge functions from `infra/supabase/`, make one real call to each: `feed`, `enrich-dish`, `invalidate-cache`, `app-config`, `group-recommendations`, `batch-update-preference-vectors`, `update-preference-vector`, `menu-scan-worker`.
**Expected:** Each function cold-starts without a module-resolution error and returns a valid response. The pinned specifiers `https://esm.sh/@supabase/supabase-js@2.39.3`, `https://esm.sh/@upstash/redis@1.38.0`, and `jsr:@std/assert@1.0.19` (test-only) resolve correctly from the Supabase edge runtime.
**Why human:** The local `deno check` exercises compilation, not edge-runtime specifier resolution. The Supabase Deploy environment resolves `esm.sh` and `jsr.io` URLs independently at cold-start. A specifier change that compiles locally may fail in the edge runtime. SC#4 and the tooling note explicitly designate the operator deploy smoke-test as out-of-band. This project uses a stage-don't-apply policy — the verifier cannot deploy to prod.

---

## Summary

Phase 4 goal is substantively achieved in the codebase. Both requirement tracks are complete:

**Track A (DEBT-05 — edge dependency pinning):**
- All 7 functions that used the deprecated `deno.land/std@0.168.0/http/server` serve import have been migrated to native `Deno.serve`. Menu-scan-worker was already migrated (confirmed 7-function, not 8, serve set).
- All 8 edge functions use exactly `https://esm.sh/@supabase/supabase-js@2.39.3` — zero violations.
- `invalidate-cache` moved from `@upstash/redis@latest` to `@1.38.0`; `feed` was already pinned.
- Both test files use `jsr:@std/assert@1.0.19`; `testing/asserts` is fully removed.
- `deno-globals.d.ts` shim keys match the new specifier strings; dead blocks (std serve + npm:@supabase) deleted.
- CORS seam (buildCorsHeaders per-request call + import + response spreads) preserved byte-for-byte in the 3 seam functions.
- Local compile checks and Deno test suites pass (4/4 and 45/45).

**Track B (SEC-03 — infra/scripts guard):**
- `infra/scripts/lib/prod-guard.ts` exists, exports `parseGuard` and `announceTarget`, derives the project ref from `SUPABASE_URL` (no non-existent `SUPABASE_PROJECT_REF`), never throws on bad env, and returns `limit` untouched.
- All 9 write-path scripts (7 LIVE-default backfills + batch-embed net-new gate + apply-phase6 refactor) import the shared guard and call `announceTarget`.
- Zero inline LIVE-default patterns (`process.argv.includes('--dry-run')`) remain.
- batch-embed now has a complete early-return dry-run gate that makes both writing RPCs and the enrich fetch loop unreachable without `--apply`.
- Guard unit test: 8/8 pass via `npm run test:guard`.
- Read-only scripts: 0 changes.

**Only outstanding item:** SC#4's operator deploy smoke-test — by design out-of-band for this stage-don't-apply project.

---

_Verified: 2026-06-20T10:15:00Z_
_Verifier: Claude (gsd-verifier)_
