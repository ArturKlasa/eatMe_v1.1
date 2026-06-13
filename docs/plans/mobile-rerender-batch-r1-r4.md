# Implementation Plan — Mobile Re-render Batch (R1–R4)

**Date:** 2026-06-13
**Source audit:** [`docs/findings/mobile-performance-audit.md`](../findings/mobile-performance-audit.md) — Part B (R1–R4).
**Scope:** Front-end re-render fixes only. **No backend, no menu-loading, no SQL.** These are the "felt at any scale, low-risk" wins.
**Status:** PLAN ONLY — no code edited yet. Awaiting approval before any edit.

---

## What's in / out

**In scope (this batch):**

| Item | What | Files | Value | Risk |
|------|------|-------|-------|------|
| **R2** | Delete two dead `useMemo`s + their orphaned imports/interfaces | `BasicMapScreen.tsx` | Medium (dead CPU on every `nearbyRestaurants` change) | **None** (pure deletion) |
| **R1** | `useCallback` the marker press handlers so the marker `React.memo` actually holds | `BasicMapScreen.tsx` | **Highest** (rebuilds native `PointAnnotation`s) | Very low |
| **R4a** | `React.memo` **MapFooter** + `useCallback` its handlers | `BasicMapScreen.tsx`, `MapFooter.tsx` | **High** (stops re-rendering 5 `expo-image` cards on any state flip) | Very low |
| **R4b** | `React.memo` **MapControls** + stabilize `handleMenuPress` | `BasicMapScreen.tsx`, `MapControls.tsx` | Low (2 text buttons) — *latent until R6, see note* | Very low |
| **R3** | Narrow whole-store subscriptions; memoize the recent-restaurants + onboarding derivations | `BasicMapScreen.tsx` | Medium (fresh array fed to `RatingFlowModal` every render) | Low |

**Explicitly OUT of scope (deferred, called out at the bottom):** R5 (feed-effect identity churn), R6 (`useUserLocation` stabilization), R7 (other whole-store subscriptions / `restaurantStore` Map caches), R8 (style/regex micro-hoists), and everything in Parts A/C (backend, menu loading). Touching none of `useUserLocation.ts`, no stores beyond two added selectors.

**One honest coupling up front:** `MapControls`'s location button calls `getLocationWithPermission` from `useUserLocation`, whose function identities are recreated every render (that's R6). So memoizing `MapControls` now is *correct but latent* — it won't actually stop re-rendering until R6 stabilizes the hook. I am **not** adding a ref-wrapper hack to force it (that band-aid belongs in R6). `MapControls` is cheap to render anyway (two `<Text>` buttons), so the latent memo costs nothing and "activates for free" once R6 lands. Details in R4b.

---

## R2 — Delete the two dead `useMemo`s (do first)

**Why:** `restaurants` (`BasicMapScreen.tsx:135`) and `dishes` (`:162`) are computed but **never consumed** — the map renders from `mapPinRestaurants`/`mapPinDishes` (built from feed state), not these. `restaurants` runs `estimateAvgPrice` + `formatDistance` + `isRestaurantOpenNow` (`new Date()` ×2 per restaurant) on every `nearbyRestaurants` change for nothing. Verified: the only other `restaurants`/`dishes` tokens are block-scoped shadows inside the feed callback (`:313-316`).

**Edits (all in `BasicMapScreen.tsx`):**

1. **Delete the `restaurants` memo** — the comment + block at `:133-158`:
   ```ts
   // Convert geospatial results to the MapRestaurant shape used by markers.
   // This is now the single authoritative source — no fallback DB query.
   const restaurants = useMemo(() => {
     …
   }, [nearbyRestaurants]);
   ```

2. **Delete the `dishes` memo** — the comment + block at `:160-184`:
   ```ts
   // Extract dish pins from the geospatial restaurant results.
   // Dishes are nested inside menus → menu_categories → dishes …
   const dishes = useMemo(() => {
     …
   }, [nearbyRestaurants]);
   ```

3. **Remove now-unused imports:**
   - `:16` → `import { estimateAvgPrice } from '../services/filterService';`
   - `:23` → `import { formatDistance } from '../services/geoService';`
   - `:24` → `import { isRestaurantOpenNow } from '../utils/i18nUtils';`

4. **Remove now-unused interfaces** (only referenced by the deleted memos):
   - `MapRestaurant` (`:45-63`)
   - `MapDish` (`:65-77`)

