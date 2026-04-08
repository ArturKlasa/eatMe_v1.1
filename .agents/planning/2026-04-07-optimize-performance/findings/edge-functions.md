# Edge Function Performance Findings

## Investigation Date: 2026-04-07

---

### [High] enrich-dish: 4 Sequential DB Queries That Could Be Parallelized

**File(s):** `infra/supabase/functions/enrich-dish/index.ts:357-405`
**Severity:** High
**Effort:** Easy (< 1 day)

**Current behavior:**
After loading the dish, `enrich-dish` makes 4 sequential `await` calls that are independent:
```typescript
// Line 361: Load ingredients
const { data: ingredientRows } = await supabase.from('dish_ingredients')...
// Line 372: Load option groups
const { data: optionGroupRows } = await supabase.from('option_groups')...
// Line 387: Load restaurant cuisine_types
const { data: restaurantRow } = await supabase.from('restaurants')...
// Line 401 (conditional): Load parent dish context
const { data: parentDish } = await supabase.from('dishes')...
```

Each `await` blocks until the previous completes. These 4 queries are independent — they don't depend on each other's results.

**Root cause:**
Sequential coding style — each query was written as a standalone block without considering parallelism.

**Proposed fix:**
```typescript
const [ingredientRows, optionGroupRows, restaurantRow, parentResult] = await Promise.all([
  supabase.from('dish_ingredients').select('...').eq('dish_id', dishId),
  supabase.from('option_groups').select('...').eq('dish_id', dishId).eq('is_active', true),
  supabase.from('restaurants').select('cuisine_types').eq('id', dish.restaurant_id).single(),
  dish.parent_dish_id 
    ? supabase.from('dishes').select('name').eq('id', dish.parent_dish_id).single()
    : Promise.resolve({ data: null }),
]);
```

**Estimated impact:**
Reduces DB query latency from ~4 × RTT to ~1 × RTT (parallelized). At ~20ms per Supabase round-trip, saves ~60ms per enrichment call. For batch processing of 100 dishes, saves ~6 seconds.

---

### [High] enrich-dish: No Redis Caching for Repeated Enrichments

**File(s):** `infra/supabase/functions/enrich-dish/index.ts`
**Severity:** High
**Effort:** Medium (1–3 days)

**Current behavior:**
The enrich-dish function has no Redis caching. Every invocation:
1. Makes 4+ DB queries
2. Potentially calls OpenAI GPT-4o-mini (~300ms)
3. Calls OpenAI embedding API (~150ms)
4. Writes back to DB

The only debounce is a simple 8-second window (`DEBOUNCE_SECONDS = 8` at line 33) checking if the dish was recently enriched. For batch re-enrichment, the same restaurant's cuisine_types are fetched repeatedly.

**Root cause:**
The function was designed for webhook-triggered single-dish enrichment. Batch scenarios weren't optimized.

**Proposed fix:**
1. Cache restaurant cuisine_types in Redis (key: `restaurant:cuisines:{id}`, TTL: 1 hour)
2. Cache completed enrichment results (key: `enriched:{dish_id}:{updated_at}`, TTL: 24 hours) to short-circuit re-enrichment
3. For batch mode, accept multiple dish_ids and share the restaurant lookup

**Estimated impact:**
For batch enrichment of 50 dishes across 5 restaurants, eliminates ~45 redundant restaurant queries and potentially ~50 embedding API calls for already-enriched dishes. Reduces batch time from ~25s to ~5s.

---

### [Medium] feed: Cache Key Includes Full Filter JSON — Low Hit Rate

**File(s):** `infra/supabase/functions/feed/index.ts:396`
**Severity:** Medium
**Effort:** Easy (< 1 day)

**Current behavior:**
```typescript
const cacheKey = `feed:${userId ?? 'anon'}:${location.lat.toFixed(3)}:${location.lng.toFixed(3)}:${JSON.stringify(filters)}`;
```
The cache key includes the full `JSON.stringify(filters)` object. The filters object has ~20 fields including price range, diet preference, cuisine list, calorie range, protein types, meat types, etc. Any small change to any filter creates a new cache key.

Cache TTL is 300 seconds (5 minutes) at line 760.

**Root cause:**
The cache key was designed for correctness (exact filter match) rather than hit rate.

