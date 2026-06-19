# Phase 2: CORS Lockdown - Pattern Map

**Mapped:** 2026-06-19
**Files analyzed:** 6 (2 create, 4 modify)
**Analogs found:** 6 / 6 (all confirmed on current HEAD)

> The RESEARCH.md Edit Inventory already did the line-accurate per-file inventory. This map confirms every analog exists verbatim on current HEAD and gives the planner copy-paste-grade reference snippets + a one-line "replicate / differs" note per file. **One research correction baked in below: `cors.test.ts` is NOT the repo's first Deno test** — see `cors.test.ts` row.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `_shared/cors.ts` (CREATE) | utility (shared helper) | transform (Origin → header object) | The 3 inline `const corsHeaders` blocks it replaces | exact (extraction of existing const) |
| `_shared/cors.test.ts` (CREATE) | test | request-response (pure fn) | `menu-scan-worker/test.ts` (only existing Deno test) | role-match (Deno test) — **but different std import; see note** |
| `feed/index.ts` (MODIFY) | edge function | request-response (+ gzip stream) | self (in-place const→per-request swap) | exact |
| `enrich-dish/index.ts` (MODIFY) | edge function | event-driven (service-role/trigger) | self | exact |
| `invalidate-cache/index.ts` (MODIFY) | edge function | event-driven (cache flush) | self | exact |
| `README.md` (MODIFY) | docs | — | self (CORS Configuration section, lines 75–81) | exact |

## Pattern Assignments

### `_shared/cors.ts` (CREATE — utility, transform)

**Analog:** the byte-identical inline const present in all three functions. **Confirmed verbatim on HEAD:**
- `feed/index.ts` lines 19–22
- `enrich-dish/index.ts` lines 30–33
- `invalidate-cache/index.ts` lines 19–22

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```

**What to replicate:** the `Access-Control-Allow-Headers` string `authorization, x-client-info, apikey, content-type` VERBATIM (SC#3 / D-12).
**What differs:** drop the static `'Access-Control-Allow-Origin': '*'`; make it a function `buildCorsHeaders(origin: string | null)` that reads `Deno.env.get('ALLOWED_ORIGINS')`, conditionally sets ACAO to an exact-matched origin, and always adds `Vary: Origin` + `Access-Control-Allow-Methods`. Reference shape is RESEARCH.md lines 247–273 (copy-paste grade) — use it as-is.

`Deno.env.get` already type-checks against the IDE shim (`deno-globals.d.ts` lines 6–11 declare `Deno.env.get`). No shim change needed for `cors.ts`.

---

### `_shared/cors.test.ts` (CREATE — test, first `jsr:@std/assert` + `Deno.env.set/delete` test)

**Analog:** `infra/supabase/functions/menu-scan-worker/test.ts` (the repo's existing — and until now ONLY — Deno test).

**RESEARCH CORRECTION (load-bearing):** RESEARCH.md (lines 410, 275, 488) repeatedly states `cors.test.ts` is "the FIRST true Deno test in the repo." This is **wrong** — `menu-scan-worker/test.ts` is an existing Deno test using `Deno.test(...)`. What IS new about `cors.test.ts`:
1. It is the first to import from **`jsr:@std/assert`**. The existing Deno test uses the OLD URL import:
   ```typescript
   // menu-scan-worker/test.ts lines 10–13 (the existing analog's assert import)
   import {
     assertEquals,
     assertArrayIncludes,
   } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
   ```
   The research's chosen `jsr:@std/assert` is a deliberate modernization, not the repo convention. **Planner decision point:** match the existing `std@0.168.0/testing/asserts.ts` URL import for consistency with the one existing Deno test, OR adopt `jsr:@std/assert` per research. Both run under `deno test --node-modules-dir=none -A`. `assertFalse` exists in both; the research's shape needs no change either way.
2. It is the first to use `Deno.env.set` / `Deno.env.delete` (the existing test only reads/mocks deps, never mutates env).

**What to replicate from the analog:** the `Deno.test('name', () => {...})` block structure, the run command header comment (`deno test --node-modules-dir=none -A <path>` — note the `--node-modules-dir=none` rationale is documented in the analog's lines 4–6), and colocating the test next to its subject.
**What differs:** assert via `jsr:@std/assert` (or std URL — see decision above); the 4 cases are pure-function calls (no Supabase/OpenAI mocking the analog needs); env is toggled with `Deno.env.set`/`Deno.env.delete` in a `try/finally` (Pitfall 3 — research lines 232–236). Test body is RESEARCH.md lines 276–323 (copy-paste grade).

**Shim note:** `Deno.env.set`/`delete` are NOT in `deno-globals.d.ts` (it declares only `get`, lines 7–9). Tests run under real Deno, so this is cosmetic IDE squiggles only. Optionally extend the `Env` interface with `set(key, value): void` / `delete(key): void` to silence them.

---

### `feed/index.ts` (MODIFY — edge function, request-response + gzip)

**Analog:** self. Confirmed on HEAD:
- inline const lines **19–22** (delete)
- imports block lines **12–15** (add `import { buildCorsHeaders } from '../_shared/cors.ts';`)
- handler entry line **708** `serve(async (req: Request) => {` — insert first line `const corsHeaders = buildCorsHeaders(req.headers.get('Origin'));`
- OPTIONS pattern lines **709–710** (unchanged text, now uses per-request local):
  ```typescript
  serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }
  ```

**`compressedJsonResponse` thread-through — A1 confirmed RESOLVED.** Signature at lines 26–28 takes `headers: Record<string, string>`, and line 45–47 applies it: `return new Response(compressed, { headers: { ...headers, 'Content-Type': 'application/json', ... } });`. The per-request `corsHeaders` reaches the gzip path unchanged. No signature change; the call site `compressedJsonResponse(responseData, corsHeaders)` (line ~1098) just passes the new per-request local.

**What to replicate:** existing OPTIONS short-circuit + every `{ ...corsHeaders, ... }` spread site (726, 754, 919, 1102, 1108 per research) — they need NO text edit once the local is per-request.
**What differs:** const becomes a per-request local computed as the handler's first line; delete the module-level const so any missed site fails compile (Pitfall 2). `POST, GET, OPTIONS` in Allow-Methods is harmless (A3).

---

### `enrich-dish/index.ts` (MODIFY — edge function, event-driven / service-role)

**Analog:** self. Confirmed on HEAD:
- inline const lines **30–33** (delete)
- imports lines **23–24** (add relative import)
- handler entry line **107**; OPTIONS lines **108–110** (same pattern as feed)
- **Auth confirms D-09:** lines 112–118 do the service-role bearer-JWT check (`authHeader.slice(7) !== expectedKey` → 401) INDEPENDENTLY of CORS:
  ```typescript
  const authHeader = req.headers.get('authorization') ?? '';
  const expectedKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!authHeader.startsWith('Bearer ') || authHeader.slice(7) !== expectedKey) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, ... });
  }
  ```
  This is the JWT-not-CORS auth boundary — DO NOT touch it. `enrich-dish` is service-role/trigger-called (no Origin in practice); lockdown is defense-in-depth (A2).

**What to replicate:** identical const→per-request swap; spread sites 117/132/150/158/203/210/216 (research) need no text edit.
**What differs:** nothing beyond the standard swap.

---

### `invalidate-cache/index.ts` (MODIFY — edge function, event-driven / cache flush)

**Analog:** self. Confirmed on HEAD:
- inline const lines **19–22** (delete)
- imports lines **15–17** (add relative import)
- handler entry line **49**; OPTIONS lines **50–52** (same pattern)
- **PERF-03 / F-21 co-ownership boundary:** the Redis `deleteByPattern`/SCAN logic (lines 24–47, 80) and the `feed:v2:*` flush-all tension are Phase 7. Touch ONLY the CORS object here.

**What to replicate:** identical const→per-request swap; spread sites 64/72/117/123 (research) need no text edit.
**What differs:** nothing beyond the standard swap. Leave all Redis logic untouched.

---

### `README.md` (MODIFY — docs)

**Analog:** self — "CORS Configuration" section, confirmed lines **75–81** on HEAD:
```markdown
## CORS Configuration

