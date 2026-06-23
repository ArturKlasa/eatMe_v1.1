---
phase: 09-mobile-map-modal-refactor
reviewed: 2026-06-22T00:00:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - apps/mobile/src/screens/BasicMapScreen/index.tsx
  - apps/mobile/src/screens/BasicMapScreen/hooks/useMapCamera.ts
  - apps/mobile/src/screens/BasicMapScreen/hooks/useDishFeed.ts
  - apps/mobile/src/screens/BasicMapScreen/hooks/useRatingFlow.ts
  - apps/mobile/src/screens/BasicMapScreen/components/RatingBanner.tsx
  - apps/mobile/src/components/map/DailyFilterModal/index.tsx
  - apps/mobile/src/components/map/DailyFilterModal/sections/PriceSection.tsx
  - apps/mobile/src/components/map/DailyFilterModal/sections/ProteinSection.tsx
  - apps/mobile/src/components/map/DailyFilterModal/sections/CuisineSection.tsx
  - apps/mobile/src/components/map/DailyFilterModal/sections/MealSection.tsx
  - apps/mobile/src/components/map/DailyFilterModal/modals/CuisineSelectionModal.tsx
  - apps/mobile/src/components/map/DailyFilterModal/modals/MealSelectionModal.tsx
  - apps/mobile/src/components/map/DailyFilterModal/DualRangeSlider.tsx
  - apps/mobile/src/components/map/DailyFilterModal/helpers.ts
  - apps/mobile/src/components/map/DailyFilterModal/constants.ts
findings:
  critical: 0
  warning: 1
  info: 3
  total: 4
status: issues_found
---

# Phase 9: Code Review Report

**Reviewed:** 2026-06-22
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

This phase is a PURE, behavior-preserving structural decomposition of two monolithic mobile components (`BasicMapScreen.tsx`, 581 lines → a `screens/BasicMapScreen/` directory of 3 hooks + 1 presentational child + composition-root `index.tsx`; `DailyFilterModal.tsx`, 891 lines → a `components/map/DailyFilterModal/` directory of 4 sections + 2 sub-modals + slider + helpers/constants + barrel).

I diff-verified every new file against the pre-refactor monolith at `edfa4d4^`. The split is faithful:

- **All logic moved verbatim.** The protein/meat special-casing (LANDMINE #3), the primitive-signature feed deps + 300ms debounce + `cancelled` flag (LANDMINE #1), the `[visible]`-only seed effect (LANDMINE #2), and the Android `measure()` polling loop (LANDMINE #4) are byte-for-byte identical to the original. Correctly preserved — not flagged.
- **All imports resolve.** I literally resolved every relative-path import from each new file's location (the hooks sit one directory deeper, requiring `../../../`; the sections two deeper, requiring `../../../../`) — all targets exist. `@/`-alias and `@eatme/*` package imports resolve (`POPULAR_CUISINES`/`ALL_CUISINES` confirmed exported from `@eatme/shared`).
- **Both barrels resolve.** Old monolith files are deleted; `screens/index.ts` and `components/map/index.ts` import the directory paths, which resolve to the new `index.tsx`/`index.ts`. No dangling references.
- **No duplicate hook instantiation.** `useUserLocation()` is now instantiated exactly once (inside `useMapCamera`); the feed hook consumes `userLocation` via props. No double-subscription regression.
- **No new dead imports.** Every import in every new file is referenced.
- **State seams intact.** `localFilters` draft reducer, paging reset, `dishPage`, `recentRestaurants` memo, onboarding-banner memo deps (`lastPromptShown`) all carried over unchanged.

No bugs, security issues, or behavioral regressions were introduced by the move. The findings below are minor quality items — two of which are pre-existing in the original monolith and merely carried across (noted as such), surfaced because mobile tsconfig does not enforce `noUnusedLocals`.

## Warnings

### WR-01: Empty `catch {}` pattern absent, but feed-fetch error is swallowed to console only

**File:** `apps/mobile/src/screens/BasicMapScreen/hooks/useDishFeed.ts:154-158`
**Issue:** The feed-fetch `catch (err)` logs to `console.error` and then silently leaves `feedLoading`/`feedDishes` in their prior state with no user-facing signal. This is carried over verbatim from the original (not a refactor regression), but the refactor is the moment it became a self-contained, reusable hook — a consumer of `useDishFeed` now has no way to know a fetch failed (the hook exposes `feedLoading` but no `feedError`). On a transient network failure the footer silently shows stale/empty results.
**Fix:** Expose an error state from the hook so the screen can decide whether to surface it:
```ts
const [feedError, setFeedError] = useState<unknown>(null);
// in try: setFeedError(null) on success
// in catch: setFeedError(err);
// return: { ..., feedLoading, feedError }
```
Lower priority given it is pre-existing and SC#4 runtime parity was approved; flagging because the extraction is the natural place to close the gap.

## Info

### IN-01: `navigation` prop destructured but never used

**File:** `apps/mobile/src/screens/BasicMapScreen/index.tsx:37`
**Issue:** `BasicMapScreen({ navigation }: MapScreenProps)` destructures `navigation`, but the body uses `rootNavigation` from `useNavigation<StackNavigationProp<RootStackParamList>>()` exclusively. The `navigation` binding is dead. Pre-existing — identical in the original monolith — but the refactor preserved it.
**Fix:** Drop the unused binding: `export function BasicMapScreen(_: MapScreenProps) {` or remove the destructure entirely if the prop type allows.

### IN-02: `useDishFeed` returns `feedLoading` and `filteredRestaurants` that no consumer reads

**File:** `apps/mobile/src/screens/BasicMapScreen/hooks/useDishFeed.ts:176-177`
**Issue:** The hook returns `feedLoading` and `filteredRestaurants`, but `index.tsx` destructures neither (`{ recommendedDishes, mapPinDishes, hasMoreDishes, handleShowMore }` only). `feedLoading` is set-but-never-read (the value never drives UI — also true in the original). `filteredRestaurants` is used internally by the `mapPinDishes` memo but never needed externally. The extraction widened the public return surface beyond what is consumed.
**Fix:** Trim the returned object to what the screen uses, or wire `feedLoading` into a real loading indicator if that was the latent intent. At minimum, drop `filteredRestaurants` from the return.

### IN-03: `useMapCamera` returns `isMapReady`, `hasAutocentered`, `locationError` that the screen never reads

**File:** `apps/mobile/src/screens/BasicMapScreen/hooks/useMapCamera.ts:96-107`
**Issue:** The hook exposes `isMapReady`, `hasAutocentered`, and `locationError` in its return, but `index.tsx` consumes only `setIsMapReady`, `handleMyLocationPress`, `userLocation`, `locationLoading`, `getLocationWithPermission`, and `hasPermission`. `locationError` is used internally by `handleMyLocationPress`; the other two are internal-only state. Returning them is harmless but advertises an API surface nothing depends on, which invites future accidental coupling.
**Fix:** Return only the symbols the screen consumes (keep `setIsMapReady` since the screen calls it from `onDidFinishLoadingMap`). Drop `isMapReady`, `hasAutocentered`, `locationError` from the return unless a future consumer is planned.

---

_Reviewed: 2026-06-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
