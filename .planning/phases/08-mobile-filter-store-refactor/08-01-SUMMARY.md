---
phase: 08-mobile-filter-store-refactor
plan: 01
subsystem: mobile-state
tags: [zustand, asyncstorage, react-native, filters, refactor]

# Dependency graph
requires: []
provides:
  - "filterStore/ directory split into 8 slice files (types, defaults, selectors, daily-actions, permanent-actions, db-sync, persistence, index)"
  - "index.ts as single create() composition root AND re-export barrel (all 13 consumers resolve unchanged)"
  - "byte-for-byte-preserved AsyncStorage persistence seam (saveFilters/loadFilters)"
provides_for_0802:
  - "the new composed store + persistence slice that plan 08-02's throwaway diff harness asserts byte-identical against the pre-refactor store"
affects: [08-02, mobile-filters, mobile-persistence]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Plain factory-function slices (createXxxSlice = (set, get) => ({...})) typed via StoreApi<FilterStore>['setState'/'getState'] — NO StateCreator generic, because the create() chain has no middleware"
    - "index.ts is BOTH the create() composition root and the public re-export barrel for a directory-form Zustand store"

key-files:
  created:
    - apps/mobile/src/stores/filterStore/types.ts
    - apps/mobile/src/stores/filterStore/defaults.ts
    - apps/mobile/src/stores/filterStore/selectors.ts
    - apps/mobile/src/stores/filterStore/daily-actions.ts
    - apps/mobile/src/stores/filterStore/permanent-actions.ts
    - apps/mobile/src/stores/filterStore/db-sync.ts
    - apps/mobile/src/stores/filterStore/persistence.ts
    - apps/mobile/src/stores/filterStore/index.ts
  modified:
    - apps/mobile/src/stores/filterStore.ts (deleted)

key-decisions:
  - "Slice typing: plain factory functions (no Zustand StateCreator generic) — set/get typed via StoreApi<FilterStore>['setState'/'getState'] since the chain has zero middleware"
  - "File granularity: 8 files following the locked D-08 slice order (types/defaults/selectors/daily-actions/permanent-actions/db-sync/persistence/index)"
  - "_saveFiltersTimer kept as a single module-scope binding in persistence.ts (not per-instance/per-call)"
  - "lastSyncedAt:null initial value lives in the db-sync slice (not duplicated in index.ts initial state)"
  - "FilterActions interface exported (was non-exported) so slice factories can type against FilterState & FilterActions — only signature-surface change, internal-only (no consumer imports FilterActions)"

patterns-established:
  - "Directory-form store: file.ts -> file/index.ts barrel keeps './file', '../stores/file', '../../stores/file' import forms resolving unchanged"
  - "Verbatim-move refactor: method bodies copied char-for-char; only lazy require/import path strings adjusted for new directory depth"

requirements-completed: [RFCT-01]

# Metrics
duration: 4min
completed: 2026-06-22
status: complete
---

# Phase 8 Plan 01: Mobile Filter Store Refactor Summary

**Split the 927-line `filterStore.ts` into an 8-file `filterStore/` directory of plain-factory Zustand slices composed in a single `create()` root + re-export barrel, preserving the AsyncStorage serialization seam and every behavior quirk byte-for-byte (`tsc --noEmit` green, all 13 consumers resolve unchanged).**

## Performance

- **Duration:** 4 min
- **Started:** 2026-06-22T02:24:41Z
- **Completed:** 2026-06-22T02:28:45Z
- **Tasks:** 3
- **Files modified:** 9 (8 created, 1 deleted)

## Accomplishments
- Decomposed the largest mobile store into 8 slice files in the locked D-08 order, moving every symbol verbatim (comments/JSDoc/§3.5 reference included).
- `index.ts` is the single `create<FilterState & FilterActions>()` composition root AND the D-09 re-export barrel — hook + 3 runtime values (`defaultDailyFilters`, `getDefaultDailyFilters`, `DAILY_FILTER_PRESETS`) + 4 types (`DailyFilters`, `PermanentFilters`, `DietPreference`, `FilterState`).
- Old single-file `filterStore.ts` deleted; directory `index.ts` resolves all 13 consumer import forms (`./filterStore` ×1 same-dir, `../stores/filterStore` ×8, `../../stores/filterStore` ×4) with zero consumer edits.
- `cd apps/mobile && npx tsc --noEmit` exits 0 (the authoritative mobile typecheck gate; root turbo skips apps/mobile).

