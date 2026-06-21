---
phase: 07-performance-cache
reviewed: 2026-06-21T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - infra/supabase/functions/feed/index.ts
  - infra/supabase/functions/invalidate-cache/index.ts
  - infra/supabase/migrations/175_generate_candidates_precap_iterative_scan.sql
  - infra/supabase/migrations/175_REVERSE_ONLY_generate_candidates_precap_iterative_scan.sql
  - infra/supabase/migrations/176_invalidate_cache_triggers.sql
  - infra/supabase/migrations/176_REVERSE_ONLY_invalidate_cache_triggers.sql
  - infra/supabase/functions/feed/__tests__/tiered-loop.test.ts
  - infra/supabase/functions/feed/__tests__/precap-behavior.test.ts
  - infra/supabase/functions/invalidate-cache/__tests__/delete-path.test.ts
  - infra/supabase/functions/feed/__tests__/fixtures/multi-restaurant-pool.json
findings:
  critical: 1
  warning: 5
  info: 4
  total: 10
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-06-21
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Reviewed the Phase 7 performance/cache change set: the tiered-radius fetch loop in `feed/index.ts`, the DELETE `old_record` fallback in `invalidate-cache/index.ts`, migration 175 (per-restaurant ROW_NUMBER pre-cap, with `iterative_scan` intentionally removed), and migration 176 (`net.http_post` Vault-backed invalidation triggers), plus three Deno test harnesses and a fixture.

The loop, pre-cap window, and trigger function are largely sound and well-documented. The intentional decisions called out in the phase context (removed `iterative_scan` GUC, unconditional `feed:v2:*` flush-all, stage-don't-apply migrations) were respected and not flagged. However there is one correctness BLOCKER: the feed **cache key omits `radius`**, so the newly meaningful tiered radius produces wrong cached responses across differing radii at the same coordinates. Several warnings concern the DELETE path's now-dead per-restaurant resolution, an unbounded-write assumption in the trigger, and a search_path gap on the SECURITY DEFINER trigger function.

## Critical Issues

### CR-01: Feed cache key omits `radius` — tiered loop returns wrong-radius cached responses

**File:** `infra/supabase/functions/feed/index.ts:735-736`
**Issue:** The cache key is built from `userId`, `location.lat/lng`, and `cacheFilters` (= `filters` minus `currentTime`). `radius` is a **top-level** `FeedRequest` field (`feed/index.ts:87`, `:713`), NOT a member of `filters`, so it never enters the key:

```ts
const { currentTime: _ignoredInCacheKey, ...cacheFilters } = filters ?? {};
const cacheKey = `feed:v2:${userId ?? 'anon'}:${location.lat.toFixed(3)}:${location.lng.toFixed(3)}:${JSON.stringify(cacheFilters)}`;
```

Two requests from the same rounded coordinates with **different radii** (e.g. a 2 km map zoom-in vs a 25 km zoom-out) collide on the same key. Whichever lands first populates the cache; the second gets the first's result for the full 300 s TTL. Before this phase the single-shot RPC made radius a relatively coarse knob, but the tiered loop (`:882-909`) makes radius the *primary* driver of how far the pool reaches — so this latent omission now actively returns the wrong dish/restaurant set (e.g. a far-zoom request served the near-zoom's truncated pool, or vice-versa). This is a user-visible correctness defect introduced/activated by the phase's loop work.

**Fix:** Fold the resolved radius into the key (and ideally `mode`/`limit`, which are also omitted today):

```ts
const cacheKey =
  `feed:v2:${userId ?? 'anon'}:${location.lat.toFixed(3)}:${location.lng.toFixed(3)}` +
  `:r${radius}:m${mode}:l${limit}:${JSON.stringify(cacheFilters)}`;
```

## Warnings

### WR-01: `invalidate-cache` dish DELETE can never resolve `restaurant_id` (row already gone)

**File:** `infra/supabase/functions/invalidate-cache/index.ts:90-102`
**Issue:** The phase added `body.record ?? body.old_record ?? {}` (`:57`) so a DELETE resolves the changed row. But for the `dishes` branch the restaurant id is resolved by **re-querying the live table**:

```ts
const { data } = await supabase
  .from('dishes')
  .select('menu_category:menu_categories(menu:menus(restaurant_id))')
  .eq('id', record.id)
  .single();
```

On a dish DELETE the row no longer exists, so `.single()` returns no data (and logs a PostgREST "0 rows" error swallowed by the un-destructured `error`), `restaurantId` stays `null`, and the per-restaurant best-effort keys are never cleared. The `old_record` fallback the phase added is therefore inert for the dish-DELETE case — the one case it was introduced to fix. (The mandatory `feed:v2:*` flush still runs, so feed correctness holds; this only defeats the per-restaurant cleanup.)
**Fix:** For DELETE, resolve from the payload instead of the table. `old_record` for a dish carries `menu_category_id`; or skip the lookup and resolve via `old_record.restaurant_id` if present. At minimum, short-circuit the live query when `body.type === 'DELETE'` and derive the id from `old_record`, and capture/log the query `error`.

### WR-02: SECURITY DEFINER trigger function has no `SET search_path`

**File:** `infra/supabase/migrations/176_invalidate_cache_triggers.sql:50-54`
**Issue:** `public._trg_invalidate_feed_cache()` is `SECURITY DEFINER` but, unlike `generate_candidates` (`175:...SET search_path = extensions, public`), it sets **no** `search_path`. It resolves unqualified objects `vault.decrypted_secrets` (schema-qualified, OK) and `net.http_post` (schema-qualified, OK), so the immediate calls are safe — but a SECURITY DEFINER function with a mutable search_path is a standing privilege-escalation hazard: any later edit that introduces an unqualified call (or any operator-set role search_path) executes with the definer's elevated rights against an attacker-influenced schema. This is a hard project convention (CLAUDE.md "RLS / ownership") and the sibling function in the same change set sets it.
**Fix:** Pin it explicitly:

```sql
CREATE OR REPLACE FUNCTION public._trg_invalidate_feed_cache()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, vault, net
AS $function$
...
```

### WR-03: `deleteByPattern` flush-all runs on EVERY row of bulk writes (write amplification → trigger storm)

**File:** `infra/supabase/migrations/176_invalidate_cache_triggers.sql:96-111` + `infra/supabase/functions/invalidate-cache/index.ts:82`
**Issue:** The triggers are `FOR EACH ROW` on INSERT/UPDATE/DELETE, and the handler unconditionally runs `deleteByPattern(redis, 'feed:v2:*')` (a full SCAN+DEL of the feed namespace) on every invocation. The header justifies flush-all as safe because writes are "operator-rare (one operator editing menus)". That assumption breaks for any **set-based** write: a menu re-import / bulk publish / `UPDATE dishes SET ... WHERE restaurant_id = X` touching N rows fires N `net.http_post` calls, each triggering a full-namespace SCAN+DEL against Upstash. The fire-and-forget trigger won't block the DB write, but it can stampede the edge function and Redis (and burn Upstash request quota). The "best-effort" framing is fine for correctness but the unbounded fan-out is a real operational risk the comment explicitly waves away.
**Fix:** Either (a) make the flush idempotent-cheap by deleting a single sentinel/namespace-version key instead of SCAN-DEL per event, or (b) add `FOR EACH STATEMENT` triggers (one invocation per statement) rather than `FOR EACH ROW`, or (c) debounce in the edge function (e.g. short Redis lock so concurrent invocations within a window collapse to one flush). At minimum, document the bulk-write blast radius rather than asserting writes are always single-row.

### WR-04: Tiered loop discards earlier tiers — a shrinking wider tier silently loses candidates

**File:** `infra/supabase/functions/feed/index.ts:907-908`
**Issue:** `pool = data ?? []` REPLACES the pool each tier on the documented assumption that "wider tier is a strict superset". That holds for the geo filter, but the RPC also applies `LIMIT p_limit` (200) **and** the new per-restaurant `rn <= 8` pre-cap (migration 175:353) *inside each call*. A wider radius admits more restaurants competing for the same 200-row cap and the same per-restaurant top-8, so a dish present in the 0.5 tier can be ranked out of the 1.0 tier's 200-row window. Because the loop only reaches the 1.0 tier when earlier tiers were **below** POOL_TARGET (sparse), the window is rarely full in that path, so the superset property usually holds — but it is not guaranteed, and the "strict superset -> REPLACE, never merge/dedup" comment overstates the invariant. Worst case a borderline-but-relevant near dish is dropped when the radius expands.
**Fix:** The current behavior is acceptable for v1 (the final tier == requested radius == prior single-shot, so it never does *worse* than before the phase). But soften the comment to reflect that the superset claim is approximate under the `LIMIT`/pre-cap, and consider keeping the best-scoring union across tiers if recall regressions surface.

