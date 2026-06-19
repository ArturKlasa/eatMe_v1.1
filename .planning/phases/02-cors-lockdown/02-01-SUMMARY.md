---
phase: 02-cors-lockdown
plan: 01
subsystem: edge-functions-cors
status: complete
tags: [security, cors, edge-functions, deno, sec-01]
requires: []
provides:
  - "infra/supabase/functions/_shared/cors.ts — buildCorsHeaders(origin) DRY allowlist-reflecting CORS helper (D-04)"
  - "infra/supabase/functions/_shared/cors.test.ts — four-case Deno test proving SEC-01 behavior"
affects:
  - "Plan 02-02 wires feed / enrich-dish / invalidate-cache to ../_shared/cors.ts"
tech_stack:
  added: []
  patterns:
    - "First infra/supabase/functions/_shared/ module (bundled per-importer at deploy, D-06 RESOLVED)"
    - "Allowlist-reflecting CORS: exact-string match, fail-closed on unset, Vary: Origin always (ASVS V14.5)"
    - "Deno test via std@0.168.0/testing/asserts.ts (matches incumbent menu-scan-worker test)"
key_files:
  created:
    - infra/supabase/functions/_shared/cors.ts
    - infra/supabase/functions/_shared/cors.test.ts
  modified:
    - .gitignore
decisions:
  - "Matched incumbent std@0.168.0/testing/asserts.ts import (NOT jsr:@std/assert) — single import convention this phase; JSR migration deferred to Phase 4 / DEBT-05"
  - "Reworded cors.ts comments to avoid the literal tokens '*' and 'Access-Control-Allow-Credentials' so the byte-literal grep acceptance gates return 0 (behavior unchanged)"
  - "Gitignored generated deno.lock (repo convention: not tracked; first deno-test run produced it at root)"
metrics:
  duration_min: 6
  tasks: 2
  files_created: 2
  files_modified: 1
  completed: 2026-06-19
---

# Phase 2 Plan 1: Shared CORS Helper Summary

Created the single DRY allowlist-reflecting CORS helper `_shared/cors.ts` (`buildCorsHeaders(origin)`) plus its four-case Deno test, both green locally — locking SEC-01 (no wildcard, exact-match allowlist, `Vary: Origin`, fail-closed) as a pure unit-tested function before Plan 02 wires the three functions to it.

## What Was Built

### Task 1 — `infra/supabase/functions/_shared/cors.ts`
The first `_shared/` module in the repo. Exports:

```typescript
export function buildCorsHeaders(origin: string | null): Record<string, string>
```

