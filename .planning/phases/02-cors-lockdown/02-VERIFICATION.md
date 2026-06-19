---
phase: 02-cors-lockdown
verified: 2026-06-19T18:51:19Z
status: passed
score: 8/8 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 2: CORS Lockdown Verification Report

**Phase Goal:** The three wildcard-CORS edge functions restrict origins to a configured allowlist for browser callers while continuing to serve the native mobile client (no Origin header) and the admin preflight without breakage.
**Verified:** 2026-06-19T18:51:19Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `feed`, `enrich-dish`, and `invalidate-cache` no longer return `Access-Control-Allow-Origin: *`; they reflect an allowlisted admin origin and add `Vary: Origin` | VERIFIED | `grep -c "const corsHeaders = {"` = 0 on all three; no wildcard literal in any file; `buildCorsHeaders` exact-match logic confirmed in source; `Vary: 'Origin'` unconditionally set; operator SC#1/SC#3 smoke confirmed (prod — accepted per operator_confirmed_prod_state) |
| 2 | A request with no `Origin` header (native/curl) still succeeds — auth via JWT, not CORS | VERIFIED | `buildCorsHeaders(null)` branch: `origin` falsy → no ACAO key, handler proceeds; JWT check in enrich-dish (lines 110–116) untouched; deno test case 3 "no-Origin (mobile/curl) omits ACAO" passes (4/4 green); operator SC#2 confirmed (prod) |
| 3 | OPTIONS preflight and main response return matching CORS headers (including verbatim `authorization, x-client-info, apikey, content-type` allow-headers) | VERIFIED | All three handlers compute `const corsHeaders = buildCorsHeaders(req.headers.get('Origin'))` as line 1 of `serve`; both the OPTIONS short-circuit (`return new Response('ok', { headers: corsHeaders })`) and every main-response spread read the identical per-request object — cannot drift; verbatim allow-headers string present in cors.ts; operator SC#3 confirmed (prod) |

