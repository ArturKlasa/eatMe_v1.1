# Implementation Plan — Feed Cache Key (§S1) + Invalidation (§S6)

**Date:** 2026-06-13
**Source audit:** [`docs/findings/mobile-performance-audit.md`](../findings/mobile-performance-audit.md) — Part A, §S1 + §S6.
**Scope:** Two Supabase Edge Functions only — `feed` and `invalidate-cache`. **No mobile/client change. No SQL.**
**Status:** PLAN ONLY — no code edited, nothing deployed. Awaiting approval.

---

## TL;DR

Two edge-function changes that must ship **together**:

1. **§S1 — stop `currentTime` from defeating the feed cache.** The Redis cache key embeds the wall-clock `HH:MM`, so it mutates every minute and the 5-min cache effectively never hits. Fix: omit `currentTime` from the **key** (the SQL still uses it for time filtering; the 300 s TTL bounds drift). ~2 lines in `feed/index.ts`.
2. **§S6 — make `invalidate-cache` actually clear feed keys.** It deletes `restaurant:{id}` keys, but the feed writes `feed:v2:…` keys — so feed cache is **never** invalidated. Once §S1 makes the cache hit, stale feed data would persist up to 5 min after a menu edit. Fix: `SCAN` + `DEL` the `feed:v2:*` namespace on any restaurant/menu/dish change.

**Why paired:** §S1 turns the cache on (hit rate ≈0 → high); §S6 keeps it correct once it's on. Shipping §S1 alone = stale menus for 5 min after edits; shipping §S6 alone = no effect (cache still never hits).

---

## Root cause (verified against source)

**The key** — `feed/index.ts:682`:
```ts
const cacheKey = `feed:v2:${userId ?? 'anon'}:${location.lat.toFixed(3)}:${location.lng.toFixed(3)}:${JSON.stringify(filters)}`;
```
**The poison** — `buildFilters` (`edgeFunctionsService.ts:228-235`) puts the live clock into `filters`:
```ts
currentTime: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }), // "HH:MM" — changes every minute
currentDayOfWeek: (['sun','mon','tue','wed','thu','fri','sat'] as const)[new Date().getDay()],              // changes daily
```
TTL is 300 s (`feed/index.ts:1012`, `{ ex: 300 }`). `currentTime` is the **only** per-request-volatile field — everything else in `buildFilters` is user-filter state. So `currentTime` alone shatters the key ≥4×/TTL window. **Verified:** client must keep sending `currentTime` — the RPC consumes it at `feed/index.ts:828` (`p_current_time: filters.currentTime ?? null`).

**The broken invalidator** — `invalidate-cache/index.ts:86-95` even documents its own staleness:
```ts
// NOTE: The feed/index.ts function does not yet write Redis keys … These key patterns
// are the anticipated names … When Redis caching is added to the feed, the keys written
// there MUST match these patterns exactly.
const keysToDelete = [`restaurant:${restaurantId}`, `restaurant:cuisines:${restaurantId}`];
```
That NOTE is stale: the feed *does* write keys now (`feed:v2:…`), under a scheme that shares no prefix with `restaurant:…`. So the webhook deletes keys nothing reads and never touches the feed cache.

---

## Change 1 — §S1 (`infra/supabase/functions/feed/index.ts`)

**Edit at the cache-key block (`:677-682`).** Keep the existing `v2` comment; add the rationale and omit `currentTime` from the key via rest-spread.

```ts
// BEFORE
    // v2: cache key bumped after modifier-aware rewrite so legacy cached responses
    // without applied_options/effective_* fields are not returned. Old entries
    // expire naturally via TTL (5 min) — no manual flush needed.
    const cacheKey = `feed:v2:${userId ?? 'anon'}:${location.lat.toFixed(3)}:${location.lng.toFixed(3)}:${JSON.stringify(filters)}`;

// AFTER
    // v2: cache key bumped after modifier-aware rewrite so legacy cached responses
    // without applied_options/effective_* fields are not returned. Old entries
    // expire naturally via TTL (5 min) — no manual flush needed.
    //
    // currentTime is deliberately EXCLUDED from the key: it changes every minute and
    // would shatter the cache (≥4 misses per 5-min TTL window — hit rate ≈ 0). The RPC
    // still applies time filtering server-side via p_current_time, and the 300s TTL
    // bounds any open/closed drift to ≤5 min. currentDayOfWeek is kept — it changes
    // only daily and correctly separates each day's open-hours / daily menus.
    const { currentTime: _ignoredInCacheKey, ...cacheFilters } = filters ?? {};
    const cacheKey = `feed:v2:${userId ?? 'anon'}:${location.lat.toFixed(3)}:${location.lng.toFixed(3)}:${JSON.stringify(cacheFilters)}`;
```

