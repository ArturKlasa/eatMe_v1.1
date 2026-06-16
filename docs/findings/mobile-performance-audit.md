# Mobile Performance & Latency Audit

**Date:** 2026-06-13
**Scope:** EatMe mobile app (`apps/mobile`) + the Supabase Edge Functions in its hot paths (`feed`, restaurant detail queries). Covers dish-suggestion latency, menu loading, and unnecessary React re-renders.
**Status:** Read-only analysis. **No changes implemented.** This document records findings and a prioritized improvement plan only.
**Method:** Parallel deep reads of the map screen, stores, hooks, map components, restaurant-detail screen, and the `feed` Edge Function + its SQL RPCs. The highest-impact claims were independently verified against source (noted *Verified* inline).

---

## 0. Executive summary — biggest wins first

Ranked by **impact ÷ effort**. Details in the linked sections.

| # | Win | Effort | Impact | Where |
|---|-----|--------|--------|-------|
| 1 | **Drop `currentTime` from the feed cache key** — it changes every minute, defeating the 5-min Redis cache (hit rate ≈ 0). | Trivial | **Very high** — every feed load currently pays full cost | §S1 |
| 2 | **`useCallback` the map marker handlers** — `handleMarkerPress`/`handleDishMarkerPress` are inline, defeating the `React.memo` on the marker layers → every Mapbox annotation rebuilds on *any* state flip. | Low | **High** (map jank) | §R1 |
| 3 | **Stop eager-loading every menu category on restaurant open** — the "lazy" design is negated; a 6-category menu fires ~18 queries in a burst. | Low–Med | **High** (cold-open latency) | §M1 |
| 4 | **Fold open-hours into `generate_candidates`** — removes a serial second DB round-trip from the feed critical path. | Low | Medium–High | §S3 |
| 5 | **Memoize `DishMenuItem` / `ModifierGroupsList` + hoist inline styles**, and **virtualize the menu list** (FlatList/FlashList instead of `ScrollView`+`.map`). | Med | **High** (menu scroll + re-render) | §M2, §M3 |
| 6 | **Delete the two dead `restaurants`/`dishes` useMemos** in `BasicMapScreen` — they run `new Date()` ×2 per restaurant on data change and feed nothing. | Trivial | Medium | §R2 |
| 7 | **Memoize the rest of the map children** (`MapFooter`, `MapControls`) + the per-render store-method calls. | Med | Medium | §R3, §R4 |

> ✅ **Ruled out by prod verification (2026-06-13):** the GiST spatial index on `restaurants.location_point` **and** all Stage-1 join-chain FK indexes **already exist** in the live DB (§S2/§S4). The originally-flagged "missing index" items were a migration-drift false alarm. The DB is well-indexed — backend latency is about the cache and round-trips, not missing indexes.

> ✅ **Implemented since this audit (2026-06-13 → 06-15):** §S1 (cache key, `caf879d`), §S3 (open-hours fold + migration 167, `8487d31`), §S6 (feed-cache invalidation, `caf879d` — **pending `invalidate-cache` deploy**), the §S8 `get_group_candidates` timezone fix (migration 168, `738b844`), and the §S8 Redis version pin (`b08f63a`). §S1 + §S3 + the §S8 timezone/pin items are **live**. Still open in §S8: dead `primaryProtein` scoring, Stage-1 payload bloat. **New post-audit finding (§S9) — now ✅ FIXED:** `generate_candidates` exceeded the 8s statement timeout beyond ~5km on the full dish set — first mitigated client-side by the auto-expanding feed radius (capped at 5km, `dc3b2d1`/`e0101ab`), then fixed at the source by the modifier-JSON push-down (migration 169) which bounds Stage-1 modifier work to `p_limit`. Measured ~1.25s flat across 5–8km post-deploy; the 5km client cap can now be relaxed.

There are two independent performance problems here, and they compound:

- **Backend:** each feed request is more expensive than it should be — the Redis cache never hits (§S1) and there's an avoidable serial round-trip (§S3). *(The DB itself is well-indexed — the spatial + join-chain indexes were verified present in prod on 2026-06-13, §S2/§S4.)*
- **Frontend:** the map screen and the menu screen re-render far more than necessary, and the menu loads/mounts everything up-front. **This is where the felt, at-any-scale wins are.**

---

# Part A — Backend / Edge-Function latency