## Slice Typing Choice (recorded per plan)
**Plain factory functions, NOT Zustand's `StateCreator` generic.** Each slice is `export const createXxxSlice = (set: Set, get: Get) => ({ ...methods })` where `Set = StoreApi<FilterStore>['setState']` and `Get = StoreApi<FilterStore>['getState']` (`FilterStore = FilterState & FilterActions`). This is the cleanest choice because the store's `create()` chain has NO middleware (bare mutator tuple `[]`) — `StateCreator<…, [], [], SliceShape>` would add mutator-tuple ceremony and per-slice partial-type friction that buys nothing. `index.ts` spreads all five factories inside the single unchanged `create<FilterState & FilterActions>((set, get) => ({...}))` call, so the final composed store type is identical to the pre-refactor store.

**Final file granularity:** 8 files — `types.ts`, `defaults.ts`, `selectors.ts`, `daily-actions.ts`, `permanent-actions.ts`, `db-sync.ts`, `persistence.ts`, `index.ts`.

## Landmine Preservation (explicit confirmation — each verified by grep + tsc)
1. **Debounce singleton:** `let _saveFiltersTimer: ReturnType<typeof setTimeout> | null = null;` declared exactly ONCE at MODULE scope in `persistence.ts` (top-level, outside the factory). Confirmed: `grep -c "^let _saveFiltersTimer"` = 1. One shared 500ms timer across all `saveFilters` calls — not per-instance, not per-call.
2. **Lazy `require('../settingsStore')`:** all three occurrences (`selectors.ts` getDailyFilterCount, `daily-actions.ts` resetDailyFilters, `persistence.ts` loadFilters) kept as lazy `require` inside their try/catch IIFEs — only the path string changed `./settingsStore` → `../settingsStore` for the new directory depth. NOT converted to top-of-file imports (circular-import seam intact).
3. **Lazy `import('../authStore')`:** `db-sync.ts` savePermanentFilters keeps `const { useAuthStore: getAuthStore } = await import('../authStore');` inside try/catch — lazy dynamic import preserved, only path string adjusted.
4. **`ingredientsToAvoid` strip:** `delete parsedPermanent.ingredientsToAvoid;` preserved verbatim with its full Phase-A migration comment block in `persistence.ts` loadFilters.
5. **D-07 DB-sync inconsistency (4/4):** `permanent-actions.ts` has exactly 4 `get().savePermanentFilters()` call sites (setPermanentDietPreference, toggleExclude, resetPermanentFilters, resetAllFilters) AND exactly 4 `get().saveFilters()` call sites (setPermanentPriceRange, setCuisinePreferences, setDefaultNutrition, toggleNotification). `toggleNotification` is LOCAL-ONLY — NOT moved into the DB-sync group. NOT normalized.
6. **Serialization seam:** `JSON.stringify(currentState.permanent)` kept exactly; `{ ...defaultPermanentFilters, ...parsedPermanent }` merge order (defaults first, parsed override) kept exactly; `saveFilters` writes only `PERMANENT_STORAGE_KEY` + `LAST_SYNCED_STORAGE_KEY` (never daily); `return Promise.resolve()` kept. Storage keys byte-identical (`@eatme_daily_filters`, `@eatme_permanent_filters`, `@eatme_last_synced_at`).
7. **`replaceDailyFilters` session-only:** does NOT call saveFilters; session-only comment moved verbatim.

## Task Commits

1. **Task 1: types/defaults/selectors slices** - `acba55b` (refactor)
2. **Task 2: daily-actions/permanent-actions/db-sync/persistence slices** - `70ac847` (refactor)
3. **Task 3a: delete old single file** - `a5e843f` (refactor) — old `filterStore.ts` 927-line deletion
4. **Task 3b: index.ts composition root + barrel** - `f89664c` (refactor)