5. **Adjacent dead code (optional, same neighborhood):** `displayedRestaurants` (`:189-190`) + its comment (`:186-188`) — assigned from `filteredRestaurants` and never read. Safe to delete; flagged separate so R2's core stays a clean "delete the two memos."

**Keep:** the `useRestaurantStore()` destructure and `nearbyRestaurants` — still used by the loading/error gates (`:559`, `:578`, `:666`) and `handleRefresh`. (Whether that whole geo layer is vestigial is a *separate* question — see Deferred.)

**Behavior change:** none. Pure deletion. **Verify:** `turbo check-types` + `turbo lint` clean (no unused-var warnings from these files).

---

## R1 — `useCallback` the marker handlers

**Why:** `RestaurantMarkers`/`DishMarkers` are `React.memo` (verified, `RestaurantMarkers.tsx:26`, `DishMarkers.tsx:24`) but receive plain-function handlers (`handleMarkerPress:363`, `handleDishMarkerPress:374`) → new identity every render → memo fails → `.map()` rebuilds **every `PointAnnotation`** (native view host, expensive) on any unrelated state flip. `useCallback`/`useRef`/`useMemo` already imported (`:1`).

**Edits (in `BasicMapScreen.tsx`):**

`handleMarkerPress` (`:363-370`):
```ts
// BEFORE
const handleMarkerPress = (restaurant: {
  id: string;
  name: string;
  coordinates: [number, number];
  isOpen: boolean;
}) => {
  rootNavigation.navigate('RestaurantDetail', { restaurantId: restaurant.id });
};

// AFTER
const handleMarkerPress = useCallback(
  (restaurant: { id: string; name: string; coordinates: [number, number]; isOpen: boolean }) => {
    rootNavigation.navigate('RestaurantDetail', { restaurantId: restaurant.id });
  },
  [rootNavigation]
);
```

`handleDishMarkerPress` (`:374-385`) — same transform, wrap body in `useCallback(…, [rootNavigation])`.

> `rootNavigation` (from `useNavigation()`) is a stable reference per navigator, so `[rootNavigation]` never churns → marker memo now holds across footer-height / menu-toggle / loading flips.

**Behavior change:** none. **On-device check:** restaurant + dish markers still tap → open the right detail screen.

---

## R3 — Narrow store subscriptions; memoize derived lists

**Why:** Two render-body store calls return fresh values every render:
- `getRecentRestaurantsForRating()` (`:124`) `.filter().sort()`s a **new array each call** (`sessionStore.ts:273-282`), then feeds `RatingFlowModal` as a prop (`:699`) → defeats its memoization every render.
- `useOnboardingStore()` (`:117`) subscribes to the **whole store** and `shouldShowPrompt()` (`:118`) recomputes `new Date()` math every render (`onboardingStore.ts:392-407`).

**Edits (in `BasicMapScreen.tsx`):**

Onboarding (`:116-118`):
```ts
// BEFORE
// Onboarding state
const { shouldShowPrompt, isCompleted } = useOnboardingStore();
const showOnboardingBanner = user && !isCompleted && shouldShowPrompt();

// AFTER
// Onboarding state — narrow selectors + memoized derivation (no whole-store
// subscription, no per-render new Date()).
const isCompleted = useOnboardingStore(state => state.isCompleted);
const lastPromptShown = useOnboardingStore(state => state.lastPromptShown);
const showOnboardingBanner = useMemo(
  () => !!user && !isCompleted && useOnboardingStore.getState().shouldShowPrompt(),
  [user, isCompleted, lastPromptShown]
);
```
- Reads the cooldown logic via `getState().shouldShowPrompt()` at memo-eval time, so it stays centralized in the store (no duplication) and only recomputes when `user`/`isCompleted`/`lastPromptShown` change.
- Subscribing to **both** `isCompleted` and `lastPromptShown` is required so the banner reacts immediately when either changes (e.g. dismiss sets `lastPromptShown`).
- *Trade-off:* the banner no longer re-evaluates the 24 h cooldown on every render, only when a dep changes or on remount. Crossing the threshold while sitting on the map for 24 h is the only lost case — acceptable.

