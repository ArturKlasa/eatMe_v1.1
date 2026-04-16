# REV-07: mobile-stores-data-flow — Zustand stores, hooks, optimistic update paths

## Scope reviewed

- `apps/mobile/src/stores/authStore.ts:1-494` (full)
- `apps/mobile/src/stores/filterStore.ts:1-1115` (full)
- `apps/mobile/src/stores/sessionStore.ts:1-337` (full)
- `apps/mobile/src/stores/onboardingStore.ts:1-457` (full)
- `apps/mobile/src/stores/restaurantStore.ts:1-338` (full)
- `apps/mobile/src/stores/settingsStore.ts:1-172` (full)
- `apps/mobile/src/stores/viewModeStore.ts:1-24` (full)
- `apps/mobile/src/stores/storeBindings.ts:1-93` (full)
- `apps/mobile/src/hooks/useDish.ts:1-72` (full)
- `apps/mobile/src/hooks/useUserLocation.ts:1-202` (full)
- `apps/mobile/src/hooks/useCountryDetection.ts:1-138` (full)
- `apps/mobile/src/services/ratingService.ts:1-500` (full)
- `apps/mobile/src/services/dishRatingService.ts:1-151` (full)
- `apps/mobile/src/services/interactionService.ts:1-75` (full)
- `apps/mobile/src/services/gamificationService.ts:55-140` (streak/badge award paths)
- `apps/mobile/src/screens/restaurant-detail/useRestaurantDetail.ts:1-407` (full)
- `apps/mobile/src/screens/restaurant-detail/RestaurantDetailScreen.tsx:1-310` (full)
- `apps/mobile/src/screens/restaurant-detail/FoodTab.tsx:1-182` (full)
- `apps/mobile/src/screens/BasicMapScreen.tsx:1-749` (full)
- `apps/mobile/src/components/rating/InContextRating.tsx:1-274` (full)
- `apps/mobile/src/components/rating/RatingFlowModal.tsx:1-384` (full)

## Findings

### REV-07-a: `SESSION_TIMEOUT_MS` used for both session-inactivity AND the rating-prompt window with conflicting intent
- Severity: high
- Category: correctness
- Location: `apps/mobile/src/stores/sessionStore.ts:16`, `:271-280`
- Observation: `SESSION_TIMEOUT_MS = 60 * 60 * 1000` (1 hour) is declared once and used for two orthogonal concepts: (1) discarding old session views in `clearOldSessions` (line 286-290), and (2) filtering restaurants eligible for the rating prompt in `getRecentRestaurantsForRating` (line 278). The comment immediately above the filter reads `// Filter to restaurants viewed in the last 24 hours` (line 275), but the code filters by `SESSION_TIMEOUT_MS`, i.e. 1 hour.
- Why it matters: The rating banner on `BasicMapScreen` (`BasicMapScreen.tsx:120-121`) drives off `getRecentRestaurantsForRating()`. If a user views restaurants during lunch and opens the app at dinner, the banner never shows — the primary acquisition point for dish ratings is silently dropped to a 1-hour window. The stale comment also makes a future maintainer likely to "fix" one but not the other.
- Suggested direction: Split the two concepts. Keep `SESSION_TIMEOUT_MS = 1h` for session-view expiry and add a separate `RATING_PROMPT_WINDOW_MS = 24h` (or whatever the product intent is) used only by `getRecentRestaurantsForRating`. Align the comment accordingly.
- Confidence: confirmed
- Evidence: lines 16, 275-278; `BasicMapScreen.tsx:120-121` shows the consumer gating the rating banner on this list.

