---
phase: 04-edge-dependency-pinning-script-guard
reviewed: 2026-06-20T00:00:00Z
depth: standard
files_reviewed: 24
files_reviewed_list:
  - infra/scripts/apply-phase6-flag-fixes.ts
  - infra/scripts/backfill-cuisine-from-dishes.ts
  - infra/scripts/backfill-cuisine-from-google.ts
  - infra/scripts/backfill-cuisine-types.ts
  - infra/scripts/backfill-open-hours.ts
  - infra/scripts/backfill-restaurant-currency.ts
  - infra/scripts/backfill-restaurant-timezone.ts
  - infra/scripts/batch-embed.ts
  - infra/scripts/lib/prod-guard.test.ts
  - infra/scripts/lib/prod-guard.ts
  - infra/scripts/package.json
  - infra/scripts/seed-cold-start-vectors.ts
  - infra/supabase/functions/app-config/index.ts
  - infra/supabase/functions/batch-update-preference-vectors/index.ts
  - infra/supabase/functions/deno-globals.d.ts
  - infra/supabase/functions/enrich-dish/index.ts
  - infra/supabase/functions/feed/index.ts
  - infra/supabase/functions/group-recommendations/index.ts
  - infra/supabase/functions/invalidate-cache/index.ts
  - infra/supabase/functions/menu-scan-worker/index.ts
  - infra/supabase/functions/menu-scan-worker/test.ts
  - infra/supabase/functions/_shared/cors.test.ts
  - infra/supabase/functions/update-preference-vector/index.ts
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-06-20
**Depth:** standard
**Files Reviewed:** 24
**Status:** issues_found

## Summary

Two-track phase: (A) the `serve`→`Deno.serve` swap + exact dependency pinning across
edge functions, and (B) the shared `prod-guard` default-dry-run gate wired into the
8 prod-write scripts. Both focus areas are, in the main, implemented correctly:

- **Edge swap (A):** All 7 functions that imported the deprecated
  `std@0.168.0/http/server` `serve` now use native `Deno.serve` with the identical
  async handler signature. Verified across `feed`, `enrich-dish`, `invalidate-cache`,
  `app-config`, `group-recommendations`, `update-preference-vector`,
  `batch-update-preference-vectors`. For `feed`/`enrich-dish`/`invalidate-cache` the
  per-request `buildCorsHeaders(req.headers.get('Origin'))` line, the
  `../_shared/cors.ts` import, the OPTIONS early-return, every `...corsHeaders`
  response spread, and all status codes (400/401/404/500) are intact. No leftover
  `deno.land/std` `serve` import remains anywhere. Pins applied uniformly:
  `@supabase/supabase-js@2.39.3`, `@upstash/redis@1.38.0`, `jsr:@std/assert@1.0.19`;
  no `@2`/`@latest`/`npm:@supabase` floating specifiers remain in functions. The
  `deno-globals.d.ts` shim was aligned to the new exact-pinned module URLs and the
  dead `npm:@supabase/supabase-js@2` / `@latest` stubs were removed.

- **prod-guard (B):** `parseGuard` is pure, default-dry-run, `--apply` is the sole
  write trigger, `--dry-run` is an accepted no-op, `--limit=N` is returned (not
  stripped), and `projectRef` is derived from the `SUPABASE_URL` host with a
  non-throwing sentinel. The 8 unit tests pass (`node --test`). Every write path in
  all 8 wired scripts (`.insert`/`.update`/`.upsert`/`.delete`/writing `.rpc`) was
  traced and is gated behind the `dryRun`/`DRY_RUN` check, with `announceTarget()`
  printed before the first mutation in each. `--limit=N` narrowing was confirmed to
  still apply in both dry-run and apply modes for every script that supports it.

The findings below are quality/robustness issues, not breaks in the phase's stated
contract. The most material is a pre-existing reference to the dropped `is_parent`
column in a file this phase modified (WR-01).

## Warnings

### WR-01: Backfill queries the dropped `is_parent` column — script will hard-fail against current prod schema

**File:** `infra/scripts/backfill-cuisine-from-dishes.ts:249`
**Issue:** `fetchDishNames` filters dishes with `.eq('is_parent', false)`. Migration
163 (`163_phase7_coordinated_drop.sql:1221`, `DROP COLUMN IF EXISTS is_parent`) removed
that column, and CLAUDE.md confirms the legacy parent/variant model was dropped
2026-06-12. A PostgREST query against a non-existent column returns an error, so
`fetchDishNames` throws, `backfillOne` returns `outcome: 'failed'`, and **every**
restaurant is reported as failed — the script produces no useful output even in
dry-run. This is a pre-existing latent bug (the line was not changed this phase), but
the file was edited in this phase to wire the guard, and the script is now advertised
as the safe default-dry-run path, so it should run cleanly. The sibling
`backfill-cuisine-from-google.ts` and `backfill-open-hours.ts` do NOT have this filter,
so the inconsistency is also a correctness smell.
**Fix:** Drop the now-invalid filter (variant containers no longer exist; every row is a
real dish):
```ts
const { data, error } = await supabase
  .from('dishes')
  .select('name')
  .eq('restaurant_id', restaurantId)
  // .eq('is_parent', false)  ← column dropped in migration 163; remove
  .order('created_at', { ascending: true })
  .limit(MAX_DISHES);
```

### WR-02: `--limit=N` with N≤0 is silently treated as "all" — a typo can run the full prod backfill

