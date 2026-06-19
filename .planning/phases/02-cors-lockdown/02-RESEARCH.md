# Phase 2: CORS Lockdown - Research

**Researched:** 2026-06-19
**Domain:** Supabase Deno Edge Functions — CORS allowlist hardening
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Allowlist configured via runtime env var **`ALLOWED_ORIGINS`** (comma-separated), read from `Deno.env`, split on comma. Operator-managed via Supabase function secrets, NOT hardcoded.
- **D-02:** Initial allowlist: **`https://eat-me-v1-1-admin.vercel.app`** (deployed admin) and **`http://localhost:3001`** (local admin dev). Both needed.
- **D-03:** Origin matching is **exact-string**. Vercel preview-deployment origins knowingly NOT matched (no wildcard-subdomain logic). Recorded as known limitation.
- **D-04:** Introduce a single shared module **`infra/supabase/functions/_shared/cors.ts`** exporting `buildCorsHeaders(origin: string | null)` that reads `ALLOWED_ORIGINS`, decides ACAO, returns the full CORS header object. The 3 functions import by **relative path** and replace their inline `corsHeaders` const.
- **D-05:** Helper returns a **plain object** so existing `{ ...corsHeaders, 'Content-Type': ... }` spreads and `feed`'s `compressedJsonResponse(data, corsHeaders)` keep working. Value depends on request `Origin` → computed per call, not a module-level const.
- **D-06:** First `_shared/` module in the repo. Planner MUST verify Supabase bundles underscore-prefixed `_shared/` imports on `supabase functions deploy`. If bundling can't be confirmed, fall back to inline-per-function. **(RESOLVED — see Primary Research Finding below: bundling is the documented, supported pattern. No fallback needed.)**
- **D-07:** Strictly the 3 functions in SEC-01: `feed`, `enrich-dish`, `invalidate-cache`. The other 4 wildcard functions NOT touched this phase.
- **D-08:** Disallowed browser origin → omit ACAO, serve normal 200. No hard 403, no info leak.
- **D-09:** No-`Origin` request (mobile/curl) → omit ACAO, proceed normally. Auth enforced by JWT, not CORS. Helper distinguishes "no Origin → proceed" from "disallowed Origin → proceed without ACAO" — both proceed, neither emits ACAO.
- **D-10:** `ALLOWED_ORIGINS` unset/missing → **fail-closed** (empty allowlist, no browser ACAO), but no-Origin mobile/curl still works. NOT fail-open to `*`, NOT a 500.
- **D-11:** `Vary: Origin` always emitted on both OPTIONS preflight and main response.
- **D-12:** Add explicit `Access-Control-Allow-Methods` (`POST, OPTIONS`, plus `GET` where served). Preserve existing `Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type` verbatim.
- **D-13:** OPTIONS preflight and main response return the **same** CORS header set for a given Origin — both routed through the shared helper.

### Claude's Discretion
- Exact helper name/signature; one object vs split preflight/response helpers.
- Whether to emit `Access-Control-Max-Age` on preflight (nice-to-have, not required).
- `Access-Control-Allow-Credentials` is **omitted** (admin uses bearer JWT in `authorization` header, not cookies) — flag if assumption is wrong. **(CONFIRMED correct — see Secondary Finding 1.)**
- Deno test shape (allowed → ACAO present; disallowed → absent; no-Origin → absent + would-200; unset env → fail-closed). Tests run with `deno test --node-modules-dir=none -A`.

### Deferred Ideas (OUT OF SCOPE)
- Lock the other 4 wildcard edge functions (`app-config`, `group-recommendations`, `update-preference-vector`, `batch-update-preference-vectors`).
- Vercel preview-deployment origin matching (`*.vercel.app` wildcard/regex).
- `Access-Control-Max-Age` preflight caching.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEC-01 | `feed`, `enrich-dish`, `invalidate-cache` restrict CORS to a configured allowlist (no wildcard in prod) without breaking the mobile client (no `Origin` header) or admin preflight | `_shared/cors.ts` bundling confirmed (Primary Finding); allowlist-reflecting design with `Vary: Origin` + `Allow-Methods` confirmed spec-correct (Secondary Finding 1); fail-closed + no-Origin happy-path edge cases confirmed spec-sound (Secondary Finding 2); complete line-accurate edit inventory (Edit Inventory section). PERF-03 co-owns `invalidate-cache` CORS, which lands here. |
</phase_requirements>

## Summary

This is a surgical, low-risk security refactor. All three target functions today share an identical module-level wildcard `corsHeaders` const (`{ 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }`) and an identical OPTIONS pattern (`return new Response('ok', { headers: corsHeaders })`). The work is to replace the const with a per-request `buildCorsHeaders(req.headers.get('Origin'))` call routed through a new shared module, preserving every existing spread site.

