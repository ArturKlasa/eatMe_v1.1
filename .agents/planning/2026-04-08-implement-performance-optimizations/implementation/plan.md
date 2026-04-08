# Implementation Plan — Performance Optimizations

## Project: 2026-04-08-implement-performance-optimizations
## Date: 2026-04-08

---

## Checklist

- [x] Step 1: DB Migration — Missing Indexes
- [x] Step 2: RestaurantDetailScreen — Explicit Column Select
- [x] Step 3: enrich-dish — Parallelize Sequential Queries
- [x] Step 4: feed Edge Function — Slim Response + Favorites Join
- [x] Step 5: BasicMapScreen — useShallow Selectors
- [x] Step 6: Explicit Selects in eatTogetherService + dishPhotoService
- [x] Step 7: filterStore — Debounce saveFilters()
- [x] Step 8: expo-image — Install and Full Migration
- [x] Step 9: Client-Side Restaurant Cache in Zustand
- [x] Step 10: User Preferences Sync Debounce
- [x] Step 11: viewHistoryService — Combined DB View
- [x] Step 12: FlatList getItemLayout in ViewedHistoryScreen
- [x] Step 13: Per-Category Lazy Loading in RestaurantDetailScreen
- [x] Step 14: feed Edge Function — Response Compression
- [x] Step 15: Cache Invalidation Webhook

---

## Step 1: DB Migration — Missing Indexes

**Objective:** Add 7 missing database indexes to eliminate sequential scans on the most frequently queried columns.

**Implementation guidance:**
- Create a new migration file `infra/supabase/migrations/076_performance_indexes.sql`
- Add the following indexes:
  ```sql
  -- Feed load: favorites lookup
  CREATE INDEX IF NOT EXISTS idx_favorites_user_subject
    ON favorites(user_id, subject_type);

  -- Feed load: interaction history
  CREATE INDEX IF NOT EXISTS idx_interactions_user_type
    ON user_dish_interactions(user_id, interaction_type);

  -- RLS: eat_together participant check (general)
  CREATE INDEX IF NOT EXISTS idx_eat_members_session_left
    ON eat_together_members(session_id, left_at);

  -- View history screen
  CREATE INDEX IF NOT EXISTS idx_session_views_user_type
    ON session_views(user_id, entity_type);

  -- enrich-dish + RestaurantDetailScreen ingredient load
  CREATE INDEX IF NOT EXISTS idx_dish_ingredients_dish
    ON dish_ingredients(dish_id);

  -- get_vote_results() RPC
  CREATE INDEX IF NOT EXISTS idx_eat_votes_session
    ON eat_together_votes(session_id);

  -- RLS self-referential policy on eat_together_members (partial index)
  CREATE INDEX IF NOT EXISTS idx_eat_members_session_user_active
    ON eat_together_members(session_id, user_id)
    WHERE left_at IS NULL;
  ```
- Run the migration against local Supabase: `supabase db push` or `supabase migration up`

**Test requirements:**
- For each indexed column, run `EXPLAIN (ANALYZE, BUFFERS)` on the query patterns listed in the findings and confirm the plan shows `Index Scan` instead of `Seq Scan`
- Key queries to test:
  - `SELECT * FROM favorites WHERE user_id = $1 AND subject_type = $2`
  - `SELECT * FROM user_dish_interactions WHERE user_id = $1 AND interaction_type = $2`
  - `SELECT * FROM eat_together_members WHERE session_id = $1 AND left_at IS NULL`

**Integration with previous steps:** First step — no dependencies.

**Demo:** Run the feed Edge Function locally and inspect query plans via Supabase Studio → SQL Editor. Show Index Scan replacing Seq Scan on `favorites` and `user_dish_interactions`.

---

## Step 2: RestaurantDetailScreen — Explicit Column Select

**Objective:** Replace all `select('*')` wildcards in the RestaurantDetailScreen nested query with explicit column lists, eliminating vector/embedding columns from the response payload.

