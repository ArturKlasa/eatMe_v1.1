---
phase: 04-edge-dependency-pinning-script-guard
plan: 01
subsystem: infra
tags: [deno, edge-functions, supabase-js, upstash-redis, jsr, dependency-pinning, supply-chain]

# Dependency graph
requires:
  - phase: 02-cors-lockdown
    provides: "_shared/cors.ts buildCorsHeaders helper + per-request corsHeaders seam in feed/enrich-dish/invalidate-cache (preserved byte-for-byte through the serve swap)"
provides:
  - "All 8 edge functions on native Deno.serve (deprecated std@0.168.0/http/server serve removed)"
  - "Single canonical supabase-js pin esm.sh/@supabase/supabase-js@2.39.3 across all 8 functions"
  - "upstash/redis exact-pinned @1.38.0 everywhere (invalidate-cache @latest removed)"
  - "Both Deno test files on jsr:@std/assert@1.0.19; deno-globals.d.ts shim aligned to new specifiers"
affects: [edge-functions, dependency-pinning, future std->jsr modernization QUAL-V2-02]

# Tech tracking
tech-stack:
  added: [jsr:@std/assert@1.0.19]
  patterns:
    - "Edge specifier convention: one style (esm.sh), exact-pinned versions, no floating @2/@latest/npm:@2"
    - "deno-globals.d.ts shim keys kept in lockstep with import specifier strings"

key-files:
  created: []
  modified:
    - infra/supabase/functions/app-config/index.ts
    - infra/supabase/functions/group-recommendations/index.ts
    - infra/supabase/functions/invalidate-cache/index.ts
    - infra/supabase/functions/enrich-dish/index.ts
    - infra/supabase/functions/feed/index.ts
    - infra/supabase/functions/batch-update-preference-vectors/index.ts
    - infra/supabase/functions/update-preference-vector/index.ts
    - infra/supabase/functions/menu-scan-worker/index.ts
    - infra/supabase/functions/_shared/cors.test.ts
    - infra/supabase/functions/menu-scan-worker/test.ts
    - infra/supabase/functions/deno-globals.d.ts

key-decisions:
  - "esm.sh chosen over roadmap-literal JSR for supabase-js (D-05, prefer-incumbent): least churn, no JSR runtime-resolution risk — recorded deviation"
  - "jsr:@std/assert@1.0.19 is the one unavoidable jsr: specifier (no esm.sh equivalent for Deno std testing)"
  - "No jsr editor shim added to deno-globals.d.ts — Deno resolves jsr natively; no squiggle observed"

patterns-established:
  - "Edge specifier convention: single esm.sh style, exact-pinned, for deterministic cold starts"
  - "Shim-lockstep: every import-string change updates the matching deno-globals.d.ts declare module key in the same commit"

requirements-completed: [DEBT-05]

# Metrics
duration: 4min
completed: 2026-06-20
---

# Phase 4 Plan 01: Edge Dependency Pinning (Track A) Summary

**All 8 edge functions migrated to native Deno.serve and collapsed onto one canonical, exactly-pinned specifier set (supabase-js@2.39.3, upstash/redis@1.38.0, jsr:@std/assert@1.0.19) with the Phase 2 CORS seam preserved byte-for-byte.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-06-20T05:12:54Z
- **Completed:** 2026-06-20T05:16:06Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments
- Removed the deprecated `serve` import from `std@0.168.0/http/server.ts` in all 7 remaining functions and renamed each call site to native `Deno.serve` — handler bodies byte-for-byte unchanged. `menu-scan-worker` was already on `Deno.serve` (confirmed: **7-function** serve set, not 8).
- Collapsed every `@supabase/supabase-js` specifier (the floating `esm.sh/@2` on 6 functions + the `npm:@2` on `menu-scan-worker`) onto the single canonical `https://esm.sh/@supabase/supabase-js@2.39.3` — matching the existing `app-config` reference.
- Exact-pinned `@upstash/redis` to `@1.38.0` in `invalidate-cache` (was `@latest`), matching `feed`.
- Migrated both Deno test files' `asserts` imports from `std@0.168.0/testing/asserts.ts` to `jsr:@std/assert@1.0.19`; symbol lists unchanged; both suites stay green (4 + 45 passing).
- Aligned `deno-globals.d.ts` shim keys to the new specifiers and deleted two dead blocks (the std serve shim and the `npm:@supabase/supabase-js@2` block).

## Canonical Specifier Strings Used
- supabase-js: `https://esm.sh/@supabase/supabase-js@2.39.3` (all 8 functions + shim)
- upstash redis: `https://esm.sh/@upstash/redis@1.38.0` (invalidate-cache, feed, shim)
- test asserts: `jsr:@std/assert@1.0.19` (cors.test.ts, menu-scan-worker/test.ts)

