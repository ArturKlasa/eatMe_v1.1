---
phase: 02-cors-lockdown
plan: 02
subsystem: edge-functions-cors
status: complete
tags: [security, cors, edge-functions, deno, sec-01, perf-03]
requires:
  - "infra/supabase/functions/_shared/cors.ts — buildCorsHeaders(origin) DRY allowlist-reflecting CORS helper (Plan 02-01)"
provides:
  - "feed / enrich-dish / invalidate-cache wired to the shared allowlist CORS helper, computed per-request"
  - "infra/supabase/functions/README.md — CORS Configuration section documents allowlist + ALLOWED_ORIGINS + fail-closed + redeploy-all-importers rule"
affects:
  - "Phase 4 (DEBT-05) serve→Deno.serve swap across these 3 files MUST preserve the per-request corsHeaders first line + the ../_shared/cors.ts import"
  - "Phase 7 / PERF-03 owns the invalidate-cache Redis/feed:v2:* flush-all logic (left untouched here)"
tech_stack:
  added: []
  patterns:
    - "Per-request CORS: const corsHeaders = buildCorsHeaders(req.headers.get('Origin')) as the FIRST line of each serve handler (D-04/D-05/D-13)"
    - "Module-level wildcard const deleted in all 3 files so the compiler flags any missed spread site (RESEARCH Pitfall 2 safety net)"
    - "OPTIONS preflight + main response read the one per-request corsHeaders → cannot drift (T-02-07 mitigated)"
key_files:
  created: []
  modified:
    - infra/supabase/functions/feed/index.ts
    - infra/supabase/functions/enrich-dish/index.ts
    - infra/supabase/functions/invalidate-cache/index.ts
    - infra/supabase/functions/README.md
decisions:
  - "Strictly-3-functions scope (D-07): only feed / enrich-dish / invalidate-cache wired; the other 4 wildcard functions deferred"
  - "serve import left unchanged — Phase 4 / DEBT-05 owns the serve→Deno.serve swap; this plan only ADDS the per-request first line inside the existing handler"
  - "Operator-owned prod cutover (stage-don't-apply): agent did not deploy or run prod smoke calls; operator set ALLOWED_ORIGINS, deployed all 3, ran SC#1/SC#2/SC#3"
metrics:
  duration_min: 5
  tasks: 4
  files_created: 0
  files_modified: 4
  completed: 2026-06-19
---

# Phase 2 Plan 2: Wire SEC-01 Functions to Shared CORS Helper Summary

Wired the three SEC-01 functions — `feed`, `enrich-dish`, `invalidate-cache` — to the shared `../_shared/cors.ts` allowlist helper (delete the module-level wildcard `const corsHeaders`, add the relative import, insert `const corsHeaders = buildCorsHeaders(req.headers.get('Origin'))` as the first line of each `serve` handler), updated the README CORS section, and handed the prod cutover to the operator — who set `ALLOWED_ORIGINS`, deployed all three functions, and confirmed SC#1/SC#2/SC#3 all pass. SEC-01 is closed (and PERF-03's CORS half for `invalidate-cache`).

## What Was Built

### Task 1 — `infra/supabase/functions/feed/index.ts` (commit `86c5568`)
The mechanical const→per-request swap, three edits:
- DELETED the module-level wildcard `const corsHeaders = { ... }` object literal.
- ADDED `import { buildCorsHeaders } from '../_shared/cors.ts';` (line 16) — the `serve` import left unchanged (Phase 4 owns the swap).
- INSERTED `const corsHeaders = buildCorsHeaders(req.headers.get('Origin'));` (line 703) as the FIRST line of the `serve` handler, before the `OPTIONS` short-circuit.

Every existing spread site (`{ ...corsHeaders, 'Content-Type': ... }`) and the `compressedJsonResponse(responseData, corsHeaders)` gzip call now resolve to the per-request local automatically (PATTERNS A1 — the signature already forwards the `headers` param onto the final `Response`). No spread-site text, no OPTIONS text, no auth, no business logic touched.

### Task 2 — `enrich-dish/index.ts` + `invalidate-cache/index.ts` (commit `bda6231`)
Same three-edit swap applied to both:
- `enrich-dish/index.ts`: import at line 25, per-request first line at line 104. The service-role bearer-JWT check (auth = JWT, not CORS, per D-09) is UNTOUCHED.
- `invalidate-cache/index.ts`: import at line 18, per-request first line at line 46. The Redis `deleteByPattern`/SCAN logic and the `feed:v2:*` flush-all line are UNTOUCHED (Phase 7 / PERF-03 territory, F-21 co-ownership).