**Implementation guidance:**
- File: `apps/mobile/src/screens/RestaurantDetailScreen.tsx:96-115`
- Replace the current query with:
  ```typescript
  supabase.from('restaurants').select(`
    id, name, address, city, postal_code, cuisine_types, rating, phone,
    website, open_hours, image_url, payment_methods, is_active,
    delivery_available, takeout_available, dine_in_available,
    menus (
      id, name, description, display_order, is_active, menu_type, schedule_type,
      menu_categories (
        id, name, description, display_order, is_active,
        dishes (
          id, name, description, price, dietary_tags, allergens, calories,
          spice_level, image_url, is_available, dish_kind, display_price_prefix,
          description_visibility, ingredients_visibility, parent_dish_id, is_parent,
          serves, price_per_person,
          dish_ingredients (ingredient_id),
          option_groups (
            id, name, description, selection_type, min_selections, max_selections,
            display_order, is_active,
            options (id, name, description, price_delta, calories_delta,
                     canonical_ingredient_id, is_available, display_order)
          )
        )
      )
    )
  `)
  ```
- Verify the TypeScript types still align — if `RestaurantDetail` type includes `embedding` or `restaurant_vector` as required fields, update the type to make them optional or remove them

**Test requirements:**
- Manually navigate to a restaurant detail screen and confirm all sections render: restaurant header, menu categories, dishes, option groups
- Use React Native Debugger / network inspector to compare response size before and after — target < 100 KB for a typical restaurant
- Assert that `embedding` and `restaurant_vector` fields are absent from the response

**Integration with previous steps:** Independent of Step 1. Can be done in parallel.

**Demo:** Open a restaurant with a large menu (50+ dishes). Compare network response size in the debugger — should drop from ~1-2 MB to ~50-100 KB.

---

## Step 3: enrich-dish — Parallelize Sequential Queries

**Objective:** Replace 4 sequential `await` calls in `enrich-dish/index.ts` with a single `Promise.all`, reducing per-enrichment latency by ~60 ms.

**Implementation guidance:**
- File: `infra/supabase/functions/enrich-dish/index.ts:357-405`
- Identify the 4 independent queries (ingredients, option groups, restaurant cuisine_types, parent dish)
- Replace with:
  ```typescript
  const [
    { data: ingredientRows },
    { data: optionGroupRows },
    { data: restaurantRow },
    { data: parentDish },
  ] = await Promise.all([
    supabase
      .from('dish_ingredients')
      .select('ingredient_id')
      .eq('dish_id', dishId),
    supabase
      .from('option_groups')
      .select('id, name, selection_type, options(id, name, price_delta)')
      .eq('dish_id', dishId)
      .eq('is_active', true),
    supabase
      .from('restaurants')
      .select('cuisine_types')
      .eq('id', dish.restaurant_id)
      .single(),
    dish.parent_dish_id
      ? supabase.from('dishes').select('name').eq('id', dish.parent_dish_id).single()
      : Promise.resolve({ data: null, error: null }),
  ]);
  ```
- Preserve all downstream logic that uses these variables — only the fetch pattern changes, not the result handling

**Test requirements:**
- Deploy the function locally with `supabase functions serve enrich-dish`
- Trigger enrichment for a dish with a parent dish and verify the enriched output (ingredients, option groups, cuisine context, parent name) is identical to the sequential version
- Add a log line timing the parallel block and confirm ~60 ms savings vs the sequential baseline

**Integration with previous steps:** Independent. `dish_ingredients` benefits from the index added in Step 1.

**Demo:** Invoke `enrich-dish` via curl for a dish with a `parent_dish_id` set. Show the timing log before (4 × RTT) and after (1 × RTT).

---

## Step 4: feed Edge Function — Slim Response + Favorites Join

**Objective:** Reduce feed dish payload by ~50% and eliminate a sequential DB round-trip for favorited restaurant cuisine lookups.

**Implementation guidance:**

**Part A — Slim dish response** (`feed/index.ts:673-695`):
```typescript
const dishResult = dishPool.slice(0, limit).map(d => ({
  id: d.id,
  name: d.name,
  price: d.price,
  display_price_prefix: d.display_price_prefix,
  image_url: d.image_url,
  restaurant_id: d.restaurant_id,
  restaurant_name: d.restaurant_name,
  distance_km: d.distance_m / 1000,
  score: d.score,
  dish_kind: d.dish_kind,
  spice_level: d.spice_level,
  serves: d.serves,
  price_per_person: d.price_per_person,
  // Only include flagged_ingredients if non-empty
  ...(d.flagged_ingredients?.length ? { flagged_ingredients: d.flagged_ingredients } : {}),
}));
```
Remove: `allergens`, `dietary_tags`, `is_available` from the default response. Verify no mobile feed card UI relies on these fields.

