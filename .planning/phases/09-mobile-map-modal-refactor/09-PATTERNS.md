# Phase 9: Mobile Map & Modal Refactor - Pattern Map

**Mapped:** 2026-06-22
**Files analyzed:** 2 targets → ~14 new files across 2 co-located directories
**Analogs found:** all (in-repo precedents exist for every role)

> Behavior-preserving structural move only. No new behavior. Every excerpt below is the EXACT
> code to relocate; the analogs show the SHAPE the new files must take, not new logic to add.

---

## Import-Path Contract (D-08 — verify with grep, the real zero-residue gate)

Three consumers import the two targets by directory/bare-name. The new `index.tsx` barrels MUST
keep these resolving (mobile tsconfig has no `noUnusedLocals`, so grep is the gate, not tsc):

| Consumer | Line | Import | New barrel must export |
|----------|------|--------|------------------------|
| `src/screens/index.ts` | 2 | `export { BasicMapScreen as MapScreen } from './BasicMapScreen'` | named `BasicMapScreen` from `screens/BasicMapScreen/index.tsx` |
| `src/screens/BasicMapScreen.tsx` | 28 | `import { DailyFilterModal } from '../components/map/DailyFilterModal'` | named `DailyFilterModal` from `components/map/DailyFilterModal/index.tsx` |
| `src/components/map/index.ts` | 7 | `export { DailyFilterModal } from './DailyFilterModal'` | (same as above) |

