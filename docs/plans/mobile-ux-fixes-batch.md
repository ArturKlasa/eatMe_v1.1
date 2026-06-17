# Mobile UX Fixes — Batch Plan (9 issues)

**Date:** 2026-06-16
**App:** `apps/mobile`
**Status:** Planned — not yet implemented

Nine user-reported mobile issues. Research + root-cause analysis complete; this is the
file-by-file implementation plan. Decisions already locked with the user are noted inline.

## Locked decisions

- **Dish markers (#4):** keep it simple — declutter to the ~5 relevant pins + restyle as
  teardrop pins with the real cuisine emoji. Tap a pin opens the dish (already works).
  **No numbering, no card↔pin sync** (tap already reveals the dish, so on-map matching
  isn't needed).
- **Get more dishes (#8):** reveal the next batch from the **already-fetched** feed (no
  backend pagination). Stops when the local batch is exhausted.

## Suggested order & commits

Bug fixes first, then map batch, then polish, then the native one. One commit per issue
(map items #7/#9/#4/#8 share `BasicMapScreen`/`MapFooter` — group as needed).

| Order | Issue | Size |
|------|-------|------|
| 1 | #6 menu scroll | S |
| 2 | #2 remove facilities | S |
| 3 | #7 + #4 + #8 + #9 map batch | S–M |
| 4 | #3 filters slide-up | S–M |
| 5 | #1 searchable filter lists | M |
| 6 | #5 startup splash (native rebuild) | M |

---

## #6 — Restaurant menu won't scroll

**Root cause:** `RestaurantDetail` is a `presentation: 'modal'` + `gestureEnabled: true`
screen on `@react-navigation/stack` (`src/navigation/RootNavigator.tsx:166-174`), which is
built on `react-native-gesture-handler` (RNGH). The modal's vertical swipe-to-dismiss
gesture only coordinates with RNGH-aware scrollables. `FoodTab` renders a **plain
`react-native` `FlatList`** (`FoodTab.tsx:20-22`), which RNGH can't coordinate with, so the
card's pan swallows the vertical drag → the list can't scroll. `HoursMoreTab` scrolls fine
because it imports `ScrollView` from `react-native-gesture-handler` (`HoursMoreTab.tsx:10`).
Regressed in commit `1ef27ba` (M2) when the tab switched ScrollView → FlatList.

> The earlier "missing `flexGrow: 1`" theory is wrong for this symptom — `flexGrow` only
> affects content shorter than the viewport, not a long menu that refuses to scroll.

**Change — `src/screens/restaurant-detail/FoodTab.tsx`:**
- Remove `FlatList` from the `react-native` import (lines 14-22).
- Add `import { FlatList } from 'react-native-gesture-handler';` (RNGH re-exports a
  gesture-aware `FlatList` with the identical API; `RefreshControl`, `contentContainerStyle`,
  virtualization props all unchanged).

**Optional nicety — `src/styles/restaurantDetail.ts`:** add `flexGrow: 1` to `scrollContent`
(line ~271) so a short menu still fills the viewport for pull-to-refresh. Not the fix; cosmetic.

**Verify (on device):** open a restaurant with a long menu → scrolls; Hours/More still
scrolls; pull-to-refresh works; swipe-down-to-dismiss the modal still works from the top.

---

## #2 — Remove "Restaurant Facilities" from permanent filters

**Finding:** facilities (`familyFriendly`, `wheelchairAccessible`, `petFriendly`,
`lgbtAccessible`, `kidsMenu`) are **UI-only** — never read by the feed
(`edgeFunctionsService.buildFilters`) nor persisted to DB (`userPreferencesService`). Clean
removal. Aligns with the discovery-not-facilities direction.

**Change — `src/stores/filterStore.ts`:**
- Remove the `facilities` block from the `PermanentFilters` interface (lines 111-118).
- Remove the `toggleFacility` action signature (line 168).
- Remove the `facilities: {…}` default block from the default permanent state (lines 273-279).
- Remove the `toggleFacility` action implementation (lines 556-567).
- In `getPermanentFilterCount` remove the facilities count block (lines 939-943):
  ```ts
  // Check facilities
  const activeFacilities = Object.values(state.permanent.facilities).filter(Boolean);
  if (activeFacilities.length > 0) { count++; }
  ```

**Change — `src/components/DrawerFilters.tsx`:**
- Remove `toggleFacility,` from the store destructure (line 31).
- Remove the entire "Restaurant Facilities" section JSX (lines 130-156).
- Remove the now-unused `formatCamelCase` helper (line 38) — it is only used by the
  facilities map (confirmed by grep; no other references).

**Persistence note:** old persisted permanent filters may still contain a `facilities` key in
AsyncStorage; it's harmlessly ignored once the field is gone. No migration needed.

**Verify:** Filters screen shows Diet + Exclude (+ nutrition) only, no Facilities; `turbo
check-types` clean; permanent-filter count badge behaves (facilities no longer contributes).

---

## #7 + #4 + #8 + #9 — Map batch (`BasicMapScreen.tsx`, `MapFooter.tsx`, `DishMarkers.tsx`)

These four touch the same two files + the dish marker; do together.

### #7 — Show only the ~5 relevant pins

Today `mapPinDishes` (`BasicMapScreen.tsx:162-180`) and `mapPinRestaurants` (`:149-158`)
render **all** feed dishes/restaurants, while the footer caps at 5 (one per restaurant).
Pin lists must follow the footer set. Join key: `dish.restaurant_id` → `restaurant.id`.

**Change — derive pins from `recommendedDishes`:**
- Replace `mapPinDishes` to map over `recommendedDishes` (not `feedDishes`) and add `cuisine`
  (needed by #4). `recommendedDishes` already carries `id/name/restaurantId/price/cuisine`:
  ```ts
  const mapPinDishes = useMemo(() => {
    const coordsMap = new Map<string, [number, number]>();
    for (const r of filteredRestaurants) {
      if (r.location?.lat != null && r.location?.lng != null) {
        coordsMap.set(r.id, [r.location.lng, r.location.lat]);
      }
    }
    return recommendedDishes
      .filter(d => coordsMap.has(d.restaurantId))
      .map(d => ({
        id: d.id,
        name: d.name,
        restaurantId: d.restaurantId,
        coordinates: coordsMap.get(d.restaurantId)!,
        price: d.price,
        cuisine: d.cuisine,
      }));
  }, [recommendedDishes, filteredRestaurants]);
  ```
  Place the `recommendedDishes` paging (from #8) **above** `mapPinDishes` in the component so
  the memos resolve in order.

- **`mapPinRestaurants` — no change.** Restaurant view mode is **currently unavailable** in the
  app (product owner, 2026-06-16), so only dish-mode pins render. Leave the
  `mode === 'restaurant'` branch and `mapPinRestaurants` untouched — deriving `mapPinDishes`
  from `recommendedDishes` already caps the visible (dish) pins to the ~5 footer restaurants,
  so no `recommendedRestaurantIds` set is needed. (If restaurant mode is re-enabled later,
  revisit whether it shows all nearby restaurants or just the recommended set.)

> **UX note (paging + camera).** When "+ more" (#8) advances to the next 5 restaurants, their
> pins may fall outside the current viewport (the camera doesn't move). Optional follow-up: on
> page change, fit the camera to the new pin set. Not required for the core fix.

### #4 — Teardrop dish pins with real cuisine emoji

Today `DishMarkers.tsx:45` calls `getEmoji('')` (empty string) → every pin is the generic
🍽️ on a flat 28×28 orange circle.

**Change — `src/components/map/DishMarkers.tsx`:**
- Add `cuisine: string` to the dish prop type.
- Remove the local `getEmoji` helper (lines ~28-33); `import { cuisineEmoji } from '@/utils/cuisineEmoji';`
- Render `cuisineEmoji(dish.cuisine)` instead of `getEmoji('')`.
- Restyle the marker as a teardrop (rotated rounded square, tip at bottom) with the emoji
  counter-rotated upright:
  ```ts
  marker: {
    width: 34, height: 34,
    backgroundColor: colors.accent,
    borderColor: colors.white, borderWidth: 2,
    borderTopLeftRadius: 17, borderTopRightRadius: 17,
    borderBottomLeftRadius: 17, borderBottomRightRadius: 2,
    transform: [{ rotate: '45deg' }],
    justifyContent: 'center', alignItems: 'center',
    shadowColor: colors.black, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 3, elevation: 4,
  },
  emojiWrap: { transform: [{ rotate: '-45deg' }] },
  emoji: { fontSize: 16, textAlign: 'center' },
  ```
  JSX: `<View style={styles.marker}><View style={styles.emojiWrap}><Text style={styles.emoji}>{cuisineEmoji(dish.cuisine)}</Text></View></View>`
- Set the Mapbox `PointAnnotation` anchor so the tip marks the coordinate:
  `anchor={{ x: 0.5, y: 1 }}` (default is center; with a bottom-tip pin we want the tip).

**Device-verify fallback:** rotated views inside `PointAnnotation` can render slightly off on
some devices. If the tip/anchor looks wrong on-device, fall back to a larger rounded circle
(no rotation) — still cuisine-specific, still cleaner than today. Decide on-device.

> RestaurantMarkers keep their current look (issue is dish icons). Optional follow-up: apply
> the same teardrop for consistency.

### #8 — "Get more dishes" reveals the next local batch

Today the button has **no `onPress`** (`MapFooter.tsx:91-94`) — inert. Feed already fetches up
to ~20 dishes but only 5 show. Reveal the next 5 (one-per-restaurant) from what's loaded.

**Change — `src/screens/BasicMapScreen.tsx`:**
- Split the current `recommendedDishes` memo (lines 101-119) into a full, uncapped deduped
  list + a paged slice:
  ```ts
  const PAGE_SIZE = 5;
  const allRecommendedDishes = useMemo(() => {
    // existing dedup + drink/dessert filter, but NO `result.length >= 5` cap
  }, [feedDishes]);
  const [dishPage, setDishPage] = useState(0);
  const recommendedDishes = useMemo(
    () => allRecommendedDishes.slice(dishPage * PAGE_SIZE, dishPage * PAGE_SIZE + PAGE_SIZE),
    [allRecommendedDishes, dishPage]
  );
  const hasMoreDishes = allRecommendedDishes.length > (dishPage + 1) * PAGE_SIZE;
  const handleShowMore = useCallback(() => setDishPage(p => p + 1), []);
  ```
- Reset to page 0 when a fresh feed arrives: add `setDishPage(0)` right after
  `setFeedDishes(dishes)` in the feed effect (`:231`).
- Pass `onShowMore={handleShowMore}` and `hasMore={hasMoreDishes}` to `<MapFooter>` (`:515`).

**Change — `src/components/map/MapFooter.tsx`:**
- Add props `onShowMore?: () => void;` and `hasMore?: boolean;` to `MapFooterProps`.
- Gate the show-more card on `hasMore` and wire its press:
  ```tsx
  {hasMore && (
    <TouchableOpacity style={mapFooterStyles.showMoreCard} onPress={onShowMore} activeOpacity={0.8}>
      <Text style={mapFooterStyles.showMoreIcon}>+</Text>
      <Text style={mapFooterStyles.showMoreText}>{t('mapFooter.viewMoreDishes')}</Text>
    </TouchableOpacity>
  )}
  ```

Map pins (#7) follow `recommendedDishes`, so they re-point to each new page automatically.
When exhausted, the button hides. (Looping back to page 0 is a possible later tweak.)

### #9 — Move price to the top-right (same row as the icon)

Today: `dishHeader` row = emoji only; price sits bottom-right in `restaurantRow`
(`MapFooter.tsx:60-78`). `dishHeader` is already `flexRowBetween`.

**Change — `src/components/map/MapFooter.tsx`:** move the price `<Text>` (lines 72-77) into
`dishHeader` as its second child; leave restaurant name alone in `restaurantRow`:
```tsx
<View style={mapFooterStyles.dishHeader}>
  <Text style={mapFooterStyles.dishEmoji}>{cuisineEmoji(dish.cuisine)}</Text>
  <Text style={mapFooterStyles.price}>
    {formatPrice(dish.price, isSupportedCurrency(dish.currencyCode) ? dish.currencyCode : undefined)}
  </Text>
</View>
...
<View style={mapFooterStyles.restaurantRow}>
  <Text style={mapFooterStyles.restaurantName} numberOfLines={1}>{dish.restaurantName}</Text>
</View>
```
`flexRowBetween` puts emoji left / price right. No style changes required (`price` style at
`styles/map.ts:171` is fine; `dishHeader` already centers items). Optional: drop `marginBottom`
on `restaurantRow` if the single-child row looks loose.

**Verify (#7/#4/#8/#9 together, on device):** map shows ≤5 teardrop pins with cuisine emoji
matching the footer; price is top-right on each card; "+ more" reveals the next 5 and pins
move with them; button disappears at the end; tapping a pin or card opens the dish.

---

## #3 — Permanent filters slide up from the bottom (like daily)

**Finding:** Daily filters use a RN `<Modal animationType="slide">` (slides up). The permanent
`FiltersScreen` is a nav screen with `presentation: 'transparentModal'` and **no vertical
transition** (`RootNavigator.tsx:71-74`); it has the bottom-anchored sheet + drag handle +
swipe-to-close already (`FiltersScreen.tsx`), but no bottom **entrance** animation — it relies
on the navigator's default transition.

**Change — `src/navigation/RootNavigator.tsx`** (single-line fix): set a bottom-slide
transition on the `Filters` screen options (lines 71-74). In `@react-navigation/stack` **v7**
(installed: 7.6.16) the option is **`animation`** — `'slide_from_bottom'` is a valid
`StackAnimationName` (verified against the package's `types.d.ts`). The `animationEnabled`
option from v6 **does not exist in v7**, so do NOT use it.
```ts
options={{
  presentation: 'transparentModal',
  cardStyle: { backgroundColor: 'transparent' },
  animation: 'slide_from_bottom',
}}
```
This slides the whole sheet **and its dim overlay** up from the bottom on open and back down on
close — which matches the daily RN `<Modal animationType="slide">` behaviour more faithfully
than a hand-rolled animation, **and needs no `FiltersScreen.tsx` change at all**. Keep the
existing `useSwipeToClose` drag-to-dismiss and the focus `translateY.setValue(0)` reset as-is.

> Supersedes the earlier draft's in-component `translateY`/`Dimensions` entrance animation +
> `animationEnabled: false` — both dropped. The navigator now owns entrance **and** exit.

**Verify (on device):** opening Filters slides up from the bottom like the daily modal; drag-
down and overlay-tap still close it.

---

## #1 — Searchable cuisine & dish (meal) lists in daily filters

**Finding:** the "All cuisines" modal renders `ALL_CUISINES` (75 items) and the "All meals"
modal renders `ALL_MEALS` (60 items) as flat wrap-grids inside a `ScrollView`
(`DailyFilterModal.tsx` — `MealSelectionModal` ~525-587, `CuisineSelectionModal` ~601-663).
Both follow the same shape: `Modal` → header (title + Done) → `ScrollView` → `modals.cuisineGrid`.

**Change — `src/components/map/DailyFilterModal.tsx`** (apply to both selection modals):
- Add `TextInput` to the `react-native` import (line 14); add `useState`.
- Local search state + filtered list (match on the **translated** label so search works in the
  user's language). For meals:
  ```tsx
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const filteredMeals = ALL_MEALS.filter(m =>
    t(`filters.meals.${toLocaleKey(m)}`).toLowerCase().includes(q)
  );
  ```
  (Cuisines: same against `filters.cuisines.${toLocaleKey(cuisine)}`.)
- Insert a search box between the header and the `ScrollView`:
  ```tsx
  <View style={modals.searchContainer}>
    <TextInput
      style={modals.searchInput}
      placeholder={t('common.search')}
      placeholderTextColor={colors.darkTextSecondary}
      value={query}
      onChangeText={setQuery}
      autoCorrect={false}
    />
  </View>
  ```
- Map the grid over `filteredMeals` / `filteredCuisines` instead of the full arrays
  (lines 561 / 637).
- Reset `query` to `''` when the modal closes (in `onClose`, or an effect on `visible`).

**Change — styles (`src/styles/` — `modals` module, or reuse `filters.ts` `ingredientSearch*`):**
add `searchContainer` + `searchInput` mirroring `filters.ts:384-401`
(`ingredientSearchContainer` / `ingredientSearchInput`) for dark-theme consistency.

**Change — i18n (`src/locales/en.json`, `es.json`, `pl.json`):** ensure a `common.search`
key exists ("Search…" / "Buscar…" / "Szukaj…"); add if missing.

Keep the existing popular-cuisine/meal quick-pick grids in the main modal unchanged — search
lives in the "All …" overlays where the long lists are.

**Verify:** open All cuisines / All meals → type → list filters live in the current language;
clearing restores the full list; selection still toggles and persists.

---

## #5 — Remove the Expo white screen on startup

**Finding:** `expo-splash-screen` is **not installed**; native splash is plain white. Expo
auto-hides the white splash when the JS bundle loads, then `RootNavigator` shows a dark
`LoadingScreen` while `supabase.auth.getSession()` runs → the white→dark flash
(`RootNavigator.tsx:238-243`, `authStore.initialize`).

**Steps:**
1. Install: `cd apps/mobile && pnpm add expo-splash-screen` (SDK 54-compatible).
2. Asset: add `assets/splash.png` (logo on a brand/dark background). If none exists, derive
   from the app icon in `assets/`.
3. `app.json` — **append** to the existing `plugins` array (already present at `app.json:45`):
   ```json
   ["expo-splash-screen", { "image": "./assets/splash.png", "backgroundColor": "#<dark-brand>", "imageWidth": 200 }]
   ```
   Use a `backgroundColor` matching `colors.dark` so any residual frame is on-brand.
4. `index.js` — prevent auto-hide at module top:
   ```js
   import * as SplashScreen from 'expo-splash-screen';
   SplashScreen.preventAutoHideAsync();
   ```
5. `src/navigation/RootNavigator.tsx` — hide once auth is ready, so the branded splash stays
   up until the first real screen is ready (removes both the white flash and the dark spinner):
   ```ts
   useEffect(() => {
     if (isInitialized) SplashScreen.hideAsync().catch(() => {});
   }, [isInitialized]);
   ```
6. Native rebuild (required — native config change): `npx expo prebuild --clean`, then rebuild
   the dev client on device.

**Verify (on device):** cold start shows the branded splash held steady until the map/login
appears — no white flash, no dark spinner gap.

**Note:** this is the only issue needing a native rebuild on the physical device; verification
is on the user's side.

---

## Cross-cutting verification

- `turbo check-types` (or `cd apps/mobile && npx tsc --noEmit`) clean after #2, #7, #8, #9.
- All visual/interaction items verified on-device by the user (no emulator in the loop).
- Commit per issue; map items may share one commit.