**Part B — Favorites cuisine join** (`feed/index.ts:473-484`):
- Move the restaurant cuisine lookup into the existing `Promise.all` by using a Supabase join:
  ```typescript
  supabase
    .from('favorites')
    .select('subject_id, restaurants!inner(cuisine_types)')
    .eq('user_id', userId)
    .eq('subject_type', 'restaurant')
  ```
- Remove the sequential `favRestaurants` query that follows the `Promise.all`
- Update the cuisine extraction logic to read from the joined shape: `fav.restaurants.cuisine_types`

**Test requirements:**
- Call the feed endpoint and assert `allergens`, `dietary_tags`, `is_available` are absent from dish objects
- Assert `flagged_ingredients` is absent when user has no ingredients to avoid, present when they do
- For a user with favorited restaurants: assert the favorites cuisine data is correct and the feed response is unchanged functionally
- Network size test: compare feed response payload size before and after (~50% reduction expected)

**Integration with previous steps:** Independent of Steps 1-3. Relies on `idx_favorites_user_subject` index from Step 1 for the join query.

**Demo:** Call the feed Edge Function for a user with favorited restaurants. Show the slimmed response in the terminal and confirm feed cards render identically in the app.

---

## Step 5: BasicMapScreen — useShallow Selectors

**Objective:** Prevent BasicMapScreen from re-rendering on every filter toggle by using shallow comparison for Zustand object selectors.

**Implementation guidance:**
- File: `apps/mobile/src/screens/BasicMapScreen.tsx:126-128`
- Add import: `import { useShallow } from 'zustand/react/shallow';`
- Update the two object selectors:
  ```typescript
  const daily = useFilterStore(useShallow(state => state.daily));
  const permanent = useFilterStore(useShallow(state => state.permanent));
  const mode = useViewModeStore(state => state.mode); // primitive — no change needed
  ```
- The `mode` selector returns a primitive string so `useShallow` is not needed there

**Test requirements:**
- Use React DevTools Profiler or add a `console.count('BasicMapScreen render')` temporarily
- Toggle a cuisine filter — confirm BasicMapScreen render count does not increase when only a nested field within `daily` changes but the shallow-compared top-level fields are the same
- Confirm the feed fetch `useEffect` still triggers correctly when filters that affect the API call change

**Integration with previous steps:** Independent. Can be done alongside Steps 2-4.

**Demo:** Open BasicMapScreen, open the filter modal, toggle a cuisine. Show in the profiler that BasicMapScreen re-renders once (on Apply) rather than on every toggle.

---

## Step 6: Explicit Selects in eatTogetherService + dishPhotoService

**Objective:** Replace `.select('*')` with explicit column lists in eat_together and dish photo service queries.

**Implementation guidance:**

**eatTogetherService.ts** — replace `select('*')` at lines 127, 146, 185, 399, 529:

For `eat_together_sessions` queries, use:
```typescript
.select('id, host_id, session_code, status, location_mode, created_at, expires_at, closed_at, decided_restaurant_id, decided_dish_ids')
```

For `eat_together_members` queries, use:
```typescript
.select('id, session_id, user_id, joined_at, left_at, is_ready')
```

**dishPhotoService.ts** — replace `select('*')` at line 136:
```typescript
.select('id, dish_id, photo_url, uploaded_by, created_at, is_approved')
```

Check each call site to confirm no field is accessed in the consuming code that isn't included in the explicit list. Add any missing fields rather than reverting to `*`.

**Test requirements:**
- Exercise all Eat Together flows end-to-end: create session, join, vote, decide
- Verify dish photos load correctly in RestaurantDetailScreen
- No TypeScript type errors after narrowing the select (Supabase types will infer the narrower shape)

**Integration with previous steps:** Benefits from `idx_eat_members_session_left` index added in Step 1.

**Demo:** Walk through a complete Eat Together session (create → join → vote → result). Verify all data displays correctly with explicit column selects.

---

## Step 7: filterStore — Debounce saveFilters()

**Objective:** Reduce AsyncStorage writes from ~50 per filter session to ~1 by debouncing the `saveFilters()` function.

