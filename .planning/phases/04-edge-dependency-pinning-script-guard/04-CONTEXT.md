# Phase 4: Edge Dependency Pinning & Script Guard - Context

**Gathered:** 2026-06-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Two independent hardening tracks, bundled because both are low-regression-risk dependency/safety chores. **Authored + Deno-tested locally only; the operator deploys functions to prod and smoke-tests one real call per function (stage-don't-apply).**

**Track A — Edge deps (DEBT-05 / F-22, F-23):**
1. Replace `serve` from `https://deno.land/std@0.168.0/http/server.ts` with native `Deno.serve` across the **8 functions** still using it (`menu-scan-worker` already uses `Deno.serve` — leave it).
2. Migrate the 2 `std@0.168.0/testing/asserts` test imports in the same pass.
3. Exact-pin `@supabase/supabase-js` to **one specifier style + one version** across ALL functions, and exact-pin `@upstash/redis` everywhere (including `invalidate-cache`, currently `@latest`).

**Track B — Script guard (SEC-03 / F-12):**
4. `infra/scripts` prod-write paths default to dry-run, refuse to mutate prod without an explicit confirmation flag, and print the target project ref before any mutation — preserving the dry-run → sample (`--limit`) → full workflow.

**Out of this phase's boundary:**
- Full Deno std → JSR modernization beyond the `serve` + `testing/asserts` swap (that's QUAL-V2-02, out of scope).
- Pinning `npm:openai@4` in `menu-scan-worker` (not named in DEBT-05; DEBT-05 is supabase-js + upstash + the serve import only) — noted in Deferred.
- The `invalidate-cache` cache-key / flush-all redesign and webhook event coverage (Phase 7 / PERF-03) — this phase only touches its imports.
- Any change to the CORS logic added in Phase 2 — the `Deno.serve` swap must **preserve** each function's per-request `corsHeaders` line and the `../_shared/cors.ts` import.

</domain>

<decisions>
## Implementation Decisions

### Track A — `Deno.serve` migration (DEBT-05 / F-22)
- **D-01:** Migrate **all 8 functions** that still import `serve` from `std@0.168.0/http/server.ts` → native `Deno.serve`: `app-config`, `group-recommendations`, `invalidate-cache`, `enrich-dish`, `feed`, `batch-update-preference-vectors`, `update-preference-vector`. `menu-scan-worker` is **already** on `Deno.serve` (line 1056) — do not touch its serve wrapper. This is a mechanical `serve(handler)` → `Deno.serve(handler)` swap; the handler signature `(req: Request) => Response | Promise<Response>` is identical, so the body of each handler is unchanged.
- **D-02:** **Preserve the Phase 2 CORS seam.** In `feed` / `enrich-dish` / `invalidate-cache`, the handler's first line computes `const corsHeaders = buildCorsHeaders(req.headers.get('Origin'))` and the file imports `../_shared/cors.ts`. The `Deno.serve` swap changes ONLY the wrapper call — the per-request `corsHeaders` line, the import, and every response spread stay byte-for-byte (STATE Phase-2 note).
- **D-03:** **Migrate the 2 test `asserts` imports** (`std@0.168.0/testing/asserts.ts`) in the same pass: `infra/supabase/functions/menu-scan-worker/test.ts:13` and `infra/supabase/functions/_shared/cors.test.ts:15`. There is no `esm.sh` equivalent for Deno std *testing* — the canonical non-deprecated replacement is **`jsr:@std/assert`** (exact-pinned, e.g. `jsr:@std/assert@1`). This is the ONE place `jsr:` is unavoidable and is consistent with "modern, non-deprecated." Planner/researcher must confirm the exact `@std/assert` version and that `deno test --node-modules-dir=none -A` resolves it.
- **D-04:** **Update `deno-globals.d.ts`** (the VS Code "cannot find module" shim). After migration: remove the now-dead `declare module 'https://deno.land/std@0.168.0/http/server.ts'` block; collapse the supabase-js shims to a single `declare module 'https://esm.sh/@supabase/supabase-js@2.39.3'` (drop the `@2` and `npm:@2` variants); change the upstash shim from `@latest` → `@1.38.0`. The shim keys MUST match the new import specifier strings exactly or the editor errors return.

### Track A — supabase-js + upstash pinning (DEBT-05 / F-23)
- **D-05:** **Canonical `@supabase/supabase-js` = `https://esm.sh/@supabase/supabase-js@2.39.3`** — one specifier style (`esm.sh`), one exact version, across ALL functions. Chosen because `app-config` already pins exactly that, and "prefer incumbent tech" (esm.sh is the dominant existing style) → least churn, no JSR runtime-resolution risk. The roadmap SC#2 wording "one exact **JSR** version" is treated as aspirational, NOT literal — recorded as a deliberate deviation.
  - Rewrites (unpinned `esm.sh/@supabase/supabase-js@2` → `@2.39.3`): `invalidate-cache:16`, `enrich-dish:24`, `batch-update-preference-vectors:16`, `update-preference-vector:22`, `feed:13`, `group-recommendations:16`.
  - Rewrite (specifier-style change `npm:@supabase/supabase-js@2` → `esm.sh/.../@2.39.3`): `menu-scan-worker:10`.
  - `app-config:16` is already `@2.39.3` — leave (it's the reference).
- **D-06:** **`@upstash/redis` pinned to `@1.38.0`** everywhere — matches the already-pinned `feed:15`. Only change is `invalidate-cache:17` (`@latest` → `@1.38.0`) plus the `deno-globals.d.ts` shim. No version bump; pin to the value already proven in `feed`.

### Track B — Script guard (SEC-03 / F-12)
- **D-07:** **New shared helper `infra/scripts/lib/prod-guard.ts`** (first module under `infra/scripts/lib/`) — mirrors the Phase 2 `_shared/cors.ts` DRY pattern. One source of truth for: default-dry-run gating, the `--apply` write trigger, and printing the target project ref before any mutation. Every write-path script imports and calls it; the guard is NOT re-implemented inline per script.
- **D-08:** **Guard ALL write-path scripts (~11), not just the 2 F-12 named.** F-12 cited `replay-menu-scan-ab.ts` + `apply-phase6-flag-fixes.ts` as examples, but the systemic SEC-03 risk is the whole directory. **Candidate write set** (planner MUST confirm each by its actual mutation calls — `insert`/`update`/`upsert`/`delete`/writing RPC — NOT by service-role usage, since read-only scripts also use the service-role key): `backfill-cuisine-from-dishes`, `backfill-cuisine-from-google`, `backfill-cuisine-types`, `backfill-open-hours`, `backfill-restaurant-currency`, `backfill-restaurant-timezone`, `seed-cold-start-vectors`, `batch-embed`, `apply-phase6-flag-fixes`, `replay-menu-scan-ab`, `preview-phase6-conversion` (verify — "preview" may be read-only). **Read-only scripts stay untouched:** `diagnose-*`, `verify-phase6`, `verify-phase7`, `check-favorites-duplicates`, `generate-phase6-flag-checklist`.
- **D-09:** **Flip every guarded script to default-dry-run.** Some scripts currently default LIVE (e.g. `backfill-cuisine-from-dishes`: `DRY_RUN = process.argv.includes('--dry-run')` → writes unless flagged); after this phase, dry-run is the default for all and writing always requires the explicit flag. This is the core of SEC-03 ("write paths default to dry-run"). The CLI-contract change for the LIVE-default scripts is intentional and must be documented in the guard rollout / script headers.
- **D-10:** **Write flag = `--apply`** (matches the one script — `apply-phase6-flag-fixes` — that already uses it). `--dry-run` is **kept as an accepted no-op** so existing muscle-memory invocations and docs don't error (it just re-affirms the new default). Exactly one flag means "write to prod" = `--apply`.
- **D-11:** **Print the project ref before any mutation.** The guard prints the target (e.g. `SUPABASE_URL` host / project ref) on every run, prominently before writes — so an operator can abort if pointed at the wrong project. `batch-embed` currently has NO dry-run path at all → adding the guard there is a net-new safety gate, not just a default flip; flag it in the plan.
- **D-12:** **Preserve dry-run → sample → full.** The guard must NOT interfere with the existing `--limit=N` sampling step (SC#3). Order of precedence: default dry-run; `--limit` narrows the set in either mode; `--apply` is required to actually write.

### Claude's Discretion
- Exact `prod-guard.ts` API shape (e.g. `parseGuard(argv)` returning `{ dryRun, projectRef }` vs a `requireProdWriteClearance()` that throws) and the print format of the project-ref banner.
- Exact `@std/assert` version to pin for the test imports (D-03) — any current exact `jsr:@std/assert@1.x`.
- Whether to add a tiny smoke test for `prod-guard.ts` — minimal-tests decision says only if it cheaply de-risks the guard; not required.
- Whether the guard reads the project ref from `SUPABASE_URL` host or a dedicated `SUPABASE_PROJECT_REF` env — pick what the scripts already have.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` → "Phase 4: Edge Dependency Pinning & Script Guard" — goal + the 4 success criteria (the scope anchor).
- `.planning/REQUIREMENTS.md` — **DEBT-05** (line 34, edge dep pinning) and **SEC-03** (line 20, script guard).

### Finding evidence (verified on current HEAD)
- `.planning/codebase/FINDINGS.md` §**F-22** (~line 268) — `std@0.168.0/http/server` `serve` in every edge function; replace with `Deno.serve`. Notes the full std→JSR modernization is QUAL-V2-02 (out of scope).
- `.planning/codebase/FINDINGS.md` §**F-23** (~line 277) — the 3-specifier supabase-js mess + `@upstash/redis@latest` vs `@1.38.0`; pin all to exact.
- `.planning/codebase/FINDINGS.md` §**F-12** (~line 169) — `infra/scripts` prod-mutation scripts with manual `--dry-run` only, no harness gate; read-only scripts (`verify-phase7.ts`) unaffected.
- `.planning/codebase/CONCERNS.md` § Dependencies at Risk + § Security Considerations — the original findings F-22/F-23/F-12 assess.

### Prior-phase seam (must not regress)
- `.planning/phases/02-cors-lockdown/02-CONTEXT.md` — the `_shared/cors.ts` `buildCorsHeaders` helper + per-request `corsHeaders` line; D-02 here preserves it through the `Deno.serve` swap.
- `.planning/STATE.md` — "Phase 4 serve→Deno.serve must preserve the per-request corsHeaders line + the cors.ts import."

### Constraints & conventions
- `.planning/PROJECT.md` — Constraints: stage-don't-apply (operator deploys prod), "Edge functions cannot import workspace packages — enums/schemas duplicated inline" (so all edge imports are remote specifiers, never `@eatme/*`); solo project / commit straight to main.
- Memory `infra_scripts_prod_backfills` — `infra/scripts` ts-node scripts hit LIVE prod Supabase (service-role + Google keys in `.env`); self-contained, `--dry-run` first. This is exactly the risk SEC-03 hardens.
- Memory `edge_fn_deno_tests` — run Deno tests with `deno test --node-modules-dir=none -A <path>`; deno at `~/.deno` (not on PATH); deploy from `infra/supabase/`. (SC#4 gate.)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets / Patterns to Mirror
- **`_shared/cors.ts` (Phase 2)** — the precedent for a DRY shared edge helper; `prod-guard.ts` is its `infra/scripts` analog (D-07).
- **`apply-phase6-flag-fixes.ts`** — already implements the *target* guard shape: `apply = argv.includes('--apply')`, `dryRun = ... || !apply`, prints `SUPABASE_URL` before applying. This is the reference behavior to generalize into `prod-guard.ts`.
- **`app-config/index.ts:16`** — already pins `esm.sh/@supabase/supabase-js@2.39.3`; the reference specifier for D-05.
- **`feed/index.ts:15`** — already pins `@upstash/redis@1.38.0`; the reference for D-06.

### Established Patterns / Constraints
- **Edge functions use remote specifiers only** (no workspace imports). Two coexisting styles today — `esm.sh` (dominant) and `npm:` (`menu-scan-worker`); D-05 collapses to `esm.sh`.
- **`deno-globals.d.ts`** declares a `module` shim per exact specifier string — it must be updated in lockstep with every import-string change (D-04), or the editor reports phantom errors.
- **Scripts roll their own dry-run** with TWO opposite defaults: LIVE-default (`backfill-cuisine-from-dishes`) vs dry-run-default (`apply-phase6-flag-fixes`). D-09 unifies to dry-run-default.
- **`batch-embed.ts`** writes but has NO dry-run flag today — guarding it is a net-new gate (D-11).

### Integration Points
- **Phase 2 just rewired** `feed`/`enrich-dish`/`invalidate-cache` — the `Deno.serve` swap touches the same files; sequence carefully so the corsHeaders seam (D-02) survives.
- **`menu-scan-worker`** is the only function already on `Deno.serve` + `npm:` specifiers — Track A normalizes its supabase-js import (D-05) but leaves its serve wrapper and its `npm:openai@4` (out of scope, see Deferred).
- **SC#4 verification:** each migrated function must compile in the local edge runtime and its Deno tests pass; operator smoke-tests one real call per function on deploy.

</code_context>

<specifics>
## Specific Ideas

- The whole phase is intentionally low-risk plumbing: a mechanical `serve`→`Deno.serve` swap, exact version strings, and one shared guard module. No business logic changes anywhere.
- "Prefer incumbent" drove the dep choice: esm.sh-pinned beats a JSR rewrite even though the roadmap literally says JSR — surface this as a recorded deviation, not a silent one.
- The guard's guiding principle mirrors Phase 2's "fail-closed but mobile-safe": **default-dry-run, one explicit `--apply`, always announce the target project** — when in doubt, don't write.
- `--dry-run` survives as a no-op purely for operator muscle-memory / existing notes; it must never error.

</specifics>

<deferred>
## Deferred Ideas

- **Pin `npm:openai@4` in `menu-scan-worker`** — not part of DEBT-05 (which names supabase-js + upstash + the serve import). After D-05 switches its supabase-js import to `esm.sh`, `menu-scan-worker` is internally mixed-specifier (esm.sh supabase-js + npm: openai) — a candidate follow-up to fully normalize, but out of this phase's requirement.
- **Full Deno std → JSR modernization** beyond `serve` + `testing/asserts` — QUAL-V2-02 (already roadmapped out of scope per F-22).
- **Lock the other 4 wildcard edge functions' CORS** — carried from Phase 2 (`app-config`, `group-recommendations`, `update-preference-vector`, `batch-update-preference-vectors`); not this phase.
- **Make `prod-guard` opt-in for all future scripts by convention** — once the helper exists, a contributing-docs note could require every new write script to call it; doc task, not code.

</deferred>

---

*Phase: 04-edge-dependency-pinning-script-guard*
*Context gathered: 2026-06-19*
