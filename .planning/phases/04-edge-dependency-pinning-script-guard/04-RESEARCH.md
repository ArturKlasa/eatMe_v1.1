# Phase 4: Edge Dependency Pinning & Script Guard - Research

**Researched:** 2026-06-19
**Domain:** Deno edge-function dependency hygiene + Node/ts-node prod-write safety gating
**Confidence:** HIGH (every codebase claim verified against current HEAD; external versions probed with local Deno 2.8.1)

> **Design is locked (D-01–D-12).** This research VERIFIES the codebase claims in CONTEXT.md, RESOLVES the small external/version unknowns, and produces the Validation Architecture. It does NOT redesign. Where CONTEXT.md line numbers/claims drifted, corrections are flagged with ⚠️.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Migrate functions still importing `serve` from `std@0.168.0/http/server.ts` → native `Deno.serve` (mechanical `serve(handler)` → `Deno.serve(handler)`; identical handler signature). `menu-scan-worker` is already on `Deno.serve` — do not touch its serve wrapper.
- **D-02:** Preserve the Phase 2 CORS seam. In `feed`/`enrich-dish`/`invalidate-cache` the handler's first line computes `const corsHeaders = buildCorsHeaders(req.headers.get('Origin'))` and the file imports `../_shared/cors.ts`. The swap changes ONLY the wrapper call — per-request line, import, and every response spread stay byte-for-byte.
- **D-03:** Migrate the 2 test `asserts` imports (`std@0.168.0/testing/asserts.ts`) → `jsr:@std/assert` (exact-pinned). The one place `jsr:` is unavoidable.
- **D-04:** Update `deno-globals.d.ts`: remove the dead `std@0.168.0/http/server.ts` block; collapse supabase-js shims to a single `esm.sh/@supabase/supabase-js@2.39.3`; change upstash shim `@latest` → `@1.38.0`. Shim keys MUST match new specifier strings exactly.
- **D-05:** Canonical `@supabase/supabase-js` = `https://esm.sh/@supabase/supabase-js@2.39.3` — one style (esm.sh), one version, across ALL functions. Roadmap "JSR" wording treated as aspirational (recorded deviation).
- **D-06:** `@upstash/redis` pinned to `@1.38.0` everywhere (matches `feed`). No version bump.
- **D-07:** New shared helper `infra/scripts/lib/prod-guard.ts` (first module under `infra/scripts/lib/`). One source of truth for default-dry-run gating, the `--apply` write trigger, and printing the target project ref before any mutation. Every write-path script imports + calls it.
- **D-08:** Guard ALL write-path scripts (~11), classified by actual mutation calls (insert/update/upsert/delete/writing-RPC) NOT by service-role usage. Read-only scripts stay untouched.
- **D-09:** Flip every guarded script to default-dry-run. Writing always requires the explicit flag.
- **D-10:** Write flag = `--apply`. `--dry-run` kept as an accepted no-op (must never error).
- **D-11:** Print the project ref before any mutation. `batch-embed` has NO dry-run path today → net-new gate.
- **D-12:** Preserve dry-run → sample (`--limit`) → full. Order: default dry-run; `--limit` narrows in either mode; `--apply` required to write.

### Claude's Discretion
- Exact `prod-guard.ts` API shape (`parseGuard(argv)` returning `{ dryRun, projectRef }` vs `requireProdWriteClearance()` that throws) and project-ref banner format.
- Exact `@std/assert` version to pin (any current exact `jsr:@std/assert@1.x`). **→ RESOLVED below: 1.0.19.**
- Whether to add a tiny smoke test for `prod-guard.ts` (only if it cheaply de-risks). **→ RECOMMENDATION below.**
- Whether the guard reads project ref from `SUPABASE_URL` host or a dedicated `SUPABASE_PROJECT_REF` env — pick what scripts already have. **→ RESOLVED below: `SUPABASE_URL` (no `SUPABASE_PROJECT_REF` exists).**

### Deferred Ideas (OUT OF SCOPE)
- Pin `npm:openai@4` in `menu-scan-worker` (not in DEBT-05).
- Full Deno std → JSR modernization beyond `serve` + `testing/asserts` (QUAL-V2-02).
- Lock the other 4 wildcard edge functions' CORS (`app-config`, `group-recommendations`, `update-preference-vector`, `batch-update-preference-vectors`) — carried from Phase 2.
- A contributing-docs convention requiring every new write script to call `prod-guard`.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEBT-05 | Edge-function deps pinned: `std@0.168.0/http/server` → `Deno.serve`; `@supabase/supabase-js` one exact version; `@upstash/redis` exact-pinned across all functions | Verified import inventory (Track A table), confirmed `Deno.serve` native + mechanical swap, resolved `@std/assert@1.0.19`, confirmed canonical esm.sh@2.39.3 + upstash@1.38.0 reference pins |
| SEC-03 | `infra/scripts` prod-mutation scripts refuse any write path without explicit dry-run/confirmation clearance | Verified definitive write-set (8 scripts) vs read-only-set, per-script dry-run mechanism inventory, extracted `apply-phase6-flag-fixes` guard pattern, confirmed `SUPABASE_URL`-only ref source + run-via-ts-node |
</phase_requirements>