Rating (`:120-125`):
```ts
// BEFORE
// Session tracking for rating prompts
const getRecentRestaurantsForRating = useSessionStore(
  state => state.getRecentRestaurantsForRating
);
const recentRestaurants = getRecentRestaurantsForRating();
const showRatingBanner = recentRestaurants.length > 0 && !!user;

// AFTER
// Session tracking for rating prompts — subscribe to the raw array, derive the
// filtered/sorted list in a memo so RatingFlowModal isn't fed a new array each render.
const recentRestaurantsRaw = useSessionStore(state => state.recentRestaurants);
const getRecentRestaurantsForRating = useSessionStore(
  state => state.getRecentRestaurantsForRating
);
const recentRestaurants = useMemo(
  () => getRecentRestaurantsForRating(),
  [recentRestaurantsRaw, getRecentRestaurantsForRating]
);
const showRatingBanner = recentRestaurants.length > 0 && !!user;
```
- `getRecentRestaurantsForRating()` reads `get().recentRestaurants`, which **is** `recentRestaurantsRaw` → keying the memo on it is correct, and logic stays in the store (no duplication of `SESSION_TIMEOUT_MS`).
- `recentRestaurants` now keeps a **stable identity** between renders until session views actually change → `RatingFlowModal`'s `recentRestaurants` prop stops churning.

**Behavior change:** none. **On-device check:** rating banner + onboarding banner still appear/hide under the same conditions; rating flow opens with the right recent restaurants.

---

## R4a — `React.memo` MapFooter + `useCallback` its handlers (high value)

**Why:** `MapFooter` is a plain `React.FC` (`MapFooter.tsx:35`) receiving freshly-created handlers each render, so every screen re-render re-runs its horizontal `ScrollView` + `.map()` over `recommendedDishes`, re-rendering each `expo-image` card.

**Edit 1 — `MapFooter.tsx` (`:35`):** wrap in `React.memo`, matching the existing `RestaurantMarkers` style.
```ts
// BEFORE
export const MapFooter: React.FC<MapFooterProps> = ({
  recommendedDishes,
  onDishPress,
  onFilterPress,
}) => {

// AFTER
export const MapFooter = React.memo<MapFooterProps>(function MapFooter({
  recommendedDishes,
  onDishPress,
  onFilterPress,
}) {
```
…and the closing of the component (`:105`):
```ts
// BEFORE
      </View>
    </View>
  );
};

// AFTER
      </View>
    </View>
  );
});
```
(`React` already imported; `useSafeAreaInsets`/`useTranslation` are called inside, so insets/locale changes still re-render it independently of props.)

**Edit 2 — `BasicMapScreen.tsx`:** stabilize the two handlers passed to it.

`handleDishPress` (`:388-401`) → `useCallback(…, [rootNavigation])` (same transform as R1).

`handleDailyFilterPress` (`:446-448`):
```ts
// BEFORE
const handleDailyFilterPress = () => {
  setIsDailyFilterVisible(true);
};

// AFTER
const handleDailyFilterPress = useCallback(() => {
  setIsDailyFilterVisible(true);
}, []);
```

> `recommendedDishes` is already a `useMemo` (`:196`) keyed on `feedDishes`, so after this edit `MapFooter` re-renders **only when the feed changes** — exactly right.

**On-device check:** footer dish cards still scroll + tap → open the dish's restaurant; filter button still opens the daily filter modal.

---

## R4b — `React.memo` MapControls + stabilize `handleMenuPress` (low value, latent)

**Why low value:** `MapControls` renders two `<Text>` FAB buttons — cheap. Memoizing is correct and free, but its handler `handleMyLocationPress` depends on `getLocationWithPermission` from `useUserLocation`, which is **recreated every render** (R6). So the memo won't fully hold until R6. I'm doing the clean parts now and **not** forcing it with a ref-wrapper.

**Edit 1 — `MapControls.tsx` (`:22`):** wrap in `React.memo`.
```ts
// BEFORE
export const MapControls: React.FC<MapControlsProps> = ({
  onLocationPress,
  onMenuPress,
  locationLoading,
  footerHeight,
}) => {

// AFTER
export const MapControls = React.memo<MapControlsProps>(function MapControls({
  onLocationPress,
  onMenuPress,
  locationLoading,
  footerHeight,
}) {
```
…and the closing (`:79`):
```ts
// BEFORE
    </>
  );
};

// AFTER
    </>
  );
});
```