**The single gating unknown (D-06) is resolved: HIGH confidence.** Supabase's official docs explicitly document the `_shared/` underscore-prefixed folder as the supported pattern for code shared across edge functions — such folders are NOT deployed as standalone functions but ARE bundled into any function that imports them via a relative path (`../_shared/cors.ts`). `supabase functions deploy <fn>` walks the import graph and bundles the shared module. No inline-per-function fallback is needed. Notably, the repo's current inline `corsHeaders` shape is byte-identical to Supabase's own documented pre-v2.95.0 CORS example — this is the canonical pattern, and the allowlist variant is the canonical hardening of it.

The CORS spec details are all confirmed correct against MDN/HTTP semantics: `Vary: Origin` is required on both preflight and main response because ACAO now varies by request Origin (caches must key on it); `Access-Control-Allow-Methods` is required on preflight because POST + `application/json` is a non-simple request that triggers preflight; omitting `Access-Control-Allow-Credentials` is correct for bearer-JWT (header, not cookie) auth. All three documented edge-case behaviors (disallowed → omit ACAO + 200, no-Origin → omit ACAO + proceed, unset env → fail-closed) are spec-sound and safe.

**Primary recommendation:** Build `infra/supabase/functions/_shared/cors.ts` exporting `buildCorsHeaders(origin: string | null): Record<string, string>`. Wire all three functions to call it per-request at the top of their `serve` handler, replacing the module-level const. Add a colocated Deno test `_shared/cors.test.ts` exercising the four cases via `Deno.env.set`/`Deno.env.delete`. No fallback path required.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| CORS allowlist decision | API / Backend (Deno edge fn) | — | CORS is a server-emitted response-header concern; the browser only enforces what the server declares. Must live server-side. |
| Origin allowlist config | Supabase function secrets (runtime env) | — | D-01: operator owns prod config; no code edit to change origins. |
| Auth enforcement | API / Backend (existing JWT validation) | — | D-09: auth is NOT CORS — CORS only governs browser JS read access, not request authorization. Unchanged this phase. |
| Shared CORS logic (DRY) | `_shared/cors.ts` (bundled into each fn) | — | D-04: one module, three importers; bundled at deploy time per fn. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Deno runtime | 2.8.1 (local, verified at `~/.deno/bin/deno`) | Edge function + test runtime | Supabase edge functions run on Deno; repo standard. |
| `jsr:@std/assert` | latest (Deno std assert) | Test assertions in the new Deno test file | Deno's official std assertion lib; canonical for `deno test`. Used as `assertEquals` / `assert` / `assertFalse`. |

No new npm/JSR packages are installed into the deployed functions. `cors.ts` is pure standard-library TypeScript (string parsing + plain-object construction). The test file imports only `@std/assert`, which Deno resolves at test time and is never bundled into the deployed function.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `_shared/cors.ts` (D-04, chosen) | Inline-per-function (rejected Area-2 option) | Inline is 3× duplication and was only the fallback if bundling couldn't be confirmed. Bundling IS confirmed → no need. |
| `buildCorsHeaders` reading env per call | Module-level allowlist parse | Reading `Deno.env` per request is negligible cost and lets the unset-env test toggle the var with `Deno.env.delete`. Per-call is simpler and avoids stale-cache-across-tests bugs. |
| Custom allowlist parser | `@supabase/supabase-js/cors` import (v2.95.0+) | The SDK's bundled `corsHeaders` is wildcard `*` and does NOT do allowlist reflection — it does not solve SEC-01. Hand-rolling the tiny allowlist check is correct here (see Don't Hand-Roll for the boundary). |

**Installation:** None. No `npm install` / `deno add` for the deployed functions. The test file's `jsr:@std/assert` import is resolved by `deno test` on demand.

## Package Legitimacy Audit

