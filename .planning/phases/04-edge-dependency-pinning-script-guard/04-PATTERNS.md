# Phase 4: Edge Dependency Pinning & Script Guard - Pattern Map

**Mapped:** 2026-06-19
**Files analyzed:** 18 (1 NEW + 17 modified) across 2 tracks
**Analogs found:** 18 / 18 (every target has an in-repo reference; corrected line numbers from RESEARCH ⚠️ applied)

> This phase is intentionally low-risk plumbing. There are **no greenfield patterns** — every change copies an already-correct sibling in the same codebase. Track A targets copy the *reference function/file* that is already on the desired specifier; Track B's one new file generalizes an existing script. Use the RESEARCH-corrected line numbers throughout (CONTEXT.md edge line numbers were stale).

## File Classification

### Track A — edit existing edge functions (no new files)

| Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------|------|-----------|----------------|---------------|
| `infra/supabase/functions/app-config/index.ts` | edge fn | request-response | self (already on `@2.39.3`); `menu-scan-worker` for `Deno.serve` | exact |
| `infra/supabase/functions/group-recommendations/index.ts` | edge fn | request-response | `app-config` (supabase-js) + `menu-scan-worker` (serve) | exact |
| `infra/supabase/functions/invalidate-cache/index.ts` | edge fn | request-response (CORS seam + redis) | `feed` (upstash pin + seam) | exact |
| `infra/supabase/functions/enrich-dish/index.ts` | edge fn | request-response (CORS seam) | `feed` (seam) | exact |
| `infra/supabase/functions/feed/index.ts` | edge fn | request-response (CORS seam + redis) | self (upstash reference); `menu-scan-worker` (serve) | exact |
| `infra/supabase/functions/batch-update-preference-vectors/index.ts` | edge fn | request-response | `app-config` / `menu-scan-worker` | exact |
| `infra/supabase/functions/update-preference-vector/index.ts` | edge fn | request-response | `app-config` / `menu-scan-worker` | exact |
| `infra/supabase/functions/menu-scan-worker/index.ts` | edge fn | request-response | `app-config:16` (supabase-js specifier) | exact — **serve wrapper UNTOUCHED** |
| `infra/supabase/functions/_shared/cors.test.ts` | test | unit | `menu-scan-worker/test.ts` (same swap) | exact |
| `infra/supabase/functions/menu-scan-worker/test.ts` | test | unit | `_shared/cors.test.ts` (same swap) | exact |
| `infra/supabase/functions/deno-globals.d.ts` | config (IDE shim) | n/a | self (lockstep with specifier changes) | exact |

### Track B — NEW file + script edits

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `infra/scripts/lib/prod-guard.ts` **(NEW)** | utility | guard / config | `apply-phase6-flag-fixes.ts:451-455` | exact (generalize inline → module) |
| `infra/scripts/apply-phase6-flag-fixes.ts` | script | batch write | self (already conformant — swap inline → import) | exact |
| `infra/scripts/backfill-cuisine-from-dishes.ts` | script | batch write | self (LIVE-default pattern) | role-match |
| `infra/scripts/backfill-cuisine-from-google.ts` | script | batch write | `backfill-cuisine-from-dishes` | role-match |
| `infra/scripts/backfill-cuisine-types.ts` | script | batch write | `backfill-cuisine-from-dishes` | role-match |
| `infra/scripts/backfill-open-hours.ts` | script | batch write | `backfill-cuisine-from-dishes` | role-match |
| `infra/scripts/backfill-restaurant-currency.ts` | script | batch write | `backfill-cuisine-from-dishes` | role-match |
| `infra/scripts/backfill-restaurant-timezone.ts` | script | batch write | `backfill-cuisine-from-dishes` | role-match |
| `infra/scripts/seed-cold-start-vectors.ts` | script | batch write (upsert) | `backfill-cuisine-from-dishes` | role-match |
| `infra/scripts/batch-embed.ts` | script | batch write (RPC) | `apply-phase6-flag-fixes` (net-new gate — NO existing dry-run) | role-match |

---

## Pattern Assignments — Track A

### `serve` → `Deno.serve` swap (7 functions)

**Analog (the form already proven in the edge runtime):** `infra/supabase/functions/menu-scan-worker/index.ts:1056`
```ts
Deno.serve(async req => {
```