Shape / behavior:
- Reads `Deno.env.get('ALLOWED_ORIGINS')` per call (D-01), coalesces unset → `''`, splits on comma, trims, filters empties → empty allowlist on unset (D-10 fail-closed).
- Base header object always contains three keys: `Access-Control-Allow-Headers` = `authorization, x-client-info, apikey, content-type` (verbatim, SC#3/D-12), `Access-Control-Allow-Methods` = `POST, GET, OPTIONS` (D-12, GET harmless/future-proof per A3), and `Vary` = `Origin` (D-11, ALWAYS present).
- Sets `Access-Control-Allow-Origin` to `origin` ONLY IF `origin` is truthy AND `allowlist.includes(origin)` (exact-string match, D-03/D-08). Otherwise the key is absent entirely — covers no-Origin (D-09), disallowed (D-08), and unset-env (D-10) in one branch. Never `null`, `''`, or a wildcard.
- No `Access-Control-Allow-Credentials` (bearer-JWT auth, not cookies — token-theft vector avoided). No `Access-Control-Max-Age` (deferred).
- Returns a plain object (D-05) so Plan 02's `{ ...corsHeaders, 'Content-Type': ... }` spreads and `feed`'s `compressedJsonResponse(data, corsHeaders)` keep working per-request.

Pure apart from the single `Deno.env.get` read — lets the test toggle the env var per case.

### Task 2 — `infra/supabase/functions/_shared/cors.test.ts`
Four `Deno.test(...)` cases, each isolating `ALLOWED_ORIGINS` via `Deno.env.set`/`Deno.env.delete` in `try/finally` (Pitfall 3 — env is process-global):

1. allowed origin → ACAO reflects origin; Vary = Origin; Allow-Methods includes POST; verbatim allow-headers.
2. disallowed origin (`https://evil.example.com`) → ACAO absent; Vary still present.
3. no-Origin (`null`, mobile/curl) → ACAO absent.
4. `ALLOWED_ORIGINS` unset → fail-closed: ACAO absent even for the would-be-allowed origin (NOT a wildcard); Vary still present.

Imports `assert, assertEquals, assertFalse` from `https://deno.land/std@0.168.0/testing/asserts.ts` (matches the incumbent `menu-scan-worker/test.ts`, NOT jsr — decision LOCKED in plan).

## Verification Results

| Check | Result |
|-------|--------|
| `~/.deno/bin/deno check _shared/cors.ts` | exit 0 |
| `~/.deno/bin/deno test --node-modules-dir=none -A _shared/cors.test.ts` | **4 passed \| 0 failed** |
| `grep -c "'\*'" cors.ts` (no wildcard literal) | 0 |
| `grep -c "Access-Control-Allow-Credentials" cors.ts` | 0 |
| verbatim allow-headers present in cors.ts | yes |
| `grep -c "Deno.test" cors.test.ts` | 4 |
| std import (not jsr) | confirmed |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Reworded cors.ts comments to satisfy byte-literal grep gates**
- **Found during:** Task 1 verification.
- **Issue:** Documentation comments mentioned the literal tokens `'*'` (in "never emits a wildcard '*'") and `Access-Control-Allow-Credentials` (in the rationale comment). The acceptance criteria use byte-literal greps (`grep -c "'\*'"` and `grep -c "Access-Control-Allow-Credentials"`) that must return 0 — these comment mentions tripped them despite no such code existing.
- **Fix:** Reworded the comments ("never emits a wildcard origin", "The Allow-Credentials response header is deliberately omitted") preserving the documentation intent. Helper code and behavior unchanged.
- **Files modified:** `infra/supabase/functions/_shared/cors.ts`
- **Commit:** 989767d

**2. [Rule 3 — Blocking] Gitignored generated `deno.lock`**
- **Found during:** post-Task-2 tree check.
- **Issue:** `deno check`/`deno test` generated a `deno.lock` at repo root (first Deno test run to resolve std via cache). The repo does not track `deno.lock` (existing `menu-scan-worker/test.ts` runs under deno with none committed).
- **Fix:** Appended `deno.lock` to `.gitignore` with a rationale comment. Generated runtime artifact, not source.
- **Files modified:** `.gitignore`
- **Commit:** (docs commit below)

> Prettier (lint-staged hook) reformatted both files on commit (`.map((o)=>` → `.map(o=>`; multi-line arg wrapping). Cosmetic only — test re-run post-format remained 4/4 green.

## Operator Notes (carried to Plan 02 / deploy — stage-don't-apply)
- The helper reads `ALLOWED_ORIGINS` (comma-separated). Initial value (D-02): `https://eat-me-v1-1-admin.vercel.app,http://localhost:3001`. Operator sets this Supabase function secret at deploy; unset = fail-closed (admin browser degraded, mobile unaffected).
- `_shared/cors.ts` is bundled per-importer at `supabase functions deploy` — editing it later requires redeploying every importer (Pitfall 1).

## Next
Plan 02-02 wires `feed`, `enrich-dish`, and `invalidate-cache` to `../_shared/cors.ts`: delete each module-level `const corsHeaders`, add the relative import, and insert `const corsHeaders = buildCorsHeaders(req.headers.get('Origin'))` as the first line of each `serve` handler. The contract this plan proved makes that a mechanical const→per-request swap.

## Self-Check: PASSED
- FOUND: infra/supabase/functions/_shared/cors.ts
- FOUND: infra/supabase/functions/_shared/cors.test.ts
- FOUND: .planning/phases/02-cors-lockdown/02-01-SUMMARY.md
- FOUND commit: 989767d (Task 1 — cors.ts)
- FOUND commit: 56f0a6f (Task 2 — cors.test.ts)
