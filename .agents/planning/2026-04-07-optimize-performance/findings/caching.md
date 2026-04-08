# Caching Strategy Findings

## Investigation Date: 2026-04-07

---

### [High] Feed Cache Key Too Specific — Near-Zero Hit Rate

**File(s):** `infra/supabase/functions/feed/index.ts:396-409`
**Severity:** High
**Effort:** Medium (1–3 days)

**Current behavior:**
The feed function caches results in Redis with a key that includes the full serialized filter object:
```typescript
const cacheKey = `feed:${userId ?? 'anon'}:${location.lat.toFixed(3)}:${location.lng.toFixed(3)}:${JSON.stringify(filters)}`;
```

The filter object has ~20+ fields. Any change to price range, cuisine, calorie range, spice level, protein types, meat types, etc. creates a completely new cache key. The cache TTL is 300 seconds.

Given that users frequently adjust daily filters, and each user has unique permanent filters (allergies, dietary restrictions), the practical cache hit rate is near zero.

**Root cause:**
The cache key conflates "hard constraints" (which change the candidate set) with "soft boosts" (which only affect scoring). Any change to any filter — even soft boosts — invalidates the cache.

**Proposed fix:**
Implement a two-tier cache:

**Tier 1 — Candidate Pool Cache (shared across similar users):**
```
Key: candidates:{lat3}:{lng3}:{radius}:{hardFilterHash}
Value: 200 candidate rows from generate_candidates
TTL: 5 minutes
```
Hard filters: location, radius, diet_tag, allergens, religious_tags, exclude_families, exclude_spicy

**Tier 2 — Scored Result Cache (per-user):**
```
Key: feed:{userId}:{candidateHash}:{softFilterHash}
Value: Scored & ranked feed
TTL: 2 minutes
```

Stage 2 scoring is pure CPU (no DB calls), so re-scoring cached candidates is cheap (~5ms vs ~200ms for the full pipeline).

**Estimated impact:**
Could achieve 30-50% cache hit rate on Tier 1 (multiple users in the same area with the same dietary constraints share candidates). Saves ~200-400ms per hit.

---

### [High] Restaurant Metadata Not Cached — Fetched on Every Detail View

**File(s):** `apps/mobile/src/screens/RestaurantDetailScreen.tsx:94-117`
**Severity:** High
**Effort:** Medium (1–3 days)

**Current behavior:**
Every time a user opens a restaurant detail screen, the full restaurant + menu tree is fetched from Supabase. There is no client-side caching. If a user navigates back and re-opens the same restaurant, the entire payload is fetched again.

Restaurant metadata (name, hours, address, cuisine) changes very rarely. Menu data changes perhaps daily. Neither is cached.

**Root cause:**
No client-side caching layer (React Query, SWR, or even Zustand-based caching) for restaurant data.

**Proposed fix:**
1. **Short-term:** Cache restaurant data in a Zustand store with a Map<restaurantId, data>. Set a staleness timeout of 5 minutes.
2. **Long-term:** Use React Query or TanStack Query which provides automatic stale-while-revalidate, background refetching, and deduplication.
3. **Server-side:** Cache restaurant metadata in Redis (key: `restaurant:{id}`, TTL: 1 hour). Invalidate on restaurant update webhook.

**Estimated impact:**
Eliminates the heaviest query in the app (~1-2MB payload) for repeat views. Most users view the same 3-5 restaurants repeatedly.

---

### [Medium] Dish Enrichment Results Not Cached in Redis

**File(s):** `infra/supabase/functions/enrich-dish/index.ts`
**Severity:** Medium
**Effort:** Easy (< 1 day)

**Current behavior:**
The enrich-dish function has no Redis caching. It imports Redis from Upstash at the top level but the Redis client is only used in the `feed` function. Each enrichment call hits the database and potentially OpenAI API.

Enrichment results are stable — once a dish is enriched with `enrichment_status = 'completed'`, the result rarely changes unless the dish name/description is updated.

**Root cause:**
The function was designed to run on database webhooks (INSERT/UPDATE on dishes). The assumption was that each dish is enriched once. But manual re-enrichment and batch processing create redundant work.

**Proposed fix:**
Add Redis caching for enrichment results:
```typescript
const cacheKey = `enriched:${dishId}:${dish.updated_at}`;
const cached = await redis.get(cacheKey);
if (cached) return cached; // Skip re-enrichment
```

**Estimated impact:**
Prevents redundant OpenAI API calls during batch re-enrichment. Saves ~$0.001/dish on GPT-4o-mini + embedding costs, and ~500ms latency per call.

---

### [Medium] User Preferences Loaded from DB on Every Auth Event

**File(s):** `apps/mobile/src/stores/storeBindings.ts:39-43`
**Severity:** Medium
**Effort:** Easy (< 1 day)

**Current behavior:**
On every login transition, `storeBindings.ts` triggers:
```typescript
useFilterStore.getState().syncWithDatabase(currentUserId);
useOnboardingStore.getState().loadUserPreferences(currentUserId);
```
The `syncWithDatabase` call fetches `user_preferences` from Supabase every time, even if the user just logged in 5 minutes ago and nothing changed.

**Root cause:**
No local timestamp tracking when preferences were last fetched. The assumption is preferences might change between sessions.

**Proposed fix:**
1. Store `lastSyncedAt` timestamp in AsyncStorage alongside permanent filters
2. Skip DB fetch if last sync was < 30 minutes ago
3. Still force-sync after explicit preference changes

**Estimated impact:**
Eliminates 1-2 DB queries per app launch/resume for returning users.

---

### [Low] Feed Cache TTL (300s) — Appropriate for Current Use

**File(s):** `infra/supabase/functions/feed/index.ts:760`
**Severity:** Low
**Effort:** N/A

**Current behavior:**
```typescript
await redis.set(cacheKey, JSON.stringify(responseData), { ex: 300 });
```
5-minute TTL is reasonable for feed data that should reflect restaurant availability changes.

**Root cause:**
N/A — appropriate TTL.

**Proposed fix:**
No change to TTL needed. The main issue is the cache key granularity (covered above), not the TTL.

**Estimated impact:**
N/A.

---

### [Low] No Cache Invalidation on Restaurant Update

**File(s):** N/A (no cache invalidation logic found)
**Severity:** Low
**Effort:** Medium (1–3 days)

**Current behavior:**
When a restaurant owner updates menu data via the web portal, there is no mechanism to invalidate cached feed results or restaurant metadata in Redis.

**Root cause:**
The current Redis usage is limited to the feed function with a short TTL (5 minutes), so stale data is bounded. But if caching is expanded (as recommended above), invalidation becomes important.

**Proposed fix:**
Add a database webhook on restaurant/menu/dish updates that invalidates relevant Redis keys:
```typescript
// On restaurant update webhook:
await redis.del(`restaurant:${restaurantId}`);
await redis.del(`restaurant:cuisines:${restaurantId}`);
// Invalidate feed candidates for the restaurant's geographic area
```

**Estimated impact:**
Ensures fresh data after restaurant updates when caching is expanded. Low priority until caching improvements are implemented.