**File:** `infra/scripts/lib/prod-guard.ts:68-69`
**Issue:** `const limit = limitArg ? parseInt(...) || 0 : 0;`. A non-numeric value
(`--limit=abc` → `NaN || 0` → `0`) or a negative value (`--limit=-5` → `-5`) both
collapse to a "process all candidates" semantic in every consuming script
(`if (LIMIT > 0) candidates = candidates.slice(0, LIMIT)`). For the sampling workflow
(`dry-run → --limit=5 sample → full`), an operator who fat-fingers `--limit=5 ` with a
stray char, or `--limt=5` (misspelled flag, so `find` matches nothing → 0), silently
gets the **entire** candidate set instead of a 5-row sample. Combined with `--apply`
that is a full prod write where a 5-row sample was intended. The guard is the one
net-new safety surface (SEC-03) and should fail loud on a malformed limit rather than
widen scope.
**Fix:** Reject a malformed/negative limit explicitly instead of coercing to 0:
```ts
let limit = 0;
if (limitArg) {
  const parsed = parseInt(limitArg.split('=')[1] ?? '', 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    throw new Error(`Invalid --limit value: "${limitArg}" (expected a non-negative integer)`);
  }
  limit = parsed;
}
```

### WR-03: `backfill-restaurant-timezone.ts` parses `--all` by hand, bypassing the shared guard — `--limit` still works but the flag surface is split

**File:** `infra/scripts/backfill-restaurant-timezone.ts:42-43`
**Issue:** This script reads `dryRun`/`projectRef`/`limit` from `parseGuard()` but then
adds `const ALL = process.argv.includes('--all');` as a separate ad-hoc argv parse. The
guard is documented as "the single DRY source of prod-write clearance," and a one-off
argv read alongside it is exactly the inline-duplication pattern the guard was created
to retire (prod-guard.ts:5-8). It is not a correctness bug today (the write is still
gated by `DRY_RUN`, and `--all` only widens the *read* candidate set), but `--all`
re-derives EVERY restaurant's timezone — a much larger write scope — and that
scope-widening flag lives outside the audited guard. A future guard hardening (e.g.
WR-02's malformed-flag rejection, or a "confirm large scope" gate) would not see it.
**Fix:** Either route `--all` (and any future scope-widening flags) through `parseGuard`
so all clearance/scope flags share one audited parser, or document explicitly in
prod-guard.ts that scope-widening flags are intentionally caller-owned. At minimum add a
test asserting `--all` cannot combine with a missing `--apply` to write.

## Info

### IN-01: `enrich-dish` auth uses a non-constant-time token comparison

**File:** `infra/supabase/functions/enrich-dish/index.ts:110`
**Issue:** `authHeader.slice(7) !== expectedKey` compares the bearer token to the
service-role key with `!==`, which short-circuits on the first differing byte and is
theoretically timing-observable. Pre-existing (not changed this phase) and low-risk in
practice (the service-role key is high-entropy and the endpoint is not a brute-force
target), but worth noting since the function was touched.
**Fix:** Use a constant-time compare (e.g. hash both sides and compare, or a length-checked
XOR loop) if this endpoint is ever exposed beyond trusted internal callers.

### IN-02: Six near-identical copies of `ALL_CUISINES` / `normalizeCuisines` across scripts and functions

**File:** `infra/scripts/backfill-cuisine-from-dishes.ts:72-157`, `infra/scripts/backfill-cuisine-from-google.ts:64-149`, `infra/scripts/backfill-cuisine-types.ts:54-143`
**Issue:** The 70-entry `ALL_CUISINES` array plus `foldCuisine`/`normalizeCuisines` are
duplicated verbatim in three scripts (and again in the worker + shared package). Each
copy has a "keep in sync" comment, which is an explicit acknowledgement that drift is
likely. A cuisine added to the canonical list but missed in one copy would silently drop
that cuisine in that one backfill path. Out of this phase's scope, but the duplication
count grew with the guard wiring touching all three files.
**Fix:** When the ts-node `@eatme/shared` import limitation is resolved (e.g. a compiled
entry or `tsx` with path mapping), collapse to a single import. Until then, a shared
`infra/scripts/lib/cuisine.ts` (sibling of `prod-guard.ts`) would at least dedupe the
three script copies.

### IN-03: `batch-embed.ts` exits 0 on a partial restaurant-vector update failure

**File:** `infra/scripts/batch-embed.ts:249-258`
**Issue:** The restaurant-vector update loop counts successes (`if (!rpcErr) updated++`)
but never records or surfaces failures, and the final `process.exit(1)` (line 260) keys
only off per-dish `failed`, not off vector-update failures. A run where every
`update_restaurant_vector` RPC errors still prints `✅ Restaurant vectors updated: 0/N`
and exits 0, so a CI/cron wrapper would treat it as success.
**Fix:** Track a `vectorFailed` counter and include it in the non-zero exit condition, or
at least log the per-restaurant RPC error.

### IN-04: `deriveProjectRef` returns `(unknown)` for a malformed URL, and scripts still announce + proceed to write

**File:** `infra/scripts/lib/prod-guard.ts:44-53`
**Issue:** When `SUPABASE_URL` is set but unparseable, `projectRef` becomes the literal
`(unknown)`. `announceTarget` then prints `=== ⚠ APPLYING to project (unknown) — writing
to LIVE prod ===` and the script proceeds. The whole point of announcing the ref is to
let the operator abort on a wrong target; `(unknown)` defeats that guardrail while still
allowing the write. The guard intentionally delegates env validation to callers (and
every caller does check `SUPABASE_URL` is non-empty), but none check it is parseable, so
a malformed-but-non-empty URL passes the caller check and lands here.
**Fix:** This is acceptable as designed if documented, but consider having
`announceTarget` print a louder warning (or the raw `SUPABASE_URL`) when `projectRef ===
'(unknown)'`, so the operator sees something actionable rather than a sentinel.

---

_Reviewed: 2026-06-20_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