**Implementation guidance:**
- File: `apps/mobile/src/stores/filterStore.ts`
- Add a debounce utility (use `lodash.debounce` if already in dependencies, or implement a simple closure-based debounce):
  ```typescript
  let saveFiltersTimer: ReturnType<typeof setTimeout> | null = null;

  const debouncedSaveFilters = (saveFn: () => void) => {
    if (saveFiltersTimer) clearTimeout(saveFiltersTimer);
    saveFiltersTimer = setTimeout(saveFn, 500);
  };
  ```
- Wrap the `saveFilters` action so all existing callers work unchanged:
  ```typescript
  saveFilters: () => {
    debouncedSaveFilters(async () => {
      // existing AsyncStorage write logic
    });
  },
  ```
- The debounce timer lives outside the Zustand store to avoid reset on state updates

**Test requirements:**
- Unit test: call `setDailyPriceRange` 20 times in rapid succession (simulating slider drag), assert AsyncStorage.setItem is called exactly once after the 500 ms window
- Confirm filters are persisted correctly after debounce completes (read them back from AsyncStorage)
- Confirm immediate saves still work for permanent filter changes initiated from outside rapid sequences

**Integration with previous steps:** Independent. Completes Sprint 1.

**Demo:** In the filter modal, drag the price range slider rapidly from min to max. Use AsyncStorage debugging to show only one write occurs after the drag ends.

---

## Step 8: expo-image — Install and Full Migration

**Objective:** Replace the bare `react-native` Image component with `expo-image` across all mobile screens and components, enabling automatic disk and memory caching for all remote images.

**Implementation guidance:**
- Install: `npx expo install expo-image` from the `apps/mobile` directory
- Find all files importing `Image` from `react-native`:
  ```
  grep -r "from 'react-native'" apps/mobile/src --include="*.tsx" --include="*.ts" -l
  ```
  Then filter for those that destructure `Image`
- For each file, replace:
  ```typescript
  // Before
  import { Image, ... } from 'react-native';
  // After
  import { Image } from 'expo-image';
  import { ... } from 'react-native'; // remaining imports
  ```
- `expo-image` accepts `source` as a URI object or `require()` for static assets. Check that remote URLs (strings or `{ uri: string }` objects) are passed correctly — both are supported
- `expo-image` does not support the `resizeMethod` prop; use `contentFit` instead of `resizeMode`:
  - `resizeMode="cover"` → `contentFit="cover"`
  - `resizeMode="contain"` → `contentFit="contain"`
- Add a default `placeholder` (blurhash or color) to improve perceived loading where images take time

**Test requirements:**
- Build and run on a physical device (simulator caching behaviour differs)
- Navigate to RestaurantDetailScreen, go back, navigate again — confirm images load instantly on second visit (disk cache hit)
- Verify no `resizeMode` prop warnings in the console
- Visual regression: screenshot each screen with images before/after and compare

**Integration with previous steps:** Independent of Steps 1-7. Starts Sprint 2.

**Demo:** On a physical device with network throttling enabled (slow 3G), navigate to a restaurant, go back, re-open it. Show images appearing instantly on second visit vs first.

---

## Step 9: Client-Side Restaurant Cache in Zustand

**Objective:** Cache restaurant detail data in Zustand with 5-minute staleness to eliminate repeat ~100 KB fetches for the same restaurant.

**Implementation guidance:**
- File: `apps/mobile/src/stores/restaurantStore.ts` (extend existing store) or create `apps/mobile/src/stores/restaurantDetailStore.ts`
- Add cache state and action:
  ```typescript
  const DETAIL_CACHE_TTL_MS = 5 * 60 * 1000;

  interface DetailCacheEntry {
    data: RestaurantDetail;
    fetchedAt: number;
  }

  // In store state:
  restaurantDetailCache: new Map<string, DetailCacheEntry>(),

  // New action:
  fetchRestaurantDetail: async (id: string): Promise<RestaurantDetail> => {
    const cached = get().restaurantDetailCache.get(id);
    if (cached && Date.now() - cached.fetchedAt < DETAIL_CACHE_TTL_MS) {
      return cached.data;
    }
    const data = await fetchRestaurantDetailFromSupabase(id); // extract current query
    get().restaurantDetailCache.set(id, { data, fetchedAt: Date.now() });
    set({ restaurantDetailCache: new Map(get().restaurantDetailCache) });
    return data;
  },
  ```
