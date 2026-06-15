# §S7 — Decommission the dead `nearby-restaurants` data layer

**Date:** 2026-06-15
**Source:** `docs/findings/mobile-performance-audit.md` §S7
**Risk:** Low — this is dead-code removal; nothing reachable changes behavior.

## Finding (verified)

The audit guessed `nearby-restaurants` was "likely cold." It is, in fact, **fully dead in mobile**:

- The only caller of `loadNearbyRestaurantsFromCurrentLocation` is `handleRefresh` (`BasicMapScreen.tsx:473`), and **`handleRefresh` itself is never wired to anything** (no call sites).
- Therefore `nearbyRestaurants` is never populated, and the store's `loading`/`error` never flip. The map's full-screen **loading gate (`:497`), error gate (`:516`), and "updating" overlay (`:604`) reference those values and so never render.** The map's pins come from the **feed** (`mapPinRestaurants`/`mapPinDishes`), not from nearby.
- `filterService.ts` has **no importers anywhere** (its `estimateAvgPrice`/`applyFilters`/`validateFilters` are unused).
- `geoService.ts`'s `fetchNearbyRestaurants*` are called only by the dead store methods, and its `formatDistance` is shadowed by the live one in `utils/i18nUtils.ts` (the one everything imports).
- The **legacy `restaurants`/`dishes` data layer** in the same store (`loadRestaurants`/`loadDishes`/`refreshData`) is **also dead** (zero callers) and shares `loading`/`error` with the nearby path.

Live half of `restaurantStore` (KEEP): the detail-cache layer — `restaurantDetailCache`/`categoryDishesCache`/`restaurantDishesCache`, `fetchRestaurantDetail`/`fetchCategoryDishes`/`fetchAllRestaurantDishes`, `getRestaurantAux`/`setRestaurantAux`/`clearRestaurantCaches`, and the module-level `restaurantAuxCache`. Used by `useRestaurantDetail`.

## Scope

### Core (the §S7 ask)
- **Delete** `src/services/geoService.ts` (fetchNearby* unused; `formatDistance` shadowed).
- **Delete** `src/services/filterService.ts` (no importers).
- **`restaurantStore.ts`** — remove the geoService imports, `nearbyRestaurants`/`searchCenter`/`searchRadius` state, `loadNearbyRestaurants`/`loadNearbyRestaurantsFromCurrentLocation` (+ interface members), and the nearby flow from the header doc.
- **`BasicMapScreen.tsx`** — remove the `useRestaurantStore` import + nearby selector (`:60-68`), `handleRefresh` (`:473-492`), the loading gate (`:494-513`), the error gate (`:515-537`), and the dead "updating" overlay (`:603-~632`).

### Legacy layer (entangled, also dead — recommend including)
- **`restaurantStore.ts`** — also remove `restaurants`/`dishes` state + `loadRestaurants`/`loadDishes`/`refreshData` + `loading`/`error`. Without this, `loading`/`error` are left as half-dead state read by nothing. Including it leaves the store as a clean detail-cache-only store.

### Deferred (NOT in this change)
- The `nearby-restaurants` **Edge Function** itself + its `apps/web-portal-v2` integration tests. v2 is paused (do-not-delete rule); the function is deployed but, after this change, fully unused. Deleting the function + tests is a separate decision — flag for later.

## Behavior impact
- **None functionally** — every removed line is unreachable today.
- ⚠️ The map ends up with **no full-screen loading/error UI** — but it already has none in practice (those gates never fire). If a real one is wanted, it's a separate follow-up keyed on **location + feed** state (`locationLoading`/`feedLoading`/`feedDishes.length`). Out of scope here.

## Verification
- `npx tsc --noEmit` clean.
- eslint clean — watch for newly-unused imports to also remove: in `BasicMapScreen` (`Alert`, `hasPermission`, `getLocationWithPermission`, `useShallow` if now unused — it is still used at `:102`, keep), in `restaurantStore` (`DishWithRelations`, `DailyFilters`/`PermanentFilters`).
- On-device (user): map loads pins from the feed as before; no crash; no missing UI that previously rendered.

## Files
- delete: `apps/mobile/src/services/geoService.ts`, `apps/mobile/src/services/filterService.ts`
- edit: `apps/mobile/src/stores/restaurantStore.ts`, `apps/mobile/src/screens/BasicMapScreen.tsx`
