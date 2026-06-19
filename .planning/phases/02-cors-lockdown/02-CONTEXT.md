# Phase 2: CORS Lockdown - Context

**Gathered:** 2026-06-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Restrict CORS on the three wildcard edge functions — `feed`, `enrich-dish`, and `invalidate-cache` — so browser callers only receive `Access-Control-Allow-Origin` for an allowlisted admin origin (no more `*`), with `Vary: Origin` always emitted. The native mobile client (sends no `Origin` header) and the admin OPTIONS preflight must keep working unchanged; auth stays enforced via the existing JWT validation, NOT via CORS.

**Authored + Deno-tested locally only.** The operator deploys the functions to prod and runs the smoke calls (stage-don't-apply). This phase writes no migrations and changes no mobile code.

**Out of this phase's boundary:** the other 4 wildcard edge functions (see Deferred), any change to JWT/auth, and the `invalidate-cache` cache-key/flush-all redesign (that is Phase 7 / PERF-03 — only its CORS is touched here).

</domain>

<decisions>
## Implementation Decisions

### Allowlist source & origins
- **D-01:** The allowlist is configured via a runtime-read env var **`ALLOWED_ORIGINS`** (comma-separated), read from `Deno.env` and split on comma. The operator adds/changes origins through Supabase function secrets with no code edit — matches "configured allowlist" in SC#1 and the operator-owns-prod model. NOT hardcoded.
- **D-02:** Initial allowlist contents: **`https://eat-me-v1-1-admin.vercel.app`** (deployed admin) and **`http://localhost:3001`** (local admin dev). Both are needed; `apps/admin` is served from both.
- **D-03:** Origin matching is **exact-string** against the parsed list. Vercel **preview-deployment** origins (branch/PR builds get random `*.vercel.app` hostnames) are knowingly NOT matched — no wildcard-subdomain logic this phase. Recorded as a known limitation; revisit only if preview-build admin testing becomes a real workflow.

### Code structure
- **D-04:** Introduce a single shared module **`infra/supabase/functions/_shared/cors.ts`** exporting a helper (e.g. `buildCorsHeaders(origin: string | null)`) that reads `ALLOWED_ORIGINS`, decides the `Access-Control-Allow-Origin` value, and returns the full CORS header object. The 3 functions import it by **relative path** and replace their inline `corsHeaders` const. DRY: the allowlist + `Vary` + methods logic lives once.
- **D-05:** The helper must return a **plain object** so the existing response spread pattern `{ ...corsHeaders, 'Content-Type': ... }` and `feed`'s `compressedJsonResponse(data, corsHeaders)` keep working with a per-request headers object (the value now depends on the request `Origin`, so it's computed per call, not a module-level const).
- **D-06:** This is the **first `_shared/` module** in the repo. The planner MUST verify Supabase bundles underscore-prefixed `_shared/` imports on `supabase functions deploy` (it's the documented pattern — underscore folders aren't deployed as their own function but are bundled when imported). If bundling can't be confirmed, fall back to inline-per-function (the rejected Area-2 option) rather than ship a broken deploy.

### Scope (which functions)
- **D-07:** **Strictly the 3 named in SEC-01**: `feed`, `enrich-dish`, `invalidate-cache`. The other 4 wildcard functions (`app-config`, `group-recommendations`, `update-preference-vector`, `batch-update-preference-vectors`) are NOT touched this phase — recorded in Deferred. Keeps the SEC-01 scope and the deploy/smoke-test boundary clean.