- Extract the Supabase query from `RestaurantDetailScreen` into a standalone `fetchRestaurantDetailFromSupabase(id)` function (using the explicit column select from Step 2)
- Update `RestaurantDetailScreen` to call `fetchRestaurantDetail(id)` from the store instead of querying Supabase directly
- Do NOT persist the cache to AsyncStorage — intentionally in-memory only (fresh on app restart)

**Test requirements:**
- Unit test: call `fetchRestaurantDetail` twice for the same ID within 5 minutes, assert the Supabase client is called exactly once
- Unit test: call after 5+ minutes (mock Date.now), assert Supabase is called again
- Integration test: navigate to restaurant, go back, navigate again — assert no new network request in the second visit
- Assert error on fetch failure does not cache the error state

**Integration with previous steps:** Uses the explicit column select query from Step 2. Builds on the restaurantStore pattern.

**Demo:** Navigate to a restaurant (network request visible in debugger). Go back. Navigate to the same restaurant again — no network request, instant load.

---

## Step 10: User Preferences Sync Debounce

**Objective:** Prevent redundant DB fetches on app resume by skipping `syncWithDatabase` and `loadUserPreferences` if they ran within the last 30 minutes.

**Implementation guidance:**
- Add `lastSyncedAt: number | null` to `filterStore` state — persist it in AsyncStorage alongside existing permanent filter state
- Add `lastSyncedAt: number | null` to `onboardingStore` state — persist it similarly
- Update `storeBindings.ts` (the auth state change handler):
  ```typescript
  const SYNC_TTL_MS = 30 * 60 * 1000;
  const now = Date.now();

  const filterLastSync = useFilterStore.getState().lastSyncedAt;
  if (!filterLastSync || now - filterLastSync > SYNC_TTL_MS) {
    await useFilterStore.getState().syncWithDatabase(userId);
    useFilterStore.getState().setLastSyncedAt(now);
  }

  const onboardingLastSync = useOnboardingStore.getState().lastSyncedAt;
  if (!onboardingLastSync || now - onboardingLastSync > SYNC_TTL_MS) {
    await useOnboardingStore.getState().loadUserPreferences(userId);
    useOnboardingStore.getState().setLastSyncedAt(now);
  }
  ```
- After an explicit preference save (e.g., saving diet preferences from the settings screen), call `setLastSyncedAt(Date.now())` to reset the window and prevent an immediate re-fetch
- On logout, reset `lastSyncedAt` to `null` in both stores so the next login always syncs

**Test requirements:**
- Unit test: simulate two auth events within 30 minutes, assert `syncWithDatabase` called once
- Unit test: simulate auth event after 30+ minutes have elapsed, assert `syncWithDatabase` called again
- Unit test: logout then login, assert `syncWithDatabase` always called on first login regardless of TTL
- Integration test: save a preference change, confirm `lastSyncedAt` is updated

**Integration with previous steps:** Independent. Completes Sprint 2.

**Demo:** Log in, check that preferences load. Background and foreground the app within 30 minutes — show in logs that `syncWithDatabase` is skipped. Wait 30+ minutes (or mock time) — show sync triggers again.

---

## Step 11: viewHistoryService — Combined DB View

**Objective:** Replace the two-query pattern in `viewHistoryService.ts` with a single query against a DB view, eliminating one round-trip per history screen load.

**Implementation guidance:**
- Create migration `infra/supabase/migrations/077_recent_viewed_restaurants_view.sql`:
  ```sql
  CREATE VIEW recent_viewed_restaurants AS
  SELECT
    sv.user_id,
    sv.viewed_at,
    r.id,
    r.name,
    r.cuisine_types,
    r.image_url,
    r.address,
    r.rating
  FROM session_views sv
  JOIN restaurants r ON r.id::text = sv.entity_id
  WHERE sv.entity_type = 'restaurant';
  ```
- Update `apps/mobile/src/services/viewHistoryService.ts:28-78`:
  ```typescript
  const { data, error } = await supabase
    .from('recent_viewed_restaurants')
    .select('*')
    .eq('user_id', userId)
    .order('viewed_at', { ascending: false })
    .limit(15);
  ```
- Remove the second `restaurants` query and the manual join logic
- Update the TypeScript return type to match the view columns