**Edit 2 — `BasicMapScreen.tsx`, `handleMenuPress` (`:442-444`):** make it fully stable via functional `setState` (so the menu FAB's handler identity never churns).
```ts
// BEFORE
const handleMenuPress = () => {
  setIsMenuVisible(!isMenuVisible);
};

// AFTER
const handleMenuPress = useCallback(() => {
  setIsMenuVisible(prev => !prev);
}, []);
```

**Not done here (deferred to R6):** `handleMyLocationPress` is left as-is. Once R6 stabilizes `useUserLocation`'s functions, wrap it in `useCallback(…, [locationLoading, locationError, t])` and `MapControls`'s memo becomes effective with no further change.

> **Optional, only if you want `MapControls` effective before R6:** add a latest-ref shim in `BasicMapScreen` —
> ```ts
> const getLocationRef = useRef(getLocationWithPermission);
> useEffect(() => { getLocationRef.current = getLocationWithPermission; });
> ```
> then have `handleMyLocationPress = useCallback(async () => { … await getLocationRef.current() … }, [locationLoading, locationError, t])`. I recommend **skipping** this and folding the real fix into R6 instead — flagged so the option isn't lost.

**On-device check:** menu FAB still toggles the floating menu; location FAB still recenters the map and shows the `⌖...` loading glyph.

---

## Sequencing & commits

Suggested order (each step compiles + is independently revertable; squash to taste):

1. **Commit 1 — R2** (`refactor(mobile): drop dead restaurant/dish memos in BasicMapScreen`): pure deletion, zero behavior change. Safest first; shrinks the diff the later commits sit on.
2. **Commit 2 — R1 + R4a** (`perf(mobile): memoize map markers + footer (stable callbacks)`): the high-value batch — marker handlers + MapFooter memo + `handleDishPress`/`handleDailyFilterPress`.
3. **Commit 3 — R3** (`perf(mobile): narrow map-screen store subscriptions`): selectors + memoized derivations.
4. **Commit 4 — R4b** (`perf(mobile): memoize MapControls + stabilize menu toggle`): low value; can be folded into Commit 2 or skipped.

Per your workflow: I won't push to `origin/main` until you say "commit."

## Verification

- **Per step:** `cd apps/mobile && npx tsc --noEmit` (or `turbo check-types`) and `turbo lint` — must stay clean (R2 specifically must clear the unused-import/interface warnings it removes).
- **No automated render tests exist** for these screens, and adding them isn't worth it here (visual/interaction code, solo project) — consistent with how we've scoped test ROI before.
- **On-device (yours — no emulator in my loop):** the four interaction checks listed under each item. The net effect should be **invisible functionally** — markers/footer/banners behave identically; the map should just feel smoother when filters/menu/loading toggle.

## Risk & rollback

- **Risk:** very low. R2 is deletion; R1/R3/R4 are identity-stability wraps with unchanged logic. No store *behavior* changes (only *subscription shape* in R3, and `getState().shouldShowPrompt()` reads the same fields the selectors watch).
- **Main thing to watch:** R3's onboarding-banner cooldown is now memo-gated (the 24 h trade-off noted above). If that ever feels wrong, drop the `useMemo` and compute `showOnboardingBanner` inline from the two selectors.
- **Rollback:** each commit is self-contained; `git revert` any one without disturbing the others.

## Deferred (intentionally not in this batch)

| Item | Why deferred |
|------|--------------|
| **R6** — stabilize `useUserLocation` (`useCallback` its fns; move location cache to `useRef`) | Medium change with a closure-staleness wrinkle; touches a hook used by 3 effects. Doing it **next** makes R4b's MapControls memo effective for free and removes the 3 effect-dependency workarounds. |
| **R5** — key the feed effect on a primitive signature; memoize `userLocation` by value | Couples with R6 (both about location identity); changes feed-fetch trigger semantics — wants its own focused change. |
| **R7** — other whole-store subscriptions; move `restaurantStore` `Map` caches out of reactive state | Broader store refactor; higher blast radius. |
| **R8** — hoist inline banner styles / module-scope the `recommendedDishes` regexes / `DishMarkers.getEmoji` | Micro-wins; fold in opportunistically. |
| Is the whole `nearbyRestaurants` / geo-store layer vestigial after R2? | After R2 it only feeds loading/error gates. Possibly removable, but that's a data-layer change touching `restaurantStore` + `handleRefresh` — separate investigation, not a re-render fix. |
| All of **Part A** (feed cache key §S1, open-hours round-trip §S3, cache invalidation §S6) and **Part C** (menu eager-load §M1, virtualization §M2/§M3) | Different subsystems; tracked in the audit's roadmap. |

---

*Plan covers Part B items R1–R4 only. Companion: [`mobile-performance-audit.md`](../findings/mobile-performance-audit.md).*
