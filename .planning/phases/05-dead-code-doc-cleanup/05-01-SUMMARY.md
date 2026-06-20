---
phase: 05-dead-code-doc-cleanup
plan: 01
subsystem: mobile
tags: [dead-code, map, view-mode, deletion, ui-visible, clean-01]

# Dependency graph
requires: []
provides:
  - "Map renders dish markers only — restaurant view-mode path fully removed"
  - "BasicMapScreen.tsx pruned (no view-mode import/selector/memo/handler/ternary) — Phase 9 decompose prerequisite met"
  - "viewModeStore / ViewModeToggle / RestaurantMarkers deleted"
affects: [phase-9-basicmapscreen-decompose]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Conservative orphan-cascade deletion: removed only code proven dead by typecheck + grep; preserved shared deps (filteredRestaurants)"

key-files:
  created: []
  modified:
    - apps/mobile/src/screens/BasicMapScreen.tsx
    - apps/mobile/src/components/map/DailyFilterModal.tsx
    - apps/mobile/src/components/map/index.ts
    - apps/mobile/src/styles/modalScreen.ts
    - apps/mobile/src/styles/modals.ts
    - apps/mobile/src/styles/index.ts
  deleted:
    - apps/mobile/src/stores/viewModeStore.ts
    - apps/mobile/src/components/map/ViewModeToggle.tsx
    - apps/mobile/src/components/map/RestaurantMarkers.tsx

key-decisions:
  - "filteredRestaurants PRESERVED — it is shared with the surviving mapPinDishes memo, so the orphan cascade stops at mapPinRestaurants (confirmed via grep before deletion)"
  - "handleMarkerPress removed (fed only RestaurantMarkers); handleDishMarkerPress + handleDishPress KEPT (dish path)"
  - "ServerRestaurant import KEPT — still used by filteredRestaurants state type (line 64), not orphaned by removing the mapPinRestaurants memo"

patterns-established: []

requirements-completed: [CLEAN-01]

# Deviations
deviations:
  - "Verify command: plan said `pnpm check-types` but apps/mobile has NO check-types script (turbo check-types silently skips mobile). Used the real typecheck `npx tsc --noEmit -p tsconfig.json` from apps/mobile instead. Baseline (pre-edit) was clean; post-edit is clean (EXIT=0)."
  - "Mobile tsconfig does NOT enforce noUnusedLocals (extends expo/tsconfig.base, not the root) — a pre-existing unused PointAnnotation import already exists. So orphaned refs would NOT fail typecheck; the grep sweep is the actual zero-residue gate (and it is clean)."

# Metrics
duration: ~10min
completed: 2026-06-20
status: complete
---

# Phase 5 Plan 01: Map View-Mode Dead-Code Removal (CLEAN-01)

**Removed the user-reachable `🏪 Places` map view-mode toggle and its entire orphan cascade — 3 files deleted, 6 pruned — leaving the dish-marker path untouched. Mobile typecheck clean; zero live residue.**

## Performance
- **Duration:** ~10 min
- **Tasks:** 4
- **Files:** 9 (3 deleted, 6 modified)

## Accomplishments
- **Deleted** `viewModeStore.ts`, `ViewModeToggle.tsx`, `RestaurantMarkers.tsx` (each had no consumer after the prune).
- **Pruned `BasicMapScreen.tsx`:** removed the `useViewModeStore` + `RestaurantMarkers` imports, the `mode` selector, the `mapPinRestaurants` memo, the dead `handleMarkerPress` handler, and collapsed the `mode === 'restaurant' ? … : …` ternary to a single `<DishMarkers dishes={mapPinDishes} onMarkerPress={handleDishMarkerPress} />`.
- **Removed orphaned styles/exports:** `viewModeToggleStyles` block (`modalScreen.ts`), `viewModeToggleContainer` (`modals.ts`), the 3 `styles/index.ts` refs, the `ViewModeToggle` import+render in `DailyFilterModal.tsx`, and the `RestaurantMarkers` barrel export (`components/map/index.ts`).

## Verification
- **Typecheck:** `cd apps/mobile && npx tsc --noEmit -p tsconfig.json` → EXIT 0 (baseline was also 0).
- **Zero residue:** `grep -rn "viewModeStore|useViewModeStore|ViewModeToggle|RestaurantMarkers|viewModeToggle" apps/mobile/src` → only `styles/REFACTORING_SUMMARY.md:324` (historical snapshot, intentionally left per D-05). Live residue: none.
- **Dish path intact:** `DishMarkers dishes={mapPinDishes}` (1), `filteredRestaurants` (4 refs), `handleDishMarkerPress`/`handleDishPress` (4) all present.

## ⚠ PENDING — Operator on-device verification (D-03)
This is the only behavior change in Phase 5. **No emulator in the agent loop**, so the operator must confirm on a physical device:
1. Map opens; the daily-filter modal renders with **no `🏪 Places`/view-mode toggle**.
2. Tapping a dish marker opens the dish's restaurant.
3. Tapping a footer dish card opens the restaurant with the dish featured.
Until this is signed off, CLEAN-01's behavioral correctness is unconfirmed (build/typecheck correctness IS confirmed).

## Self-Check: PASSED
All 4 tasks complete; typecheck green; zero live residue; dish path preserved; one commit for the track (D-11).