## CORS Seam (D-02) — Preserved Byte-for-Byte
The 3 seam functions (`feed`, `enrich-dish`, `invalidate-cache`) keep their per-request `const corsHeaders = buildCorsHeaders(req.headers.get('Origin'))` line, the `../_shared/cors.ts` import, and every `...corsHeaders` response spread unchanged. Diff for these 3 files = only the import-delete + the `serve(`→`Deno.serve(` token (verified by inspecting `git diff` and by `cors.test.ts` staying green 4/4). The SEC-01 CORS lockdown did not regress.

## jsr Editor Shim
**Not needed.** Per D-03, a `declare module 'jsr:@std/assert@1.0.19'` shim was only to be added if an actual "cannot find module" squiggle appeared. None did — the test files run under real Deno which resolves `jsr:` natively. No pre-emptive shim added.

## Task Commits

Each task was committed atomically:

1. **Task 1: Swap serve → Deno.serve in 7 functions (CORS seam preserved)** — `688b995` (refactor)
2. **Task 2: Pin supabase-js@2.39.3 (8 fns) + upstash@1.38.0; align shim** — `5de8d18` (chore)
3. **Task 3: Migrate test asserts to jsr:@std/assert@1.0.19; delete dead serve shim** — `71357e3` (test)

## Files Created/Modified
- `infra/supabase/functions/{app-config,group-recommendations,invalidate-cache,enrich-dish,feed,batch-update-preference-vectors,update-preference-vector}/index.ts` — serve → Deno.serve + supabase-js pin
- `infra/supabase/functions/menu-scan-worker/index.ts` — supabase-js `npm:@2` → `esm.sh/@2.39.3` (serve wrapper + npm:openai@4 untouched, out of scope)
- `infra/supabase/functions/_shared/cors.test.ts` — asserts → jsr:@std/assert@1.0.19
- `infra/supabase/functions/menu-scan-worker/test.ts` — asserts → jsr:@std/assert@1.0.19
- `infra/supabase/functions/deno-globals.d.ts` — shim keys aligned; dead std serve + npm:@supabase blocks deleted

## Decisions Made
- **D-05 (recorded deviation):** Used `esm.sh` exact-pin over the roadmap's literal "JSR" wording for supabase-js — prefer-incumbent (esm.sh is the dominant existing style, `app-config` already pins it), least churn, no JSR runtime-resolution risk.
- **D-03:** `jsr:@std/assert@1.0.19` is the sole unavoidable `jsr:` specifier — there is no esm.sh equivalent for Deno std *testing*. Version 1.0.19 exports all four symbols used (assert, assertEquals, assertFalse, assertArrayIncludes), verified under Deno 2.8.1.

## Deviations from Plan

None - plan executed exactly as written. (D-05's esm.sh-over-JSR choice is a pre-recorded planning deviation, not an execution-time one.)

## Issues Encountered
- The prettier pre-commit hook collapsed the multi-line `import { ... } from 'jsr:@std/assert@1.0.19'` blocks in both test files onto a single line. This is intentional lint normalization — the specifier and symbol set are preserved and both test suites remained green. No action required.

## User Setup Required
None - no external service configuration required at author time.

**Operator deploy note (SC#4 — stage-don't-apply):** Deploy the functions from `infra/supabase/`, then smoke-test one real call per migrated function (feed, enrich-dish, invalidate-cache, app-config, group-recommendations, batch-update-preference-vectors, update-preference-vector, menu-scan-worker) to confirm each cold-starts on the new pinned deps in the live edge runtime.

## Next Phase Readiness
- Track A (DEBT-05 edge dependency pinning) complete: serve swap, supabase-js + upstash exact-pins, asserts migration, shim alignment all verified locally (grep assertions clean, 6 deno checks + 2 functions-with-tests compile, both Deno suites green).
- Plan 04-02 / 04-03 (Track B — `infra/scripts` prod-write guard, SEC-03) are independent and unblocked.
- Deferred (out of this plan's boundary, noted in CONTEXT): pin `npm:openai@4` in menu-scan-worker; full std→JSR modernization (QUAL-V2-02); lock the other 4 wildcard-CORS functions.

## Self-Check: PASSED

- SUMMARY.md exists at `.planning/phases/04-edge-dependency-pinning-script-guard/04-01-SUMMARY.md`
- All 3 task commits present in git history: `688b995`, `5de8d18`, `71357e3`

---
*Phase: 04-edge-dependency-pinning-script-guard*
*Completed: 2026-06-20*
