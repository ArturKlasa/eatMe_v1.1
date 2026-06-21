# Phase 8: Mobile Filter Store Refactor - Context

**Gathered:** 2026-06-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Split the 927-line `apps/mobile/src/stores/filterStore.ts` into slice creators composed in an `index.ts`, **preserving the public store API and the hand-rolled AsyncStorage persistence shape byte-for-byte** — so no installed user loses their saved permanent filters.

This is a behavior-preserving refactor (RFCT-01). No new filter axes, no UI changes, no persistence-format changes. Mobile changes are verified on-device by the operator (no emulator in the agent loop).

**Locked by ROADMAP success criteria (not re-litigated here):**
- Decompose into slice creators (defaults/types → selectors → daily actions → permanent actions → persistence seam last), composed in an `index.ts`.
- `useFilterStore`'s import path and exported type stay unchanged for every consumer.
- `saveFilters` serialization / `loadFilters` parsing keeps identical field names and nesting; the persisted-vs-session boundary stays (permanent persisted, daily session-only).
- `pnpm check-types` passes; operator confirms on-device that saved filters survive force-close/reopen.
- Any test added is limited to de-risking the persistence-serialization seam (no broad coverage push).

</domain>

<decisions>
## Implementation Decisions

### Persistence approach
- **D-01:** Keep the **hand-rolled** persistence verbatim. Move `saveFilters` / `loadFilters` into a dedicated persistence slice with the SAME behavior: direct `AsyncStorage` calls, same keys (`@eatme_daily_filters`, `@eatme_permanent_filters`, `@eatme_last_synced_at`), same 500ms debounce, same "daily is session-only / always reset on load" semantics, same `ingredientsToAvoid` legacy-strip in `loadFilters`.
- **D-02:** Do **NOT** adopt Zustand `persist` middleware. It would re-wrap storage as `{state, version}` under a single key — a different shape from today's raw per-key JSON — which breaks the byte-for-byte requirement and risks wiping installed users' permanent filters. No functional gain.
- **D-03 (correction for downstream agents):** CONCERNS.md (`filterStore.ts — 927 Lines` section) advises "bump the migration version on the Zustand `persist` middleware config" and "verify the `partialize` function." **This is stale** — the store is a plain `create<FilterState & FilterActions>((set, get) => …)` with NO `persist` middleware and NO `partialize`. The real serialization boundary is the manual logic in `saveFilters` (writes only `permanent` + `lastSyncedAt`) and `loadFilters` (daily always reset, permanent merged over defaults). Treat THAT logic as the seam to preserve.

### Serialization-seam verification
- **D-04:** Prove byte-for-byte equality with a **throwaway one-shot diff harness**, not a committed test. The harness serializes the permanent-filter payload (the defaults object + at least one populated/non-default sample) from the pre-refactor store and the new composed store, asserts the JSON strings match, and is deleted before phase close. No new test runner is stood up in `apps/mobile`.
- **D-05:** The harness pairs with — does not replace — the operator's on-device force-close/reopen check (SC#3). The on-device check is the authoritative regression gate for the live persisted state.

### Pre-existing behavior quirks
- **D-06:** **Preserve current behavior exactly**, including known inconsistencies. The split is a pure move; do not "fix while here." Each quirk found during the move is recorded as a deferred item (see Deferred Ideas), not changed.
- **D-07:** Specific quirk to preserve (do NOT normalize): permanent setters are inconsistent about DB sync — `setPermanentDietPreference`, `toggleExclude`, `toggleNotification`, `resetPermanentFilters`, `resetAllFilters` call `savePermanentFilters()` (local **+** DB sync), while `setPermanentPriceRange`, `setCuisinePreferences`, `setDefaultNutrition` call `saveFilters()` (local-only). Keep each call site exactly as-is.

### Slice file layout
- **D-08:** Convert `filterStore.ts` → a `filterStore/` **directory**. `index.ts` is the composition root (single `create()` call wiring the slices) AND the re-export barrel, so `../stores/filterStore` resolves unchanged. Named slice files follow the locked order, e.g. `types.ts`, `defaults.ts` (incl. `DAILY_FILTER_PRESETS`, storage keys), `selectors.ts`, `daily-actions.ts`, `permanent-actions.ts`, `db-sync.ts`, `persistence.ts`. Exact file granularity within this shape is flexible during planning.
- **D-09:** `index.ts` MUST re-export every symbol consumers currently import from `filterStore.ts`: the `useFilterStore` hook; types `DailyFilters`, `PermanentFilters`, `DietPreference`, `FilterState`; and the **value** `defaultDailyFilters` (imported as a runtime value by `DailyFilterModal.tsx`), plus `getDefaultDailyFilters` and `DAILY_FILTER_PRESETS` (currently exported). Verify with a consumer grep that no import path or named import breaks.

### Claude's Discretion
- Exact number/naming of slice files within the layout shape of D-08.
- Whether to type slices via Zustand's `StateCreator<FilterState & FilterActions, [], [], SliceShape>` pattern or plain factory functions — provided the final composed store type and the single `create()` call are unchanged. (Researcher/planner to confirm the cleanest typing given there is no middleware in the chain.)
- Internal placement of the module-level `_saveFiltersTimer` debounce singleton (must remain a single shared timer, not one-per-call — see Code Insights).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirement & success criteria
- `.planning/ROADMAP.md` § "Phase 8: Mobile Filter Store Refactor" — Goal + the 4 locked success criteria (slice order, import/type preservation, serialization byte-for-byte, targeted-test-only).
- `.planning/REQUIREMENTS.md` — RFCT-01 (the one requirement this phase satisfies).