The `feed` function is a two-stage pipeline: **Stage 1** = `generate_candidates` SQL RPC (up to 200 candidates, pgvector ANN + popularity + distance), **Stage 2** = JS re-scoring with ~13 additive soft boosts, then diversity cap + open-hours filter. Reference: `infra/supabase/functions/feed/index.ts`.

### S1 — The feed Redis cache is defeated by its own key — ✅ DONE (was VERY HIGH)

**Update 2026-06-13:** Fixed in `caf879d` — `currentTime` is rest-spread out of the cache key (`feed/index.ts:694`), so the 5-min Redis cache now survives the minute boundary; the RPC still receives `currentTime` for server-side time filtering. **Live** (shipped with the §S3 feed redeploy). Original analysis retained below.

The cache key is built at `feed/index.ts:682`:

```
feed:v2:{userId}:{lat.toFixed(3)}:{lng.toFixed(3)}:{JSON.stringify(filters)}
```

`buildFilters` injects `currentTime` at **minute** granularity into `filters` (`edgeFunctionsService.ts:228-232`, verified):

```ts
currentTime: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }),  // "HH:MM"
```

The cache TTL is 300 s (`feed/index.ts:1012`). Because `currentTime` is part of the serialized `filters` segment of the key and changes **every minute**, the key mutates ≥4 times within one TTL window → **the same user effectively never hits the cache.** `lat/lng.toFixed(3)` (~110 m) fragments keys further as the user pans.

**Why it matters:** every feed load pays the full Stage-1 SQL + Stage-2 scoring + open-hours round-trip. The cache is currently decorative.