**Proposed fix:**
1. Hash the filter object deterministically: `const filterHash = await crypto.subtle.digest('SHA-256', JSON.stringify(sortedFilters))`
2. Separate "hard filter" vs "soft boost" parameters — only hard filters should invalidate the cache. Soft boosts (cuisine preference, spice level, price range) affect scoring but not the candidate set.
3. Consider caching the Stage 1 candidate pool (200 candidates) separately from the final scored result. Stage 1 depends only on location + hard filters.

**Estimated impact:**
Could improve cache hit rate from near-zero to ~30-50% for users in the same area with similar dietary constraints. Would save ~200-400ms per cache hit (skipping the generate_candidates RPC).

---

### [Medium] feed: Extra DB Query for Favorited Restaurant Cuisines

**File(s):** `infra/supabase/functions/feed/index.ts:473-484`
**Severity:** Medium
**Effort:** Easy (< 1 day)

**Current behavior:**
After loading user favorites in parallel (line 449), the function makes an additional sequential query to fetch cuisine_types of favorited restaurants:
```typescript
const { data: favRestaurants } = await supabase
  .from('restaurants')
  .select('cuisine_types')
  .in('id', favIds);
```
This happens AFTER the initial `Promise.all()` and blocks Stage 1.

**Root cause:**
The favorites query only returns `subject_id` (restaurant IDs). A second query is needed to resolve cuisine_types. This wasn't included in the initial Promise.all.

**Proposed fix:**
Use a Supabase join in the favorites query to include restaurant data:
```typescript
supabase
  .from('favorites')
  .select('subject_id, restaurants!inner(cuisine_types)')
  .eq('user_id', userId)
  .eq('subject_type', 'restaurant')
```
Or fold the cuisine lookup into the existing Promise.all.

**Estimated impact:**
Eliminates one additional DB round-trip (~20ms) per feed request for users with favorites.

---

### [Medium] nearby-restaurants: Full Table Scan Without PostGIS

**File(s):** `infra/supabase/functions/nearby-restaurants/index.ts:180-284`
**Severity:** Medium
**Effort:** Easy (< 1 day)

**Current behavior:**
Fetches ALL restaurants with `select('*')` including nested menus/dishes, then filters by distance in JavaScript. No PostGIS `ST_DWithin` used.

The function has a deprecation notice (line 143-148) monitoring traffic to confirm no clients still use it.

**Root cause:**
Legacy endpoint superseded by the `feed` Edge Function.

**Proposed fix:**
Confirm zero traffic from the telemetry logs, then remove the function from the Edge Function registry.

**Estimated impact:**
Removes a cold-start-heavy function from the deployment. If accidentally called, it currently fetches the entire restaurant table with nested joins — potentially megabytes of data.

---

### [Low] group-recommendations: Well-Parallelized User Context Loading

**File(s):** `infra/supabase/functions/group-recommendations/index.ts:259-268`
**Severity:** Low
**Effort:** N/A

**Current behavior:**
Preferences and behavior profiles are loaded in parallel via `Promise.all`:
```typescript
const [prefsRes, behaviorRes] = await Promise.all([
  serviceClient.from('user_preferences').select('...').in('user_id', memberIds),
  serviceClient.from('user_behavior_profiles').select('...').in('user_id', memberIds),
]);
```

**Root cause:**
N/A — good pattern already in place.

**Proposed fix:**
No change needed. The function correctly parallelizes independent queries.

**Estimated impact:**
N/A — confirming good pattern.

---

### [Low] Edge Functions: No Response Compression

**File(s):** All edge functions
**Severity:** Low
**Effort:** Easy (< 1 day)

**Current behavior:**
No edge function sets compression headers. Responses are sent as raw JSON. The feed function returns up to 20 dishes + 50 restaurants — potentially ~50-100KB uncompressed.

**Root cause:**
Supabase Edge Functions (Deno) support gzip but it's not automatically applied.

**Proposed fix:**
Add response compression for large payloads:
```typescript
const encoder = new TextEncoder();
const body = encoder.encode(JSON.stringify(responseData));
const compressed = await new Response(
  new Response(body).body?.pipeThrough(new CompressionStream('gzip'))
).arrayBuffer();

return new Response(compressed, {
  headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' }
});
```

**Estimated impact:**
JSON compresses ~70-80%. Could reduce feed response from ~80KB to ~20KB, improving mobile load times on slow connections.