---

## Summary

Phase 4 is two low-risk plumbing tracks. **Track A** swaps the deprecated `std@0.168.0/http/server` `serve` for native `Deno.serve` in the edge functions, migrates 2 test `asserts` imports to `jsr:@std/assert@1.0.19`, and unifies supabase-js / upstash-redis specifiers to single exact pins. **Track B** introduces `infra/scripts/lib/prod-guard.ts` and retrofits every prod-write script to default-dry-run + explicit `--apply` + print-the-target-ref.

All codebase claims in CONTEXT.md were re-verified against current HEAD. **Two material drifts were found** (see ⚠️ DISCREPANCIES below): the function count is **7, not 8**, and `replay-menu-scan-ab.ts` — named in F-12 and listed in D-08 — is actually **read-only** (it self-documents "It does NOT write anything"). Both must be corrected in the plan. All CONTEXT.md line numbers were also stale by a few lines (Phase 2/3 edits shifted them); corrected line numbers are given throughout.

The external unknowns are resolved with HIGH confidence using local Deno 2.8.1: `jsr:@std/assert@1` resolves to **1.0.19**, exports all 5 symbols the two tests use, and `deno test --node-modules-dir=none -A` downloads/resolves it cleanly; `Deno.serve` is a native stable function in the runtime.

**Primary recommendation:** Execute Track A as a pure find/replace per the verified table below (7 functions for the serve swap, 7 functions for the supabase-js rewrite incl. the menu-scan-worker specifier-style change, 1 function for upstash, 2 test files for asserts, 1 shim file). Execute Track B by generalizing the exact `apply-phase6-flag-fixes.ts` guard idiom into `prod-guard.ts`, then retrofitting the **8 confirmed write scripts** — flipping the 7 LIVE-default backfills/seed and adding a net-new gate to `batch-embed`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| HTTP request handling in edge fns | Supabase Edge (Deno runtime) | — | `serve`/`Deno.serve` is the Deno-runtime entrypoint; swap is runtime-tier only |
| Dependency version resolution (cold start) | Supabase Edge (Deno runtime) | — | Remote specifiers resolved at edge cold-start; pinning is a runtime determinism concern |
| IDE type shims (`deno-globals.d.ts`) | Dev tooling (VS Code tsserver) | — | Pure editor ergonomics; not a runtime artifact, but must track specifier strings |
| Prod-write gating | Operator CLI tooling (Node/ts-node) | — | `infra/scripts` are operator-run Node scripts hitting prod with service-role; the guard is a CLI-tier safety control |
| Deno test execution | Local dev (Deno test runner) | — | `deno test --node-modules-dir=none -A`; deno at `~/.deno/bin` |

---

## ⚠️ DISCREPANCIES — CONTEXT.md vs current HEAD (READ FIRST)

These are the corrections the planner MUST apply. The locked *decisions* remain valid; only the *facts they reference* drifted.

### ⚠️ D-1 — The count is **7 functions**, not 8.
**[VERIFIED: grep on HEAD]** `grep "deno.land/std@0.168.0/http/server"` returns exactly **7** index.ts files still importing `serve`: `app-config`, `group-recommendations`, `invalidate-cache`, `enrich-dish`, `feed`, `batch-update-preference-vectors`, `update-preference-vector`. D-01's *prose* says "all 8 functions" but its *name list* lists exactly these 7 (it excludes `menu-scan-worker`, which is already on `Deno.serve`). **The 7-name list is correct; the "8" is a counting error.** Total functions in the directory = 8, of which 1 (`menu-scan-worker`) is already migrated → **7 need the swap.** Planner: write "7 functions" everywhere.

### ⚠️ D-08 — `replay-menu-scan-ab.ts` is **READ-ONLY**, not a write script.
**[VERIFIED: file header line 8 + body grep]** Despite being named in F-12 as a prod-mutation example and listed as a D-08 candidate, `replay-menu-scan-ab.ts:8` states *"It does NOT write anything. It reads the job + its source images from prod"* and line 256 confirms *"(read-only — nothing written)"*. Its only `.from('menu_scan_jobs')` call (line 237) is a `.select()`; it `.download()`s storage and calls OpenAI. **It has zero insert/update/upsert/delete and no writing RPC.** → **EXCLUDE from the guard set.** This drops the write-set from the "~11" estimate to **8**.

### ⚠️ D-08 — `preview-phase6-conversion.ts` is **READ-ONLY** (the D-08 "verify" suspicion is correct).
**[VERIFIED: grep]** Only `.select()` reads; it emits SQL text ending in `ROLLBACK` (line 153). No mutation calls. → **EXCLUDE.**

### ⚠️ All CONTEXT.md edge-function line numbers are stale by a few lines.
Phase 2/3 edits shifted them. Corrected line numbers are in the Track A tables below. The *specifiers* CONTEXT.md cited are all still accurate; only the line numbers moved.