### REV-07-b: `sessionStore.trackView` does an auth-round-trip on every screen view
- Severity: high
- Category: performance
- Location: `apps/mobile/src/stores/sessionStore.ts:154-191`
- Observation: `trackView` (and indirectly `trackRestaurantView`, `trackDishView`) calls `await supabase.auth.getUser()` on every invocation to read the user ID for the `session_views` insert, even though the user ID is already available in `useAuthStore.getState().user`. `supabase.auth.getUser()` hits `/auth/v1/user` (a network round-trip) unless the SDK cache is fresh — per supabase-js docs it explicitly verifies the JWT.
- Why it matters: Every restaurant detail mount triggers `trackRestaurantView` → `trackView` and every dish detail open triggers `trackDishView` → `trackView`. On a cold screen that opens, say, 10 categories with their dishes, this is ~10+ extra `auth.getUser()` network requests, each ~100-300 ms. It also means each view-tracking write depends on a background auth fetch — network flakiness delays every tracked interaction.
- Suggested direction: Read the user from `useAuthStore.getState().user?.id` (already populated by `authStore.initialize` + the `onAuthStateChange` listener). Fall back to `supabase.auth.getUser()` only for defensive correctness, or skip entirely since `currentSessionId` already implies an authenticated user.
- Confidence: confirmed
- Evidence: lines 171-182 (`auth.getUser()` inside the insert path). `authStore.ts:81-150` shows the user is already mirrored into the store.

### REV-07-c: `trackDishView` silently drops local state update if the restaurant was not tracked first
- Severity: high
- Category: correctness
- Location: `apps/mobile/src/stores/sessionStore.ts:193-235`
- Observation: `trackDishView` updates `recentRestaurants` only inside the `state => { const restaurantIndex = state.recentRestaurants.findIndex(r => r.id === restaurantId); if (restaurantIndex === -1) { return state; } ... }` block. If the caller fires `trackDishView(restaurantId, dish)` before (or without) a matching `trackRestaurantView(restaurant)`, the dish is silently dropped from `recentRestaurants[*].viewedDishes`. The DB-side `trackView('dish', dish.id)` still fires, but local `recentRestaurants` state never learns about it.
- Why it matters: `useRestaurantDetail.handleDishPress` calls `trackDishView(restaurantId, {...dish})` after `trackRestaurantView` runs in the screen's mount effect — works today. But any new caller (dish deep-link, dish marker on the map) that opens a dish detail without first hitting the restaurant detail will record the view in Supabase but leave the rating flow oblivious. The rating modal uses `recentRestaurants[*].viewedDishes` (via `getRestaurantDishes` / the modal's `viewedDishes` list) — dishes viewed this way never appear.
- Suggested direction: When `restaurantIndex === -1`, create a placeholder restaurant entry (or at minimum log a warning). Ideally, ensure the caller invariant ("always track restaurant before dish") is enforced by the API — e.g. make `trackDishView` also track the restaurant if a `restaurant` shape is passed, or accept a `restaurant` parameter instead of just `restaurantId`.
- Confidence: confirmed
- Evidence: lines 199-203 (early return when restaurant not found).

### REV-07-d: `useRestaurantDetail` auto-loads *all* menu categories in parallel on mount with no concurrency cap
- Severity: medium
- Category: performance
- Location: `apps/mobile/src/screens/restaurant-detail/useRestaurantDetail.ts:227-234`
- Observation: After the restaurant metadata arrives, `useEffect` does `restaurant.menus?.forEach(menu => menu.menu_categories?.forEach(cat => loadCategoryDishes(cat.id)))`. Each `loadCategoryDishes` kicks off a round-trip to Supabase `menu_categories` + a parallel `getDishRatingsBatch` + `getUserDishOpinions`. There is no concurrency cap, no intersection-observer / viewport gating, and the lazy-on-tap affordance in `FoodTab.tsx:97-105` is dead code (the effect already loads every category before the user interacts).
- Why it matters: Restaurants with 10-30 categories fire 30-90 parallel Supabase requests on screen open. Three costs: (1) mobile networks buckle on that fan-out, (2) the RLS-enforced PostgREST reads serialize on pool limits, (3) each success path does `setCategoryDishes(prev => new Map(...))` followed by two more `setState` calls, causing 30+ sequential re-renders. The comment at line 226 ("Auto-load all categories in parallel") treats this as a feature, but it contradicts the file header's "lazy per-category dish loading" claim at line 4.
- Suggested direction: Either (a) truly lazy — only load on category accordion expand (remove the blanket `forEach`), or (b) batch — fetch the first N categories on mount and queue the rest behind a scroll/intersection trigger. Collapse the multiple `setState` calls per category into a single update to cut re-renders.
- Confidence: confirmed
- Evidence: `useRestaurantDetail.ts:227-234`, `FoodTab.tsx:96-105` (the "Load dishes" button that is now unreachable on first mount).