Notes:
- **Order-stable:** rest-spread preserves the remaining fields' order, so `JSON.stringify` stays deterministic across requests. `currentTime` was second-to-last in `buildFilters`, so removing it doesn't reorder anything else.
- **No version bump needed:** old `v2`-with-`currentTime` entries can't collide with new `v2`-without-`currentTime` entries (different strings) — they orphan and expire in ≤5 min. No flush.
- **`_ignoredInCacheKey`** is `_`-prefixed → satisfies Deno lint's no-unused-vars.
- **Not touched:** `lat/lng.toFixed(3)` (~110 m geo buckets). Coarsening to `toFixed(2)` (~1.1 km) would raise hit-rate while panning, but the feed is distance-ranked/-labeled, so serving a feed computed ~1 km away would show wrong distances/sort. Left as-is; noted as an optional future knob.

**Net §S1:** one comment + two code lines. Hit rate for a stationary/slow-moving user goes from ≈0 to high.

---

## Change 2 — §S6 (`infra/supabase/functions/invalidate-cache/index.ts`)

**Add a SCAN-based namespace delete and call it for any of the three watched tables, independent of `restaurantId` resolution.** Keep the existing `restaurant:*` deletes as a bonus.

**(a) Add a helper** next to `getRedis()` (`:24-29`):
```ts
/**
 * Delete every key matching a glob via SCAN (cursor-paged, non-blocking).
 * Returns the number of keys deleted. Safe on an empty namespace (returns 0).
 */
async function deleteByPattern(redis: Redis, pattern: string): Promise<number> {
  let cursor = '0';
  let deleted = 0;
  do {
    const [next, keys] = await redis.scan(cursor, { match: pattern, count: 200 });
    cursor = next;
    if (keys.length > 0) {
      await redis.del(...keys);
      deleted += keys.length;
    }
  } while (cursor !== '0');
  return deleted;
}
```

**(b) Restructure the handler body** so the feed namespace is cleared for any valid table, then best-effort clear the per-restaurant keys. Replaces the current `:50-101` flow:

```ts
// AFTER (handler body, post-redis-guard)
    // Only restaurants / menus / dishes affect feed output.
    if (table !== 'restaurants' && table !== 'menus' && table !== 'dishes') {
      console.warn('[invalidate-cache] Unknown table:', table);
      return new Response(JSON.stringify({ skipped: true, reason: 'unknown_table', table }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // §S6 core: the feed cache key is feed:v2:{user}:{geo}:{filters} — it carries no
    // restaurant_id, so we can't target a single restaurant. Writes here are rare (one
    // operator editing menus), so clearing the whole feed namespace is the correct,
    // simple choice; entries recompute lazily on the next feed request.
    const feedKeysDeleted = await deleteByPattern(redis, 'feed:v2:*');

    // Best-effort: also clear any per-restaurant keys (legacy/other cache paths).
    let restaurantId: string | null = null;
    if (table === 'restaurants') {
      restaurantId = record.id ?? null;
    } else if (table === 'menus') {
      restaurantId = record.restaurant_id ?? null;
    } else if (table === 'dishes') {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );
      const { data } = await supabase
        .from('dishes')
        .select('menu_category:menu_categories(menu:menus(restaurant_id))')
        .eq('id', record.id)
        .single();
      restaurantId = (data as any)?.menu_category?.menu?.restaurant_id ?? null;
    }

    const restaurantKeys = restaurantId
      ? [`restaurant:${restaurantId}`, `restaurant:cuisines:${restaurantId}`]
      : [];
    if (restaurantKeys.length > 0) {
      await Promise.all(restaurantKeys.map(k => redis.del(k)));
    }

    console.log('[invalidate-cache] Cleared', { table, restaurantId, feedKeysDeleted, restaurantKeys });
    return new Response(
      JSON.stringify({ feedKeysDeleted, restaurantKeys, restaurantId, table }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
```

