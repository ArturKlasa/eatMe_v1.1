# Phase 9: Mobile Map & Modal Refactor - Context

**Gathered:** 2026-06-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Decompose two oversized mobile files into custom hooks + presentational children, **behavior-preserving**, verified on-device by the operator (no emulator in the agent loop):

- `apps/mobile/src/screens/BasicMapScreen.tsx` (580 lines) → custom hooks + presentational children (RFCT-02).
- `apps/mobile/src/components/map/DailyFilterModal.tsx` (890 lines) → one presentational sub-component per filter section + extracted sub-modals/helpers (RFCT-03).

This is a pure structural move. **No new behavior, no UX changes, no "fix while here."** Carries the Phase 8 doctrine forward (directory + barrel; preserve quirks exactly). Mobile changes are confirmed on a physical device by the operator.

**Locked by ROADMAP success criteria (not re-litigated here):**
- SC#1: BasicMapScreen split into custom hooks (`useMapCamera`, `useLocationPermission`, `useFeedMarkers` named in ROADMAP) + presentational children.
- SC#2: DailyFilterModal split into one presentational sub-component per filter section, value+onChange-driven (see D-02 for the reinterpretation against the actual code).
- SC#3: `pnpm check-types` passes; **one refactor per commit** for clean bisect.
- SC#4: operator on-device smoke — camera centers, dish markers render + tap-through, daily filters apply/reset, deep-link/navigation opens the correct dish.

</domain>

<decisions>
## Implementation Decisions