**Per-function edit = exactly two line touches** (delete the import, rename the wrapper token). RESEARCH-corrected line numbers:

| Function | DELETE import line | call-site `serve(` → `Deno.serve(` |
|----------|--------------------|-------------------------------------|
| `app-config` | 15 | 32 |
| `group-recommendations` | 15 | 182 |
| `invalidate-cache` | 15 | 45 |
| `enrich-dish` | 23 | 103 |
| `feed` | 12 | 702 |
| `batch-update-preference-vectors` | 15 | 41 |
| `update-preference-vector` | 21 | 183 |

The import line to delete is identical in all 7:
```ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
```
`Deno` is already declared in `deno-globals.d.ts:6-11`, so `Deno.serve` needs no new shim. Handler bodies are byte-for-byte unchanged.

### CORS seam preservation (D-02 — only feed / enrich-dish / invalidate-cache)

**These 3 lines MUST survive byte-for-byte** — the swap touches only the wrapper line above them.

`feed/index.ts:702-703`:
```ts
serve(async (req: Request) => {                                    // → Deno.serve(async (req: Request) => {
  const corsHeaders = buildCorsHeaders(req.headers.get('Origin')); // KEEP byte-for-byte
```
`enrich-dish/index.ts:103-104`:
```ts
serve(async (req: Request) => {                                    // → Deno.serve(
  const corsHeaders = buildCorsHeaders(req.headers.get('Origin')); // KEEP
```
`invalidate-cache/index.ts:45-46`:
```ts
serve(async (req: Request) => {                                    // → Deno.serve(
  const corsHeaders = buildCorsHeaders(req.headers.get('Origin')); // KEEP
```
The `import { buildCorsHeaders } from '../_shared/cors.ts';` line and every `...corsHeaders` response spread (enrich-dish ~8, feed ~6, invalidate-cache ~5) stay unchanged. The other 4 functions use a module-level wildcard `corsHeaders` const (e.g. `app-config:18-22`) — out of scope to change; just leave it.

### supabase-js pinning (D-05) — canonical `https://esm.sh/@supabase/supabase-js@2.39.3`

**Analog (already exactly canonical — LEAVE):** `app-config/index.ts:16`
```ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
```

| Function | line | current | edit |
|----------|------|---------|------|
| `invalidate-cache` | 16 | `esm.sh/@supabase/supabase-js@2` | `@2` → `@2.39.3` |
| `group-recommendations` | 16 | `esm.sh/.../@2` | `@2` → `@2.39.3` |
| `enrich-dish` | 24 | `esm.sh/.../@2` | `@2` → `@2.39.3` |
| `batch-update-preference-vectors` | 16 | `esm.sh/.../@2` | `@2` → `@2.39.3` |
| `update-preference-vector` | 22 | `esm.sh/.../@2` | `@2` → `@2.39.3` |
| `feed` | 13 | `esm.sh/.../@2` | `@2` → `@2.39.3` |
| `menu-scan-worker` | 10 | `npm:@supabase/supabase-js@2` | **style change** → `https://esm.sh/@supabase/supabase-js@2.39.3` (serve wrapper untouched) |

### upstash/redis pinning (D-06) — canonical `https://esm.sh/@upstash/redis@1.38.0`

**Analog (already canonical — LEAVE):** `feed/index.ts:14-15`
```ts
// Pinned (not @latest) for deterministic cold starts — see §S8.
import { Redis } from 'https://esm.sh/@upstash/redis@1.38.0';
```
Only edit: `invalidate-cache/index.ts:17` `@upstash/redis@latest` → `@upstash/redis@1.38.0`.

### Test asserts swap (D-03) — `jsr:@std/assert@1.0.19`

Both test files import from `https://deno.land/std@0.168.0/testing/asserts.ts`; change the source string only, keep the destructured symbols.