### ⚠️ Only `apply-phase6-flag-fixes.ts` prints the target ref today.
**[VERIFIED: grep]** Of all write scripts, only `apply-phase6-flag-fixes.ts` prints `SUPABASE_URL` before writing (line 455). The 7 backfills/seed and `batch-embed` do **NOT** print any project ref today → D-11's "print the ref" is net-new behavior for 8 of the 8 write scripts except the one reference script. (`verify-phase7.ts`/`verify-phase6.ts` print URLs but are read-only and out of scope.)

---

## Track A — Edge Dependency Pinning (DEBT-05)

### A.1 — `serve` → `Deno.serve` migration inventory [VERIFIED: grep on HEAD]

7 functions need the swap. The swap is `import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';` **deleted** and `serve(` → `Deno.serve(` at the call site. Handler bodies unchanged.

| Function | `import serve` line (delete) | `serve(` call-site line (→ `Deno.serve(`) | Handler signature | CORS seam (D-02)? |
|----------|------------------------------|-------------------------------------------|-------------------|-------------------|
| `app-config` | 15 | 32 (`serve(async req => {`) | `(req) => …` | NO — module-level `corsHeaders` (wildcard) |
| `group-recommendations` | 15 | 182 (`serve(async (req: Request) => {`) | `(req: Request) => …` | NO — module-level `corsHeaders` |
| `invalidate-cache` | 15 | 45 (`serve(async (req: Request) => {`) | `(req: Request) => …` | **YES — per-request `buildCorsHeaders` (line 46)** |
| `enrich-dish` | 23 | 103 (`serve(async (req: Request) => {`) | `(req: Request) => …` | **YES — per-request `buildCorsHeaders` (line 104)** |
| `feed` | 12 | 702 (`serve(async (req: Request) => {`) | `(req: Request) => …` | **YES — per-request `buildCorsHeaders` (line 703)** |
| `batch-update-preference-vectors` | 15 | 41 (`serve(async (req: Request) => {`) | `(req: Request) => …` | NO — module-level `corsHeaders` |
| `update-preference-vector` | 21 | 183 (`serve(async (req: Request) => {`) | `(req: Request) => …` | NO — module-level `corsHeaders` |

**`menu-scan-worker`** — already `Deno.serve(async req => {` at line 1056 [VERIFIED]. **DO NOT touch its serve wrapper.** (D-05 still normalizes its supabase-js *import* — see A.3.)

**D-02 nuance the planner must respect:** Only `feed`/`enrich-dish`/`invalidate-cache` use the Phase 2 per-request `buildCorsHeaders(req.headers.get('Origin'))` seam + `../_shared/cors.ts` import. The other 4 functions use a **module-level `corsHeaders` constant** (the old wildcard — confirming the Deferred "lock the other 4 wildcard functions' CORS" item; that is NOT this phase). For all 7, the swap touches ONLY the wrapper call + the deleted import line — no handler-body lines change. For the 3 seam functions specifically, verify the `corsHeaders` first line, the `cors.ts` import, and every `...corsHeaders` response spread are byte-for-byte unchanged (enrich-dish has ~8 spreads, feed ~6, invalidate-cache ~5 — see grep evidence).