### WR-05: `precapCompare` NULLS-LAST mirror diverges from SQL when only one side is NULL with equal sort — and from JS float ordering

**File:** `infra/supabase/functions/feed/__tests__/precap-behavior.test.ts:42-50`
**Issue:** The test claims to be a "pure mirror of the SQL ROW_NUMBER pre-cap" and is the **automated gate** for SC#3 / behavior preservation. Two mismatches weaken that guarantee: (1) the comparator returns `av - bv` for the vector-distance tier, which is a correct sign but the SQL sorts by IEEE `<=>` cosine distance; fine for the fixture but the harness asserts byte/row deltas it can satisfy trivially. (2) More importantly, the fixture has `vector_distance` non-null on every row, so the `NULLS LAST` branch (`:45-47`) — the exact path taken on the dominant anon/cold-start case where the SQL window orders an entire partition of NULLs by popularity — is **never exercised**. The "behavior-preserving" test therefore proves nothing about the cold-start ordering that production hits most. This is a test-reliability gap, not a runtime bug.
**Fix:** Add a fixture variant (or mutate a copy in-test) with `vector_distance: null` across a multi-dish restaurant so the NULLS-LAST → popularity → distance tie-break path is actually asserted against `applyDiversity`.

## Info

### IN-01: Cache hit path returns uncompressed JSON, bypassing the gzip branch

**File:** `infra/supabase/functions/feed/index.ts:743-749`
**Issue:** On a cache hit the response is returned via `new Response(JSON.stringify(...))` with no `Content-Encoding`, while the miss path honors `Accept-Encoding: gzip` (`:1096-1098`). Cache hits (the common case) thus ship larger uncompressed payloads — the opposite of the phase's perf intent. Not a correctness issue.
**Fix:** Route the cache-hit response through `compressedJsonResponse(...)` when the client advertises gzip.

### IN-02: `selectConfigForUser` meatTypes match never fires for `other`/`other_meat`

**File:** `infra/supabase/functions/feed/index.ts:540`
**Issue:** `filters.meatTypes?.includes(opt.primary_protein)` compares daily `meatTypes` keys (`chicken|beef|pork|lamb|goat|other`) against option `primary_protein` enum values (`...|other_meat|...`). `'other'` never equals `'other_meat'`, so an "other meat" option gets no +50 modifier-selection boost. Cosmetic scoring nuance, not a selection-correctness bug (defaults/protein still win).
**Fix:** Map `meatTypes` keys to `primary_protein` values before the membership test, or special-case `other → other_meat`.

### IN-03: Unused destructured `mode === 'restaurants'` empties dishResult but still computes diversity/open-now

**File:** `infra/supabase/functions/feed/index.ts:986-988`
**Issue:** When `mode === 'restaurants'`, `dishResult` is `[]` yet the full dish scoring, diversity cap, and per-dish open-now filter still run upstream. Harmless (results feed the restaurant map), just noting the dead dish-projection branch for readers. Out-of-scope as a perf item; flagged only as a readability note.
**Fix:** None required; optionally short-circuit dish-only work when `mode === 'restaurants'`.

### IN-04: `getRedis()` in invalidate-cache constructs a new client every request (no memoization)

**File:** `infra/supabase/functions/invalidate-cache/index.ts:20-25`
**Issue:** Unlike `feed/index.ts` (`:53-60`, memoized `_redis`), the invalidate-cache `getRedis()` returns a fresh `new Redis(...)` per invocation. For a REST-based Upstash client this is low-cost, but it's an inconsistency with the sibling function and a minor per-call allocation on a hot trigger path (see WR-03).
**Fix:** Memoize the client in a module-level singleton as `feed/index.ts` does.

---

_Reviewed: 2026-06-21_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
