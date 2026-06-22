---
phase: 09-mobile-map-modal-refactor
plan: 01
subsystem: mobile-map-screen
tags: [refactor, mobile, hooks, barrel, RFCT-02]
status: complete
requires:
  - apps/mobile/src/hooks/useUserLocation.ts
  - apps/mobile/src/stores/{authStore,sessionStore,filterStore,onboardingStore,countryDetectionStore}
  - apps/mobile/src/services/{edgeFunctionsService,ratingService}
  - apps/mobile/src/components/map/{DailyFilterModal,DishMarkers,MapControls,MapFooter}
provides:
  - screens/BasicMapScreen/ co-located directory + barrel (named + default BasicMapScreen)
  - hooks/useMapCamera, hooks/useDishFeed, hooks/useRatingFlow
  - components/RatingBanner (React.memo presentational child)
affects:
  - apps/mobile/src/screens/index.ts (consumer — resolves unchanged to the new directory)
tech-stack:
  added: []
  patterns:
    - Phase 8 co-located directory + barrel doctrine applied to a screen
    - Custom hooks mirror useUserLocation shape (state + stable useCallback + single object return)
    - React.memo presentational child mirrors MapFooter
key-files:
  created:
    - apps/mobile/src/screens/BasicMapScreen/index.tsx
    - apps/mobile/src/screens/BasicMapScreen/hooks/useMapCamera.ts
    - apps/mobile/src/screens/BasicMapScreen/hooks/useDishFeed.ts
    - apps/mobile/src/screens/BasicMapScreen/hooks/useRatingFlow.ts
    - apps/mobile/src/screens/BasicMapScreen/components/RatingBanner.tsx
  modified: []
  deleted:
    - apps/mobile/src/screens/BasicMapScreen.tsx
decisions:
  - "Kept the mount getLocationWithPermission() effect and the refineFromGPS effect in index.tsx (planner discretion, D-07) rather than folding them into useMapCamera — minimizes movement; useMapCamera re-exposes getLocationWithPermission/hasPermission for them."
  - "userLocation flows useMapCamera → index.tsx → useDishFeed(userLocation) as a parameter (D-05), keeping the single useUserLocation instance."
metrics:
  duration: ~25m
  completed: 2026-06-22
  tasks: 3
  files_created: 5
  files_deleted: 1
---

# Phase 9 Plan 1: Decompose BasicMapScreen Summary

Pure behavior-preserving structural move (RFCT-02): the 581-line `BasicMapScreen.tsx` monolith is now a co-located `screens/BasicMapScreen/` directory — `index.tsx` composition root + barrel, three custom hooks (`useMapCamera`, `useDishFeed`, `useRatingFlow`), and a `RatingBanner` presentational child. No new behavior, no UX change; LANDMINE #1 (feed primitive-signature deps + 300ms debounce + cancelled flag) preserved verbatim and guard-commented.

## What Was Built

- **`hooks/useMapCamera.ts`** — owns `cameraRef`/`isMapReady`/`hasAutocentered`, the auto-center effect, and `handleMyLocationPress`. Consumes the shared `useUserLocation()` internally (D-05 — NOT recreated as `useLocationPermission`, NOT moved) and re-exposes `userLocation`/`locationLoading`/`locationError`/`getLocationWithPermission`/`hasPermission`.
- **`hooks/useDishFeed.ts`** — feed/paging state, `buildDish`, dedup + drink/dessert keyword filter, `mapPinDishes`, and the LANDMINE feed effect. `userLocation` is a parameter (passed from useMapCamera via the screen). Returns `{ recommendedDishes, mapPinDishes, hasMoreDishes, handleShowMore, feedLoading, filteredRestaurants }`.
- **`hooks/useRatingFlow.ts`** — `recentRestaurants` memo (perf quirk preserved, D-10), rating-modal visibility, `handleRatingComplete`/`getRestaurantDishes`/`checkIsFirstVisit`.
- **`components/RatingBanner.tsx`** — `React.memo<RatingBannerProps>` child, banner JSX moved verbatim; reads `insets`/`t` internally like MapFooter.
- **`index.tsx`** — composes the three hooks + RatingBanner; keeps `footerHeight`/modal-visibility state, the onboarding-banner derivation, the mount-location + refineFromGPS effects, and the screen-local navigation handlers. Exports named + default `BasicMapScreen` (D-08).
- Old `screens/BasicMapScreen.tsx` deleted; `screens/index.ts:2` resolves unchanged to the new directory barrel.

## LANDMINE #1 — Preserved Verbatim

The feed effect deps array stays `[feedLat, feedLng, dailyKey, permanentKey, user?.id]` — the primitive signature (`toFixed(3)` coords + `JSON.stringify(daily/permanent)` + user id), with the 300ms debounce `setTimeout`, the `() => cancelled` flag passed to `getCombinedFeedAutoExpand`, and the `clearTimeout` cleanup. A guard anchor comment (`// LANDMINE — do NOT "fix"; see 09-CONTEXT.md D-11.1 ...`) precedes the `feedLat` declaration. Collapsing deps to the raw objects would loop the /feed call — not done.

## Deviations from Plan

None — plan executed exactly as written. The two location effects were kept in index.tsx (explicitly allowed planner discretion under D-07); the lint hook (prettier --write via pre-commit) reformatted import wrapping and the `useDishFeed` destructure onto fewer lines — cosmetic only, no logic change.

## Verification

- `cd apps/mobile && npx tsc --noEmit` exits 0 after each of the 3 tasks and at final.
- Zero-residue grep gate (mobile tsconfig has no `noUnusedLocals`):
  - old monolith deleted; no stale `BasicMapScreen.tsx` references in `apps/mobile/src`.
  - `useLocationPermission` appears nowhere; `useUserLocation.ts` untouched and present.
  - feed symbols (`feedLat`, `buildDish`, `allRecommendedDishes`) live only in `hooks/useDishFeed.ts`, none in `index.tsx`.
  - LANDMINE deps array + guard comment present in `useDishFeed.ts`.
  - `screens/index.ts:2` `export { BasicMapScreen as MapScreen } from './BasicMapScreen'` unchanged and resolving.
- On-device behavioral smoke (SC#4) is deferred to 09-03 (operator runs it on a physical phone; the agent cannot run it).

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, file access, or schema changes. Supabase queries (`getRestaurantDishes`, rating writes) and the edge-function feed fetch were relocated byte-for-byte with identical call sites and RLS-enforced shapes.

## Commits

- `edfa4d4` refactor(09-01): extract useMapCamera + useRatingFlow hooks (RFCT-02)
- `fdf595d` refactor(09-01): extract useDishFeed hook (LANDMINE #1) + RatingBanner child (RFCT-02)
- `01c11ca` refactor(09-01): decompose BasicMapScreen into hooks + RatingBanner (RFCT-02)

## Self-Check: PASSED

All 5 created files present, old monolith deleted, all 3 commits in git history.