**Test requirements:**
- Integration test: call `getViewHistory(userId)`, assert results match expected restaurants in correct order
- Assert the result count is capped at 15
- Verify the view respects RLS (the view should be in the `public` schema and inherit RLS from the underlying tables, or explicitly set `WITH (security_invoker = true)`)

**Integration with previous steps:** Starts Sprint 3. Adds a new migration — number it after the indexes migration from Step 1.

**Demo:** Navigate to the View History screen and confirm restaurants display correctly. Check Supabase Studio query logs to confirm a single query hits the view instead of two separate queries.

---

## Step 12: FlatList getItemLayout in ViewedHistoryScreen

**Objective:** Add `getItemLayout` and `removeClippedSubviews` to the ViewedHistoryScreen FlatList to eliminate per-item dynamic measurement.

**Implementation guidance:**
- File: `apps/mobile/src/screens/ViewedHistoryScreen.tsx:112-118`
- Measure the actual rendered height of a history item using the existing styles, or temporarily add a `onLayout` to capture it
- Define a constant:
  ```typescript
  const HISTORY_ITEM_HEIGHT = 88; // adjust to actual measured height including margins
  ```
- Update the FlatList:
  ```tsx
  <FlatList
    data={restaurants}
    renderItem={renderItem}
    keyExtractor={item => item.id}
    getItemLayout={(_, index) => ({
      length: HISTORY_ITEM_HEIGHT,
      offset: HISTORY_ITEM_HEIGHT * index,
      index,
    })}
    removeClippedSubviews={true}
    contentContainerStyle={styles.listContent}
    showsVerticalScrollIndicator={false}
  />
  ```

**Test requirements:**
- Snapshot test: assert `getItemLayout` prop is present on the FlatList
- Visual test: scroll the history list and confirm no layout jumps or clipping artifacts
- Confirm the item height constant matches the actual rendered height (measure with React DevTools Inspector)

**Integration with previous steps:** Builds on Step 11 (viewHistoryService now returns a clean single-query result). Small, self-contained change.

**Demo:** Scroll the View History screen. Show smooth scrolling with no jank. Inspect the FlatList in React DevTools to confirm `getItemLayout` is wired up.

---

## Step 13: Per-Category Lazy Loading in RestaurantDetailScreen

**Objective:** Load only the first category's dishes on initial render; fetch additional categories lazily as the user navigates to them.

**Implementation guidance:**
- Restructure the RestaurantDetailScreen data fetching:
  1. **Initial fetch** — load restaurant metadata + menu structure (menus, categories) without dishes:
     ```typescript
     supabase.from('restaurants').select(`
       id, name, address, ...,  // all restaurant columns from Step 2
       menus (
         id, name, description, display_order, is_active, menu_type, schedule_type,
         menu_categories (id, name, description, display_order, is_active)
         // no dishes here
       )
     `)
     ```
  2. **Category fetch** — load dishes for a specific category on demand:
     ```typescript
     supabase.from('menu_categories').select(`
       dishes (
         id, name, description, price, dietary_tags, allergens, calories,
         spice_level, image_url, is_available, dish_kind, display_price_prefix,
         description_visibility, ingredients_visibility, parent_dish_id, is_parent,
         serves, price_per_person,
         dish_ingredients (ingredient_id),
         option_groups (
           id, name, description, selection_type, min_selections, max_selections,
           display_order, is_active,
           options (id, name, description, price_delta, calories_delta,
                    canonical_ingredient_id, is_available, display_order)
         )
       )
     `).eq('id', categoryId)
     ```
- Add per-category loading state: `categoryDishes: Map<categoryId, DishWithDetails[] | 'loading' | 'error'>`
- On mount, auto-fetch the first visible category's dishes
- When the user taps a category tab/section, fetch that category if not already loaded
- Update the restaurant detail cache (Step 9) to store the category-level dish data separately

**Test requirements:**
- Integration test: mount RestaurantDetailScreen, assert only one category fetch fires initially
- Integration test: tap a second category tab, assert the second category fetch fires
- Integration test: tap a previously-loaded category, assert no new fetch
- Visual test: loading indicator appears per-category while fetching

**Integration with previous steps:** Extends Step 9 (restaurant cache). Uses the explicit column selects established in Step 2.