The function includes CORS headers to allow mobile app access:

- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type`
```

**What to replicate:** the section header + bullet-list format.
**What differs:** replace the `*` line with: allowlist-reflection behavior, the `ALLOWED_ORIGINS` env-var (comma-separated, operator-set via function secrets), the fail-closed-on-unset rule (D-10), and the **redeploy-all-importers** warning (Pitfall 1 — editing `_shared/cors.ts` requires redeploying every importing function because the shared module is bundled per-function at deploy).

## Shared Patterns

### CORS helper (the DRY source)
**Source:** new `_shared/cors.ts`; reference shape RESEARCH.md lines 247–273.
**Apply to:** all 3 edge functions via `import { buildCorsHeaders } from '../_shared/cors.ts';` (relative import — workspace `@eatme/*` packages are NOT importable in Deno edge functions; this is a LOCAL relative import).

### OPTIONS preflight short-circuit (already present, replicate as-is)
**Source:** identical in all 3 functions (feed 709–710, enrich-dish 108–110, invalidate-cache 50–52).
```typescript
if (req.method === 'OPTIONS') {
  return new Response('ok', { headers: corsHeaders });
}
```
**Apply to:** all 3 — text unchanged; only the `corsHeaders` binding becomes per-request (D-13: same header set as the main response, guaranteed because both read the one helper).

### Per-request CORS local (the one structural change)
**Source:** RESEARCH.md Pattern 2 (lines 170–186).
**Apply to:** all 3 — insert `const corsHeaders = buildCorsHeaders(req.headers.get('Origin'));` as the FIRST line of each `serve` handler; delete the module-level const so unmigrated references fail compile.

### Deno test convention
**Source:** `menu-scan-worker/test.ts` (the existing Deno test) — `Deno.test(...)` blocks + the documented `deno test --node-modules-dir=none -A <path>` run command.
**Apply to:** `cors.test.ts` (with the `jsr:@std/assert`-vs-`std@0.168.0` import decision flagged above).

## No Analog Found

None. All 6 files have a confirmed in-repo analog on current HEAD. (Even the "new convention" items — `_shared/` folder and `jsr:@std/assert` import — have close existing analogs: the inline const for the helper, and `menu-scan-worker/test.ts` for the Deno test.)

## Metadata

**Analog search scope:** `infra/supabase/functions/**` (feed, enrich-dish, invalidate-cache, menu-scan-worker, deno-globals.d.ts, README.md); repo-wide `*.test.ts` + `Deno.test` grep.
**Files scanned:** ~6 source files read (targeted ranges) + 2 greps.
**Pattern extraction date:** 2026-06-19

## PATTERN MAPPING COMPLETE