Also **delete the stale NOTE** (`:86-92`) and **update the header comment** (`:1-13`) to say feed keys are now cleared via SCAN.

Notes / trade-offs:
- **Over-invalidation is intentional and harmless:** any single menu edit clears all feed caches; they recompute on next request. Acceptable because writes are rare and the alternative (a `feed:byRestaurant:{id}` reverse index maintained on every feed write) is far more machinery than current scale warrants. Flagged as the future optimization if write volume grows.
- **Bulk-update amplification:** a backfill that `UPDATE`s many dishes fires the webhook per row → many redundant full-namespace clears. Harmless at current scale (SCAN over a small namespace is cheap; the 30 s pg_net webhook timeout from commit `c1465e9` is ample), but worth knowing before running a large `infra/scripts` backfill.
- **Out of scope:** whether the DB webhook is configured for `INSERT`/`DELETE` as well as `UPDATE` (a Supabase dashboard/migration setting, not code). If it's `UPDATE`-only today, new/removed dishes won't invalidate until that's widened — noted, not changed here.

---

## Why no client change

`currentTime` must still be **sent** (the RPC filters daily/rotating menus on it, `feed:828`). We only stop it from contaminating the cache **identity**, which is built server-side. `edgeFunctionsService.ts` is untouched → no mobile rebuild, no app-store anything.

---

## Testing

- **Type/lint:** `deno check` both functions (deno lives at `~/.deno`, not on PATH; run from `infra/supabase/`). No node_modules: `deno test --node-modules-dir=none -A …` is the established invocation if we add a test.
- **Guard test (optional, your call):** a regression test asserting "key ignores `currentTime`, still varies on real filters" would lock in §S1. Cost: `feed/index.ts` calls `serve()` at top level, so importing it from a test starts a server — the clean way is to extract `buildFeedCacheKey()` into a small `feed/cache.ts` and test that. Given your "judge test ROI" stance on a solo project, my default is **skip it** and rely on the log check below; happy to add it if you'd rather have the guard.
- **Manual / prod verification (the real proof):**
  1. After deploy, load the feed twice from the same spot within 5 min → second response logs `[Feed] Cache hit` (today it never does) and `metadata.cached: true`.
  2. Edit a dish/menu in the portal → `invalidate-cache` logs `feedKeysDeleted > 0`; the next feed load is a miss (recomputes) and reflects the edit.

## Deploy (prod — you run these, or confirm and I will)

From `infra/supabase/`:
```bash
supabase functions deploy feed
supabase functions deploy invalidate-cache
```
Deploy **both together** (the §S1/§S6 pairing). This is a prod behavior change on a live cache — per how we handle prod, I'll hand you the commands rather than deploy unprompted unless you tell me to.

## Risk & rollback

- **§S1 risk:** a cached feed can be ≤5 min stale on open/closed status (bounded by TTL). This is the intended trade for the cache working at all. The `openNow` *toggle* still varies the key (it's user state, not the clock).
- **§S6 risk:** over-invalidation (harmless) and a SCAN per webhook (trivial at scale). No risk of deleting non-feed keys — `feed:v2:*` is an exact namespace.
- **Rollback:** `git revert` + redeploy the two functions. No schema/state migration, so rollback is clean and instant.

## Out of scope (deferred)

| Item | Why |
|------|-----|
| §S3 — fold open-hours into `generate_candidates` (drop the 2nd round-trip) | Separate latency win in the same file; its own change. |
| Geo-bucket coarsening (`toFixed(2)`) | Real hit-rate gain while panning, but changes shown distances/sort — needs a UX call. |
| `feed:byRestaurant:{id}` reverse index for targeted invalidation | Only worth it past current write volume; namespace-clear is correct meanwhile. |
| Webhook `INSERT`/`DELETE` coverage | Dashboard/migration config, not function code. |
| §S5 (double cosine distance), §S8 (UTC open-now in `get_group_candidates`, dead `primaryProtein` scoring, pin Redis import) | Tracked in the audit; independent. |

---

*Covers audit Part A §S1 + §S6. Companion: [`mobile-performance-audit.md`](../findings/mobile-performance-audit.md).*