### A.2 — `Deno.serve` is a safe mechanical swap [VERIFIED: local Deno 2.8.1]
- `Deno.serve` is a **native stable** runtime function: `deno eval "typeof Deno.serve"` → `function` on Deno 2.8.1. `Deno.serve(handler)` accepts the same handler shape `(req: Request) => Response | Promise<Response>` the std `serve` used. [CITED: deno.land — `Deno.serve` is the recommended native HTTP server API; `std/http/server`'s `serve` was deprecated and removed in later std]
- The existing migrated function (`menu-scan-worker:1056`) already proves the form works in the Supabase edge runtime: `Deno.serve(async req => { … })`. The swap is byte-identical except the wrapper name.
- **No signature/behavior change.** `Deno.serve(handler)` ignores the void return (std `serve` returned `void` / a Promise that never resolves; `Deno.serve` returns an `HttpServer` that the functions don't capture). The handlers already `return new Response(...)` — fully compatible.

### A.3 — supabase-js pinning (D-05) [VERIFIED: grep on HEAD]
**Canonical = `https://esm.sh/@supabase/supabase-js@2.39.3`** (reference: `app-config/index.ts:16`, already exactly this — LEAVE).

| Function | supabase-js line | Current specifier | Change |
|----------|------------------|-------------------|--------|
| `app-config` | 16 | `esm.sh/@supabase/supabase-js@2.39.3` | **none (reference)** |
| `invalidate-cache` | 16 | `esm.sh/@supabase/supabase-js@2` | pin `@2` → `@2.39.3` |
| `group-recommendations` | 16 | `esm.sh/@supabase/supabase-js@2` | pin `@2` → `@2.39.3` |
| `enrich-dish` | 24 | `esm.sh/@supabase/supabase-js@2` | pin `@2` → `@2.39.3` |
| `batch-update-preference-vectors` | 16 | `esm.sh/@supabase/supabase-js@2` | pin `@2` → `@2.39.3` |
| `update-preference-vector` | 22 | `esm.sh/@supabase/supabase-js@2` | pin `@2` → `@2.39.3` |
| `feed` | 13 | `esm.sh/@supabase/supabase-js@2` | pin `@2` → `@2.39.3` |
| `menu-scan-worker` | 10 | `npm:@supabase/supabase-js@2` | **style change** `npm:@2` → `esm.sh/.../@2.39.3` |

All CONTEXT.md D-05 line numbers verified accurate. → 6 esm.sh pins + 1 specifier-style change + 1 reference = all 8 functions on the single canonical specifier.

### A.4 — upstash/redis pinning (D-06) [VERIFIED: grep on HEAD]
**Canonical = `https://esm.sh/@upstash/redis@1.38.0`** (reference: `feed/index.ts:15`, already this — LEAVE).

| Function | upstash line | Current | Change |
|----------|--------------|---------|--------|
| `feed` | 15 | `@upstash/redis@1.38.0` | **none (reference)** |
| `invalidate-cache` | 17 | `@upstash/redis@latest` | `@latest` → `@1.38.0` |

Only `invalidate-cache` and `feed` import upstash; only `invalidate-cache` changes. CONTEXT.md line numbers verified accurate.

### A.5 — Test `asserts` migration (D-03) [VERIFIED: grep + local probe]
2 test files import from `std@0.168.0/testing/asserts.ts`:

| Test file | Current import line | Symbols actually used | New import |
|-----------|---------------------|------------------------|------------|
| `_shared/cors.test.ts` | 15 | `assert`, `assertEquals`, `assertFalse` | `jsr:@std/assert@1.0.19` |
| `menu-scan-worker/test.ts` | 13 | `assertEquals`, `assertArrayIncludes` | `jsr:@std/assert@1.0.19` |

**[VERIFIED: local Deno 2.8.1]** `jsr:@std/assert@1` resolves to **`1.0.19`** (`deno info jsr:@std/assert@1` → `jsr.io/@std/assert/1.0.19/mod.ts`). A `deno run` importing `{ assert, assertEquals, assertFalse, assertArrayIncludes, assertExists }` from `jsr:@std/assert@1` printed `ALL_SYMBOLS_OK` — **all symbols the two tests use are exported.** Both `jsr:@std/assert@1` (floating-major) and `jsr:@std/assert@1.0.19` (exact) resolve. Per D-03 + Claude's-Discretion, pin **exact** for determinism: **`jsr:@std/assert@1.0.19`**. [VERIFIED: jsr registry — latest stable is 1.0.19]

> Note: CONTEXT.md / DISCUSSION-LOG misreferences "(D-03/D-08…D-11)" inside `cors.test.ts:5-9` — those are the *cors.test.ts file's own* decision tags from Phase 2, not Phase 4 decisions. Ignore; they're documentation inside the test, unrelated to this phase's D-03.

### A.6 — `deno-globals.d.ts` shim edits (D-04) [VERIFIED: full file read]
Current shim blocks (`infra/supabase/functions/deno-globals.d.ts`, 64 lines):

| Lines | Block | Action |
|-------|-------|--------|
| 16–18 | `declare module 'https://deno.land/std@0.168.0/http/server.ts'` (exports `serve`) | **DELETE** (dead after Track A; `Deno.serve` needs no module shim — `Deno` is declared at lines 6–11) |
| 20–23 | `declare module 'https://esm.sh/@supabase/supabase-js@2'` | **CHANGE KEY** → `'https://esm.sh/@supabase/supabase-js@2.39.3'` |
| 34–37 | `declare module 'npm:@supabase/supabase-js@2'` | **DELETE** (no function imports `npm:@2` after D-05; `menu-scan-worker` moves to esm.sh) |
| 25–32 | `declare module 'https://esm.sh/@upstash/redis@latest'` | **CHANGE KEY** → `'https://esm.sh/@upstash/redis@1.38.0'` |
| 39–63 | `npm:openai@4`, `npm:openai@4/helpers/zod`, `npm:zod@3` blocks | **LEAVE** (menu-scan-worker openai/zod — out of scope, Deferred) |

Result: one supabase-js shim (`@2.39.3`), one upstash shim (`@1.38.0`), no `serve` shim, no `npm:@supabase` shim. **Shim keys MUST exactly match the new import strings** or VS Code "cannot find module" errors return (D-04). No `@std/assert` shim is needed — deno-globals.d.ts is a *VS Code* shim only; the test files run under real Deno which resolves `jsr:` natively (no editor errors because tsserver doesn't type-check the jsr import the same way, and these are .test.ts files; if an editor error appears, a 3-line `declare module 'jsr:@std/assert@1.0.19'` block can be added — judge after the change).

---

## Track B — Script Guard (SEC-03 / F-12)

### B.1 — Definitive write-set vs read-only-set [VERIFIED: mutation-call grep per file]

Classification by actual mutation calls (`.insert(` / `.update(` / `.upsert(` / `.delete(` / writing `.rpc(`), per D-08 — NOT by service-role usage.

**WRITE-PATH SCRIPTS (8) — must import + call the guard:**

| Script | Mutation evidence (file:line) | Current dry-run mechanism | Prints ref today? |
|--------|-------------------------------|---------------------------|-------------------|
| `apply-phase6-flag-fixes.ts` | `.insert` (495, 513), `.delete` (524) | **dry-run-DEFAULT** — `apply = argv.includes('--apply')`; `dryRun = argv.includes('--dry-run') || !apply` (452–453) | **YES** — prints `SUPABASE_URL` in banner (455). **This is the reference pattern (D-07).** |
| `backfill-cuisine-from-dishes.ts` | `.update` (263) | **LIVE-default** — `DRY_RUN = argv.includes('--dry-run')` (48); writes unless `--dry-run`. Has `--limit` (49–50) | NO |
| `backfill-cuisine-from-google.ts` | `.update` (314) | **LIVE-default** (42); has `--limit` (43–44) | NO |
| `backfill-cuisine-types.ts` | `.update` (226) | **LIVE-default** (35); no `--limit` | NO |
| `backfill-open-hours.ts` | `.update` (174) | **LIVE-default** (47); no `--limit` | NO |
| `backfill-restaurant-currency.ts` | `.update` (85) | **LIVE-default** (31); has `--limit` (32–33) | NO |
| `backfill-restaurant-timezone.ts` | `.update` (106) | **LIVE-default** (34); has `--limit` (36–37), `--all` (35) | NO |
| `seed-cold-start-vectors.ts` | `.upsert` (214) | **LIVE-default** (43); has `--limit` (44–45) | NO |
| `batch-embed.ts` | writing RPCs `run_analyze_dishes` (199), `update_restaurant_vector` (220) | **NONE — no dry-run flag at all** (D-11: net-new gate) | NO (prints `ENRICH_DISH_URL` only, 123) |

> That is 9 rows = `apply-phase6` (reference, already conformant) + 8 to retrofit. If counting "scripts needing a CLI-contract change," it's **8** (the 7 LIVE-default + `batch-embed`); `apply-phase6` already matches the target and only needs to switch its inline logic to importing the shared helper (D-07).

**READ-ONLY SCRIPTS (untouched):**

| Script | Why read-only |
|--------|---------------|
| `replay-menu-scan-ab.ts` | ⚠️ **Reclassified** — self-documents "does NOT write anything" (8, 256); only `.select` + storage `.download` + OpenAI |
| `preview-phase6-conversion.ts` | ⚠️ **Reclassified** — only `.select`; emits SQL ending in `ROLLBACK` (153) |
| `verify-phase7.ts` | RPCs are probes with garbage args (NOT_FOUND/SOURCE_NOT_FOUND expected); "read-only — nothing written" (110) |
| `verify-phase6.ts` | no mutation calls |
| `check-favorites-duplicates.ts` | no mutation calls |
| `generate-phase6-flag-checklist.ts` | no mutation calls |
| `diagnose-empty-cuisine.ts` | no mutation calls |
| `diagnose-no-dishes.ts` | only `.rpc('generate_candidates')` — read-only candidate query |
| `diagnose-open-now.ts` | no mutation calls |
| `diagnose-s3-open-hours.ts` | only `.rpc('generate_candidates')` — read-only |
| `diagnose-scan-quality-trend.ts` | no mutation calls |

### B.2 — Reference guard pattern to generalize (D-07) [VERIFIED: apply-phase6-flag-fixes.ts:452–455]
```ts
// apply-phase6-flag-fixes.ts — the exact target shape (lines 452–455)
const apply = process.argv.includes('--apply');
const dryRun = process.argv.includes('--dry-run') || !apply;
console.log(
  `\n=== Phase 6 flag fixes — ${dryRun ? 'DRY RUN (no writes)' : '⚠ APPLYING to ' + process.env.SUPABASE_URL} — ${FIXES.length} fixes ===\n`
);
```
This already embodies D-09/D-10/D-11: default-dry-run (`|| !apply`), `--apply` write trigger, prints the prod target (`SUPABASE_URL`) before applying. **Generalize verbatim into `infra/scripts/lib/prod-guard.ts`.**

### B.3 — Confirmed environment facts for the guard [VERIFIED]
- **No `infra/scripts/lib/` directory exists** → `prod-guard.ts` is the first module under it (matches D-07).
- **Project-ref source:** scripts read `process.env.SUPABASE_URL` (e.g. `apply-phase6:21`, `batch-embed`, all backfills). **No `SUPABASE_PROJECT_REF` env exists anywhere.** → Guard derives the ref from `SUPABASE_URL` (the host, e.g. `https://<ref>.supabase.co`). [VERIFIED: grep — only `SUPABASE_URL` present]
- **Run method:** all scripts are run via **`ts-node`** — shebang `#!/usr/bin/env ts-node` on every script, and `package.json` scripts are `"ts-node <file>.ts"`. Args come through `process.argv` (Node). The guard's argv parsing must use `process.argv` (NOT Deno args). [VERIFIED: package.json + shebangs]
- **`.env` location:** `infra/scripts/.env` holds `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (+ OpenAI/Google keys), loaded via `dotenv`. The guard reads `process.env.SUPABASE_URL` after dotenv config (already loaded by each script before main()).

### B.4 — Guard contract the planner should specify (synthesized from D-09–D-12)
- **Default dry-run.** Absent `--apply`, no mutation client method is reached. (Inverts the 7 LIVE-default scripts; net-new for `batch-embed`.)
- **`--apply`** is the sole write trigger.
- **`--dry-run`** is accepted as a no-op (never errors) — re-affirms the new default (D-10).
- **`--limit=N`** sampling is preserved untouched and orthogonal to apply/dry-run (D-12). The guard must NOT consume/break `--limit`; scripts keep their own `--limit` parsing (or the guard returns it — Claude's discretion).
- **Always print the resolved project ref** (from `SUPABASE_URL` host) prominently before any write, on every run.
- **Suggested API (Claude's discretion):** `parseGuard(argv): { dryRun: boolean; apply: boolean; projectRef: string }` plus a `announceTarget()` that prints the banner — least churn vs the reference script's inline form. A throwing `requireProdWriteClearance()` is also fine but the scripts currently branch on a boolean, so a returned `{dryRun}` matches existing call sites better.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Deno HTTP server | A custom `serve` wrapper or keep std `serve` | native `Deno.serve` | std `http/server` `serve` is deprecated/removed; native is the supported path (D-01) |
| Deno test assertions | esm.sh or hand-rolled asserts | `jsr:@std/assert@1.0.19` | the canonical non-deprecated assertion lib; no esm.sh equivalent for std *testing* (D-03) |
| Per-script prod-write gating | Re-implementing argv/dry-run/ref-print in each script | shared `infra/scripts/lib/prod-guard.ts` | one source of truth; mirrors the `_shared/cors.ts` DRY precedent (D-07) |

---

## Common Pitfalls

### Pitfall 1: Breaking the Phase 2 CORS seam during the serve swap
**What goes wrong:** A careless replace that also touches the handler's first lines drops or alters the per-request `const corsHeaders = buildCorsHeaders(...)` line in feed/enrich-dish/invalidate-cache → reintroduces the SEC-01 wildcard regression.
**How to avoid:** Replace ONLY the `import { serve } ...` line (delete) and the `serve(` token (→ `Deno.serve(`). Diff each of the 3 seam files and confirm zero changes below the wrapper line. Re-run `cors.test.ts` after.
**Warning sign:** any diff hunk in feed/enrich-dish/invalidate-cache that isn't exactly the import-delete + `serve(`→`Deno.serve(`.

### Pitfall 2: Shim key drift in `deno-globals.d.ts`
**What goes wrong:** The shim `declare module '...'` key no longer matches the new import string → VS Code "cannot find module" errors return (cosmetic but noisy).
**How to avoid:** Edit shim keys in lockstep with every specifier change (D-04). The new keys must be exactly `https://esm.sh/@supabase/supabase-js@2.39.3` and `https://esm.sh/@upstash/redis@1.38.0`.
**Warning sign:** editor red squiggles on the import lines after the change.

### Pitfall 3: Inverting LIVE-default scripts silently
**What goes wrong:** Flipping `backfill-*`/`seed-cold-start-vectors` to dry-run-default changes their CLI contract — an operator's old `ts-node backfill-cuisine-from-dishes.ts` (which used to write) now no-ops. If undocumented, the operator thinks the backfill "did nothing."
**How to avoid:** D-09 mandates documenting the inversion in each script header + the guard rollout. The dry-run banner must make the new default loud ("DRY RUN — re-run with --apply to write").
**Warning sign:** operator reports "the backfill ran but nothing changed."

### Pitfall 4: Misclassifying read-only scripts as writes (and vice-versa)
**What goes wrong:** Adding the guard to `replay-menu-scan-ab.ts` / `preview-phase6-conversion.ts` (read-only) needlessly changes their UX; or missing a real writer. Classifying by service-role-key usage (all scripts use it) is the trap.
**How to avoid:** Use the verified B.1 table — classification is by actual mutation calls. `replay` and `preview` are read-only (reclassified vs CONTEXT.md).

### Pitfall 5: Guard swallowing `--limit`
**What goes wrong:** If the guard's argv parser strips/ignores `--limit=N`, the dry-run→sample→full workflow (D-12) breaks.
**How to avoid:** Keep `--limit` parsing where it is (in each script) OR have the guard pass it through untouched. Verify a `--dry-run --limit=5` run still narrows.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `import { serve } from "std/http/server.ts"` | native `Deno.serve(handler)` | Deno 1.35+ stabilized; std `serve` deprecated then removed | This phase's Track A |
| `std@x/testing/asserts.ts` (deno.land/std) | `jsr:@std/assert` | std migrated to JSR (`@std/*`); deno.land/std frozen | This phase's Track A test imports (D-03) |
| Floating specifiers (`@supabase/supabase-js@2`, `@upstash/redis@latest`) | exact pins | best practice for deterministic edge cold starts | This phase's Track A (D-05/D-06) |

**Deprecated/outdated:** `https://deno.land/std@0.168.0/http/server.ts` (whole module path), `https://deno.land/std@0.168.0/testing/asserts.ts`, `@upstash/redis@latest`, unpinned `@supabase/supabase-js@2` / `npm:@supabase/supabase-js@2`.

---

## Validation Architecture

> nyquist_validation is enabled (no `.planning/config.json` opt-out found). This section feeds VALIDATION.md.

### Test Framework
| Property | Value |
|----------|-------|
| Framework (edge) | Deno test runner (built-in), Deno **2.8.1** at `~/.deno/bin/deno` (NOT on PATH) |
| Framework (scripts) | none today — Node/ts-node scripts; no test harness in `infra/scripts` |
| Edge config file | none — tests are standalone `*.test.ts` / `test.ts` run by path |
| Quick run (one test) | `~/.deno/bin/deno test --node-modules-dir=none -A <path>` |
| Full edge suite | run both test files (there are only 2 — see below) |

### Phase Requirements → Test Map
| Req | Behavior | Test Type | Automated Command | Exists? |
|-----|----------|-----------|-------------------|---------|
| DEBT-05 | `cors.test.ts` still passes after asserts→jsr swap + serve swap to its 3 seam fns | unit (Deno) | `deno test --node-modules-dir=none -A infra/supabase/functions/_shared/cors.test.ts` | ✅ exists |
| DEBT-05 | `menu-scan-worker/test.ts` still passes after asserts→jsr swap + supabase-js style change | unit (Deno) | `deno test --node-modules-dir=none -A infra/supabase/functions/menu-scan-worker/test.ts` | ✅ exists |
| DEBT-05 | The 5 functions WITHOUT tests compile under the edge runtime after the swap | compile-check | `deno check --node-modules-dir=none infra/supabase/functions/<fn>/index.ts` per fn | ❌ no per-fn test (compile-check substitutes) |
| DEBT-05 | No `std@0.168.0/http/server` import remains | grep assertion | `! grep -rn "std@0.168.0/http/server" infra/supabase/functions` (only deno-globals.d.ts removed too) → expect 0 | n/a |
| DEBT-05 | All supabase-js specifiers are exactly `esm.sh/@supabase/supabase-js@2.39.3` | grep assertion | `grep -rn "supabase-js" infra/supabase/functions/*/index.ts` → every line `@2.39.3` esm.sh | n/a |
| DEBT-05 | All `@upstash/redis` are `@1.38.0` (no `@latest`) | grep assertion | `! grep -rn "upstash/redis@latest" infra/supabase/functions` → 0 | n/a |
| DEBT-05 | Both test files import `jsr:@std/assert@1.0.19`, no `testing/asserts.ts` | grep assertion | `! grep -rn "testing/asserts" infra/supabase/functions` → 0 | n/a |
| SEC-03 | Guarded script absent `--apply` reaches no mutation method (default dry-run) | behavior (local, no prod) | run each guarded script with no flag → asserts "DRY RUN" banner, zero writes (point `.env` at a throwaway/empty URL or assert the dry-run branch is taken before any client call) | ❌ Wave 0 if test desired |
| SEC-03 | Project ref prints before any mutation | behavior (local) | run with `--apply` against a safe target → banner shows the `SUPABASE_URL` host before writes | manual/grep |
| SEC-03 | `--limit=N` still narrows in either mode | behavior (local) | `--dry-run --limit=5` lists ≤5 candidates | manual |
| SEC-03 | `--dry-run` is an accepted no-op (never errors) | behavior (local) | run with `--dry-run` → exits 0, no write | manual |

### Sampling Rate
- **Per task commit:** the relevant single `deno test ... <path>` for any edge file touched; for a script change, a `--dry-run` smoke of that script.
- **Per wave/track merge:** both Deno test files green + all grep assertions return 0 (Track A); a `--dry-run` (no `--apply`) run of each guarded script asserting the DRY-RUN banner + ref print (Track B).
- **Phase gate:** all grep assertions clean, both Deno tests pass, guard behavior verified locally; THEN operator deploys + smoke-tests.

### Operator-gated boundary (stage-don't-apply)
Validated **locally** (Claude): Deno compile + the 2 existing Deno tests + grep assertions + guard dry-run behavior with no prod write.
Validated **by operator** (on deploy): **one real call per migrated function** (SC#4) — confirms each function cold-starts on the new pinned deps in the live edge runtime. The operator also runs the actual prod-write scripts with `--apply` when they next need a backfill (that exercise is operational, not a phase gate).

### Wave 0 Gaps
- [ ] (Optional, Claude's-discretion D / CONTEXT.md) `infra/scripts/lib/prod-guard.test.ts` — a tiny Node test of `parseGuard(argv)`: asserts (1) no flag → `dryRun:true`; (2) `--apply` → `dryRun:false`; (3) `--dry-run` → `dryRun:true` (no throw); (4) project ref derived from a sample `SUPABASE_URL`. **ROI recommendation: WORTH IT** — the guard is a *safety* control whose failure mode is "silently writes to prod," exactly the SEC-03 risk; a ~20-line pure-function test cheaply de-risks the one piece of net-new logic. But `infra/scripts` has no Node test runner today, so this requires adding one (e.g. `node --test` with `ts-node`/`tsx`, or a plain assert script run via ts-node) — judge that setup cost at plan time; if the harness add is non-trivial, a documented manual dry-run check per script is acceptable given the solo/minimal-test posture.
- [ ] No framework install needed for the **edge** side — Deno's test runner is built in; only ensure `~/.deno/bin` is on PATH for the run (`export PATH="$HOME/.deno/bin:$PATH"`).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Deno | SC#4 edge compile + Deno tests | ✓ | 2.8.1 (at `~/.deno/bin/deno`, not on PATH) | export PATH before running |
| `jsr:@std/assert` | D-03 test imports | ✓ (resolves over network) | 1.0.19 | none — jsr is required for std testing |
| `Deno.serve` (native) | D-01 | ✓ | native in 2.8.1 | none needed |
| ts-node | running `infra/scripts` | ✓ (devDep in infra/scripts/package.json `^10.9.2`) | per lockfile | tsx |
| Node | running `infra/scripts` | ✓ | (host node) | — |
| Network (jsr.io / esm.sh) | first `deno test`/cold start to fetch deps | ✓ | — | Deno caches after first fetch |

**Missing dependencies with no fallback:** none.
**Note:** `deno` must be invoked via `~/.deno/bin/deno` or with `PATH` exported — it is NOT on PATH by default (memory `edge_fn_deno_tests`).

## Security Domain

> `security_enforcement` assumed enabled. SEC-03 is itself a security control.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Secure SDLC / Supply chain | **yes** | Exact dependency pinning (D-05/D-06) — prevents a breaking/ malicious patch from silently entering at edge cold start (the core DEBT-05 supply-chain hardening) |
| V5 Input Validation | partial | Guard validates the `--apply` invariant before any write |
| V14 Config | **yes** | Default-dry-run + explicit-confirm + announce-target is a fail-safe-default config control (SEC-03) |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Floating/`@latest` specifier pulls a breaking or malicious version at cold start | Tampering | Exact version pins (D-05/D-06) — this phase |
| Operator accidentally writes to wrong/prod project | Tampering / Repudiation | Print target ref + require `--apply` + default dry-run (SEC-03) |
| Silent write because default was LIVE | Tampering | Flip to default-dry-run (D-09) |

**Note:** Dependency legitimacy — `@supabase/supabase-js`, `@upstash/redis`, `@std/assert` are all canonical, long-established packages from official sources (Supabase, Upstash, Deno std). No new/unknown packages are introduced; no slopsquatting risk. (No package-legitimacy table needed — these are incumbents already in the codebase, only their version strings change.)

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | (none) | — | All claims verified against HEAD or probed with local Deno 2.8.1 / jsr registry. |

**Empty by design:** every Track A line number was grep-verified; every script classification was mutation-call-verified; `@std/assert@1.0.19` + symbol exports + `Deno.serve` were probed locally.

## Open Questions

1. **Should `prod-guard.test.ts` be added (and does it justify adding a Node test runner to `infra/scripts`)?**
   - What we know: the guard is pure-function-testable and is a safety control; `infra/scripts` has zero test infra today.
   - Recommendation: add the tiny test IF a no-friction runner is available (`node --test` via ts-node, or a plain ts-node assert script); otherwise document a manual `--dry-run`-then-`--apply` check. Resolved at plan time (Claude's discretion).

2. **Does `jsr:@std/assert@1.0.19` need a `deno-globals.d.ts` shim for VS Code?**
   - What we know: deno-globals is a VS-Code-only shim; the test files run under real Deno (resolves jsr natively). The current shim file has no jsr block and no test-import shim today.
   - Recommendation: leave it out; add a 3-line `declare module 'jsr:@std/assert@1.0.19'` only if an editor error actually appears after the change. Low risk.

## Sources

### Primary (HIGH confidence)
- Local Deno 2.8.1 (`~/.deno/bin/deno`): `deno info jsr:@std/assert@1` → resolves `1.0.19`; symbol-import probe → `ALL_SYMBOLS_OK`; `typeof Deno.serve` → `function`.
- Current HEAD grep across `infra/supabase/functions/**` and `infra/scripts/**` — every import line, call-site, mutation call, and dry-run mechanism cited file:line.
- `apply-phase6-flag-fixes.ts:452–455` — verified reference guard pattern.
- `deno-globals.d.ts` (full read) — verified shim blocks.
- `_shared/cors.test.ts` / `menu-scan-worker/test.ts` — verified assertion symbols used.

### Secondary (MEDIUM confidence)
- [jsr.io @std/assert] — latest stable 1.0.19. https://jsr.io/@std/assert
- [Deno docs] — `Deno.serve` native stable API; std `http/server` `serve` deprecated.

## Metadata

**Confidence breakdown:**
- Track A inventory (lines/specifiers): HIGH — grep-verified on HEAD.
- `@std/assert` version + symbols + `Deno.serve`: HIGH — probed with local Deno 2.8.1.
- Track B write/read classification: HIGH — verified by mutation-call grep, not service-role usage.
- Guard pattern + env facts: HIGH — read directly from the reference script + package.json.

**Research date:** 2026-06-19
**Valid until:** 2026-07-19 (stable plumbing; `@std/assert` could tick a patch — re-probe if planning slips weeks, but `@1` floating-major stays compatible).