> No external packages are installed by this phase. `cors.ts` uses zero dependencies; the test file imports `jsr:@std/assert` (Deno's first-party standard library, published by the Deno core team). Nothing is added to the deployed function bundle.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `@std/assert` | JSR (`jsr:@std/assert`) | mature (Deno std) | very high | github.com/denoland/std | OK | Approved — test-only, first-party Deno std, never bundled into deployed fn |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
                    ┌─────────────────────────────────────────┐
                    │  Caller sends request to edge function   │
                    │  (with or without an `Origin` header)    │
                    └───────────────────┬─────────────────────┘
                                        │
                                        ▼
                    ┌─────────────────────────────────────────┐
                    │ serve(handler): FIRST LINE of handler    │
                    │ const origin = req.headers.get('Origin') │
                    │ const corsHeaders =                      │
                    │     buildCorsHeaders(origin)             │
                    └───────────────────┬─────────────────────┘
                                        │
            ┌───────────────────────────┼───────────────────────────┐
            ▼                           ▼                           ▼
   ┌─────────────────┐        ┌──────────────────┐       ┌────────────────────┐
   │ origin === null │        │ origin ∈ allow-  │       │ origin ∉ allowlist │
   │ (mobile/curl)   │        │ list (admin)     │       │ (other browser)    │
   └────────┬────────┘        └────────┬─────────┘       └─────────┬──────────┘
            │ no ACAO                   │ ACAO=origin              │ no ACAO
            │ +Vary +Methods            │ +Vary +Methods          │ +Vary +Methods
            └───────────────┬───────────┴──────────────┬──────────┘
                            ▼                          ▼
              ┌──────────────────────────┐  ┌──────────────────────────┐
              │ OPTIONS preflight:       │  │ Real request (POST/GET):  │
              │ Response('ok',           │  │ existing JWT/auth check,  │
              │   {headers: corsHeaders})│  │ business logic, then       │
              │ (D-13: SAME headers)     │  │ {...corsHeaders, CT} spread│
              └──────────────────────────┘  └──────────────────────────┘

  buildCorsHeaders(origin) internals:
    allowlist = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map(trim).filter(Boolean)
    base = { 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
             'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
             'Vary': 'Origin' }                    // Vary ALWAYS present (D-11)
    if (origin && allowlist.includes(origin))      // exact match (D-03)
        base['Access-Control-Allow-Origin'] = origin
    // else: omit ACAO entirely (covers no-Origin D-09, disallowed D-08, unset-env fail-closed D-10)
    return base
```

### Recommended Project Structure
```
infra/supabase/functions/
├── _shared/
│   ├── cors.ts          # NEW — buildCorsHeaders(origin) helper (the one DRY source)
│   └── cors.test.ts     # NEW — Deno test: allowed / disallowed / no-Origin / unset-env
├── feed/index.ts        # EDIT — import ../_shared/cors.ts; per-request corsHeaders
├── enrich-dish/index.ts # EDIT — same
└── invalidate-cache/index.ts # EDIT — same
```

### Pattern 1: `_shared/` module bundled at deploy
**What:** Underscore-prefixed folders under `functions/` hold shared ES modules. They are NOT deployed as standalone functions; they ARE pulled into the bundle of any function that imports them.
**When to use:** Logic shared across ≥2 functions (exactly this case — 3 importers).
**Example:**
```typescript
// Source: https://supabase.com/docs/guides/functions/development-tips
// Recommended structure:
//   ├── _shared
//   │   ├── supabaseAdmin.ts
//   │   ├── supabaseClient.ts
//   │   └── cors.ts
//   ├── function-one
//   │   └── index.ts
//   └── function-two
//       └── index.ts
// Import in a function:  import { buildCorsHeaders } from '../_shared/cors.ts'
```
[CITED: supabase.com/docs/guides/functions/development-tips] — "store any shared code in a folder prefixed with an underscore (`_`)"; underscore folders "are imported by other functions but aren't deployed independently." [VERIFIED: web search of supabase/discussions #8723] — "any folder starting with an underscore will be pulled into the function bundle by deploy … you cannot deploy the `_shared` folder directly."

### Pattern 2: Per-request CORS header object
**What:** Because ACAO depends on the request Origin, `corsHeaders` can no longer be a module-level const. Compute it as the first line of the `serve` handler and thread the resulting plain object through every existing response.
**When to use:** Any allowlist-reflecting CORS (vs. static wildcard).
**Example:**
```typescript
// Source: repo pattern + MDN allowlist reflection guidance
serve(async (req: Request) => {
  const corsHeaders = buildCorsHeaders(req.headers.get('Origin'));   // FIRST line
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });             // D-13: same headers
  }
  // ... existing auth + logic unchanged ...
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }, // spread unchanged
  });
});
```

### Anti-Patterns to Avoid
- **Reflecting the Origin unconditionally** (`ACAO: req.headers.get('Origin')` with no allowlist check) — that is wildcard-equivalent and re-opens the exact hole SEC-01 closes. Always gate on `allowlist.includes(origin)`.
- **Returning ACAO for a no-Origin request** — never set ACAO to `null`/empty string; omit the header entirely (D-09).
- **Fail-open to `*` when `ALLOWED_ORIGINS` is unset** — explicitly forbidden by D-10. Empty/missing env = empty allowlist = no browser ACAO. A degraded admin browser experience is acceptable; a security regression is not.
- **Forgetting `Vary: Origin` on the OPTIONS preflight** — preflights are cacheable too; the Vary must be on both (D-11).
- **Keeping a module-level `const corsHeaders`** anywhere after the refactor — it would shadow the per-request object and silently re-introduce a stale/wildcard value. Delete the const in all three files.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OPTIONS preflight detection | A custom preflight parser inspecting `Access-Control-Request-Method` | The existing `if (req.method === 'OPTIONS')` short-circuit | Already correct and present in all three functions; just feed it the per-request `corsHeaders`. |
| Origin → ACAO decision | A regex/wildcard subdomain matcher | Exact-string `allowlist.includes(origin)` | D-03 explicitly chooses exact matching; wildcard-subdomain is deferred. A regex here is scope creep + an injection surface. |

**Key insight:** The allowlist check itself (split env on comma, exact `includes`) is ~5 lines and IS the correct thing to write by hand — there is no library that does "reflect-if-allowlisted with fail-closed-on-unset" semantics the way D-08/D-09/D-10 specify. The `@supabase/supabase-js/cors` export ships a wildcard `*` and would *fail* SEC-01. So the boundary is: don't hand-roll preflight HTTP parsing (use the runtime), DO hand-roll the tiny allowlist decision (no lib fits).

## Runtime State Inventory

> This phase touches only Deno source code + one runtime env var. No DB, no migrations, no mobile code, no OS-registered state.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no DB writes, no migrations (verified: phase boundary D-13, no migration files in scope). | none |
| Live service config | **`ALLOWED_ORIGINS` Supabase function secret** — NEW runtime config the operator must set on deploy (D-01/D-02). Not in git. Initial value: `https://eat-me-v1-1-admin.vercel.app,http://localhost:3001`. | Operator sets the secret at deploy time (operator-owns-prod). Plan must include this as an explicit deploy-step instruction, not a code edit. |
| OS-registered state | None — verified: edge functions are deployed artifacts, no local OS registration. | none |
| Secrets/env vars | `ALLOWED_ORIGINS` is read by code via `Deno.env.get('ALLOWED_ORIGINS')`. If the operator forgets to set it, fail-closed (D-10) keeps mobile working and degrades admin browser only. | Operator sets the secret; plan documents the exact name + comma-separated value shape. |
| Build artifacts | None — no compiled output; Supabase bundles on deploy. The `_shared/cors.ts` is bundled into each of the 3 functions at `supabase functions deploy <fn>` time. | Operator must redeploy ALL THREE functions (each gets its own bundled copy of the shared module). Editing `cors.ts` later requires redeploying every importer. |