`_shared/cors.test.ts:15` (symbols used: `assert`, `assertEquals`, `assertFalse`):
```ts
import {
  assert,
  assertEquals,
  assertFalse,
} from 'https://deno.land/std@0.168.0/testing/asserts.ts';  // → 'jsr:@std/assert@1.0.19'
```
`menu-scan-worker/test.ts:13` (symbols used: `assertEquals`, `assertArrayIncludes`):
```ts
import {
  assertEquals,
  assertArrayIncludes,
} from 'https://deno.land/std@0.168.0/testing/asserts.ts';  // → 'jsr:@std/assert@1.0.19'
```
Both symbols verified exported by `@std/assert@1.0.19` (RESEARCH local probe). No `deno-globals.d.ts` shim needed for `jsr:` (test files run under real Deno); add a 3-line `declare module` only if an editor squiggle actually appears.

### `deno-globals.d.ts` shim edits (D-04)

Full current file is 64 lines. Edits, keyed to verified blocks:

| Lines | Current block | Action |
|-------|---------------|--------|
| 16-18 | `declare module 'https://deno.land/std@0.168.0/http/server.ts' { export function serve(...) }` | **DELETE** (dead after serve swap) |
| 20-23 | `declare module 'https://esm.sh/@supabase/supabase-js@2' { ... }` | **CHANGE KEY** → `'https://esm.sh/@supabase/supabase-js@2.39.3'` |
| 25-32 | `declare module 'https://esm.sh/@upstash/redis@latest' { ... }` | **CHANGE KEY** → `'https://esm.sh/@upstash/redis@1.38.0'` |
| 34-37 | `declare module 'npm:@supabase/supabase-js@2' { ... }` | **DELETE** (no fn uses `npm:@2` after menu-scan-worker moves to esm.sh) |
| 39-63 | `npm:openai@4`, `.../helpers/zod`, `npm:zod@3` | **LEAVE** (out of scope) |

Shim keys MUST match the new import strings exactly or VS Code "cannot find module" errors return.

---

## Pattern Assignments — Track B

### `infra/scripts/lib/prod-guard.ts` (NEW — utility, guard)

**Analog to generalize:** `infra/scripts/apply-phase6-flag-fixes.ts:451-455` — the only script that already embodies D-09/D-10/D-11 (default-dry-run, `--apply` trigger, prints target ref).

```ts
// apply-phase6-flag-fixes.ts:451-455 — the exact target shape to extract
const apply = process.argv.includes('--apply');
const dryRun = process.argv.includes('--dry-run') || !apply;   // default dry-run (D-09); --dry-run is a no-op affirmation (D-10)
console.log(
  `\n=== Phase 6 flag fixes — ${dryRun ? 'DRY RUN (no writes)' : '⚠ APPLYING to ' + process.env.SUPABASE_URL} — ${FIXES.length} fixes ===\n`
);
```