### Modal state model (Area A)
- **D-01:** Preserve the **local-draft → Apply** pattern verbatim. `DailyFilterModal` keeps `const [localFilters, setLocalFilters] = React.useState<DailyFilters>({ ...currentDaily })` (line 91), seeded on open by a `[visible]`-only effect (line 99-101, `currentDaily` intentionally NOT in deps), and commits to the store **only on Apply** via `replaceDailyFilters(localFilters)` (line 128). Do NOT bind filter sections live to the store's daily actions.
- **D-02 (SC#2 reinterpretation — read before planning):** ROADMAP SC#2 literally reads *"state remaining in filterStore (value+onChange props bound to existing daily actions)."* The **actual code is local-draft-then-Apply, not live store binding.** Resolve toward preserving behavior: section children ARE presentational `value` + `onChange` components, but their value/onChange bind to the **parent's `localFilters` draft** (parent owns the reducers), and the parent commits to `filterStore` once on Apply. SC#2 is satisfied **in spirit** (presentational sections, store is the source of truth via Apply). The literal "bound to existing daily actions per-change" wording is **deliberately NOT followed** because per-change store writes would change behavior (lose the cancel-on-close semantics).
- **D-03:** **Parent owns the reducers.** The `DailyFilterModal` parent (`index.tsx`) holds `localFilters` + ALL `setLocalFilters` update logic — including the protein/meat special-casing (see Landmines). Section children are pure presentational, receiving the relevant slice of `localFilters` + typed `onChange` callbacks. No section owns store or draft state.

### BasicMapScreen hook scope (Area B)
- **D-04:** The three ROADMAP-named hooks are a **FLOOR, not a ceiling.** The planner may introduce additional hooks where they reduce the screen's responsibility surface. Anticipated beyond the named three: `useDishFeed` (feed fetch + 300ms debounce + `cancelled` flag + paging + `buildDish` + dedup/drink-dessert keyword filter + `mapPinDishes`) and `useRatingFlow` (`recentRestaurants`, `submitRating`, `checkIsFirstVisit`, `handleRatingComplete`). Exact hook set is planner discretion within the floor.
- **D-05:** **Reuse the existing `useUserLocation` hook; do NOT create `useLocationPermission`.** ROADMAP's "useLocationPermission" is satisfied by the already-existing `apps/mobile/src/hooks/useUserLocation.ts` (consumed at BasicMapScreen line 184). `useMapCamera` owns `cameraRef` / `isMapReady` / `hasAutocentered` / the auto-center effect / `handleMyLocationPress` and **consumes** `useUserLocation`. Do NOT move `useUserLocation` into the screen directory — it is a shared hook used elsewhere.
- **D-06:** Extract the inline rating-banner JSX (~lines 530-575, gated by `showRatingBanner`) into a `<RatingBanner>` presentational child under the screen's `components/` dir.

### File/folder layout (Area C)
- **D-07:** **Co-located directory + barrel** (mirrors Phase 8 D-08). Convert each target file → a directory whose `index.tsx` is BOTH the composition root/parent AND the re-export barrel:
  - `apps/mobile/src/screens/BasicMapScreen/` → `index.tsx` (composition + barrel), `hooks/` subdir (`useMapCamera`, `useDishFeed`, `useRatingFlow`, …), `components/` subdir (`RatingBanner.tsx` + any other screen-local children).
  - `apps/mobile/src/components/map/DailyFilterModal/` → `index.tsx` (parent + barrel), `sections/` (one presentational child per filter section), `modals/` (`CuisineSelectionModal.tsx`, `MealSelectionModal.tsx`), `DualRangeSlider.tsx`, `helpers.ts`, `constants.ts`.
  - File granularity within this shape is flexible during planning.
- **D-08:** **Barrel re-export every consumed symbol** (Phase 8 D-09 analog) so NO import path breaks:
  - `screens/index.ts` does `export { BasicMapScreen as MapScreen } from './BasicMapScreen'` — so `BasicMapScreen/index.tsx` MUST export a named `BasicMapScreen` (the `MapScreenProps`-typed function component) for `./BasicMapScreen` to keep resolving.
  - `DailyFilterModal/index.tsx` MUST re-export `DailyFilterModal` — BasicMapScreen imports it as `import { DailyFilterModal } from '../components/map/DailyFilterModal'` (line 28).
  - Verify with a consumer grep. The zero-residue gate is grep, not the type-checker (mobile tsconfig does NOT enforce `noUnusedLocals`).
- **D-09:** **One file per in-file sibling; KEEP both selection modals verbatim.** `DualRangeSlider` → `DualRangeSlider.tsx`; `CuisineSelectionModal` → `modals/CuisineSelectionModal.tsx`; `MealSelectionModal` → `modals/MealSelectionModal.tsx`. The two selection modals are near-duplicates but **stay separate** — merging into one generic modal is a behavior change (deferred, see below). `toLocaleKey` → `helpers.ts`; `ALL_MEALS` → `constants.ts`.

### Quirk & dead-code disposition (Area D)
- **D-10:** **Preserve behavior exactly, including known quirks.** This is a pure move; do NOT "fix while here." Each quirk found during the move is a deferred item, not a change. (Phase 8 D-06 doctrine, carried forward.)
- **D-11:** **Verbatim + guard comments** on the four load-bearing landmines. Move each byte-for-byte AND add a short anchor comment (`// LANDMINE — do NOT "fix"; see 09-CONTEXT.md`) at the new site. Adding a comment is NOT a behavior change (D-10-safe). The four:
  1. **BasicMapScreen feed effect deps are a PRIMITIVE SIGNATURE, not raw objects.** `feedLat`/`feedLng` = `userLocation…toFixed(3)` strings (lines 203-204); `dailyKey`/`permanentKey` = `JSON.stringify(daily|permanent)` (lines 205-206); deps array `[feedLat, feedLng, dailyKey, permanentKey, user?.id]` (line 249). Plus the **300ms debounce** `setTimeout` (line 211, 239) and the `cancelled` flag passed as `() => cancelled` to `getCombinedFeedAutoExpand` (line 222). Must NOT be "simplified" to `[userLocation, daily, permanent, …]` — that re-runs every render and loops.
  2. **DailyFilterModal seed-on-open effect deps = `[visible]` ONLY** (line 101); `currentDaily` deliberately excluded. Adding `currentDaily` to deps clobbers in-progress edits.
  3. **Protein/meat toggle special-casing** (lines ~224-340): selecting `meat` pre-selects sub-types; deselecting clears them; vegetarian/vegan toggles `dietPreference`. Preserve the exact branch logic when it moves into the parent reducer (D-03).
  4. **DualRangeSlider Android `measure()` polling** (lines ~761-768): polls until width is non-zero (Android reports width=0 for ~1s after Modal slide-in). It already carries an explanatory comment — keep it and reinforce the don't-remove anchor.
- **D-12:** **Drop the commented-out "Diet Type Tabs" block** (line 189). Dead code (zero runtime behavior) from the abandoned allergens/dietary-tags feature (columns dropped, migrations 155/156). Removal is NOT a behavior fix. Note the deletion in the commit body for traceability; git history preserves provenance.

### Claude's Discretion
- Exact hook set beyond the floor (D-04); exact `sections/` granularity (how finely to split price / protein+meat / cuisine / meals).
- Whether the screen composition lives directly in `index.tsx` or in a `BasicMapScreen.tsx` imported by `index.tsx` (shape is fixed by D-07; internal split is flexible).
- Whether `<RatingBanner>` receives rating-flow handlers from a `useRatingFlow` hook or from the parent directly.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirement & success criteria
- `.planning/ROADMAP.md` § "Phase 9: Mobile Map & Modal Refactor" — Goal + SC#1-4.
- `.planning/REQUIREMENTS.md` — RFCT-02 (BasicMapScreen, after CLEAN-01, on-device) + RFCT-03 (DailyFilterModal, on-device). Both this phase.

### Precedent doctrine (apply the same patterns)
- `.planning/phases/08-mobile-filter-store-refactor/08-CONTEXT.md` — D-06 (preserve behavior incl. quirks, no "fix while here"), D-08 (directory + `index` barrel), D-09 (re-export every consumer symbol). This phase mirrors that approach for two files instead of one.

### Target code & its fragility
- `apps/mobile/src/screens/BasicMapScreen.tsx` (580 lines) — RFCT-02 target. Landmine: feed effect lines 203-249 (primitive-signature deps + 300ms debounce + `cancelled`); rating banner inline JSX ~530-575; rating flow `submitRating` (line 390) / `checkIsFirstVisit` (443) / `recentRestaurants` (79-87); feed/paging `PAGE_SIZE=5` (120) / `buildDish` (129) / `mapPinDishes` (159). Export: `export function BasicMapScreen({ navigation }: MapScreenProps)` (line 45), consumed by `src/screens/index.ts:2`.
- `apps/mobile/src/components/map/DailyFilterModal.tsx` (890 lines) — RFCT-03 target. Draft state line 91; `[visible]`-only seed effect 99-101; Apply commit `replaceDailyFilters(localFilters)` 128; protein/meat toggle ~224-340; siblings `toLocaleKey` (38), `ALL_MEALS` (479), `MealSelectionModal` (553), `CuisineSelectionModal` (647), `DualRangeSlider` (744, measure-poll 761-768); dead "Diet Type Tabs" block at line 189.
- `.planning/codebase/CONCERNS.md` (≈ lines 242-336) — originating concerns for both files. NOTE the line counts there are slightly stale (580 not 608; 890 not 894); read for the fragility framing.

### Collaborators (keep contracts intact)
- `apps/mobile/src/hooks/useUserLocation.ts` — REUSE (D-05); do not recreate as `useLocationPermission` and do not move it.
- `apps/mobile/src/stores/filterStore/index.ts` — the Phase 8 barrel. `DailyFilterModal` imports `useFilterStore`, `DailyFilters`, `defaultDailyFilters` from `'../../stores/filterStore'` (line 25); that path resolves to this barrel and must stay working.

### Doctrine justifying the dead-code drop (D-12)
- `CLAUDE.md` § "Allergens & Dietary Tags — Abandoned" + migrations 155/156 — diet filtering is protein-derived; the dietary-tag UI surface was abandoned, so the commented Diet Type Tabs block is inert residue.

### Verification toolchain
- Mobile typecheck: `cd apps/mobile && npx tsc --noEmit` (root `turbo/pnpm check-types` skips `apps/mobile`). Mobile tsconfig does NOT enforce `noUnusedLocals`, so a **residual-symbol grep** is the real zero-residue gate.
- Operator on-device smoke (SC#4) is the authoritative regression gate.

</canonical_refs>

<code_context>
## Existing Code Insights

### BasicMapScreen split map
- **Camera** → `useMapCamera`: `cameraRef`, `isMapReady`, `hasAutocentered`, auto-center effect, `handleMyLocationPress`; consumes `useUserLocation` (line 184).
- **Feed + paging** → `useDishFeed` (planner's call): the 300ms-debounced effect (203-249), `allRecommendedDishes` dedup + drink/dessert keyword filter (~106-118), `PAGE_SIZE`/`dishPage` paging (120-126), `buildDish` (129), `mapPinDishes` (159).
- **Rating flow** → `useRatingFlow` (planner's call): `recentRestaurants` (79-87), `submitRating` (390), `checkIsFirstVisit`/`isFirstVisitToRestaurant` (20, 443), `handleRatingBannerPress` (371).
- **Presentational** → `<RatingBanner>` (the inline JSX 530-575). Already-extracted children imported from `components/map`: `DishMarkers`, `MapControls`, `MapFooter`, `DailyFilterModal` (lines 28-31) — leave these as-is.

### DailyFilterModal split map
- **Parent (`index.tsx`)** owns `localFilters` draft + all reducers (incl. protein/meat special-casing) and the Apply commit.
- **`sections/`** — one presentational child per filter section (price/slider, protein + meat sub-types, cuisine row, meals row), each `value` + `onChange` against the parent draft.
- **`modals/`** — `CuisineSelectionModal`, `MealSelectionModal` (verbatim, separate).
- **Standalone** — `DualRangeSlider.tsx`, `helpers.ts` (`toLocaleKey`), `constants.ts` (`ALL_MEALS`).

### Landmines to preserve during the move (D-11)
See D-11 for the four with line refs: feed primitive-signature deps + 300ms debounce + cancel; `[visible]`-only seed effect; protein/meat toggle; DualRangeSlider Android measure-poll. Move verbatim, add a guard comment at each new site.

### Consumers / import paths to preserve (D-08)
- `src/screens/index.ts` → `export { BasicMapScreen as MapScreen } from './BasicMapScreen'` (needs named `BasicMapScreen` from the new `index.tsx`).
- BasicMapScreen line 28 → `import { DailyFilterModal } from '../components/map/DailyFilterModal'` (needs named `DailyFilterModal` from the new `index.tsx`).

</code_context>

<specifics>
## Specific Ideas

- **One refactor per commit** (SC#3) — keep each extraction independently revertable for a clean bisect; do not batch BasicMapScreen and DailyFilterModal work into one commit.
- The agent's job is to make the move provably shape-identical (tsc green + zero-residue grep + import paths intact); the **operator confirms live behavior on a physical device** (camera centers, markers render + tap-through to the right dish, daily filters apply/reset, navigation opens the correct dish).

</specifics>

<deferred>
## Deferred Ideas

- **Merge `CuisineSelectionModal` + `MealSelectionModal`** into one generic `SearchableSelectionModal` — deliberately rejected here (D-09): merging is a behavior change. Capture as a follow-up once behavior-preserving extraction lands.
- **Normalize the feed-effect ergonomics** (e.g. a reusable debounced-fetch hook shared across screens) — out of scope for this behavior-preserving phase.
- Any additional quirk surfaced while moving code → append here, do NOT fix in place.

</deferred>

---

*Phase: 09-mobile-map-modal-refactor*
*Context gathered: 2026-06-22*