**Demo:** Open a restaurant with 3+ menu categories. Show in the network debugger that only the first category's dishes are fetched initially. Tap another category — show a second targeted fetch for that category's dishes only.

---

## Step 14: feed Edge Function — Response Compression

**Objective:** Add gzip compression to the feed Edge Function response, reducing payload from ~80 KB to ~20 KB for mobile clients on slow connections.

**Implementation guidance:**
- File: `infra/supabase/functions/feed/index.ts`
- Add a compression helper near the response return:
  ```typescript
  async function compressedJsonResponse(data: unknown, headers: Record<string, string>) {
    const json = JSON.stringify(data);
    const encoder = new TextEncoder();
    const body = encoder.encode(json);

    const cs = new CompressionStream('gzip');
    const writer = cs.writable.getWriter();
    writer.write(body);
    writer.close();

    const compressed = await new Response(cs.readable).arrayBuffer();

    return new Response(compressed, {
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        'Content-Encoding': 'gzip',
      },
    });
  }
  ```
- Replace the final `return new Response(JSON.stringify(responseData), ...)` with `return compressedJsonResponse(responseData, corsHeaders)`
- Only apply compression when the caller's `Accept-Encoding` header includes `gzip` — check `req.headers.get('Accept-Encoding')?.includes('gzip')` and fall back to uncompressed if not
- Verify the Supabase client (`supabase.functions.invoke`) decompresses automatically (it uses `fetch` under the hood, which handles `Content-Encoding: gzip` natively)

**Test requirements:**
- Integration test: call the feed function with `Accept-Encoding: gzip`, assert response has `Content-Encoding: gzip` header
- Integration test: decompress the response body and assert the JSON is valid and matches the uncompressed equivalent
- Test without `Accept-Encoding: gzip` header — assert response is plain JSON
- Measure compressed vs uncompressed sizes and confirm >60% reduction

**Integration with previous steps:** Builds on Step 4 (slimmed payload). Apply compression after slimming for maximum effect.

**Demo:** Call the feed Edge Function via curl with and without `--compressed`. Show the `Content-Encoding: gzip` header and compare response sizes.

---

## Step 15: Cache Invalidation Webhook

**Objective:** Ensure Redis cache entries for restaurant data are invalidated when restaurant, menu, or dish data is updated, preventing stale cache after owner edits.

**Implementation guidance:**
- Create a new Edge Function `infra/supabase/functions/invalidate-cache/index.ts`:
  ```typescript
  // Input (from DB webhook): { type: 'UPDATE', table: 'restaurants'|'menus'|'dishes', record: { id, restaurant_id? } }
  // Action: delete relevant Redis keys

  const redis = new Redis({ url: UPSTASH_REDIS_URL, token: UPSTASH_REDIS_TOKEN });

  const restaurantId = body.record.restaurant_id ?? body.record.id;
  const keysToDelete = [
    `restaurant:${restaurantId}`,
    `restaurant:cuisines:${restaurantId}`,
  ];

  await redis.del(...keysToDelete);
  return new Response(JSON.stringify({ deleted: keysToDelete }), { status: 200 });
  ```
- Register the webhook in Supabase Dashboard → Database → Webhooks:
  - Table: `restaurants`, events: UPDATE
  - Table: `menus`, events: UPDATE (use `restaurant_id` from the record)
  - Table: `dishes`, events: UPDATE (resolve `restaurant_id` via `menu_category → menu → restaurant`)
- For `dishes` and `menus`, the webhook payload may not include `restaurant_id` directly — query it in the Edge Function or use a DB trigger that enriches the payload

**Test requirements:**
- Integration test: update a restaurant record, assert the `invalidate-cache` function is invoked and returns 200
- Integration test: after invalidation, assert the Redis key no longer exists
- Integration test: next feed request after invalidation fetches fresh data from DB (not stale Redis)
- Test edge case: webhook fires for a restaurant with no Redis entry — assert no error (Redis DEL is a no-op for missing keys)

**Integration with previous steps:** Final step. Completes Sprint 3. Depends on Redis being in use (established by the existing feed function). The client-side cache from Step 9 has its own TTL — server-side invalidation only affects the Redis feed cache.

**Demo:** Update a restaurant's name via the web portal. Show in Redis CLI that the cache key is deleted. Trigger a feed request and confirm the updated restaurant name appears in the response.