**Generalize to** (Claude's-discretion API; the `{ dryRun }` boolean return matches existing call sites that branch on a `DRY_RUN` const):
- `parseGuard(argv = process.argv): { dryRun: boolean; apply: boolean; projectRef: string; limit: number }`
  - `apply = argv.includes('--apply')`; `dryRun = !apply` (`--dry-run` accepted, never errors — D-10).
  - `projectRef` derived from `process.env.SUPABASE_URL` host (e.g. `https://<ref>.supabase.co` → `<ref>`). **No `SUPABASE_PROJECT_REF` env exists** — use `SUPABASE_URL` only (RESEARCH B.3).
  - `limit` parsed from `--limit=N` and **returned, not consumed** (D-12) — or leave each script's own `--limit` parsing in place; either way the guard must not break it (Pitfall 5).
- `announceTarget(g)` — prints the ref banner loudly before any write, on every run (D-11). Banner must say "DRY RUN — re-run with --apply to write" so the LIVE-default inversion is obvious (Pitfall 3).

**Import conventions to match** (every script uses these — copy verbatim into the guard or assume the caller has run dotenv):
```ts
import 'dotenv/config';                              // apply-phase6-flag-fixes.ts:18 — loaded before main() in every script
const SUPABASE_URL = process.env.SUPABASE_URL ?? ''; // backfill-*.ts pattern
```
Confirmed: `infra/scripts/lib/` does not exist yet — this is the first module under it.

### Write-script retrofits — current dry-run mechanism per script

All run via `ts-node` (shebang `#!/usr/bin/env ts-node` + `package.json` `"ts-node <file>.ts"`), args via `process.argv`. The guard's argv parsing must use `process.argv` (Node, not Deno).

**Group 1 — LIVE-default (7 scripts): flip to default-dry-run (CLI-contract change, D-09).** All share this idiom (e.g. `backfill-cuisine-from-dishes.ts:48`, `seed-cold-start-vectors.ts:43`, `backfill-restaurant-timezone.ts:34`):
```ts
const DRY_RUN = process.argv.includes('--dry-run');   // ← writes UNLESS flagged. Replace with guard's dryRun (default true).
const limitArg = process.argv.find(a => a.startsWith('--limit='));   // KEEP — orthogonal to guard (D-12)
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1] ?? '0', 10) : 0;
```
Per-script: `backfill-cuisine-from-dishes:48` (`--limit` y), `backfill-cuisine-from-google:42` (`--limit` y), `backfill-cuisine-types:35` (`--limit` n), `backfill-open-hours:47` (`--limit` n), `backfill-restaurant-currency:31` (`--limit` y), `backfill-restaurant-timezone:34` (`--limit` y, also `--all:35`), `seed-cold-start-vectors:43` (`--limit` y, mutation is `.upsert(214)`). None print a project ref today → ref-print is net-new for all 7. Several already log a `Mode: DRY RUN / LIVE` line (e.g. `backfill-cuisine-types:157`, `backfill-open-hours:190`, `backfill-restaurant-currency:53`) — reconcile that line with the guard banner.

**Group 2 — net-new gate (1 script): `batch-embed.ts`.** Has **NO** dry-run flag at all; only prints `ENRICH_DISH_URL` (`batch-embed.ts:123`), not a project ref. Mutations are writing RPCs `run_analyze_dishes` (199) + `update_restaurant_vector` (220). Adding the guard here is a brand-new safety gate — wrap both RPC call sites behind `dryRun`.

**Group 3 — reference (1 script): `apply-phase6-flag-fixes.ts`.** Already conformant (lines 451-455). Only edit: replace the inline `apply`/`dryRun`/banner with an import of `./lib/prod-guard.ts` so it consumes the shared source of truth (D-07).

**EXCLUDE (read-only — RESEARCH ⚠️ reclassification):** `replay-menu-scan-ab.ts` (self-documents "does NOT write anything"), `preview-phase6-conversion.ts` (`.select` only, emits `ROLLBACK`). Both were named/suspected in CONTEXT.md but verified read-only — do NOT guard them. Also untouched: all `diagnose-*`, `verify-phase6/7`, `check-favorites-duplicates`, `generate-phase6-flag-checklist`.

---

## Shared Patterns

### Edge specifier convention
**Source:** `app-config/index.ts:16` (supabase-js), `feed/index.ts:15` (upstash)
**Apply to:** all 8 edge functions. Single style = `esm.sh`, exact-pinned. No `@eatme/*` workspace imports in edge code (constraint: enums duplicated inline).

### Shim-lockstep convention
**Source:** `deno-globals.d.ts` (one `declare module` per exact specifier string)
**Apply to:** every Track A import-string change — update the matching shim key in the same commit or VS Code reports phantom errors.

### Prod-write guard idiom
**Source:** `apply-phase6-flag-fixes.ts:451-455`
**Apply to:** all 9 write scripts via `infra/scripts/lib/prod-guard.ts`. Default-dry-run, sole write flag `--apply`, `--dry-run` no-op, announce `SUPABASE_URL` ref before any mutation, never consume `--limit`.

### Script bootstrap idiom
**Source:** `apply-phase6-flag-fixes.ts:18-21` / `backfill-*.ts:41-50`
**Apply to:** consistent `import 'dotenv/config'` then `createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)`; `process.argv` flag parsing; `#!/usr/bin/env ts-node` shebang.

## No Analog Found

None. Every target maps to an in-repo reference. (The optional `infra/scripts/lib/prod-guard.test.ts` would be net-new test infra — `infra/scripts` has no Node test runner today; treat as Claude's-discretion per RESEARCH Wave-0, not a required analog.)

## Metadata

**Analog search scope:** `infra/supabase/functions/**`, `infra/scripts/**`
**Files scanned:** all 8 edge functions + 2 test files + deno-globals.d.ts + 9 write scripts + package.json
**Pattern extraction date:** 2026-06-19
**Line numbers:** RESEARCH-corrected (CONTEXT.md edge line numbers were stale; supabase-js/upstash line numbers were accurate).