Note: `BasicMapScreen.tsx:580` also has `export default BasicMapScreen` — preserve the default export
in the new `index.tsx` too (no current default consumer found, but it's free insurance for the move).

---

## File Classification

| New file | Role | Data flow | Closest analog | Match |
|----------|------|-----------|----------------|-------|
| `screens/BasicMapScreen/index.tsx` | parent-container + barrel | composition | `stores/filterStore/index.ts` | exact (barrel) |
| `screens/BasicMapScreen/hooks/useMapCamera.ts` | custom hook | event-driven (imperative camera) | `hooks/useUserLocation.ts` | exact (hook shape) |
| `screens/BasicMapScreen/hooks/useDishFeed.ts` | custom hook | request-response (debounced fetch) | `hooks/useUserLocation.ts` | role-match |
| `screens/BasicMapScreen/hooks/useRatingFlow.ts` | custom hook | request-response | `hooks/useUserLocation.ts` | role-match |
| `screens/BasicMapScreen/components/RatingBanner.tsx` | presentational | value+onPress | `components/map/MapFooter.tsx` | exact |
| `components/map/DailyFilterModal/index.tsx` | parent-container + barrel | local-draft → Apply | `stores/filterStore/index.ts` (barrel) + current file | exact |
| `components/map/DailyFilterModal/sections/PriceSection.tsx` | presentational | value+onChange | `components/map/MapFooter.tsx` | exact |
| `components/map/DailyFilterModal/sections/ProteinSection.tsx` | presentational | value+onChange | `components/map/MapFooter.tsx` | exact |
| `components/map/DailyFilterModal/sections/CuisineSection.tsx` | presentational | value+onChange | `components/map/MapFooter.tsx` | exact |
| `components/map/DailyFilterModal/sections/MealSection.tsx` | presentational | value+onChange | `components/map/MapFooter.tsx` | exact |
| `components/map/DailyFilterModal/modals/CuisineSelectionModal.tsx` | presentational modal | value+onToggle | self (verbatim, lines 647-727) | exact |
| `components/map/DailyFilterModal/modals/MealSelectionModal.tsx` | presentational modal | value+onToggle | self (verbatim, lines 553-633) | exact |
| `components/map/DailyFilterModal/DualRangeSlider.tsx` | presentational (gesture) | event-driven | self (verbatim, lines 744-890) | exact |
| `components/map/DailyFilterModal/helpers.ts` | helper module | transform | self (`toLocaleKey`, lines 38-51) | exact |
| `components/map/DailyFilterModal/constants.ts` | constants module | — | self (`ALL_MEALS`, lines 479-539) | exact |

Section granularity (how finely to split price / protein+meat / cuisine / meals) is planner
discretion per D-04/D-58. The 4-section split above mirrors the four `<View style={modals.section}>`
blocks in the current file.

---

## Shared Pattern: Co-located directory + barrel (Phase 8 precedent)

**Source:** `apps/mobile/src/stores/filterStore/index.ts` (lines 9-35)
**Apply to:** both new `index.tsx` files.

The Phase 8 `filterStore` directory is the canonical shape: a sibling-file dir whose `index.ts`
composes the pieces AND re-exports every symbol consumers reference.

```typescript
// stores/filterStore/index.ts:23-35 — compose, then re-export barrel
export const useFilterStore = create<FilterState & FilterActions>((set, get) => ({
  ...defaultFilterState,
  ...createDailyActionsSlice(set, get),
  // ...
}));

// Re-export barrel — every symbol consumers import from `filterStore` (D-09)
export { defaultDailyFilters, getDefaultDailyFilters, DAILY_FILTER_PRESETS } from './defaults';
export type { DailyFilters, PermanentFilters, DietPreference, FilterState } from './types';
```

Dir layout that resulted (8 sibling files + `index.ts`): `defaults.ts daily-actions.ts
permanent-actions.ts db-sync.ts persistence.ts selectors.ts types.ts index.ts`. The new dirs follow
the same convention (kebab/camel sibling files, single composition `index.tsx`).

For the screen, the parent component IS the composition root (unlike the store factory). The
`index.tsx` keeps `export function BasicMapScreen(...)` (currently line 45) as a named export and
re-exports any types if needed; the JSX `return` (lines 448-577) stays in `index.tsx` (or a sibling
`BasicMapScreen.tsx` imported by it — D-07 leaves the internal split flexible).

---

## Pattern Assignments — BasicMapScreen

### `hooks/useMapCamera.ts` (custom hook, event-driven)

**Analog:** `hooks/useUserLocation.ts` (the hook it will CONSUME — do NOT recreate `useUserLocation`, D-05).

**Hook shape to mirror** (`useUserLocation.ts:37-45, 211-218`): `useState` for status, `useRef` for
mutable handles, stable `useCallback` handlers, single object return.

**Code to move into this hook** (from `BasicMapScreen.tsx`):
- `cameraRef` (line 53), `isMapReady` (54), `hasAutocentered` (56) state.
- the auto-center effect (lines 252-276) — owns `getLocationWithPermission` from `useUserLocation`.
- `handleMyLocationPress` (lines 316-353).
- Consumes `useUserLocation()` (lines 178-184) internally; re-exposes `locationLoading`/`locationError`
  to the screen (or the screen calls `useUserLocation` separately — planner's call, but D-05 says
  `useMapCamera` consumes it).

`useUserLocation` already returns stable callbacks via `useCallback` + a `cacheRef` (lines 47-53) so
its identity won't churn — mirror that discipline in `useMapCamera` so the auto-center effect deps
stay stable.

### `hooks/useDishFeed.ts` (custom hook, request-response) — LANDMINE #1

**Analog:** `hooks/useUserLocation.ts` (hook shape).

**Code to move VERBATIM** (`BasicMapScreen.tsx`):
- feed/paging state: `feedDishes` (60), `feedLoading` (61), `filteredRestaurants` (62), `dishPage` (121).
- `PAGE_SIZE = 5` (120), `buildDish` (129-153), `allRecommendedDishes` memo + keyword filters
  (99-116), `recommendedDishes`/`hasMoreDishes`/`handleShowMore` (122-127), `mapPinDishes` (159-176).
- **The feed effect (203-249) — primitive-signature deps, 300ms debounce, `cancelled` flag.**

> LANDMINE — do NOT "fix"; see 09-CONTEXT.md D-11.1. Deps array MUST stay
> `[feedLat, feedLng, dailyKey, permanentKey, user?.id]` (line 249), where:

```typescript
// BasicMapScreen.tsx:203-206 — PRIMITIVE signature, NOT raw objects
const feedLat = userLocation ? userLocation.latitude.toFixed(3) : null;
const feedLng = userLocation ? userLocation.longitude.toFixed(3) : null;
const dailyKey = JSON.stringify(daily);
const permanentKey = JSON.stringify(permanent);
```

```typescript
// BasicMapScreen.tsx:210-244 — 300ms debounce + cancelled flag passed as () => cancelled
let cancelled = false;
const timeoutId = setTimeout(async () => { /* ... getCombinedFeedAutoExpand(..., () => cancelled) */ }, 300);
return () => { cancelled = true; clearTimeout(timeoutId); };
```

Do NOT simplify deps to `[userLocation, daily, permanent, …]` — that loops. Add the guard comment at
the new site (D-11). Hook returns `{ recommendedDishes, mapPinDishes, hasMoreDishes, handleShowMore,
feedLoading, filteredRestaurants }` (exact return shape is planner's call).

### `hooks/useRatingFlow.ts` (custom hook, request-response)

**Analog:** `hooks/useUserLocation.ts` (hook shape).

**Code to move** (`BasicMapScreen.tsx`):
- `recentRestaurantsRaw`/`getRecentRestaurantsForRating`/`recentRestaurants` memo (79-86),
  `showRatingBanner` (87).
- `handleRatingComplete` (379-405, calls `submitRating`), `getRestaurantDishes` (417-441),
  `checkIsFirstVisit` (443-446, calls `isFirstVisitToRestaurant`).
- rating-modal visibility: `isRatingFlowVisible` (59), `handleRatingBannerPress` (371),
  `closeRatingFlow` (375).

Preserve the `useMemo` over the raw array (lines 83-86) so `RatingFlowModal` isn't fed a new array
each render — that's an existing perf quirk to keep (D-10).

### `components/RatingBanner.tsx` (presentational, value+onPress) — D-06

**Analog:** `components/map/MapFooter.tsx` (`React.memo` presentational child, props = data + callbacks).

**Code to move VERBATIM:** the inline rating-banner JSX (`BasicMapScreen.tsx:530-575`), the
`{showRatingBanner && (...)}` block. Props: `onPress` (was `handleRatingBannerPress`), plus whatever
of `insets.top` / `t()` it needs (it currently reads `insets` line 49 and `t` line 47, and styled
constants `colors`/`typography`/`spacing`). Mirror MapFooter's prop-interface + `React.memo` pattern:

```typescript
// MapFooter.tsx:39-45 — presentational child shape to copy
export const MapFooter = React.memo<MapFooterProps>(function MapFooter({
  recommendedDishes, onDishPress, onFilterPress, onShowMore, hasMore,
}) { /* ... */ });
```

---

## Pattern Assignments — DailyFilterModal

### `index.tsx` (parent-container + barrel) — owns ALL draft state & reducers (D-03)

**Analog:** `stores/filterStore/index.ts` (barrel) + the current file's parent component
(lines 80-476).

**State the parent KEEPS** (D-01/D-03): `localFilters` draft (line 91), `cuisineModalVisible` (92),
`mealModalVisible` (93), `sliderDragging` (94), the Apply commit (127-130), and ALL `setLocalFilters`
reducer logic — including the protein/meat special-casing (lines 224-340).

**LANDMINE #2 — seed-on-open effect, `[visible]`-only deps:**

```typescript
// DailyFilterModal.tsx:97-101 — currentDaily DELIBERATELY excluded from deps
React.useEffect(() => {
  if (visible) {
    setLocalFilters({ ...currentDaily });
  }
}, [visible]); // intentionally only on open; currentDaily not in deps
```

> LANDMINE — do NOT add `currentDaily` to deps; clobbers in-progress edits. Add guard comment at
> new site (D-11.2).

**LANDMINE #3 — protein/meat toggle special-casing** (lines 224-283): selecting `meat` pre-selects
chicken/beef/pork; deselecting clears all meat sub-types; vegetarian/vegan toggle `dietPreference`.
This reducer logic stays in the PARENT (D-03), moved byte-for-byte. The section children receive
`localFilters` slices + typed `onChange` callbacks that call the parent's `setLocalFilters`.

**Barrel:** re-export `DailyFilterModal` named (and keep the `DailyFilterModalProps` interface,
lines 75-78). Imports currently from `'../../stores/filterStore'` (line 25) — from the new dir that
path becomes `'../../../stores/filterStore'`; update relative depth carefully (one level deeper).
Same for `'../../stores/settingsStore'` (26), `'../../utils/currencyConfig'` (27),
`'../../utils/i18nUtils'` (31).

### `sections/*.tsx` (presentational, value+onChange) — D-02/D-03

**Analog:** `components/map/MapFooter.tsx` (props = `value` data + `onX` callbacks, no store access).

Each section is the JSX of one `<View style={modals.section}>` block, lifted with its slice of
`localFilters` as a `value` prop and a typed `onChange`/`onToggle` callback bound to the parent's
reducer. NO section touches the store or owns draft state (D-03). Mirror the MapFooter prop-interface
pattern (`MapFooter.tsx:29-37`).

| Section | Source lines | value prop | onChange prop |
|---------|--------------|------------|---------------|
| PriceSection | 152-181 | `priceRange` (+ currency info) | `(min,max)=>...` (currently 175-177) |
| ProteinSection | 183-342 | `proteinTypes`, `meatTypes`, `dietPreference` | toggle callbacks (parent owns the special-casing) |
| CuisineSection | 343-384 | `cuisineTypes` | toggle + `onOpenAll` (sets `cuisineModalVisible`) |
| MealSection | 386-440 | `meals` | toggle + `onOpenAll` (sets `mealModalVisible`) |

Note: the protein toggle's branching (224-283) lives in the PARENT reducer; ProteinSection just
renders buttons and calls `onToggleProtein(key)` — keep the meat-subtype conditional render
(`localFilters.proteinTypes.meat && ...`, line 300) driven by the `value` prop.

### `modals/CuisineSelectionModal.tsx` + `modals/MealSelectionModal.tsx` (verbatim, separate) — D-09

**Analog:** self. Move byte-for-byte: `MealSelectionModal` (lines 546-633), `CuisineSelectionModal`
(lines 640-727). They are near-duplicates but stay SEPARATE — merging is a deferred behavior change.
Both need `searchBox` styles (lines 54-73), `toLocaleKey` (from `helpers.ts`), and `ALL_MEALS`/
`ALL_CUISINES` (meal one from `constants.ts`, cuisine from `@eatme/shared`). Both consume
`modals` styles, `colors/spacing/typography/borderRadius` from `@eatme/tokens`, and `useTranslation`.

### `DualRangeSlider.tsx` (presentational gesture) — LANDMINE #4

**Analog:** self. Move byte-for-byte: lines 734-890 (interface + component).

> LANDMINE — do NOT remove the Android `measure()` polling. Lines 761-786: polls until width is
> non-zero (Android reports width=0 for ~1s after Modal slide-in). It already carries an explanatory
> comment — keep it and reinforce the don't-remove anchor (D-11.4).

```typescript
// DailyFilterModal.tsx:761-786 — Android measure-poll, keep verbatim
React.useEffect(() => {
  if (trackWidth > 0) return;
  // ... polls wrapperRef.current?.measure() up to 20× @50ms until width > 0
}, [trackWidth]);
```

### `helpers.ts` (`toLocaleKey`) + `constants.ts` (`ALL_MEALS`) — D-09

**Analog:** self. `toLocaleKey` = lines 38-51 (exported). `ALL_MEALS` = lines 479-539 (exported).
The `searchBox` StyleSheet (54-73) is shared by both selection modals — planner's call whether it
lands in `helpers.ts`, a `styles.ts`, or co-located in the modals dir; keep it shared, not duplicated.

---

## Dead Code to DROP (D-12)

`DailyFilterModal.tsx:189-212` — the commented-out "Diet Type Tabs" block. Inert residue from the
abandoned allergens/dietary-tags feature (columns dropped, migrations 155/156; see CLAUDE.md
"Allergens & Dietary Tags — Abandoned"). Delete during the move; note in the commit body. This is
the ONLY deletion permitted — it has zero runtime behavior, so it is not a behavior change.

---

## Commit Discipline (SC#3)

One refactor per commit for a clean bisect: do NOT batch the BasicMapScreen extraction and the
DailyFilterModal extraction into one commit. Two independently-revertable commits.

---

## Verification Gate

- `cd apps/mobile && npx tsc --noEmit` (root `turbo/pnpm check-types` SKIPS apps/mobile).
- **Residual-symbol grep is the real zero-residue gate** (mobile tsconfig has no `noUnusedLocals`).
  Grep the three consumer import paths above resolve after the move.
- Operator on-device smoke (SC#4) is the authoritative regression gate — agent cannot run it.

---

## Metadata

**Analog search scope:** `apps/mobile/src/{screens,hooks,stores,components/map}`
**Files scanned:** BasicMapScreen.tsx, DailyFilterModal.tsx, filterStore/index.ts, useUserLocation.ts,
MapFooter.tsx, screens/index.ts, components/map/index.ts; grep over `apps/mobile/src`.
**No "no-analog" files:** every new file has an in-repo precedent (Phase 8 barrel, useUserLocation
hook shape, MapFooter presentational shape, or self-verbatim).
