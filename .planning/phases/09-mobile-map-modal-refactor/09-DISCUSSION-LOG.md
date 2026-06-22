# Phase 9: Mobile Map & Modal Refactor — Discussion Log

**Date:** 2026-06-22
**Participants:** Operator (ArturKlasa) + Claude
**Outcome:** 4 gray areas discussed; all resolved → `09-CONTEXT.md` written.

The operator selected **all four** surfaced gray areas to discuss.

---

## Area A — Modal state model (SC#2 conflict)

**Gray area:** ROADMAP SC#2 literally says DailyFilterModal sections should be "value+onChange props bound to existing daily actions" (live store binding). The actual code uses a deliberate **local-draft → Apply** pattern: `localFilters` useState, seeded by a `[visible]`-only effect, committed only on Apply via `replaceDailyFilters`. These conflict.

**Decision:**
- **Preserve draft + Apply** (not live store binding). Per-change store writes would lose the cancel-on-close semantics — a behavior change, out of bounds for a behavior-preserving phase.
- **Parent owns the reducers.** The parent (`index.tsx`) holds `localFilters` + all update logic; sections are pure presentational value/onChange children against the draft.
- SC#2 is reinterpreted: satisfied in spirit (presentational sections, store is source of truth via Apply); the literal per-change-binding wording is explicitly not followed.

→ D-01, D-02, D-03.

---

## Area B — BasicMapScreen hook scope

**Gray area:** ROADMAP names exactly three hooks (`useMapCamera`, `useLocationPermission`, `useFeedMarkers`), but (a) a `useUserLocation` hook already exists, and (b) the three don't cover the screen's full responsibility set (feed/paging, rating flow).

**Decision:**
- **Hooks are a floor, not a ceiling** — planner may add hooks (anticipated: `useDishFeed`, `useRatingFlow`) to fully drain the screen.
- **Reuse `useUserLocation`** rather than create a redundant `useLocationPermission` wrapper. `useMapCamera` consumes it.
- **Extract the inline ~50-line rating banner to `<RatingBanner>`.**

→ D-04, D-05, D-06.

---

## Area C — File/folder layout

**Gray area:** directory shape (co-located screen dir vs reuse shared `src/hooks/` + `src/components/map/`), and disposition of DailyFilterModal's in-file siblings (DualRangeSlider, the two near-duplicate selection modals, `toLocaleKey`, `ALL_MEALS`).

**Decision:**
- **Co-located dirs + barrel** for both targets (mirrors Phase 8 D-08): `screens/BasicMapScreen/` (+ `hooks/`, `components/`) and `components/map/DailyFilterModal/` (+ `sections/`, `modals/`). `index.tsx` is composition root + re-export barrel; import paths resolve unchanged.
- **One file per sibling; keep both selection modals verbatim** (no merge — merging is a behavior change, deferred). `toLocaleKey` → `helpers.ts`, `ALL_MEALS` → `constants.ts`.

→ D-07, D-08, D-09.

---

## Area D — Quirk & dead-code disposition

**Gray area:** how to protect four behavior-load-bearing landmines across the move, and what to do with a commented-out "Diet Type Tabs" block.

**Initial questions were paused for clarification; operator then asked for a recommendation.** Claude recommended verbatim+guard-comments and drop-the-dead-block, with rationale (the decomposition fragments code into many small editable files → higher drift risk → in-code anchors beat a planning-doc record; the dead block is inert residue from the abandoned dietary-tags feature, columns dropped in migrations 155/156, so removal is not a behavior fix). Operator accepted both.

**Decision:**
- **Verbatim + guard comments** on the four landmines: (1) feed effect primitive-signature deps + 300ms debounce + `cancelled` flag; (2) DailyFilterModal `[visible]`-only seed effect; (3) protein/meat toggle special-casing; (4) DualRangeSlider Android `measure()` polling. Adding a comment is not a behavior change (D-10-safe).
- **Drop the commented-out "Diet Type Tabs" block** (line 189); note the deletion in the commit body. Git history preserves provenance.

→ D-10, D-11, D-12.

---

## Verified code facts (during scouting)

- BasicMapScreen.tsx = 580 lines; DailyFilterModal.tsx = 890 lines (CONCERNS.md's 608/894 are slightly stale).
- Feed debounce is **300ms** (line 239); deps `[feedLat, feedLng, dailyKey, permanentKey, user?.id]` (line 249).
- DailyFilterModal seed effect is `[visible]`-only (line 101, with the in-source comment "intentionally only on open; currentDaily not in deps").
- `filterStore` is now a directory with a barrel (Phase 8); `DailyFilterModal` imports `defaultDailyFilters` from `'../../stores/filterStore'` (line 25) — path unaffected.
- Screen consumer: `src/screens/index.ts` → `export { BasicMapScreen as MapScreen } from './BasicMapScreen'`; modal consumer: BasicMapScreen line 28. Both must keep resolving after the dir conversion.
- No dedicated deep-link/`Linking` code in BasicMapScreen — it navigates to RestaurantDetail via the marker handler; SC#4's deep-link check is a navigation smoke item.

---

*Next: `/gsd-plan-phase 9`*