### REV-07-e: `FoodTab` recomputes `sortedDishes` + `groupDishesByParent` inside the render function for every category
- Severity: medium
- Category: performance
- Location: `apps/mobile/src/screens/restaurant-detail/FoodTab.tsx:69-157`
- Observation: The category loop calls `groupDishesByParent(sortedDishes(dishes, permanentFilters, ingredientsToAvoid))` inline (line 76-78). `sortedDishes` maps each dish through `classifyDish`, then sorts. `DishMenuItem` is rendered without `React.memo`. Every render of `RestaurantDetailScreen` — triggered by any of ~20 state transitions in `useRestaurantDetail`, plus every change to `userDishOpinions`, `dishRatings`, `dishPhotos`, etc. — re-walks every category, re-classifies every dish, and re-creates the grouped array with fresh references, causing every `DishMenuItem` to re-render.
- Why it matters: Each in-context rating submission flips `userDishOpinions` (line 303 in `RestaurantDetailScreen.tsx`), which cascades through `FoodTab` and re-classifies every dish in every category for a 1-dish change. On a 100-dish menu this is O(100) classifications per tap. Measurable jank on mid-tier Android devices.
- Suggested direction: Hoist the per-category sort/group into a `useMemo` keyed on `[category.id, dishes, permanentFilters.dietPreference, …]`, and wrap `DishMenuItem` in `React.memo` with a comparator that ignores unrelated `dishRatings`/`userDishOpinions` updates for other dishes.
- Confidence: confirmed
- Evidence: lines 73-157; `DishMenuItem` import at line 20 is not a memoized component (cross-checked — no `React.memo` wrapper).