### Target code & its fragility
- `apps/mobile/src/stores/filterStore.ts` — the 927-line store being split. The whole file is in scope.
- `.planning/codebase/CONCERNS.md` § "`filterStore.ts` — 927 Lines" — the originating concern. NOTE its "Zustand `persist` / `partialize`" guidance is stale (see D-03); read it for the fragility framing, not the prescription.

### Domain context referenced by the code
- `docs/plans/abandon-allergens-dietary.md` §3.5 — defines the `DietPreference` ('all' | 'vegetarian' | 'vegan') hard/soft contract that the daily and permanent diet layers implement; cited directly in `filterStore.ts` comments. Move the comment/type verbatim.

### Persistence collaborators (imported by the store — keep contracts intact)
- `apps/mobile/src/services/userPreferencesService.ts` — `loadUserPreferences`, `saveUserPreferences`, `permanentFiltersToDb`, `dbToPermanentFilters` (the DB-sync seam; imports `type PermanentFilters` back from the store).
- `apps/mobile/src/utils/currencyConfig.ts` — `getPriceRangeForCurrency`, `SupportedCurrency` (currency-aware price defaults).

</canonical_refs>

<code_context>
## Existing Code Insights

### Current structure (the split map)
The file already groups cleanly into the locked slice order:
- **Types:** `DietPreference`, `DailyFilters`, `PermanentFilters`, `FilterState`, `FilterActions` (interface).
- **Defaults / constants:** `defaultDailyFilters`, `getDefaultDailyFilters()`, `defaultPermanentFilters`, `defaultFilterState`, `DAILY_FILTER_PRESETS`, storage keys, `_saveFiltersTimer`.
- **Daily actions:** `setDailyPriceRange` … `replaceDailyFilters`, `setCurrencyPriceRange`.
- **Permanent actions:** `setPermanentDietPreference` … `toggleNotification`.
- **Preset/reset actions:** `applyPreset`, `clearActivePreset`, `resetDailyFilters`, `resetPermanentFilters`, `resetAllFilters`.
- **Persistence:** `loadFilters`, `saveFilters` (+ the debounce timer).
- **DB sync:** `lastSyncedAt`, `loadPreferencesFromDB`, `savePreferencesToDB`, `syncWithDatabase`, `savePermanentFilters`.
- **Selectors/utility:** `getDailyFilterCount`, `getPermanentFilterCount`, `hasDailyFilters`, `hasPermanentFilters`.

### Landmines to preserve during the move
- **Module-level debounce singleton:** `let _saveFiltersTimer` lives at module scope so all `saveFilters` calls share one 500ms timer. It must remain a single shared module-level binding in whichever slice owns persistence — do NOT recreate per slice instance or per call.
- **Dynamic `require('./settingsStore')`** appears in 3 places (`resetDailyFilters`, `loadFilters`, `getDailyFilterCount`) — a deliberate lazy require to dodge a circular import. Keep it as a lazy `require`, not a top-of-file import.
- **Dynamic `import('./authStore')`** inside `savePermanentFilters` — same circular-import avoidance. Preserve the lazy dynamic import.
- **`loadFilters` legacy strip:** `delete parsedPermanent.ingredientsToAvoid` (Phase A migration cleanup). Move verbatim.
- **`replaceDailyFilters` intentionally does NOT persist** (daily is session-only) — comment + behavior must survive.

### Consumers (13 files import from the store)
- Value imports to re-export: `useFilterStore` (hook), `defaultDailyFilters` (used by `DailyFilterModal.tsx`), `getDefaultDailyFilters`, `DAILY_FILTER_PRESETS`.
- Type imports to re-export: `DailyFilters`, `PermanentFilters`, `DietPreference`, `FilterState` (e.g. `FoodTab.tsx`, `useRestaurantDetail.ts`, `ModifierGroupsList.tsx`, `menuFilterUtils.ts`, `userPreferencesService.ts`, `edgeFunctionsService.ts`, `DailyFilterModal.tsx`).

### Verification toolchain
- Mobile typecheck is `cd apps/mobile && npx tsc --noEmit` (the root `turbo/pnpm check-types` skips `apps/mobile` — no `check-types` script there). Mobile tsconfig does NOT enforce `noUnusedLocals`, so a grep for residual symbols is the real zero-residue gate.

</code_context>

<specifics>
## Specific Ideas

- The phase goal is explicitly "no installed user loses their saved filters" — every decision above resolves toward the conservative, byte-identical path for that reason.
- Operator validates on a physical device; the agent's job is to make the move provably shape-identical and let the operator confirm the live state.

</specifics>

<deferred>
## Deferred Ideas

- **Normalize the permanent-setter DB-sync inconsistency** (D-07): decide whether `setPermanentPriceRange` / `setCuisinePreferences` / `setDefaultNutrition` *should* also sync to DB like the other permanent setters. Out of scope for this behavior-preserving phase — capture as a follow-up todo after the refactor lands.
- **Adopt Zustand `persist` middleware** with a proper legacy-key migration — a future modernization once a safe migration path is designed; deliberately rejected here (D-02).
- **Stand up a real test runner in `apps/mobile`** — broader than this phase's minimal-test policy; the serialization seam is covered by a throwaway harness instead (D-04).
- Any additional quirks surfaced while moving code should be appended here, not fixed in place.

</deferred>

---

*Phase: 08-mobile-filter-store-refactor*
*Context gathered: 2026-06-21*