**The canonical question — after every file is updated, what runtime state still has the old value?** The deployed functions in prod still run wildcard CORS until the operator redeploys all three AND sets `ALLOWED_ORIGINS`. Both steps are operator actions (stage-don't-apply). The plan's deploy checklist must list: (1) set `ALLOWED_ORIGINS` secret, (2) `supabase functions deploy feed`, `enrich-dish`, `invalidate-cache`, (3) run the three smoke calls.

## Common Pitfalls

### Pitfall 1: Editing `cors.ts` later silently leaves stale copies in prod
**What goes wrong:** Because each function bundles its own copy of `_shared/cors.ts` at deploy, changing the shared file does NOT update already-deployed functions.
**Why it happens:** Bundling is per-function at deploy time, not a live shared import.
**How to avoid:** Any future change to `cors.ts` must redeploy every importing function. Document this in the function README. For THIS phase: redeploy all three after initial wiring.
**Warning signs:** A smoke test passes on one function and fails on another after a `cors.ts` edit → a function wasn't redeployed.

### Pitfall 2: Leaving the module-level `const corsHeaders` in place
**What goes wrong:** If the old `const corsHeaders = {...}` is left at module scope and only some response sites are switched to the per-request object, responses silently mix wildcard and allowlist headers.
**Why it happens:** There are many spread sites (feed has 7, enrich-dish has 8) — easy to miss one.
**How to avoid:** Delete the const entirely; the compiler/lint then flags any unmigrated reference as an undefined identifier. Use the complete Edit Inventory below as the checklist.
**Warning signs:** A `corsHeaders` reference that still resolves after the const is deleted means a stray local was introduced.

### Pitfall 3: `Deno.env` test pollution across cases
**What goes wrong:** The unset-env (fail-closed) test case can leak state into other tests if `ALLOWED_ORIGINS` is set globally and not cleaned up.
**Why it happens:** `Deno.env` is process-global; tests share it.
**How to avoid:** In each test step, `Deno.env.set('ALLOWED_ORIGINS', ...)` at the start and `Deno.env.delete('ALLOWED_ORIGINS')` in a `finally` (or set explicitly per case). Order the unset-env case to set its own precondition rather than relying on absence.
**Warning signs:** Tests pass in isolation but fail when run together, or vice-versa.

### Pitfall 4: Forgetting POST+JSON triggers a preflight
**What goes wrong:** Assuming the admin's POST request is a "simple" request and skipping `Access-Control-Allow-Methods`.
**Why it happens:** Only GET/HEAD/POST with simple content-types skip preflight; `application/json` is NOT a simple content-type, so the browser sends an OPTIONS preflight first.
**How to avoid:** Always emit `Access-Control-Allow-Methods` on the OPTIONS response (D-12). [CITED: MDN CORS] confirms `Access-Control-Allow-Methods` is "returned in preflight responses" and "required when the browser sends a preflight OPTIONS request before making the actual POST request with `application/json`."
**Warning signs:** Admin browser console shows the preflight succeeding but the real request blocked, or vice-versa.

## Code Examples

### `_shared/cors.ts` (reference shape — planner/executor may adjust naming)
```typescript
// Source: synthesized from D-04/D-05/D-08/D-09/D-10/D-11/D-12 + MDN allowlist guidance
// infra/supabase/functions/_shared/cors.ts

const ALLOW_HEADERS = 'authorization, x-client-info, apikey, content-type'; // verbatim, D-12
const ALLOW_METHODS = 'POST, GET, OPTIONS';                                 // D-12

export function buildCorsHeaders(origin: string | null): Record<string, string> {
  const allowlist = (Deno.env.get('ALLOWED_ORIGINS') ?? '')   // unset => '' => [] (fail-closed, D-10)
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': ALLOW_HEADERS,
    'Access-Control-Allow-Methods': ALLOW_METHODS,
    'Vary': 'Origin',                                          // ALWAYS, D-11
  };

  // Exact-string match (D-03). origin === null (mobile/curl) never matches => no ACAO (D-09).
  // Disallowed browser origin => no ACAO (D-08). No credentials header (bearer-JWT auth).
  if (origin && allowlist.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}
```

### `_shared/cors.test.ts` (Deno test — first true Deno test in the repo)
```typescript
// Source: Deno std test conventions; run with: deno test --node-modules-dir=none -A _shared/cors.test.ts
import { assert, assertEquals, assertFalse } from 'jsr:@std/assert';
import { buildCorsHeaders } from './cors.ts';

const ALLOWED = 'https://eat-me-v1-1-admin.vercel.app';

Deno.test('allowed origin → ACAO reflects origin + Vary present', () => {
  Deno.env.set('ALLOWED_ORIGINS', `${ALLOWED},http://localhost:3001`);
  try {
    const h = buildCorsHeaders(ALLOWED);
    assertEquals(h['Access-Control-Allow-Origin'], ALLOWED);
    assertEquals(h['Vary'], 'Origin');
    assert(h['Access-Control-Allow-Methods'].includes('POST'));
    assertEquals(h['Access-Control-Allow-Headers'], 'authorization, x-client-info, apikey, content-type');
  } finally {
    Deno.env.delete('ALLOWED_ORIGINS');
  }
});