_Note: Task 3 landed as two commits because the lint-staged hook rolled back the simultaneously-staged `index.ts` when the same commit also staged a pure deletion; `index.ts` was re-committed immediately as f89664c. Net result is identical to a single Task 3 commit._

## Files Created/Modified
- `apps/mobile/src/stores/filterStore/types.ts` - DietPreference, DailyFilters, PermanentFilters, FilterState, exported FilterActions
- `apps/mobile/src/stores/filterStore/defaults.ts` - defaultDailyFilters, getDefaultDailyFilters, defaultPermanentFilters, defaultFilterState, DAILY_FILTER_PRESETS, storage keys
- `apps/mobile/src/stores/filterStore/selectors.ts` - createSelectorsSlice (filter-count selectors; lazy settingsStore require)
- `apps/mobile/src/stores/filterStore/daily-actions.ts` - createDailyActionsSlice (daily setters + presets + resets)
- `apps/mobile/src/stores/filterStore/permanent-actions.ts` - createPermanentActionsSlice (D-07 4/4 split preserved)
- `apps/mobile/src/stores/filterStore/db-sync.ts` - createDbSyncSlice (lastSyncedAt + DB sync; lazy authStore import)
- `apps/mobile/src/stores/filterStore/persistence.ts` - createPersistenceSlice (module-scope debounce singleton; serialize seam)
- `apps/mobile/src/stores/filterStore/index.ts` - single create() root + re-export barrel
- `apps/mobile/src/stores/filterStore.ts` - DELETED (verbatim content moved into the directory)

## Decisions Made
- Slice typing via plain factory functions (no StateCreator) — see "Slice Typing Choice" above.
- `FilterActions` exported (was non-exported) so slices can type against `FilterState & FilterActions`. Internal-only signature change; no consumer imports `FilterActions`. This is the only non-content change and was explicitly sanctioned by the plan.
- `lastSyncedAt: null` lives in the db-sync slice's returned object (not also set in index.ts) to avoid a duplicate key.

## Deviations from Plan

None - plan executed exactly as written. (Verbatim-move constraint honored; no Rule 1-4 deviations triggered. The only mechanical note is the Task 3 two-commit split caused by the lint-staged hook, documented under Task Commits — no behavioral or scope change.)

## Issues Encountered
- The lint-staged pre-commit hook (prettier --write) reformatted whitespace/line-wraps on the lazy-require IIFEs and the long export line. This is cosmetic formatting only; all post-prettier verify greps (D07_QUIRK_PRESERVED, LAZY_REQUIRE_PATH_OK, VALUE_REEXPORTS_OK) still pass and `tsc --noEmit` is green. Runtime targets and serialization unchanged.
- Task 3's `git rm` of the old file + simultaneous `git add index.ts` confused lint-staged into committing only the deletion; resolved by re-committing `index.ts` immediately (f89664c). Working tree is clean.

## User Setup Required
None - no external service configuration required. (On-device force-close/reopen regression check — SC#3 — is performed by the operator in plan 08-02, paired with the throwaway byte-for-byte diff harness.)

## Next Phase Readiness
- Plan 08-02 can now stand up its throwaway diff harness against the new composed store + persistence slice to prove byte-for-byte serialization equality (D-04), then hand the operator the on-device check (D-05/SC#3).
- No blockers. RFCT-01 satisfied: store split, public API + AsyncStorage serialization shape preserved.

## Self-Check: PASSED
- All 8 slice files present; old single-file `filterStore.ts` confirmed deleted.
- All 4 task commits found in git (acba55b, 70ac847, a5e843f, f89664c).
- `cd apps/mobile && npx tsc --noEmit` exits 0 (TSC_GREEN).
- All 16 file-level verify sentinels pass post-prettier.

---
*Phase: 08-mobile-filter-store-refactor*
*Completed: 2026-06-22*