### Task 3 — `infra/supabase/functions/README.md` (commit `8b60486`)
Rewrote the "CORS Configuration" section: allowlist-reflecting (not wildcard) for the three functions; `Access-Control-Allow-Origin` set only on exact `ALLOWED_ORIGINS` match; comma-separated `ALLOWED_ORIGINS` Supabase function secret (initial `https://eat-me-v1-1-admin.vercel.app,http://localhost:3001`); fail-closed on unset (never `*`); no-Origin native/curl still succeeds (auth via JWT); verbatim allow-headers `authorization, x-client-info, apikey, content-type` + `Vary: Origin` always emitted; and the redeploy-all-importers rule (editing `_shared/cors.ts` requires redeploying all three bundling functions — Pitfall 1). No longer presents `Access-Control-Allow-Origin: *` as the behavior.

### Task 4 — Operator deploy + smoke checklist (checkpoint:human-action) — COMPLETE
Stage-don't-apply prod cutover; agent did not deploy or run prod calls. The operator:
- Set the `ALLOWED_ORIGINS` secret FIRST.
- Deployed all three functions (`feed`, `enrich-dish`, `invalidate-cache`) — each bundles its own copy of `_shared/cors.ts`.
- Ran the three smoke calls against `feed`:
  - **SC#1 (no wildcard)** — disallowed/absent Origin response has NO `Access-Control-Allow-Origin: *`. **PASS**
  - **SC#2 (no-Origin succeeds)** — no `Origin` header (mobile sim) → HTTP 200 / normal body, auth via JWT unaffected. **PASS**
  - **SC#3 (preflight matches)** — `OPTIONS` with `Origin: https://eat-me-v1-1-admin.vercel.app` reflects that origin, includes the verbatim `Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type` and `Vary: Origin`. **PASS**

Operator typed "approved". Prod cutover complete.

## Verification Results

| Check | Result |
|-------|--------|
| `grep -c "const corsHeaders = {"` feed / enrich-dish / invalidate-cache | 0 / 0 / 0 |
| `import { buildCorsHeaders } from '../_shared/cors.ts'` present in all 3 | yes (feed:16, enrich-dish:25, invalidate-cache:18) |
| `const corsHeaders = buildCorsHeaders(req.headers.get('Origin'))` first line in all 3 | yes (feed:703, enrich-dish:104, invalidate-cache:46) |
| `grep -c "'Access-Control-Allow-Origin': '*'"` per function | 0 / 0 / 0 (no wildcard literal left) |
| `~/.deno/bin/deno check` _shared/cors.ts + all 3 functions | exit 0 |
| Plan-01 `~/.deno/bin/deno test --node-modules-dir=none -A _shared/cors.test.ts` | **4 passed \| 0 failed** |
| README contains `ALLOWED_ORIGINS` + `redeploy` + verbatim allow-headers | yes |
| enrich-dish service-role JWT check preserved | yes (untouched) |
| invalidate-cache Redis / `feed:v2:*` flush-all preserved | yes (untouched) |
| Operator SC#1 / SC#2 / SC#3 (prod) | all PASS (operator-confirmed) |

## Deviations from Plan

None — plan executed exactly as written. The three code edits were the mechanical const→per-request swap the Plan-01 contract made possible; no bugs, missing functionality, or blocking issues surfaced. (Prettier's lint-staged hook may have cosmetically reformatted on commit, behavior unchanged.)

## Forward-Coordination Flag (Phase 4 / DEBT-05)

Phase 4 swaps `serve(...)` → `Deno.serve(...)` across these same three files. That swap MUST preserve, in each file:
- (a) the `const corsHeaders = buildCorsHeaders(req.headers.get('Origin'))` first line of the handler, and
- (b) the `import { buildCorsHeaders } from '../_shared/cors.ts'` import.
Phase 4 changes only the `serve` import/entry, not the per-request CORS line.

## Next
SEC-01 is closed at the code + prod level (all three functions emit allowlist-reflecting CORS, no wildcard, no-Origin happy path preserved, preflight verified). PERF-03's CORS half for `invalidate-cache` is also done; its Redis/flush-all half remains Phase 7 / PERF-03 work. Phase-level completion (code-review + verification gates) is the orchestrator's call.

## Self-Check: PASSED
- FOUND: infra/supabase/functions/feed/index.ts (import line 16, per-request line 703)
- FOUND: infra/supabase/functions/enrich-dish/index.ts (import line 25, per-request line 104)
- FOUND: infra/supabase/functions/invalidate-cache/index.ts (import line 18, per-request line 46)
- FOUND: infra/supabase/functions/README.md (ALLOWED_ORIGINS + redeploy)
- FOUND: .planning/phases/02-cors-lockdown/02-02-SUMMARY.md
- FOUND commit: 86c5568 (Task 1 — feed)
- FOUND commit: bda6231 (Task 2 — enrich-dish + invalidate-cache)
- FOUND commit: 8b60486 (Task 3 — README)