**Fix direction:** exclude `currentTime` from the cache key (the SQL already filters on time server-side, so it doesn't belong in the cache identity), or bucket it coarsely (e.g. 15-min). Consider also coarsening the geohash or rounding filter values.

### S2 — Spatial index on `restaurants.location_point` — ✅ RESOLVED (exists in prod)

**Update 2026-06-13:** verified against live prod via `pg_indexes`. The index **exists**:
`restaurants_location_point_idx — CREATE INDEX … USING gist (location_point)`. **No action needed.**

The audit originally flagged this as possibly missing because a repo-wide grep across `infra/supabase/migrations/*.sql` found no `gist`/`location_point` index and the baseline `database_schema.sql` captures **zero** `CREATE INDEX` statements. That was a migration-drift false alarm — the index was created in pre-071 history not represented in the tracked migrations. The only real residue is **schema drift**: a fresh environment built purely from the tracked migrations would lack this (and many other) indexes. Reconciling the migration baseline is worthwhile hygiene someday, but it's not a latency issue.

### S3 — Two serial DB round-trips gate every feed response — ✅ DONE (was MEDIUM-HIGH)

**Update 2026-06-13:** Fixed in `8487d31` (+ migration 167) — `generate_candidates` now returns `open_hours / timezone / country_code`, and the feed builds its open-info map from those rows instead of issuing a second query. **Live** (migration applied + feed redeployed). Original analysis retained below.

The critical path is strictly serial: parallel user-context block → **await** `generate_candidates` → **await** a *second* query for `open_hours / timezone / country_code` (`feed/index.ts:886-890`, can't start until Stage-1 restaurant IDs are known) → response. That's 3 serial awaits (4 for logged-in users).

The open-hours data is already on the `restaurants` row that `generate_candidates` joins — it could be returned by the RPC directly, **eliminating the round-trip**.

**Fix direction:** add `r.open_hours, r.timezone, r.country_code` to the `generate_candidates` projection and drop the second query.

### S4 — Stage-1 join-chain FK indexes — ✅ RESOLVED (all exist in prod)

**Update 2026-06-13:** verified — every join-chain FK column is indexed in prod: `dishes_menu_category_id_idx`, `dishes_dish_category_id_idx`, `dishes_restaurant_id_idx`, `option_groups_dish_id_idx`, `options_option_group_id_idx`, `menu_categories_menu_id_idx`. Same migration-drift false alarm as §S2 — present in the live DB, absent from tracked migrations. **No action needed.**

**Minor smell spotted in the same check (hygiene, not latency):** `dishes` carries a **duplicate index** — both `dishes_menu_id_idx` and `dishes_menu_category_id_idx` are defined on the *same* column `(menu_category_id)` (the former is also misnamed). Dropping the redundant `dishes_menu_id_idx` would shave write/storage overhead. There's also a GIN index `restaurants_location_idx` on the legacy `location` column (separate from the live `location_point` GiST) that is likely vestigial.

### S5 — pgvector ANN not used at current scale; cosine distance computed twice — **LOW now, compounding**

The HNSW index `dishes_embedding_hnsw_idx` exists (migration 136) but the planner only adopts it above ~5k rows (~375 indexed today), so the vector sort is currently a brute-force seq scan. Worse, `embedding <=> p_preference_vector` is computed **twice per row** — once in `SELECT`, once in `ORDER BY` — instead of by alias. Negligible now, a multiplier later.

### S6 — Cache invalidation is a no-op — ✅ DONE in code (`caf879d`), ⚠️ pending `invalidate-cache` deploy

**Update 2026-06-13:** Fixed in `caf879d` — `invalidate-cache` now SCAN-deletes the whole `feed:v2:*` namespace on any restaurant/menu/dish change (plus best-effort per-restaurant keys). Code committed + `deno check` clean, **but `invalidate-cache` is a separate function that must be deployed independently** (`supabase functions deploy invalidate-cache`); until that deploy lands, the old no-op version is live. Original analysis retained below.

`invalidate-cache` deletes keys like `restaurant:{id}` / `restaurant:cuisines:{id}`, but the feed writes keys under `feed:v2:{user}:{geo}:{filters}`. **The webhook never clears any feed cache entry** — stale feed data persists until TTL. (Bounded today because §S1 makes hits rare, but the mechanism is non-functional and will silently fail once §S1 is fixed.)

### S7 — `nearby-restaurants` is an O(N) full-table scan with nested menu payload — ✅ DONE

**Update 2026-06-15:** Decommissioned. The mobile nearby path was fully dead (its entry point `handleRefresh` was never wired) — removed in `bb22003` along with `geoService.ts`/`filterService.ts` and the legacy `restaurants`/`dishes` store layer (see `docs/plans/decommission-nearby-restaurants-s7.md`). The edge function itself + the web-portal-v2 integration tests that referenced it were then deleted. Original analysis retained below.

`nearby-restaurants/index.ts:158-191` does `restaurants.select('*, menus(*, dishes(*))').eq('status','published')` with **no radius filter in SQL** — fetches *all* published restaurants with *all* menus and dishes, then filters by Haversine in JS. The file flags itself as deprecated. **The mobile client's live path uses `getCombinedFeed` (feed), and the `geoService` nearby path is dead (see filters doc §5.2 D5)** — so this is likely already cold. **Action: confirm zero traffic and delete.**

### S8 — Other backend notes

- ✅ **DONE (`738b844`, migration 168):** ~~`get_group_candidates` uses UTC open-now~~ — `is_restaurant_open_now` now takes a `timezone` arg and evaluates open/closed in the restaurant's local zone. Was: the same UTC bug the feed already fixed in JS; mis-evaluated non-UTC restaurants and could trigger the 2× radius retry.
- **`primaryProtein` scoring is dead** — the feed scores it heavily (+0.30 dish, +100 option weight) but the mobile client never sends it (no `primaryProtein` in `FeedRequest`/`buildFilters`). Wire it or remove it.
- ✅ **DONE (`b08f63a`):** ~~`@upstash/redis@latest` import pin~~ — pinned to `@upstash/redis@1.38.0` (`feed/index.ts:15`).
- **Stage-1 payload is heavy** — 200 candidates each carrying full `modifier_groups` jsonb + `reachable_*` arrays; `view_count` is returned but never used. Minor bloat ×200.

### S9 — `generate_candidates` exceeds the statement timeout beyond ~5km — **MEDIUM** ✅ FIXED (migration 169, 2026-06-16)

During §S3 rollout the map went empty in prod. Root cause was **not** §S3: `generate_candidates` over the full published-dish set (~8.4k dishes) exceeds Postgres' 8s statement timeout (error 57014) past ~5km radius, so the feed 500s. A stale-stats plan regression made it worse — `ANALYZE` brought ≤5km back to ~1s, but 8km+ still times out.

**Mitigation (shipped):** the mobile feed now uses an auto-expanding radius — starts at 1.5km, widens 1.5→3→5km until ≥5 dishes, **hard-capped at 5km** (`dc3b2d1`, `e0101ab`). This sidesteps the timeout entirely but means **distance preferences above 5km currently behave as 5km**.

**Real fix (shipped — migration 169, 2026-06-16):** the modifier-JSON push-down. The old `dish_modifiers` CTE (mig 167) built the full modifier JSON + `option_proteins` for *every* dish with active `option_groups` in the whole DB — no radius filter, no LIMIT — even though only ≤`p_limit` (200) rows are returned. Whether that whole-table aggregate landed on the hot path was a **planner choice** driven by stats (fresh → nested-loop the few in-range dishes, ~1s; stale → hash-aggregate all `option_groups`, >8s), which is exactly why a one-off `ANALYZE` "fixed" it and it drifted back two days later. 169 restructures into a `MATERIALIZED candidates` CTE (every cheap filter + `ORDER BY` + `LIMIT`, **zero** modifier work) feeding a `LATERAL` that builds modifier JSON for **only the ≤200 survivors**; the lone WHERE use of the old CTE, `required_groups_safe`, is inlined as a `NOT EXISTS` that runs only under an active diet filter. Modifier cost is now bounded by `p_limit` **by construction**, so a drifted plan can no longer re-create the cliff. Same arg signature + 32-column return shape → the feed function is untouched. Measured post-deploy (fresh stats, MX City, NULL vector): **5km = 1.25s / 46k buffers, 8km = 1.28s / 56k buffers** — near-flat across radius (2.5× the area adds ~22% buffers but only ~2% time), because the dominant cost is now the radius-independent 200-row modifier build. **Consequence:** the 5km client cap is now a band-aid over a fixed root cause and can be relaxed/removed — pending a 10/15km EXPLAIN sanity check.

---

# Part B — Mobile rendering (unnecessary re-renders)

`BasicMapScreen` is a single **767-line monolith** holding ~8 `useState` slices + 6 store subscriptions. Because nearly every callback and child prop is recreated inline, any state flip (footer height, menu toggle, feed-loading) re-runs the whole body and cascades into the Mapbox markers and footer. The `React.memo` already on the marker layers is almost entirely defeated.

### R1 — Marker `React.memo` defeated by inline callbacks — **HIGH** *(Verified)*

`RestaurantMarkers` / `DishMarkers` are wrapped in `React.memo`, but receive handlers defined as plain functions (verified — `handleMarkerPress` at `BasicMapScreen.tsx:363`, `handleDishMarkerPress` at `:374`, neither `useCallback`), passed at `:641` / `:643`. New function identity every render → memo comparison fails → the marker layer re-renders → its `.map()` **rebuilds every `PointAnnotation`** (one of Mapbox's most expensive primitives, each a native view host) on *any* unrelated state change (footer measure, menu toggle, loading flip).

**Fix direction:** wrap both handlers in `useCallback` (stable deps: `rootNavigation`). This is the single biggest cheap front-end win.

### R2 — Two dead `useMemo`s do real work and feed nothing — **MEDIUM** *(Verified)*

`const restaurants = useMemo(...)` (`BasicMapScreen.tsx:135`) maps over `nearbyRestaurants` calling `estimateAvgPrice`, `formatDistance`, and `isRestaurantOpenNow` (which does `new Date()` **twice per restaurant**). `const dishes = useMemo(...)` (`:162`) triple-nests over `menus → dishes`. **Neither is consumed** — the map renders from `mapPinRestaurants` (`:244`) / `mapPinDishes` (`:257`), built from the *separate* feed state. (Verified: the only other `restaurants`/`dishes` references are block-scoped shadows inside the feed callback at `:313-318`.) Pure dead CPU that runs whenever `nearbyRestaurants` changes.

**Fix direction:** delete both memos (and confirm/remove the now-unused `nearbyRestaurants` data layer for the map).

### R3 — Store methods called in the render body return fresh values every render — **HIGH**

`getRecentRestaurantsForRating()` is **invoked in the render body** (`BasicMapScreen.tsx:124`); it does `.filter().sort()` and returns a **brand-new array every call** (`sessionStore.ts:273-282`), then feeds `RatingFlowModal` as a prop (`:699`) → defeats downstream memoization every render. `shouldShowPrompt()` (`:118`) recomputes `new Date()` math every render too.

**Fix direction:** select the raw array from the store and derive the filtered/sorted list in a `useMemo`; gate the banner on primitive store fields, not a method call.

### R4 — Map children not memoized + fresh inline callbacks — **MEDIUM-HIGH**

`MapFooter` (`MapFooter.tsx:35`), `MapControls` (`:22`), and `FloatingMenu` (`:40`) are plain `React.FC` (no `React.memo`) and receive freshly-created handlers each render (`handleMyLocationPress`, `handleMenuPress`, `handleDishPress`, `closeMenu`…). So every screen re-render re-renders the footer's horizontal `ScrollView` and re-runs `MapFooter`'s `.map()` over `recommendedDishes`, re-rendering each `expo-image` card. (`FloatingMenu` early-returns when closed, so it's cheap unless open.)

**Fix direction:** `React.memo` the three components and `useCallback` all handlers passed to them.

### R5 — Feed-refetch effect over-fires on object-identity churn — **MEDIUM**

The feed effect (`BasicMapScreen.tsx:298-332`, deps `[userLocation, daily, permanent]`) re-runs whenever any dep changes *identity*. `replaceDailyFilters({...filters})` always spreads a new object (`filterStore.ts:529`), and `useUserLocation` sets a **new** `userLocation` object on every GPS success (`useUserLocation.ts:121-128`) even when coordinates are unchanged. Net: more `/feed` calls than semantically required, each setting 2 state slices → cascade. (A 300 ms debounce is present but doesn't dedupe identical values.)

**Fix direction:** key the effect on a stable primitive signature (serialized filters + rounded lat/lng) rather than object identity; memoize `userLocation` by value.

### R6 — `useUserLocation` returns unstable function identities — **MEDIUM**

`requestPermission`, `getCurrentLocation`, `getLocationWithPermission`, `clearLocation` are recreated every render (no `useCallback`); the hook returns a new `{...state, ...fns}` object each render (`:194-200`). Three effects in `BasicMapScreen` depend on these and work around the churn by omitting them from deps (with comments admitting the workaround). `getCurrentLocation` also reads `state.cachedLocation` from a closure that can go stale.

**Fix direction:** `useCallback` the hook's functions; move the location cache to a `useRef`; consider lifting location into a Zustand store for narrow subscription.

### R7 — Whole-store subscriptions (no selector) — **MEDIUM / LOW**

| Component | Issue | Ref |
|-----------|-------|-----|
| `BasicMapScreen` | Bare `useRestaurantStore()` destructuring 4 fields → re-renders on *any* store mutation, including the detail/category cache clones below | `BasicMapScreen.tsx:94-99` |
| `restaurantStore` caches | `restaurantDetailCache` / `categoryDishesCache` are `Map`s in Zustand state, cloned (`new Map(cache)`) and `set({...})` on every write → notifies **all** subscribers (incl. the map screen) | `restaurantStore.ts:300-302, 352-354` |
| `FilterFAB` | `const { … } = useFilterStore()` no selector + calls `getDailyFilterCount()` (15-branch scan w/ sync `require`) in render. *(Not currently mounted — flagged as the textbook anti-pattern.)* | `FilterFAB.tsx:23-34` |
| `DailyFilterModal` | Subscribes to `state.daily` only to seed local state on open, but still re-renders the ~450-line modal on any global `daily` change; price-slider drag lifts state per gesture frame, re-running cuisine/meal `.map()`s | `DailyFilterModal.tsx:53` |
| `ViewModeToggle` | Whole-store `useViewModeStore()` (tiny store, minor) | `ViewModeToggle.tsx:12` |

**Fix direction:** narrow selectors (`useShallow` for multi-field); move the `restaurantStore` `Map` caches out of reactive state into a module-level ref; read `state.daily` via `getState()` in the modal's open effect instead of subscribing.

### R8 — Low-impact

- Large inline `style={{…}}` objects on conditional banners (`BasicMapScreen.tsx:667-692, 717-760`) — hoist to `StyleSheet.create`.
- `recommendedDishes` recompiles two regexes inside the `useMemo` body (`:196-214`) — move to module scope.
- `DishMarkers.getEmoji` redefined per render, always called with `''` → constant `'🍽️'` (`DishMarkers.tsx:28-33`).

---

# Part C — Menu loading (restaurant detail)

When a user taps a restaurant, the detail screen loads via **direct Supabase (PostgREST) queries** (not the feed). The skeleton (restaurant + menus + categories, *no dishes*) loads first and gates the UI; then dishes/ratings/opinions stream in per category.

### M1 — The whole menu is eager-loaded, defeating the lazy design — **HIGH** *(Verified)*

Despite a "lazy per-category dish loading" comment, `useRestaurantDetail.ts:224-231` (verified) fires `loadCategoryDishes` for **every category of every menu** the moment the skeleton arrives:

```ts
useEffect(() => {
  if (!restaurant) return;
  restaurant.menus?.forEach(menu =>
    menu.menu_categories?.forEach(cat => { if (cat?.id) loadCategoryDishes(cat.id); })
  );
}, [restaurant?.id, loadCategoryDishes]);
```

Each category triggers 3 queries (dishes + ratings + opinions). A 6-category menu = **~18 queries in a burst** on top of the 4 skeleton/favorite queries. The per-category "Load dishes" button and `'loading'`/`undefined` states (`FoodTab.tsx:190-211`) are **dead UI** — categories never sit unloaded.

**Fix direction:** load only the first/expanded category eagerly; load others on scroll/expand. Or replace with a single "all dishes for this restaurant" query.

### M2 — `ScrollView` + `.map`, not a virtualized list — **HIGH**

`FoodTab.tsx:117` is a `ScrollView`; the menu is `menus.map → menu_categories.map → sorted.map(dish)`. **Every dish row + every `ModifierGroupsList` + all option rows mount at once** — no virtualization. A 100-dish menu mounts 100 `DishMenuItem` + 100 `ModifierGroupsList` up front. Compounds with M1 (everything loaded *and* mounted).

**Fix direction:** flatten to a sectioned `FlashList` / `SectionList` so only on-screen rows render.

### M3 — No `React.memo` on rows; double classification; re-sort every render — **HIGH**

- `DishMenuItem`, `ModifierGroupsList`, `DishRatingBadge`, `RestaurantRatingBadge` are all plain components (zero `React.memo` in the dir). Any `categoryDishes` / `dishRatings` / `userDishOpinions` Map update (one per streaming category, per M1) re-renders the **entire** mounted tree.
- `sortedDishes(dishes, permanentFilters)` runs **inside the category `.map`, unmemoized** (`FoodTab.tsx:174`) → re-classifies + re-sorts every dish every render. Then `DishMenuItem.tsx:84` calls `classifyDish` **again** for the same dish (result already computed in `sortedDishes` but discarded). **Each dish is classified twice per render.**
- `ModifierGroupsList.tsx:44-47` re-filters + re-sorts groups and options inline every render — work already done once in `handleDishPress` for the modal path.

**Fix direction:** `React.memo` the rows; hoist inline row styles (`FoodTab.tsx:218-223, 235`) into `StyleSheet`; `useMemo` the per-category sorted/classified list keyed on `[dishes, permanentFilters]`; pass `passesHardFilters` down instead of recomputing.

### M4 — Per-category fan-out instead of batched queries — **MEDIUM**

Ratings (`getDishRatingsBatch`) and opinions (`getUserDishOpinions`) are already `.in(dishIds)` batch-capable but are scoped **per category**, so they run N times with small ID lists instead of once across all dish IDs.

**Fix direction:** fetch all dishes for the restaurant, then one ratings batch + one opinions batch across the full dish-id set.

### M5 — Reopening a restaurant is **not** instant — **MEDIUM**

`fetchRestaurantDetail` and `fetchCategoryDishes` have a 5-min in-memory TTL cache (`restaurantStore.ts:32-33`) — good. But **ratings, opinions, restaurant rating, favorites, and photos are not cached** — they re-run on every open even on a cache hit (`useRestaurantDetail.ts:155-161`, and per-category F/G always re-run). So menu *text* appears instantly but badges/hearts repopulate after a network round-trip. No pull-to-refresh to force-bust; staleness is TTL-only.

**Fix direction:** cache ratings/opinions/photos with a short TTL and gate their fetch on a cache check; add pull-to-refresh that clears the two store caches for this id.

### M6 — Dish photos use plain RN `<Image>` (no cache, full-res thumbnails) — **MEDIUM**

`DishPhotoModal.tsx:14` imports `Image` from `react-native` (the rest of the app uses `expo-image`). The hero (`:281`) and the 60×60 thumbnails (`:326`) both load `photo_url` at **full resolution**, with no memory/disk cache → re-opening re-downloads, and every thumbnail downloads a full-size image.

**Fix direction:** switch to `expo-image` with `cachePolicy="memory-disk"`; request a resized URL for thumbnails.

### M7 — Smaller items

- `toggleFavorite` does read-then-write (2–3 sequential round-trips) per tap (`favoritesService.ts:132-157`) → use a single upsert/delete or a toggle RPC.
- `dish_photos.select('*')` over-fetches on the hot dish-tap path (`useRestaurantDetail.ts:286`) → explicit columns.
- 12 s timeout race (`:129-135`) means a stalled query blocks the spinner 12 s before "not found" → lower to ~5–6 s.
- Dead/duplicate: `handleFavoriteToggle` exported but unused (`:254-264`); `basePrice` prop unused in `ModifierGroupsList` (`:38`); `useDish.ts` likely unused on this path (and `select('*')`); `ModifierGroupsList.describeSelection` emits hardcoded English (i18n smell).
- Effect-dependency churn: `loadCategoryDishes` deps include `user?.id`; when sign-in resolves after `restaurant?.id`, the auto-load effect re-fires for every category (network saved by a `prev.has` guard, but ratings/opinions re-fetch and rows re-render).

---

# Part D — Prioritized roadmap (not implemented)

**Phase 1 — trivial, high-yield (do first):**
1. ✅ Remove `currentTime` from the feed cache key (§S1) — done `caf879d`, live.
2. `useCallback` the marker handlers (§R1).
3. Delete the dead `restaurants`/`dishes` memos in `BasicMapScreen` (§R2).
4. ~~Verify the spatial index against live prod (§S2)~~ — ✅ **Done 2026-06-13: the spatial index + all join-chain FK indexes exist in prod. No DB index work needed.**

**Phase 2 — low effort, structural:**
5. Stop eager-loading all menu categories (§M1).
6. ✅ Fold open-hours into `generate_candidates` (§S3) — done `8487d31` + migration 167, live.
7. Memoize map children + fix the per-render store-method calls (§R3, §R4).
8. Narrow the whole-store subscriptions / move `Map` caches out of reactive state (§R7).

**Phase 3 — medium effort, biggest structural payoff:**
9. Virtualize the menu list + memoize rows + de-duplicate classification (§M2, §M3).
10. Batch dishes/ratings/opinions; cache ratings/opinions/photos; switch dish photos to `expo-image` (§M4, §M5, §M6).
11. Stabilize `useUserLocation`; key the feed effect on a primitive signature (§R5, §R6).

**Cleanup / correctness (fold in opportunistically):**
12. ✅ Fix `invalidate-cache` key patterns (§S6) — done `caf879d`; **deploy `invalidate-cache` to make it live** (the only open step in the S1+S6 pair).
13. ✅ Decommission `nearby-restaurants` (§S7 — done: mobile path `bb22003`, edge fn + v2 tests removed); ✅ fix `get_group_candidates` UTC open-now (§S8 — done `738b844`/migration 168); wire or remove `primaryProtein` (§S8, still open); ✅ pin the Redis import (done `b08f63a`).

> **Note on §S1 + §S6 ordering:** fixing the cache key (§S1) will make the cache actually hit — at which point the broken invalidation (§S6) becomes a real staleness bug. Treat them as a pair.

---

## Appendix — file map

| Area | Key files |
|------|-----------|
| Feed pipeline | `infra/supabase/functions/feed/index.ts`; RPCs in `migrations/163_*.sql` (`generate_candidates`, `get_group_candidates`) |
| Feed client / serializer | `apps/mobile/src/services/edgeFunctionsService.ts` (`buildFilters` `:180-237`, cache-relevant `currentTime` `:228`) |
| Map screen | `apps/mobile/src/screens/BasicMapScreen.tsx` (767 lines) |
| Map components | `apps/mobile/src/components/map/{RestaurantMarkers,DishMarkers,MapFooter,MapControls,DailyFilterModal,ViewModeToggle}.tsx` |
| Location | `apps/mobile/src/hooks/useUserLocation.ts` |
| Stores | `apps/mobile/src/stores/{restaurantStore,sessionStore,filterStore,viewModeStore}.ts` |
| Restaurant detail | `apps/mobile/src/screens/restaurant-detail/{useRestaurantDetail,FoodTab,DishMenuItem,ModifierGroupsList}.ts(x)` |
| Photos | `apps/mobile/src/components/DishPhotoModal.tsx` |
| Indexes (audit) | `infra/supabase/migrations/076_performance_indexes.sql` (no spatial index) |

---

*Companion document: [`mobile-filters-evaluation.md`](./mobile-filters-evaluation.md) — daily vs permanent filter system evaluation.*