### Header contract & edge-case behavior
- **D-08:** **Disallowed browser origin** (an `Origin` present but not in the allowlist): omit the `Access-Control-Allow-Origin` header and serve the **normal 200 response** — the browser blocks the JS from reading it. No hard 403 branch, no info leak, mobile/curl unaffected.
- **D-09:** **No-`Origin` request** (native mobile / curl): omit `Access-Control-Allow-Origin` and proceed normally — auth is enforced by the existing JWT validation, not CORS (locks SC#2). The helper must distinguish "no Origin → proceed" from "disallowed Origin → proceed without ACAO" — both proceed; neither emits ACAO.
- **D-10:** **`ALLOWED_ORIGINS` unset/missing**: **fail-closed** — treat as an empty allowlist (no browser origin gets ACAO), but no-Origin mobile/curl still works. A misconfigured deploy degrades admin *browser* access, never security. NOT fail-open to `*`, NOT a 500.
- **D-11:** **`Vary: Origin`** is always emitted on both the OPTIONS preflight and the main response (locks SC#1; required because the ACAO value now depends on the request Origin, so caches must key on it).
- **D-12:** Add an explicit **`Access-Control-Allow-Methods`** header (`POST, OPTIONS`, plus `GET` for any function that serves GET) — currently absent on all three; makes the preflight spec-correct for the non-simple POST+JSON requests. Preserve the existing **`Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type`** verbatim (SC#3).
- **D-13:** OPTIONS preflight and the main response return the **same** CORS header set for a given Origin (SC#3) — both routed through the shared helper so they cannot drift.

### Claude's Discretion
- Exact helper name/signature and whether it returns one object or splits preflight vs response helpers.
- Whether to also emit `Access-Control-Max-Age` on preflight (cache the preflight) — nice-to-have, not required.
- `Access-Control-Allow-Credentials` is **omitted** (admin authenticates with a bearer JWT in the `authorization` header, not cookies) — flag if that assumption is wrong.
- The Deno test shape that exercises the helper (allowed origin → ACAO present; disallowed → absent; no-Origin → absent + 200; unset env → fail-closed). Tests run with `deno test --node-modules-dir=none -A`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirement
- `.planning/ROADMAP.md` → "Phase 2: CORS Lockdown" — goal + the 3 success criteria (the scope anchor; SC#1 no-wildcard + Vary, SC#2 no-Origin succeeds, SC#3 preflight/response header match).
- `.planning/REQUIREMENTS.md` — **SEC-01** (line 18); **PERF-03** (line 40) notes `invalidate-cache` CORS lockdown lands "with SEC-01".

### Finding evidence (verified live state)
- `.planning/codebase/FINDINGS.md` §**F-10** ("Feed Edge Function — Wildcard CORS", ~line 127) — confirmed verdict + exact line citations on current HEAD; **correction baked in:** enrich-dish CORS is at line **31**, not the stale CONCERNS line 33.
- `.planning/codebase/FINDINGS.md` §**F-21** (~line 264) — `invalidate-cache` CORS co-owned by PERF-03; flags the `feed:v2:*` flush-all tension as a Phase 7 design call (NOT this phase).
- `.planning/codebase/CONCERNS.md` § Security Considerations — original finding (the input F-10 assesses).

### Source files to modify (CORS confirmed on current HEAD)
- `infra/supabase/functions/feed/index.ts` — inline `corsHeaders` lines **19–22**; OPTIONS handler `709–710`; response spreads at `724/749/913/1101/1106` and `compressedJsonResponse(responseData, corsHeaders)` at `1098`.
- `infra/supabase/functions/enrich-dish/index.ts` — inline `corsHeaders` lines **30–33**; OPTIONS handler `108–109`; multiple response spreads `115–216`.
- `infra/supabase/functions/invalidate-cache/index.ts` — inline `corsHeaders` lines **18–21**; OPTIONS handler (~`49`).
- `infra/supabase/functions/README.md` — edge-function conventions / deploy notes (verify `_shared/` bundling claim in D-06).

### Constraints & prior decisions
- `.planning/PROJECT.md` — Constraints: stage-don't-apply (operator deploys prod), "Edge functions cannot import workspace packages — enums/schemas duplicated inline" (so the shared module is a LOCAL relative import, not `@eatme/shared`).
- `.planning/phases/01-assessment-findings-register/01-CONTEXT.md` — establishes the operator-runs-prod / authored-and-dry-run workflow this phase inherits for the deploy + smoke step.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Inline `corsHeaders` const** in all 3 functions (and 4 others): `{ 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }`. The new `_shared/cors.ts` helper replaces these; preserve the Allow-Headers string verbatim.
- **`feed`'s `compressedJsonResponse(data, headers)`** already takes a `headers` arg — thread the per-request CORS object through it unchanged.
- **Established OPTIONS pattern**: `if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })` — becomes `buildCorsHeaders(req.headers.get('Origin'))`.

### Established Patterns
- **Edge functions duplicate logic inline** (no workspace-package imports allowed in Deno). This phase deliberately introduces the FIRST `infra/supabase/functions/_shared/` module — a convention shift the planner must validate on deploy (D-06).
- **Deno tests**: `deno test --node-modules-dir=none -A <path>` (deno at `~/.deno`, deploy from `infra/supabase/`).
- **Stage-don't-apply**: code is authored + locally tested; the operator deploys and runs the SC-required smoke calls (no-Origin smoke + browser-origin admin path).

### Integration Points
- **Input** is `req.headers.get('Origin')`; the helper output is a plain header object spread into every response (keep it a plain object — D-05).
- **Supabase function secrets**: operator sets `ALLOWED_ORIGINS` per deploy (the only new runtime config).
- **Phase 4** (Deno.serve migration + dep pinning) also touches every function — the new `_shared/` seam is a coordination point; sequence so the two phases don't fight over the same files.
- **Phase 7 / PERF-03** co-owns `invalidate-cache` (cache-event coverage + the flush-all tension) — this phase only locks its CORS, leaving the cache logic untouched.

</code_context>

<specifics>
## Specific Ideas

- The fix is intentionally minimal and surgical: swap the wildcard for an allowlist-reflecting helper, add `Vary` + `Allow-Methods`, change nothing about auth or business logic.
- "Fail-closed but mobile-safe" is the guiding principle for every edge case: when in doubt, drop the browser ACAO header — never drop the no-Origin happy path, never fall back to `*`.
- Verification mirrors the 3 success criteria exactly: (1) curl with a disallowed/empty origin sees no `*`; (2) no-`Origin` call still 200s; (3) OPTIONS from `https://eat-me-v1-1-admin.vercel.app` returns matching headers incl. the existing allow-headers.

</specifics>

<deferred>
## Deferred Ideas

- **Lock the other 4 wildcard edge functions** — `app-config`, `group-recommendations`, `update-preference-vector`, `batch-update-preference-vectors` also return `Access-Control-Allow-Origin: *`. Out of SEC-01 scope; candidate for a follow-up / insert-phase once the `_shared/cors.ts` helper exists (low marginal cost to extend). Classify each as browser-callable vs mobile/cron/service-role-only before locking.
- **Vercel preview-deployment origin matching** — wildcard-subdomain (`*.vercel.app` or regex) support so admin preview builds aren't blocked. Only if preview-build admin testing becomes a real workflow.
- **`Access-Control-Max-Age` preflight caching** — minor perf nicety; not required for SEC-01.

</deferred>

---

*Phase: 02-cors-lockdown*
*Context gathered: 2026-06-19*