Deno.test('disallowed origin → no ACAO, Vary still present', () => {
  Deno.env.set('ALLOWED_ORIGINS', ALLOWED);
  try {
    const h = buildCorsHeaders('https://evil.example.com');
    assertFalse('Access-Control-Allow-Origin' in h);
    assertEquals(h['Vary'], 'Origin');
  } finally {
    Deno.env.delete('ALLOWED_ORIGINS');
  }
});

Deno.test('no-Origin (mobile/curl) → no ACAO, would-200', () => {
  Deno.env.set('ALLOWED_ORIGINS', ALLOWED);
  try {
    const h = buildCorsHeaders(null);
    assertFalse('Access-Control-Allow-Origin' in h);
  } finally {
    Deno.env.delete('ALLOWED_ORIGINS');
  }
});

Deno.test('ALLOWED_ORIGINS unset → fail-closed (no ACAO even for would-be-allowed origin)', () => {
  Deno.env.delete('ALLOWED_ORIGINS');
  const h = buildCorsHeaders(ALLOWED);
  assertFalse('Access-Control-Allow-Origin' in h);   // fail-closed, NOT '*'
  assertEquals(h['Vary'], 'Origin');                 // still well-formed
});
```

## Edit Inventory (line-accurate, current HEAD 2026-06-19)

> Verified by reading the actual files + grep on current HEAD. CONTEXT line numbers confirmed accurate. This is the complete set of edits the executor must make.

### `infra/supabase/functions/feed/index.ts`
- **Line 19–22** — DELETE the module-level `const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '...' }`.
- **Add import** near line 12–15 (with the other imports): `import { buildCorsHeaders } from '../_shared/cors.ts';`
- **Line 708 (`serve(async (req: Request) => {`)** — insert as the FIRST line of the handler body: `const corsHeaders = buildCorsHeaders(req.headers.get('Origin'));`
- **Line 710** — OPTIONS: `return new Response('ok', { headers: corsHeaders });` — now uses the per-request object (no text change needed, just relies on the new local).
- **Spread sites that already use `{ ...corsHeaders, 'Content-Type': ... }` — no edit needed beyond the local now being per-request:** lines **726**, **754** (cache hit), **919**, **1102**, **1108** (error catch).
- **Line 1098** — `return compressedJsonResponse(responseData, corsHeaders);` — threads the per-request object through; `compressedJsonResponse(data, headers)` already accepts a `headers` arg (defined line 26–28). No signature change.
- **Note:** `compressedJsonResponse` (lines 26–45) sets `headers` on its `new Response` (line 45) — confirm it spreads/forwards the passed `headers` so the CORS object reaches the gzip path. It receives `headers` as a param; verify line 45 applies them.
- **Methods:** feed is POST-only at the app level but the handler does not branch on GET; `POST, GET, OPTIONS` in Allow-Methods is harmless and future-proof. No GET route to preserve specifically.

### `infra/supabase/functions/enrich-dish/index.ts`
- **Line 30–33** — DELETE the module-level `const corsHeaders`.
- **Add import** near line 23–24: `import { buildCorsHeaders } from '../_shared/cors.ts';`
- **Line 107 (`serve(async (req: Request) => {`)** — insert FIRST line: `const corsHeaders = buildCorsHeaders(req.headers.get('Origin'));`
- **Line 109** — OPTIONS handler uses `corsHeaders` (now per-request).
- **Spread sites (all `{ ...corsHeaders, 'Content-Type': 'application/json' }`) — no text edit, rely on per-request local:** lines **117** (401 Unauthorized), **132** (Missing dish_id), **150** (Dish not found), **158** (recently_completed), **203** (Failed to save embedding), **210** (success), **216** (catch).
- **Auth note (confirms D-09):** line 112–118 enforces the service-role bearer JWT check INDEPENDENTLY of CORS — CORS lockdown does not touch this. `enrich-dish` is trigger/cron/service-role-called (not browser-called), so it has no Origin in practice; the lockdown is defense-in-depth + consistency.

### `infra/supabase/functions/invalidate-cache/index.ts`
- **Line 19–22** — DELETE the module-level `const corsHeaders`.
- **Add import** near line 15–17: `import { buildCorsHeaders } from '../_shared/cors.ts';`
- **Line 49 (`serve(async (req: Request) => {`)** — insert FIRST line: `const corsHeaders = buildCorsHeaders(req.headers.get('Origin'));`
- **Line 51** — OPTIONS handler uses `corsHeaders`.
- **Spread sites (all `{ ...corsHeaders, 'Content-Type': 'application/json' }`) — no text edit:** lines **64** (redis_not_configured), **72** (unknown_table), **117** (success), **123** (catch).
- **Co-ownership note (F-21 / PERF-03):** this phase touches ONLY the CORS object. The `feed:v2:*` flush-all logic (line 80) and cache-event coverage are Phase 7. Do not touch the Redis logic.

### Shared / cross-cutting
- The `Allow-Headers` string `authorization, x-client-info, apikey, content-type` must be preserved VERBATIM in `cors.ts` (SC#3 / D-12). All three functions currently carry the identical string.
- `infra/supabase/functions/README.md` — UPDATE the "CORS Configuration" section (lines 75–81) which currently documents `Access-Control-Allow-Origin: *`. Replace with the allowlist + `ALLOWED_ORIGINS` env-var + redeploy-all-importers note (covers Pitfall 1).
- `infra/supabase/functions/deno-globals.d.ts` — the IDE shim declares URL-import modules; the new relative `../_shared/cors.ts` import needs no shim (it's a local TS file the tsserver resolves directly). The `Deno.env` shim (lines 6–11) already exists, so `Deno.env.get` in `cors.ts` type-checks. `Deno.env.set`/`Deno.env.delete` used in the test are NOT in the shim — but tests run under real Deno (not tsserver), so this is cosmetic-only; optionally extend the shim's `Env` interface with `set`/`delete` to silence IDE squiggles in the test file.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Inline `_shared/cors.ts` with hardcoded `corsHeaders` | (supabase-js v2.95.0+) import `corsHeaders` from `@supabase/supabase-js/cors`, or `withSupabase` wrapper auto-handles CORS | supabase-js v2.95.0 | NOT applicable here — the SDK export is wildcard `*` and does not do allowlist reflection. The `_shared/cors.ts` file pattern remains correct for custom allowlist logic. [CITED: supabase.com/docs/guides/functions/cors] |
| `deno.land/std@0.168.0/http/server` `serve` | native `Deno.serve` | Deno 2.x | NOT this phase — DEBT-05 / Phase 4 does the `serve` swap. **Coordination flag below.** |

**Deprecated/outdated:** The repo's `serve` import (`std@0.168.0`) is slated for replacement in Phase 4 (DEBT-05). This phase keeps `serve(...)` as-is — it only adds the first-line `corsHeaders` local inside the existing handler. The two phases touch the same three files; sequence so they don't collide (see Open Questions).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `compressedJsonResponse` (feed lines 26–45) forwards its `headers` param onto the final `new Response` so the per-request CORS object reaches the gzip path. | Edit Inventory (feed) | LOW — confirmed the function signature takes `headers` and is called with `corsHeaders` at line 1098; executor should glance at line 45 to confirm `headers` is applied, but the existing wildcard already flowed through this path, so behavior is preserved. |
| A2 | `enrich-dish` and `invalidate-cache` are never browser-called in practice (trigger/cron/webhook/service-role), so their CORS lockdown is defense-in-depth with zero functional risk. | Edit Inventory | LOW — even if browser-called, the allowlist + fail-closed behavior is the desired outcome. No regression path. |
| A3 | `GET` in `Access-Control-Allow-Methods` is harmless for POST-only functions. | Edit Inventory (feed) | NONE — Allow-Methods is advisory to the browser; listing an unused method does not enable anything server-side. |

**If this table feels thin:** it is — the gating unknown (D-06 bundling) was resolved to HIGH via official docs + maintainer discussion, and the CORS spec questions were confirmed against MDN/HTTP semantics. The remaining assumptions are low-risk implementation glances, not decision-level unknowns.

## Open Questions

1. **Phase 4 (DEBT-05 `Deno.serve` swap) file collision**
   - What we know: Phase 4 rewrites the `serve(...)` entry in all edge functions; this phase adds a first-line `corsHeaders` local inside that same handler.
   - What's unclear: execution ordering of Phase 2 vs Phase 4 (Phase 4 is later in ROADMAP, so Phase 2 lands first).
   - Recommendation: Phase 2 ships first (it is Phase 2). Phase 4's `serve → Deno.serve` swap must preserve the `const corsHeaders = buildCorsHeaders(...)` first line and the `../_shared/cors.ts` import. Flag this forward to Phase 4's planner as a "do not regress" note. No action needed in Phase 2 itself.

2. **Operator must set `ALLOWED_ORIGINS` before/at deploy**
   - What we know: fail-closed (D-10) means a missing secret degrades admin browser access (mobile unaffected).
   - What's unclear: nothing blocking — but the smoke test for the admin-origin path (SC#3) will FAIL if the operator deploys without setting the secret.
   - Recommendation: The plan's operator deploy checklist must order "set `ALLOWED_ORIGINS` secret" BEFORE the admin-origin smoke call, else SC#3 falsely appears broken.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Deno | authoring + running the Deno test | ✓ | 2.8.1 (at `~/.deno/bin/deno`, not on PATH) | — |
| `jsr:@std/assert` | test assertions | ✓ (resolved on demand by `deno test`) | latest | — |
| Supabase CLI | operator deploy (`supabase functions deploy`) | operator's machine (stage-don't-apply) | — | operator-owned; not in agent loop |
| `ALLOWED_ORIGINS` secret | runtime allowlist | operator sets at deploy | — | fail-closed (D-10) if unset |

**Missing dependencies with no fallback:** none for authoring/testing. Deploy + secret are operator-owned (stage-don't-apply), outside the agent loop.
**Missing dependencies with fallback:** `ALLOWED_ORIGINS` unset → fail-closed (mobile keeps working, admin browser degraded). This is the designed behavior, not a blocker.

## Validation Architecture

> `.planning/config.json` not checked for `nyquist_validation` flag explicitly; treating as enabled. This section maps each success criterion to a concrete check.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Deno's built-in test runner (`deno test`) — FIRST true Deno test in the repo (existing `tests/migrations/*.test.ts` are Vitest, not Deno) |
| Config file | none — no `deno.json` exists; `deno test` runs without config |
| Quick run command | `~/.deno/bin/deno test --node-modules-dir=none -A infra/supabase/functions/_shared/cors.test.ts` |
| Full suite command | same (single new test file) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-01 (SC#1) | allowed origin → ACAO reflects origin, no wildcard, `Vary: Origin` present | unit | `deno test --node-modules-dir=none -A _shared/cors.test.ts` | ❌ Wave 0 |
| SEC-01 (SC#1) | disallowed/empty origin → no `*`, no ACAO | unit | same | ❌ Wave 0 |
| SEC-01 (SC#2) | no-`Origin` request → no ACAO, helper returns a would-200 header set | unit | same | ❌ Wave 0 |
| SEC-01 (fail-closed D-10) | `ALLOWED_ORIGINS` unset → no ACAO even for would-be-allowed origin (NOT `*`) | unit | same | ❌ Wave 0 |
| SEC-01 (SC#3) | OPTIONS preflight and main response carry identical CORS set incl. verbatim allow-headers | unit (helper is single source) + operator smoke | unit asserts the header set; operator runs OPTIONS curl from `https://eat-me-v1-1-admin.vercel.app` | ❌ Wave 0 (unit) / operator (smoke) |

### Operator Smoke Calls (stage-don't-apply — post-deploy, operator-run)
These are NOT automatable in the agent loop (require deployed prod functions). The plan must hand these to the operator, mirroring the 3 success criteria:
1. **SC#1:** `curl -i` with a disallowed/absent `Origin` → response has NO `Access-Control-Allow-Origin: *`.
2. **SC#2:** `curl` with NO `Origin` header (simulating mobile) → still returns 200 / normal body.
3. **SC#3:** `curl -i -X OPTIONS -H 'Origin: https://eat-me-v1-1-admin.vercel.app'` → ACAO echoes the admin origin AND `Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type` is present, AND `Vary: Origin` present.

### Sampling Rate
- **Per task commit:** `deno test --node-modules-dir=none -A infra/supabase/functions/_shared/cors.test.ts`
- **Per wave merge:** same (single file)
- **Phase gate:** Deno test green locally; operator smoke calls deferred to deploy (stage-don't-apply — recorded as operator checklist, not an agent gate).

### Wave 0 Gaps
- [ ] `infra/supabase/functions/_shared/cors.ts` — the helper under test (covers SEC-01)
- [ ] `infra/supabase/functions/_shared/cors.test.ts` — the four-case Deno test
- [ ] No framework install needed — `deno test` is built-in; `jsr:@std/assert` auto-resolves.

*(This is the repo's first Deno test file; no shared Deno test fixtures/conftest needed — the helper is pure and self-contained.)*

## Security Domain

> `security_enforcement` treated as enabled. This IS a security phase (SEC-01).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (unchanged) | Existing JWT validation — NOT modified this phase. CORS is explicitly NOT the auth boundary (D-09). |
| V3 Session Management | no | Bearer JWT in `authorization` header; no cookies (hence no `Allow-Credentials`). |
| V4 Access Control | partial | CORS restricts which *browser origins* can read responses; it is a browser-enforced read-access control, NOT a server authorization control. Server authz stays with JWT. |
| V5 Input Validation | yes (light) | `ALLOWED_ORIGINS` is split/trimmed/filtered; exact-string match avoids regex-injection surface (D-03). |
| V6 Cryptography | no | None — no crypto in scope. |
| V14 Configuration (CORS) | **yes (primary)** | This is the ASVS V14.5 CORS control: no wildcard with credentials; allowlist of trusted origins; `Vary: Origin` for cache correctness. |

### Known Threat Patterns for Supabase Deno edge functions + browser admin

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Wildcard `ACAO: *` lets any site's JS read API responses | Information Disclosure | Allowlist reflection with exact match (this phase). |
| Unconditional Origin reflection (allowlist bypass) | Spoofing / Info Disclosure | Gate ACAO on `allowlist.includes(origin)` — never reflect unchecked. |
| Cache poisoning: CDN serves one origin's ACAO to another | Tampering | `Vary: Origin` always (D-11) — confirmed required by [CITED: MDN/HTTP CORS]. |
| Fail-open on misconfig (`ALLOWED_ORIGINS` unset → `*`) | Info Disclosure | Fail-closed (D-10) — empty allowlist, no ACAO. |
| `Allow-Credentials: true` + reflected origin (token/cookie theft) | Info Disclosure | Omit `Allow-Credentials` entirely (bearer-header auth, no cookies). Confirmed correct — see Secondary Finding 1. |

## Sources

### Primary (HIGH confidence)
- [CITED: supabase.com/docs/guides/functions/development-tips] — `_shared/` underscore-folder pattern; recommended structure (`_shared/cors.ts` + sibling functions); folders prefixed `_` are imported but not deployed independently; `../_shared/cors.ts` import shape.
- [CITED: supabase.com/docs/guides/functions/cors] — recommended CORS setup; confirms the repo's inline `corsHeaders` shape is the documented pre-v2.95.0 pattern; OPTIONS handled via `if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })`.
- [VERIFIED: github.com/orgs/supabase/discussions/8723] — "any folder starting with an underscore will be pulled into the function bundle by deploy"; "you cannot deploy the `_shared` folder directly … must be deployed as part of the functions that use it"; redeploy all importers after a shared-file change.
- [CITED: developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS] — `Vary: Origin` required when ACAO varies by request Origin (cache keying); `Access-Control-Allow-Methods` returned in preflight responses and required for POST + `application/json` (non-simple) requests.
- Source files read on current HEAD: `feed/index.ts`, `enrich-dish/index.ts`, `invalidate-cache/index.ts` (full grep of every `corsHeaders` site) — Edit Inventory line numbers verified.

### Secondary (MEDIUM confidence)
- [VERIFIED: web search] — allowlist-reflection + `Vary: Origin` cache-poisoning guidance corroborated across http.dev and portswigger CORS references (matches MDN).

### Tertiary (LOW confidence)
- none material — all load-bearing claims confirmed against official docs or maintainer discussion.

## Metadata

**Confidence breakdown:**
- `_shared/` bundling (the gate): HIGH — official Supabase docs + maintainer discussion both confirm; no fallback needed.
- CORS spec (Vary / Allow-Methods / credentials omission): HIGH — MDN + corroborating CORS references.
- Edit inventory: HIGH — every site grepped + read on current HEAD; CONTEXT line numbers confirmed accurate.
- Test shape: HIGH — Deno built-in runner + `@std/assert`; first Deno test but the pattern is standard.

**Research date:** 2026-06-19
**Valid until:** 2026-07-19 (stable; Supabase `_shared` pattern and CORS semantics are long-stable. Re-check only if Supabase changes function bundling or the team adopts supabase-js v2.95.0+ CORS imports.)