**Score:** 8/8 truths and must-haves verified (0 present-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `infra/supabase/functions/_shared/cors.ts` | `buildCorsHeaders(origin)` DRY allowlist-reflecting helper | VERIFIED | Exists, 43 lines, exports `buildCorsHeaders`, reads `Deno.env.get('ALLOWED_ORIGINS')`, fail-closed, always emits `Vary: Origin` + Allow-Methods + verbatim allow-headers, never emits wildcard or Credentials header; `deno check` exit 0 |
| `infra/supabase/functions/_shared/cors.test.ts` | Four-case Deno test | VERIFIED | Exists, 67 lines, 4 `Deno.test` blocks, imports from `std@0.168.0/testing/asserts.ts` (incumbent URL), imports `buildCorsHeaders` from `./cors.ts`, env cleanup with `try/finally`; `deno test` 4 passed / 0 failed |
| `infra/supabase/functions/feed/index.ts` | Wired to shared CORS helper, per-request | VERIFIED | Import at line 16; `const corsHeaders = buildCorsHeaders(req.headers.get('Origin'))` at line 703 (first line of handler); `const corsHeaders = {` count = 0; no wildcard literal |
| `infra/supabase/functions/enrich-dish/index.ts` | Wired to shared CORS helper, per-request | VERIFIED | Import at line 25; per-request assignment at line 104 (first line of handler); `const corsHeaders = {` count = 0; no wildcard literal; service-role JWT check at lines 110–116 untouched |
| `infra/supabase/functions/invalidate-cache/index.ts` | Wired to shared CORS helper, per-request | VERIFIED | Import at line 18; per-request assignment at line 46 (first line of handler); `const corsHeaders = {` count = 0; no wildcard literal; Redis `deleteByPattern`/SCAN logic and `feed:v2:*` flush-all at line 77 untouched |
| `infra/supabase/functions/README.md` | Documents allowlist + ALLOWED_ORIGINS + fail-closed + redeploy rule | VERIFIED | Lines 75–84: allowlist-reflecting section present; contains `ALLOWED_ORIGINS`, `fail-closed`, verbatim allow-headers, `Vary: Origin`, `redeploy ALL THREE`, `_shared/cors.ts`; no longer presents `*` as the behavior (two remaining `*` mentions are both negation phrases: "never falls back to `*`") |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `_shared/cors.test.ts` | `_shared/cors.ts` | `import { buildCorsHeaders } from './cors.ts'` | WIRED | Line 16 of test file confirmed |
| `_shared/cors.ts` | `ALLOWED_ORIGINS` env var | `Deno.env.get('ALLOWED_ORIGINS')` | WIRED | Line 22 of cors.ts confirmed |
| `feed/index.ts` | `_shared/cors.ts` | `import { buildCorsHeaders } from '../_shared/cors.ts'` | WIRED | Line 16 confirmed; used at line 703 |
| `enrich-dish/index.ts` | `_shared/cors.ts` | `import { buildCorsHeaders } from '../_shared/cors.ts'` | WIRED | Line 25 confirmed; used at line 104 |
| `invalidate-cache/index.ts` | `_shared/cors.ts` | `import { buildCorsHeaders } from '../_shared/cors.ts'` | WIRED | Line 18 confirmed; used at line 46 |

### Data-Flow Trace (Level 4)

Not applicable — `_shared/cors.ts` is a pure computation helper with one env var read, not a component rendering dynamic data. The data-flow question (does `buildCorsHeaders` actually read a real allowlist?) is answered by the unit test (4/4 green, including case 1 which asserts the reflective path with a real env-var set, and case 4 which asserts fail-closed on unset).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 4 CORS contract cases (reflect, disallowed, no-Origin, unset-env) | `~/.deno/bin/deno test --node-modules-dir=none -A infra/supabase/functions/_shared/cors.test.ts` | 4 passed, 0 failed, exit 0 | PASS |
| All four files type-check | `~/.deno/bin/deno check _shared/cors.ts feed/index.ts enrich-dish/index.ts invalidate-cache/index.ts` | exit 0 | PASS |

### Probe Execution

No `probe-*.sh` scripts declared or present for this phase. Behavioral spot-checks (deno test + deno check) serve as the executable verification layer.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SEC-01 | Plans 02-01, 02-02 | `feed`, `enrich-dish`, `invalidate-cache` restrict CORS to configured allowlist; no wildcard in prod; mobile client (no Origin) unbroken; admin preflight unbroken | SATISFIED | `buildCorsHeaders` exact-match allowlist verified in source; 4/4 unit tests green; all three functions wired per-request; `deno check` exit 0; operator smoke SC#1/SC#2/SC#3 all PASS (confirmed per operator_confirmed_prod_state); REQUIREMENTS.md marks SEC-01 `[x] Complete` at Phase 2 |

No orphaned requirements: the traceability table in REQUIREMENTS.md maps SEC-01 exclusively to Phase 2, and both plan frontmatters list `requirements: [SEC-01]`. Coverage is complete.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | — | — | No anti-patterns found |

Grep gate results:
- `const corsHeaders = {` in any function: 0/0/0 (no module-level wildcard const surviving)
- `'Access-Control-Allow-Origin': '*'` literal in any function: 0/0/0
- `'*'` in `_shared/cors.ts`: 0
- `Access-Control-Allow-Credentials` in `_shared/cors.ts`: 0
- No `TBD`, `FIXME`, or `XXX` debt markers found in any modified file

### Human Verification Required

None. All three success criteria were either directly verifiable from source + tests, or accepted via the operator_confirmed_prod_state evidence provided by the submitter (SC#1/SC#2/SC#3 smoke calls executed and confirmed PASS by the operator in prod).

### Gaps Summary

No gaps. All must-haves from both plan frontmatters are verified in the codebase. The phase goal is fully achieved.

---

_Verified: 2026-06-19T18:51:19Z_
_Verifier: Claude (gsd-verifier)_