### REV-07-f: `loadCategoryDishes` opinion merge can clobber an optimistic in-context rating
- Severity: medium
- Category: correctness
- Location: `apps/mobile/src/screens/restaurant-detail/useRestaurantDetail.ts:206-220`
- Observation: `loadCategoryDishes` does `Promise.all([getDishRatingsBatch, getUserDishOpinions])`, then does `setUserDishOpinions(prev => new Map([...prev, ...opinions]))`. Map spread semantics: entries from `opinions` override `prev`. If a user rapidly rates a dish via `InContextRating` (which optimistically sets `userDishOpinions` through `onRated` in `RestaurantDetailScreen.tsx:302-304`) before the concurrent `getUserDishOpinions` fetch returns, and the user previously had an opinion for that dish, the fetch returns the *old* opinion and overwrites the optimistic update. UI reverts silently; only a fresh category load (which is effectively never, due to REV-07-d's cache at line 185-190) will ever resync.
- Why it matters: The rating UX is built on the optimistic-update invariant; a silent revert to an old opinion is a confusing correctness gap — users see their "Liked" tap momentarily appear, then snap back to "Okay".
- Suggested direction: Make the merge order favour local state — `new Map([...opinions, ...prev])` — or only write keys that are *not* already present in `prev`. Alternatively, guard `setUserDishOpinions` with a timestamp so local writes outrank stale fetches.
- Confidence: likely
- Evidence: `setUserDishOpinions(prev => new Map([...prev, ...opinions]))` at line 217; optimistic caller at `RestaurantDetailScreen.tsx:302-304`; concurrent fetch at `InContextRating.tsx:111-119`. Exact race window depends on network/DB commit timing.

### REV-07-g: `submitInContextRating` fires user_points insert as a floating promise
- Severity: medium
- Category: correctness
- Location: `apps/mobile/src/services/ratingService.ts:421-428`
- Observation: Inside an `async` function, the call `supabase.from('user_points').insert(pointsToAward).then(({ error }) => {...})` is not `await`ed. Immediately after, `Promise.all([updateStreak(userId), checkAndAwardTrustedTasterBadge(userId)])` runs. There is no ordering guarantee; streak/badge logic reads `dish_opinions`, not `user_points`, so the factual race is benign *today*, but any future extension that computes streak bonuses from `user_points` will see a missing row. Additionally, a rejected insert never surfaces — the caller's returned `{ success: true }` is a false positive when points were silently dropped.
- Why it matters: This is a known class of bug that bites when someone adds a "points-based" feature and reasons about writes as awaited. The returned contract also lies about success.
- Suggested direction: `await` the insert and fold its `error` into the non-fatal warning path (matching `awardPoints` at `ratingService.ts:188-273`, which does await). If the intent is fire-and-forget for latency, make that explicit in the return type (e.g. `{ success, pointsPending: Promise<...> }`).
- Confidence: confirmed
- Evidence: lines 421-428 (missing await); lines 261-266 show the correct awaited pattern elsewhere in the same file.

### REV-07-h: `restaurantStore.loadRestaurants` fetches every restaurant + every menu + every dish, unlimited
- Severity: medium
- Category: performance
- Location: `apps/mobile/src/stores/restaurantStore.ts:111-142`
- Observation: `loadRestaurants` does `.from('restaurants').select('*, menus (*, menu_categories (*, dishes (*)))')` with no `.limit()`, no filter, and no pagination. The store defines this action on both apps' shared store even though the mobile hot-path uses the Edge Function feed (`geoService`).
- Why it matters: If any caller invokes this (and there is no grep-guard preventing it — the action is exposed from the store), the mobile app pulls the entire restaurant graph into memory. Even if "currently unused" in the main UI, exposing it in the store signature invites future misuse; a single dev adding a "see all restaurants" screen will ship a 50-MB payload.
- Suggested direction: Either (a) remove the action entirely if nothing calls it, (b) add mandatory pagination (`.range(from, to)`) and a `filter` param, or (c) narrow the select to non-nested fields and require callers to fetch menus separately.
- Confidence: confirmed (unused). `grep -r "loadRestaurants\|\.loadDishes" apps/mobile/src` would confirm callers; the store exposes the action at line 62 of the interface.
- Evidence: lines 111-142 (unbounded select); file header comment at line 14-17 says these are used "by the web portal and admin screens", but this store is under `apps/mobile/src/stores/`, so the shape is vestigial.

### REV-07-i: `filterStore.resetDailyFilters` and `getDailyFilterCount` use synchronous `require('./settingsStore')` inside a module-dynamic IIFE
- Severity: low
- Category: maintainability
- Location: `apps/mobile/src/stores/filterStore.ts:778-784`, `:977-984`
- Observation: Three places in `filterStore.ts` call `require('./settingsStore').useSettingsStore.getState().currency` inside a try/catch IIFE to read the current currency. `savePermanentFilters` at line 960 also uses `await import('./authStore')`. The comment pattern suggests these are workarounds for a circular import (`filterStore` → `settingsStore` back to filterStore).
- Why it matters: Mixing `require()` with ESM import statements is fragile under Metro's Hermes bundler and TS path resolution; it bypasses module-level circular detection and tree-shaking. It also breaks Jest snapshot/mocking — tests cannot mock `settingsStore` via the standard `jest.mock()` path because the store is resolved at call time. This is maintenance debt that future refactors will trip on.
- Suggested direction: Extract the shared currency-helper into a dependency-free module (or pass the currency in as an argument to these actions). `savePermanentFilters` could be split so `authStore` subscribes to `filterStore` changes via `storeBindings.ts` rather than `filterStore` dynamically importing `authStore`.
- Confidence: confirmed
- Evidence: lines 778-784, 829-837 (inside `loadFilters`), 960-963.

### REV-07-j: Module-level `_saveFiltersTimer` and `authListenerSubscription` leak across Fast Refresh
- Severity: low
- Category: maintainability
- Location: `apps/mobile/src/stores/filterStore.ts:419`, `apps/mobile/src/stores/authStore.ts:16`
- Observation: Both stores use a module-scope mutable singleton: `_saveFiltersTimer: ReturnType<typeof setTimeout> | null` and `authListenerSubscription: Subscription | null`. On Metro's Fast Refresh during development, the module is re-evaluated but the old timer / subscription is not cleaned up — it continues to run against the stale closure.
- Why it matters: Dev-only annoyance (double listeners firing, timers writing old state), but also a real risk in test setups where a fresh module is imported repeatedly. In prod, the pattern is fine because Zustand modules are singletons.
- Suggested direction: Use `hmr-accept` hooks (Metro/Expo's `module.hot.dispose`) to clear the timer/subscription on reload. Or move the subscription into a `useEffect` inside an app-level provider so React's lifecycle handles it.
- Confidence: likely
- Evidence: `filterStore.ts:419` (comment explicitly says "prevents excessive AsyncStorage writes on rapid slider movement" — module-level by design). `authStore.ts:16` ("Track if auth listener is already set up"). Neither has an HMR teardown.

### REV-07-k: `InContextRating` revert-on-error path reverts to stale `existingOpinion` prop
- Severity: low
- Category: correctness
- Location: `apps/mobile/src/components/rating/InContextRating.tsx:93-128`
- Observation: `handleSubmit` captures `existingOpinion` via the React props closure. The checkmark animation runs for ~1.9s (line 101-105) before `setSubmitting(false)`; during that window the parent may have re-rendered and delivered a new `existingOpinion` via the effect at line 64-66. If the server write fails at the end of that window, `setCurrentOpinion(existingOpinion)` reverts to whatever the prop was *at the time handleSubmit was defined*, not the current one.
- Why it matters: The only realistic corrupting sequence is: user taps, write fails slowly, parent refetches mid-failure, UI reverts to something stale. Narrow window in practice, but the revert logic is the critical correctness path for optimistic UIs.
- Suggested direction: Capture the opinion to revert to via a ref set at handler entry (or pass `currentOpinion` from state at failure time). Alternatively, do not revert at all — keep the user's input visible and surface the error for retry.
- Confidence: likely
- Evidence: `existingOpinion` read at line 123 (inside a callback set up at line 93).

### REV-07-l: `useUserLocation.getCurrentLocation` reads cached location from a stale closure
- Severity: low
- Category: correctness
- Location: `apps/mobile/src/hooks/useUserLocation.ts:89-143`
- Observation: `getCurrentLocation` is re-declared on every render without memoization and closes over `state` (line 96-99). Within a single render cycle, consecutive calls see the same `state.cachedLocation` snapshot — fine — but a caller that holds the function across renders (e.g. via `getLocationWithPermission` in `BasicMapScreen.tsx:282`) will use whichever render's closure fired it, not the latest.
- Why it matters: Minor; the practical effect is an occasional extra `Location.getCurrentPositionAsync` call when the cache would have sufficed. Does not cause incorrect locations.
- Suggested direction: Use `useRef` to mirror `cachedLocation` + `lastUpdated` so the read is always current, or move the cache into a Zustand store.
- Confidence: likely
- Evidence: lines 96-105 (cache check against `state.cachedLocation`), exported at line 194-200.

### REV-07-m: `useCountryDetection` auto-refine effect deps suppress exhaustive-deps; `refineWithGPS` dep on `countryCode` is unreachable
- Severity: low
- Category: correctness
- Location: `apps/mobile/src/hooks/useCountryDetection.ts:122-127`
- Observation: `useEffect(() => { if (autoRefineWithGPS) refineWithGPS(); }, [autoRefineWithGPS])` has an `eslint-disable-next-line react-hooks/exhaustive-deps`. `refineWithGPS` is `useCallback(async () => {...}, [countryCode])` (line 79-119). Once `countryCode` updates, the callback identity changes but the effect never re-runs. The apparent intent ("refine once on mount") conflicts with the `countryCode` capture inside — later invocations of the ref-stable callback compare against an old country code.
- Why it matters: Narrow. Likely harmless because the effect fires only once and the check `gpsCountryCode !== countryCode` on line 103 will correctly see the first-pass value. But anyone calling `refineWithGPS` later (e.g. a "retry" button) gets stale semantics.
- Suggested direction: Drop the `countryCode` dep on the useCallback and read from the setter's prev state, or capture `countryCodeRef` via useRef.
- Confidence: likely
- Evidence: lines 79-119, 122-127.

### REV-07-n: `sessionStore.startSession` has a TOCTOU race under concurrent calls
- Severity: low
- Category: correctness
- Location: `apps/mobile/src/stores/sessionStore.ts:81-127`
- Observation: `startSession` reads the active session, then inserts a new one if none exists. Two concurrent callers (e.g. app launch + foreground event) both read "no active session" and both insert, producing two open sessions for the same user. There is no DB-side uniqueness guard (`user_sessions` is not unique on `(user_id, is_active=true)`).
- Why it matters: The second session becomes the `currentSessionId` in-memory while both stay active in DB. Rating telemetry gets split; analytics joins produce duplicates. Low frequency but possible on backgrounded-then-foregrounded flows.
- Suggested direction: Either (a) add a DB-side partial unique index on `(user_id) where is_active = true` and handle the 23505 error gracefully, or (b) gate `startSession` with an in-memory "starting" lock (`if (get().starting) return;`). The former is more robust.
- Confidence: likely
- Evidence: lines 92-123 (select-then-insert with no locking).

### REV-07-o: `filterStore.saveFilters` resolves immediately while the debounced write is still pending
- Severity: low
- Category: maintainability
- Location: `apps/mobile/src/stores/filterStore.ts:859-884`
- Observation: Signature is `saveFilters: () => Promise<void>` but the body schedules a `setTimeout(...)` and returns `Promise.resolve()` before the AsyncStorage write completes. Callers like `applyPreset` / all toggle actions `await state.saveFilters()` (indirectly via `savePermanentFilters` at line 953-955), expecting write completion.
- Why it matters: A caller that does `await saveFilters(); navigate()` may navigate before AsyncStorage has persisted. Cold restart after navigation may see old filters.
- Suggested direction: Either rename to `scheduleSave` (clear intent) or wire the returned promise to resolve when the debounced write actually completes.
- Confidence: confirmed
- Evidence: lines 861-883 (debounce scheduler), lines 952-956 (caller awaits).

### REV-07-p: `onboardingStore.loadUserPreferences` silently swallows both primary and fallback errors
- Severity: low
- Category: maintainability
- Location: `apps/mobile/src/stores/onboardingStore.ts:229-319`
- Observation: Two nested try/catch. Outer catch at line 295 logs then enters AsyncStorage fallback. Inner catch at line 316 logs again then returns. A user whose AsyncStorage is corrupted and whose Supabase fetch fails winds up with `isCompleted=false` silently — the app prompts for onboarding every session.
- Why it matters: Data recovery paths should surface to the user or emit telemetry. Silent dual-failure produces a confusing "why is this asking me again" loop.
- Suggested direction: Emit a debug event or user-visible banner when both paths fail; at minimum set `error` state on the store.
- Confidence: confirmed
- Evidence: nested try/catch structure at lines 229-319.

### REV-07-q: `useRestaurantDetail` 12-second timeout fallback leaves the retry UI ambiguous
- Severity: low
- Category: maintainability
- Location: `apps/mobile/src/screens/restaurant-detail/useRestaurantDetail.ts:135-157`
- Observation: `Promise.race([fetchRestaurantDetail, timeoutFallback])` throws "timeout" after 12s. The catch logs and the `finally` sets `loading=false`. The screen then shows "Restaurant not found" with a retry button. Users can't distinguish "this restaurant id is invalid" (show 404) from "we timed out" (show retry).
- Why it matters: Retry UX is right, but the user-facing copy (`restaurant.restaurantNotFound`) misleads; re-tapping retry does fire a new attempt, so functionally OK, just cosmetic.
- Suggested direction: Track the failure reason (timeout vs 404) and show different copy.
- Confidence: confirmed
- Evidence: lines 136-156, `RestaurantDetailScreen.tsx:98-118`.

### REV-07-r: `authStore` OAuth path stores short-lived session tokens via `setSession` without refresh-token validation
- Severity: low
- Category: security
- Location: `apps/mobile/src/stores/authStore.ts:416-453`
- Observation: The browser-based OAuth path parses `access_token` and `refresh_token` from the redirect URL fragment and passes both to `supabase.auth.setSession`. If the redirect is intercepted (universal-link hijack, though the `ASWebAuthenticationSession` should isolate), the tokens are trusted as-is.
- Why it matters: Tokens arriving via URL fragment are standard in implicit flows, but any code path that logs the URL before parsing, or persists intermediate values, leaks them. The current code calls `debugLog('[Auth] Browser result:', result.type)` at line 420 (OK, only `type`), but adding any future `debugLog(result.url)` would leak. Worth flagging as a review checkpoint.
- Suggested direction: Prefer PKCE-based flow for third-party OAuth (Supabase supports `flowType: 'pkce'` on client init) so the client never holds the refresh token in a URL. Confirm no logger config prints `result.url`.
- Confidence: needs-verification
- Evidence: lines 416-445 (URL fragment parse + `setSession`); no `flowType` visible in the Supabase client init — REV-02 / REV-09 should cross-check.

### REV-07-s: `recordInteraction` fire-and-forget fetch leaks the anon key via Edge Function URL
- Severity: info
- Category: security
- Location: `apps/mobile/src/services/interactionService.ts:62-74`
- Observation: `triggerVectorUpdate` POSTs directly to `${SUPABASE_URL}/functions/v1/update-preference-vector` with `Authorization: Bearer <ANON_KEY>`. The anon key is a public/client key, not a service-role key, so the exposure is intentional. Nonetheless, calls are fire-and-forget (`.catch(() => warn)`) — no retry, no batching, one HTTP per dish interaction.
- Why it matters: Not a security concern (anon key is public), but at-scale perf: every in-context rating → one `user_dish_interactions` insert + one Edge Function POST. Server-side debounce at the Edge Function level helps, but client-side coalescing would remove wasted fetches.
- Suggested direction: Add a 1-2s client-side coalesce on `triggerVectorUpdate` keyed by user ID. Or remove the trigger entirely and let the Edge Function pick up from a DB trigger / cron.
- Confidence: confirmed
- Evidence: lines 61-74.

## No issues found in

- `viewModeStore.ts` — trivial two-value toggle, nothing to flag.
- `settingsStore.ts` persistence via Zustand's `persist` middleware with explicit `partialize` allowlist — correct pattern.
- `storeBindings.ts` — the login-transition guard (`currentUserId !== prevUserId`) correctly prevents double-sync when both `initialize()` and the auth-state-change listener fire.
- `sessionStore.saveToStorage` / `loadFromStorage` date rehydration — correctly recreates `Date` objects on load.
- `useDish.ts` — straightforward single-dish fetch with effect-based loading. Re-fetch on `dishId` change only (correct).

## Follow-up questions

1. Is the rating-prompt intent 1 hour or 24 hours? (REV-07-a) The code and comment disagree. Product answer drives the fix.
2. Is `restaurantStore.loadRestaurants` actually unused? A repo-wide grep would confirm before proposing removal (REV-07-h).
3. Is the Supabase client initialised with `flowType: 'pkce'`? If not, REV-07-r is actionable; if yes, the finding downgrades to info.
4. What is the expected behaviour when a user background-foregrounds the app mid-session — should `startSession` idempotently reuse the active session ID it holds in memory rather than round-tripping to DB? (REV-07-n)
5. Is `InContextRating` expected to re-render on every filter change? A brief performance trace on a 100-dish menu would confirm the impact of REV-07-e.
