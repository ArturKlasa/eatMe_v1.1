# Implementation Plan: eatMe Codebase Refactor

## Checklist

- [x] **Step 1:** Create `@eatme/shared` package scaffold and configure monorepo integration
- [x] **Step 2:** Extract constants into `@eatme/shared/constants/`
- [x] **Step 3:** Extract types into `@eatme/shared/types/`
- [x] **Step 4:** Extract validation schemas into `@eatme/shared/validation/`
- [x] **Step 5:** Migrate web-portal imports to `@eatme/shared` and remove local copies
- [x] **Step 6:** Migrate mobile imports to `@eatme/shared` and remove local copies
- [x] **Step 7:** Add `test` task to Turbo pipeline and verify full build
- [x] **Step 8:** Create CLAUDE.md and `agent_docs/` directory
- [x] **Step 9:** Update `.github/copilot-instructions.md` to fix stale references
- [x] **Step 10:** Split `useMenuScanState.ts` into focused hooks
- [x] **Step 11:** Split `MenuScanReview.tsx` into focused components
- [x] **Step 12:** Split `RestaurantDetailScreen.tsx` into focused modules
- [x] **Step 13:** Restructure `common.ts` into focused style modules
- [x] **Step 14:** JSDoc pass on `@eatme/shared` and `@eatme/database` packages
- [x] **Step 15:** JSDoc pass on web-portal `lib/`, hooks, and API routes
- [x] **Step 16:** JSDoc pass on mobile services, stores, and hooks
- [x] **Step 17:** Document magic numbers and add module-level doc comments
- [x] **Step 18:** Dead code removal and verbose pattern cleanup
- [x] **Step 19:** Extract shared test utilities and consolidate test mocks
- [x] **Step 20:** Add `eslint-plugin-jsdoc` to ESLint configs
- [x] **Step 21:** Add pre-commit hooks with Husky + lint-staged
- [x] **Step 22:** Create GitHub Actions CI workflow

---

## Branching Strategy

Each phase should be implemented on a dedicated short-lived branch and merged to main before starting the next phase. This minimizes merge conflict risk (see Design Appendix D).

- **Phase 1:** `refactor/shared-package`
- **Phase 2:** `refactor/ai-readiness`
- **Phase 3:** `refactor/code-quality`
- **Phase 4:** `refactor/ci-infrastructure`

Phases 2 and 3 can run in parallel on separate branches after Phase 1 merges to main. Phase 4 starts after both merge.

---

## Phase 1: Foundation — `@eatme/shared` Package

*Requirements: R1, R2, R3, R4, R5 (partial), R11, R17, R22*

### Step 1: Create `@eatme/shared` package scaffold and configure monorepo integration

**Objective:** Set up the new shared package with proper TypeScript and monorepo configuration so both apps can consume it.

**Implementation guidance:**

1. Create `packages/shared/` directory with:
   - `package.json` — name `@eatme/shared`, version `0.0.1`, main/types pointing to `./src/index.ts`, zod as optional peer dependency
   - `tsconfig.json` — extend from root config, strict mode, composite enabled for project references
   - `src/index.ts` — empty barrel export (will be populated in subsequent steps)
   - `src/constants/index.ts`, `src/types/index.ts`, `src/validation/index.ts` — empty barrel exports

2. Add `"@eatme/shared": "workspace:*"` to `apps/web-portal/package.json` and `apps/mobile/package.json` dependencies

3. Add `"@eatme/shared"` to `next.config.ts` `transpilePackages` array (alongside existing `@eatme/database`)

4. Run `pnpm install` to link the workspace package

5. No changes needed to `pnpm-workspace.yaml` — it already includes `packages/*` which auto-discovers `packages/shared/`

6. Verify: `turbo build` succeeds with the new empty package

**Test requirements:**
- `turbo build && turbo lint && turbo check-types` must pass
- Both apps compile without errors
- `pnpm ls @eatme/shared` shows it linked in both apps

**Integration with previous work:** This is the first step — no dependencies.

**Demo:** Both apps build successfully with the new `@eatme/shared` dependency resolved. Importing `from '@eatme/shared'` works (returns empty module).

---

### Step 2: Extract constants into `@eatme/shared/constants/`

**Objective:** Move all domain constants from both apps into the shared package, merging divergent lists into canonical sources.

**Implementation guidance:**

1. Create the following files in `packages/shared/src/constants/`:
   - `cuisine.ts` — Merge `POPULAR_CUISINES` from web-portal (12 items) and mobile (identical 12 items). Merge `CUISINES` (web, 67 items) with `ALL_CUISINES` (mobile, 67 items including 4 extras: "Asian", "Comfort Food", "Fine Dining", "International"). Export both as `POPULAR_CUISINES` and `ALL_CUISINES`. Also export `CUISINES` as an alias for `ALL_CUISINES` for backward compatibility.
   - `dietary.ts` — Copy `DIETARY_TAGS`, `ALLERGENS`, `RELIGIOUS_REQUIREMENTS` from `apps/web-portal/lib/constants.ts`
   - `menu.ts` — Copy `MENU_CATEGORIES`, `DISH_KINDS`, `SELECTION_TYPES`, `OPTION_PRESETS` from web-portal constants
   - `pricing.ts` — Copy `PRICE_RANGES`, `SPICE_LEVELS`, `DISPLAY_PRICE_PREFIXES` from web-portal constants
   - `restaurant.ts` — Copy `RESTAURANT_TYPES`, `PAYMENT_METHOD_OPTIONS`, `SERVICE_SPEED_OPTIONS`, `COUNTRIES` from web-portal constants
   - `calendar.ts` — Copy `DAYS_OF_WEEK` and the `DayKey` type from web-portal constants
   - `wizard.ts` — Copy `WIZARD_STEPS` from web-portal constants

2. Update `packages/shared/src/constants/index.ts` to re-export everything from all constant files

3. Update `packages/shared/src/index.ts` to re-export `from './constants'`

4. Verify types are preserved — all `as const` assertions and readonly arrays must be maintained

**Test requirements:**
- `turbo build && turbo check-types` passes
- Import `{ POPULAR_CUISINES, ALL_CUISINES }` from `@eatme/shared` in a scratch file — verify types and values are correct
- Web-portal's existing 49 test files still pass

**Integration with previous work:** Depends on Step 1 (package scaffold exists).

**Demo:** Shared package exports all constants. You can `import { POPULAR_CUISINES } from '@eatme/shared'` and get typed, readonly constant arrays.

---

### Step 3: Extract types into `@eatme/shared/types/`

**Objective:** Move shared domain type definitions from `apps/web-portal/types/restaurant.ts` into the shared package.

**Implementation guidance:**

1. Create `packages/shared/src/types/restaurant.ts` — copy all 17 exported types/interfaces from `apps/web-portal/types/restaurant.ts`:
   - `Location`, `SelectedIngredient`, `DishKind`, `ScheduleType`, `DisplayPricePrefix`
   - `Option`, `OptionGroup`, `OperatingHours`, `DishCategory`, `Dish`, `Menu`
   - `RestaurantType`, `RestaurantBasicInfo`, `PaymentMethods`
   - `RestaurantOperations`, `RestaurantData`, `WizardStep`, `FormProgress`

2. Check for imports within the type file — `restaurant.ts` may import `Ingredient` from Supabase types. If so, keep that import as `import type { ... } from '@eatme/database'` (the shared package can depend on the database package for generated types)

3. If `@eatme/database` types are needed, add `"@eatme/database": "workspace:*"` to `packages/shared/package.json`

4. Update `packages/shared/src/types/index.ts` barrel export

5. Update `packages/shared/src/index.ts` to re-export `from './types'`

**Test requirements:**
- `turbo build && turbo check-types` passes
- Types are importable: `import type { Dish, Menu, Restaurant } from '@eatme/shared'`
- No circular dependencies between `@eatme/shared` and `@eatme/database`

**Integration with previous work:** Depends on Step 1. Independent of Step 2 (constants).

**Demo:** All 17 domain types are importable from `@eatme/shared` with correct TypeScript types.

---

### Step 4: Extract validation schemas into `@eatme/shared/validation/`

**Objective:** Move Zod validation schemas from web-portal into the shared package so they can be reused across apps.

**Implementation guidance:**

1. Create `packages/shared/src/validation/restaurant.ts` — copy from `apps/web-portal/lib/validation.ts` (161 lines):
   - `basicInfoSchema`, `operationsSchema`, `dishSchema`, `menuSchema`, `restaurantDataSchema`
   - Inferred types: `BasicInfoFormData`, `OperationsFormData`, `DishFormData`, `MenuFormData`, `RestaurantDataFormData`

2. Update imports within the validation file:
   - Replace any imports from `@/types/restaurant` or `@/lib/constants` with imports from `@eatme/shared` (its own package — use relative paths like `../types/restaurant` and `../constants/...`)

3. Update `packages/shared/src/validation/index.ts` barrel export

4. Update `packages/shared/src/index.ts` to re-export `from './validation'`

5. Verify that `zod` is listed as an optional peer dependency in `packages/shared/package.json`

**Test requirements:**
- `turbo build && turbo check-types` passes
- Schemas are importable: `import { basicInfoSchema } from '@eatme/shared'`
- Schema validation works: `basicInfoSchema.parse(validData)` succeeds, `basicInfoSchema.parse(invalidData)` throws

**Integration with previous work:** Depends on Steps 2 and 3 (constants and types must be in place since validation schemas reference them).

**Demo:** Validation schemas work correctly when imported from `@eatme/shared`. Parsing valid and invalid data produces expected results.

---

### Step 5: Migrate web-portal imports to `@eatme/shared` and remove local copies

**Objective:** Update all web-portal imports to use `@eatme/shared` instead of local constants, types, and validation files. Remove the now-redundant local files.

**Implementation guidance:**

1. Find all imports from local constants:
   - Search for `from '@/lib/constants'` or `from '../lib/constants'` etc.
   - Replace with `from '@eatme/shared'` (or `from '@eatme/shared/constants'` if more specific)

2. Find all imports from local types:
   - Search for `from '@/types/restaurant'` or similar
   - Replace with `from '@eatme/shared'` (using `import type` where applicable)

3. Find all imports from local validation:
   - Search for `from '@/lib/validation'`
   - Replace with `from '@eatme/shared'`

4. Check for any component-local Zod schemas (e.g., in `RestaurantForm.tsx`) that duplicate the centralized schemas — consolidate these into `@eatme/shared/validation/` or keep them local if they're truly component-specific

5. Delete the local files:
   - `apps/web-portal/lib/constants.ts` (372 lines)
   - `apps/web-portal/types/restaurant.ts`
   - `apps/web-portal/lib/validation.ts` (161 lines)

6. Remove any "Keep in sync" comments that referenced the old local files

**Test requirements:**
- `turbo build && turbo lint && turbo check-types` passes
- All 49 web-portal test files pass
- Manually verify: web portal dev server starts, onboarding flow works, admin pages render

**Integration with previous work:** Depends on Steps 2–4 (all shared content must be in place).

**Demo:** Web portal compiles and runs identically, but now imports constants, types, and validation from `@eatme/shared`. Local copies are deleted. `git diff --stat` shows net LOC reduction.

---

### Step 6: Migrate mobile imports to `@eatme/shared` and remove local copies

**Objective:** Update mobile app imports to use `@eatme/shared` for constants and types. Remove the now-redundant local constant definitions.

**Implementation guidance:**

1. Find all imports from local constants:
   - Search for `from '@/constants'` or `from '../constants'`
   - Replace constant imports with `from '@eatme/shared'`
   - **Keep** `from '@/constants/icons'` imports as-is — `icons.ts` stays in the mobile app (platform-specific emoji mappings)

2. Update `apps/mobile/src/constants/index.ts`:
   - Remove `POPULAR_CUISINES` and `ALL_CUISINES` definitions
   - Keep the re-export of icons: `export { ALLERGEN_ICONS, DIETARY_TAG_ICONS, getAllergenIcon, getDietaryTagIcon } from './icons'`
   - Add re-exports from shared: `export { POPULAR_CUISINES, ALL_CUISINES } from '@eatme/shared'` (for backward compatibility if other files import from `@/constants`)

3. Check mobile types in `apps/mobile/src/types/` — if any overlap with `@eatme/shared` types, update imports. Leave mobile-specific types (navigation, rating) in place.

4. Check mobile services and stores for any type definitions that should reference `@eatme/shared` instead of local ad-hoc types

**Test requirements:**
- `turbo build && turbo check-types` passes
- Manual smoke test: mobile app launches, restaurant list renders, filters work with cuisine selection, allergen icons display correctly

**Integration with previous work:** Depends on Steps 2–4 (shared content in place) and Step 5 (web-portal migration validates the shared package works).

**Demo:** Mobile app compiles and runs identically, importing shared constants from `@eatme/shared`. The canonical cuisine list now includes all entries from both apps.

---

### Step 7: Add `test` task to Turbo pipeline and verify full build

**Objective:** Wire up the existing Vitest test suite into Turbo's task pipeline and verify the entire monorepo builds, lints, type-checks, and tests cleanly after Phase 1 changes.

**Implementation guidance:**

1. The web-portal currently has `"test": "vitest"` which runs in **watch mode** — this will hang in CI/Turbo. Two options:
   - **Option A (recommended):** Change `"test"` script to `"vitest run"` (single-run mode) and add `"test:watch": "vitest"` for local dev
   - **Option B:** Keep `"test": "vitest"` for local dev, add `"test:run": "vitest run"` and point Turbo at that

2. Add `"test"` task to `turbo.json` (using whichever script name runs in single-run mode):
   ```json
   "test": {
     "dependsOn": ["^build"]
   }
   ```
   If using Option B, name the Turbo task to match: `"test:run": { "dependsOn": ["^build"] }`

4. Run the full verification suite:
   ```bash
   turbo build && turbo lint && turbo check-types && turbo test
   ```

5. Fix any issues surfaced by the comprehensive check

**Test requirements:**
- All Turbo tasks pass: build, lint, check-types, test
- 49 web-portal test files pass via `turbo test`
- No regressions from Phase 1 changes

**Integration with previous work:** Depends on Steps 1–6 (all Phase 1 changes are complete).

**Demo:** Running `turbo test` from the monorepo root executes web-portal's Vitest suite and reports results. Full pipeline (`build + lint + check-types + test`) passes clean. This is the Phase 1 completion checkpoint.

---

## Phase 2: AI Readiness — Documentation + File Splits

*Requirements: R6, R7, R8, R9, R10, R11, R18*

### Step 8: Create CLAUDE.md and `agent_docs/` directory

**Objective:** Create a concise CLAUDE.md (<100 lines) at the project root with progressive disclosure via an `agent_docs/` directory, giving AI assistants the context they need.

**Implementation guidance:**

1. Create `/CLAUDE.md` with these sections (each brief):
   - **Project Overview** — 1 paragraph: EatMe is a food discovery platform with mobile app (Expo/RN), web portal (Next.js 16), and Supabase backend. pnpm + Turborepo monorepo.
   - **Tech Stack** — Bullet list of key technologies per app
   - **Key Commands** — `pnpm install`, `turbo dev`, `turbo build`, `turbo test`, `turbo lint`, `turbo check-types`
   - **Architecture** — Brief description + "See `agent_docs/architecture.md` for details"
   - **Common Pitfalls** — Top 5 one-liners (PostGIS POINT format, RLS on new tables, localStorage keys, native modules need rebuild, transpilePackages for workspace deps)
   - **Further Reading** — Links to `agent_docs/*.md` and `docs/project/*.md`

2. Create `agent_docs/` directory with:
   - `architecture.md` — Monorepo structure, package relationships, data flow (reference `docs/project/` for deep detail). Include the `@eatme/shared` package added in Phase 1.
   - `commands.md` — All dev, build, test, lint, deploy commands with flags and directories
   - `conventions.md` — Naming conventions, error handling patterns, state management, form patterns. Reference `docs/project/10-contributing.md`.
   - `database.md` — Schema overview pointing to `infra/supabase/migrations/database_schema.sql` as authoritative source, RLS patterns, migration naming. Reference `docs/project/06-database-schema.md`.
   - `terminology.md` — Domain terms: restaurant types, dish kinds, menu categories, allergens, dietary tags, price ranges, operating hours, onboarding wizard steps

3. Keep CLAUDE.md under 100 lines — move detail to `agent_docs/`

**Test requirements:**
- CLAUDE.md is under 100 lines
- All file paths referenced in CLAUDE.md and agent_docs/ actually exist
- `turbo build` still passes (no code changes in this step)

**Integration with previous work:** Can start after Phase 1 (Step 7). References `@eatme/shared` package from Phase 1.

**Demo:** Opening a new Claude Code session in the project root loads CLAUDE.md automatically. The AI assistant can navigate to `agent_docs/` for deeper context. All links resolve correctly.

---

### Step 9: Update `.github/copilot-instructions.md` to fix stale references

**Objective:** Fix outdated information in copilot-instructions.md so it accurately reflects the current codebase state.

**Implementation guidance:**

1. Fix the following stale references:
   - Change "Next.js 14" → "Next.js 16"
   - Remove references to `packages/ui`, `packages/typescript-config`, `packages/eslint-config` (don't exist)
   - Update packages list to: `packages/database` (Supabase client + types), `packages/tokens` (design tokens), `packages/shared` (constants, types, validation)
   - Change "No automated test suite yet - TDD is aspirational" → note that web-portal has 49 Vitest test files; mobile has no tests yet
   - Change `packages/database` from "Planned" to "Implemented and consumed by both apps"
   - Update "Last Updated" date
   - Add note about `@eatme/shared` package and its purpose
   - Reference `agent_docs/` for shared documentation

2. Do NOT rewrite the entire file — make targeted fixes to preserve the existing structure and content that is correct

**Test requirements:**
- No code changes — purely documentation
- Verify all file paths mentioned in the updated doc still exist

**Integration with previous work:** Depends on Step 8 (CLAUDE.md + agent_docs exist to reference).

**Demo:** copilot-instructions.md accurately reflects the current project state. No stale references to nonexistent packages or wrong version numbers.

---

### Step 10: Split `useMenuScanState.ts` into focused hooks

**Objective:** Break the 1,378-line hook into 5-6 focused hooks that align with the existing component structure (`MenuScanUpload.tsx`, `MenuScanProcessing.tsx`, `MenuScanReview.tsx`, `MenuScanDone.tsx`).

**Implementation guidance:**

1. Read `apps/web-portal/app/admin/menu-scan/hooks/useMenuScanState.ts` thoroughly. Identify:
   - All exported types/interfaces → move to `menuScanTypes.ts`
   - Step state machine (upload/processing/review/done enum + transitions) → `useMenuScanStep.ts`
   - Upload-phase logic (restaurant selection, file handling, drag-drop, PDF conversion) → `useUploadState.ts`
   - Processing-phase logic (API calls, image resizing, orchestration) → `useProcessingState.ts`
   - Review-phase logic (menu/dish editing, ingredient resolution, save) → `useReviewState.ts`
   - Group/batch logic (flagged duplicates, batch acceptance) → `useGroupState.ts`

2. Create a coordinator hook `useMenuScan.ts` that:
   - Composes all sub-hooks
   - Exposes the same API surface as the original `useMenuScanState`
   - Is the only hook imported by the page component (`page.tsx`)

3. **Critical:** Update type imports in all consuming components. These currently import types directly from `useMenuScanState`:
   - `components/MenuScanDone.tsx` — imports `RestaurantOption`
   - `components/MenuScanUpload.tsx` — imports `RestaurantOption`
   - `components/MenuScanProcessing.tsx` — imports `RestaurantOption`, `RestaurantDetailsForm`
   - `components/MenuScanReview.tsx` — imports multiple types
   - All must be redirected to `menuScanTypes.ts`

4. Update `page.tsx` import from `useMenuScanState` → `useMenuScan`

5. Delete original `useMenuScanState.ts`

6. Update the existing test file `test/useMenuScanState.test.ts` — update import to `useMenuScan`, ensure all tests still pass

**Test requirements:**
- `turbo build && turbo check-types` passes
- Existing `useMenuScanState.test.ts` tests pass (with updated imports)
- Manual verification: navigate to `/admin/menu-scan`, upload a menu image, go through all steps (upload → processing → review → done) — behavior is identical

**Integration with previous work:** Independent of Steps 8–9 (docs). Can run in parallel.

**Demo:** Menu scan feature works identically. The hooks directory now has 6-7 focused files instead of one 1,378-line monolith. Each hook is under 450 lines.

---

### Step 11: Split `MenuScanReview.tsx` into focused components

**Objective:** Break the 1,265-line component into 6-7 focused sub-components.

**Implementation guidance:**

1. Read `apps/web-portal/app/admin/menu-scan/components/MenuScanReview.tsx` thoroughly. Identify render boundaries.

2. Extract the following into separate files in the same `components/` directory:
   - `ReviewHeader.tsx` — Title, dish count, Re-scan/Save action buttons (~40 lines)
   - `ReviewLeftPanel.tsx` — Container for Images tab + Details tab (~140 lines)
   - `ImageCarousel.tsx` — Image preview with pagination (~90 lines)
   - `RestaurantDetailsForm.tsx` — Address, city, location picker form (~90 lines)
   - `MenuExtractionList.tsx` — Main menu/category/dish rendering tree (~450 lines)
   - `DishEditPanel.tsx` — Expanded dish editing with ingredients, allergens (~300 lines)
   - `ImageZoomLightbox.tsx` — Full-screen image viewer (~60 lines)

3. Slim down `MenuScanReview.tsx` to ~100 lines as an orchestrator that:
   - Receives props from the parent (which uses the new `useMenuScan` coordinator hook from Step 10)
   - Renders the sub-components with appropriate prop drilling or context

4. Ensure all extracted components are properly typed with explicit prop interfaces

**Test requirements:**
- `turbo build && turbo check-types` passes
- Existing `DishFormDialog.test.tsx` and related tests still pass
- Manual verification: open a completed menu scan review, verify all panels render, images display, editing works, save completes

**Integration with previous work:** Best done after Step 10 (hooks split), since the hook API informs what props flow to the review component.

**Demo:** Menu scan review page looks and behaves identically. `MenuScanReview.tsx` is ~100 lines. Each sub-component has a clear, typed prop interface.

---

### Step 12: Split `RestaurantDetailScreen.tsx` into focused modules

**Objective:** Break the 1,003-line screen into a subdirectory with 8-9 focused modules.

**Implementation guidance:**

1. Create `apps/mobile/src/screens/restaurant-detail/` directory

2. Read `RestaurantDetailScreen.tsx` thoroughly. Extract:
   - `useRestaurantDetail.ts` — All useState/useEffect, data loading, rating logic, favorites (~200 lines)
   - `RestaurantMetadata.ts` — Pure helper functions: `getCurrentDayHours`, `getPaymentNote`, hour formatting (~40 lines)
   - `DishGrouping.ts` — `groupDishesByParent` logic with type definitions (~50 lines)
   - `DishFiltering.ts` — `sortDishesByFilter`, `classifyDish`, allergen mapping (~30 lines)
   - `RestaurantHeader.tsx` — Restaurant name, info banner, favorite toggle, action menu (~150 lines)
   - `RestaurantHourSection.tsx` — Operating hours display with expandable state (~100 lines)
   - `MenuCategorySection.tsx` — Category tabs, lazy-loaded dish list (~200 lines)
   - `DishCard.tsx` — Individual dish display with ratings, photos, variants (~100 lines)
   - `DishDetailModal.tsx` — Selected dish expanded view with option groups (~150 lines)

3. Create `restaurant-detail/index.tsx` that re-exports `RestaurantDetailScreen`

4. Slim down `RestaurantDetailScreen.tsx` to an orchestrator (~120 lines) that composes the sub-components

5. Update `apps/mobile/src/screens/index.ts` barrel export:
   - Change `export { RestaurantDetailScreen } from './RestaurantDetailScreen'`
   - To `export { RestaurantDetailScreen } from './restaurant-detail'`

6. Delete the original top-level `RestaurantDetailScreen.tsx`

**Test requirements:**
- `turbo build && turbo check-types` passes
- Manual smoke test on mobile: navigate to a restaurant detail screen, verify all sections render (header, hours, menu categories, dish cards), tap a dish to open detail modal, toggle favorite

**Integration with previous work:** Independent of Steps 10–11 (web-portal splits). Can run in parallel.

**Demo:** Restaurant detail screen on mobile looks and behaves identically. The `screens/restaurant-detail/` directory has 9 focused files. All imports from `@/screens` still work via barrel export. Document the manual smoke test checklist in the PR description for reviewer reference.

---

### Step 13: Restructure `common.ts` into focused style modules

**Objective:** Split the 1,202-line `common.ts` into ~10 focused style modules, reducing ~200 lines through factory composition, while preserving the existing barrel export API in `styles/index.ts`.

**Implementation guidance:**

1. Read `apps/mobile/src/styles/common.ts` thoroughly. Map each exported StyleSheet/object to its new destination file.

2. Create new files in `apps/mobile/src/styles/`:
   - `factories.ts` — All `create*` factory functions: `createFlex`, `createPadding`, `createBorder`, `createTextStyle`, `createRounded`, `createShadow` (~80 lines)
   - `atomic.ts` — Atomic style definitions that use factories (~40 lines)
   - `bases.ts` — `modalBase`, `filterBase`, `buttonBase`, `cardBase` patterns. **Consolidation opportunity:** refactor these to use factory functions consistently instead of duplicating property sets (~120 lines)
   - `containers.ts` — Screen, section, row, center container styles (~40 lines)
   - `typography.ts` — Text hierarchy: h1-h3, body, small, tiny, link, error, success (~60 lines)
   - `buttons.ts` — Button variants including icon buttons (~50 lines). Note: will conflict with existing `buttons` export — use naming carefully
   - `forms.ts` — Form fields, inputs, settings items (~80 lines)
   - `cards.ts` — Card containers, elevated, headers (~30 lines)
   - `modals.ts` — Modal-specific styles: profile, settings, favorites modals (~150 lines). Note: will conflict with existing `modals` export from `common.ts` — ensure `styles/index.ts` updates correctly
   - `spacing.ts` — Margin/padding utility classes (~60 lines)

3. Delete `common.ts`

4. Update `apps/mobile/src/styles/index.ts`:
   - Replace all `from './common'` imports with imports from the new modules
   - Maintain the same exported names (`commonStyles`, `containers`, `headers`, `text`, `emptyState`, `cards`, `forms`, `profile`, `buttons`, `inputs`, `spacingUtils`, `switchConfig`, `modals`, `modalScreenStyles`, `viewModeToggleStyles`, `atomic`, `filterBase`, `buttonBase`, `createBorder`, `createTextStyle`, `createRounded`, `createShadow`)
   - Keep the backward-compatible `commonStyles` composite object

5. Update `filters.ts`, `map.ts`, `navigation.ts` if they import from `./common` — redirect to specific new modules

**Test requirements:**
- `turbo build && turbo check-types` passes
- Manual smoke test on mobile: check key screens for visual regressions — map screen, filters modal, restaurant detail, profile, settings
- Compare screenshots before/after if possible

**Integration with previous work:** Independent of Steps 10–12. Can run in parallel with web-portal splits.

**Demo:** Mobile app looks identical. `styles/common.ts` is gone, replaced by 10 focused modules. The `styles/index.ts` barrel exports are unchanged — no consuming code needs modification. Target ~600 LOC reduction from factory consolidation and elimination of duplicated property definitions (R18). The ~600 figure includes both the structural deduplication from systematic factory use and the removal of redundant style definitions that appear across the 16 original StyleSheet exports.

---

## Phase 3: Code Quality — JSDoc + Cleanup

*Requirements: R5, R12, R13, R14, R15, R19, R20, R21*

### Step 14: JSDoc pass on `@eatme/shared` and `@eatme/database` packages

**Objective:** Add comprehensive JSDoc documentation to all exports in the shared packages, establishing the gold standard for the rest of the codebase.

**Implementation guidance:**

1. For every exported function, type, interface, and constant in `packages/shared/src/`:
   - Add JSDoc with `@description` explaining purpose and usage
   - For functions: add `@param`, `@returns`, `@throws` where applicable
   - For constants: add `@description` explaining what the constant represents and where it's used
   - For types/interfaces: add `@description` and document non-obvious properties

2. For `packages/database/src/`:
   - `client.ts` already has good JSDoc (WHY explanations) — verify and enhance if needed
   - Add JSDoc to any undocumented exports
   - Document the `Database` type and table helpers

3. Add module-level doc comments to all files:
   ```typescript
   /**
    * Cuisine Constants
    *
    * Canonical lists of cuisine types used across mobile and web-portal.
    * POPULAR_CUISINES is the quick-pick subset shown in filter grids.
    * ALL_CUISINES is the complete list for selection modals.
    */
   ```

4. Follow the existing good patterns from `packages/database/src/client.ts` (WHY-first explanations)

**Test requirements:**
- `turbo build && turbo check-types` passes (JSDoc doesn't break compilation)
- No functional changes — documentation only

**Integration with previous work:** Depends on Phase 1 completion (shared package exists with content).

**Demo:** Hovering over any import from `@eatme/shared` in VS Code/IDE shows rich documentation with descriptions, parameters, and return types. Every file has a module-level comment.

---

### Step 15: JSDoc pass on web-portal `lib/`, hooks, and API routes

**Objective:** Raise web-portal comment coverage from 40% to 80%+ on key directories.

**Implementation guidance:**

1. Prioritize by impact (most-imported files first):
   - `lib/supabase.ts` — Document all exports, especially `formatLocationForSupabase`, type re-exports
   - `lib/ingredients.ts` — Document search API, allergen lookup functions
   - `lib/menu-scan.ts` — Document AI extraction types, processing functions
   - `lib/storage.ts` — Document auto-save pattern, storage keys
   - `lib/restaurantService.ts` — Document all Supabase operations
   - `lib/hooks/*.ts` — Document all custom hooks with `@param` and `@returns`

2. For API routes (`app/api/**/*.ts`):
   - Add module-level comments describing the endpoint, method, request/response shape
   - Document any complex business logic within

3. For hooks:
   - Every hook gets `@param` for options/config and `@returns` describing the return tuple/object
   - Document side effects and dependencies

4. Do NOT add comments to code you're not touching — focus on `lib/`, `hooks/`, and `app/api/`

**Test requirements:**
- `turbo build && turbo check-types` passes
- All 49 test files pass
- No functional changes

**Integration with previous work:** Independent of other Phase 3 steps. Can run in parallel.

**Demo:** Web-portal `lib/` directory has JSDoc on all exports. IDE tooltips show documentation for all public APIs.

---

### Step 16: JSDoc pass on mobile services, stores, and hooks

**Objective:** Maintain mobile's 85% comment coverage and add JSDoc annotations to store actions, service exports, and hooks.

**Implementation guidance:**

1. Prioritize by complexity:
   - `services/filterService.ts` (503 lines) — Document `estimateAvgPrice`, `applyPermanentFilters`, `applyDailyFilters`, `sortRestaurants`
   - `services/ratingService.ts` (already has JSDoc — verify completeness)
   - `services/geoService.ts` — Document Edge Function calls
   - `services/dishRatingService.ts`, `restaurantRatingService.ts` — Document all exports

2. For stores:
   - `stores/filterStore.ts` (1,107 lines) — Add JSDoc to all Zustand actions (set functions). Document the two-tier filter system (daily vs permanent).
   - `stores/authStore.ts`, `stores/sessionStore.ts` — Document state shape and actions

3. For hooks:
   - `hooks/useDish.ts`, `hooks/useCountryDetection.ts`, `hooks/useSwipeToClose.ts` — Full JSDoc with `@param` and `@returns`

4. Follow the existing good pattern from `services/ratingService.ts`

**Test requirements:**
- `turbo build && turbo check-types` passes
- Manual smoke test: app still works (no functional changes)

**Integration with previous work:** Independent of Step 15. Can run in parallel.

**Demo:** All mobile service and store exports have JSDoc. IDE tooltips show documentation for Zustand actions and service functions.

---

### Step 17: Document magic numbers and add module-level doc comments

**Objective:** Eliminate undocumented magic numbers and ensure every source file has a module-level doc comment.

**Implementation guidance:**

1. Document identified magic numbers:
   - `stores/filterStore.ts` — Price defaults (10, 50, 200, 800): add inline comments explaining why these bounds were chosen (e.g., "10 PLN minimum covers the cheapest street food; 800 PLN covers fine dining tasting menus")
   - `infra/supabase/functions/feed/index.ts` — Scoring weights (`W.similarity: 0.4`, etc.): document the tuning rationale
   - `lib/restaurantService.ts` — Error code `PGRST116`: add comment explaining this is PostgREST's "not found" error code

2. Add module-level doc comments to files that lack them:
   - Target: every `.ts` and `.tsx` file in `lib/`, `services/`, `stores/`, `hooks/`, `components/` directories
   - Format: 2-4 line JSDoc block at the top of each file explaining its purpose
   - Example:
     ```typescript
     /**
      * Filter Store
      *
      * Zustand store managing the two-tier filter system: daily filters
      * (reset each session) and permanent filters (persisted to AsyncStorage).
      */
     ```

3. Do NOT over-document — skip files where the name + first few lines make the purpose obvious (e.g., `useDebounce.ts`)

**Test requirements:**
- No functional changes
- `turbo build && turbo check-types` passes

**Integration with previous work:** Best done after Steps 14–16 (JSDoc passes), as it fills remaining gaps.

**Demo:** Grepping for magic numbers shows inline explanations. Every service, store, and utility file has a module-level doc comment.

---

### Step 18: Dead code removal and verbose pattern cleanup

**Objective:** Remove dead code, stray console.logs, unused dependencies, and simplify verbose patterns. Target: ~250 LOC reduction (R5, R19, R21).

**Implementation guidance:**

1. Remove `console.log` statements (not `console.error` — those are intentional):
   - `apps/web-portal/app/api/ingredients/route.ts`
   - `apps/web-portal/app/api/menu-scan/route.ts` (multiple instances)
   - `apps/web-portal/app/admin/menu-scan/hooks/` (from the split hooks — check each file)
   - Search both apps for any other stray `console.log` that isn't behind a `__DEV__` check

2. Remove unused dependencies:
   - Check `baseline-browser-mapping` in web-portal devDependencies — verify it's unused, then remove from `package.json`
   - Run `pnpm why string-similarity` to check if it's still used after the hook split

3. Simplify verbose patterns:
   - Look for repeated null/undefined checks that could use optional chaining (`?.`)
   - Look for `x !== null && x !== undefined` patterns that could use nullish coalescing (`??`)
   - Look for verbose map/spread state updates that could be simplified
   - Focus on files touched in Phase 2 splits — don't go hunting across the entire codebase

4. Remove any commented-out code blocks (not TODO comments — those track intentional future work)

**Test requirements:**
- `turbo build && turbo lint && turbo check-types && turbo test` passes
- Manual verification that removed console.logs don't hide important debugging info
- `pnpm install` still succeeds after dependency removal

**Integration with previous work:** Depends on Phase 2 (file splits done, so we know the final file structure).

**Demo:** `git diff --stat` shows net LOC reduction. No stray `console.log` in production code. Unused dependencies removed from `package.json`.

---

### Step 19: Extract shared test utilities and consolidate test mocks

**Objective:** Reduce ~100 LOC of duplicated test mock boilerplate across web-portal test files.

**Implementation guidance:**

1. Read `apps/web-portal/test/DishFormDialog.test.tsx` (433 lines) and `apps/web-portal/test/useMenuScanState.test.ts` — identify repeated mock patterns

2. Create `apps/web-portal/test/helpers/`:
   - `mockSupabase.ts` — Shared Supabase client mock factory
   - `mockToast.ts` — Shared toast/notification mock
   - `mockRouter.ts` — Shared Next.js router mock (if duplicated)
   - `index.ts` — Barrel export

3. Update test files to import from `test/helpers/` instead of defining mocks inline

4. Ensure `vitest.config.ts` path aliases include the helpers directory if needed

**Test requirements:**
- All 49 test files pass after refactoring
- No test behavior changes — same assertions, same coverage

**Integration with previous work:** Can run any time after Phase 1 (test infrastructure wired up). Independent of JSDoc steps.

**Demo:** Test files are shorter and more focused on actual test logic. Mock setup is a one-liner import instead of 30+ lines of boilerplate.

---

## Phase 4: Infrastructure — CI + Quality Gates

*Requirements: R16, R23, R24, R25*

### Step 20: Add `eslint-plugin-jsdoc` to ESLint configs

**Objective:** Configure JSDoc linting as warnings to enforce documentation standards going forward.

**Implementation guidance:**

1. Install `eslint-plugin-jsdoc` as a dev dependency at the monorepo root:
   ```bash
   pnpm add -Dw eslint-plugin-jsdoc
   ```

2. Update web-portal's `eslint.config.mjs` (flat config format):
   - Import `jsdoc` plugin
   - Add rules:
     - `jsdoc/require-jsdoc`: `warn` — require JSDoc on exported functions/classes
     - `jsdoc/require-param`: `warn` — require `@param` tags
     - `jsdoc/require-returns`: `warn` — require `@returns` tags
     - `jsdoc/check-param-names`: `warn` — param names match function signature
   - Configure to only check exported declarations (not internal helpers)

3. Update mobile's ESLint config similarly (check if it uses flat config or legacy format)

4. Run `turbo lint` — expect warnings (not errors) on undocumented exports. Document the current warning count as a baseline.

**Test requirements:**
- `turbo lint` passes (warnings don't fail the build)
- No errors introduced — only warnings
- Document baseline warning count for tracking improvement

**Integration with previous work:** Best done after Phase 3 (JSDoc passes reduce warning count before the rule is turned on).

**Demo:** Running `turbo lint` shows JSDoc warnings for undocumented exports. The warning count is significantly lower than it would have been pre-Phase 3 thanks to the JSDoc passes.

---

### Step 21: Add pre-commit hooks with Husky + lint-staged

**Objective:** Install pre-commit hooks that run lint and type-check on staged files to catch issues before they're committed.

**Implementation guidance:**

1. Install Husky and lint-staged:
   ```bash
   pnpm add -Dw husky lint-staged
   npx husky init
   ```

2. Configure `.husky/pre-commit`:
   ```bash
   pnpm lint-staged
   ```

3. Add lint-staged config to root `package.json`:
   ```json
   "lint-staged": {
     "*.{ts,tsx}": [
       "eslint --fix --max-warnings=0"
     ]
   }
   ```
   Note: Use `--max-warnings=0` only if JSDoc warnings have been resolved to a manageable level. Otherwise, omit it initially and set a threshold later.

4. Consider whether to include `tsc --noEmit` in lint-staged. It's slow on large projects — may be better to leave full type-checking to CI. Evaluate and decide.

5. Test the hook by making a small change, staging it, and committing

**Test requirements:**
- Making a commit with a lint error → commit is blocked
- Making a clean commit → commit succeeds
- Hook runs only on staged files (not the entire codebase)

**Integration with previous work:** Depends on Step 20 (ESLint config with jsdoc plugin must be in place).

**Demo:** Committing a file with a lint error blocks the commit with a clear error message. Committing clean code succeeds quickly (lint-staged only checks staged files).

---

### Step 22: Create GitHub Actions CI workflow

**Objective:** Set up automated CI that runs build, lint, type-check, and test on every push and pull request.

**Implementation guidance:**

1. Create `.github/workflows/ci.yml`:
   ```yaml
   name: CI
   on:
     push:
       branches: [main]
     pull_request:
       branches: [main]
   
   jobs:
     build-and-test:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: pnpm/action-setup@v4
           with:
             version: 9
         - uses: actions/setup-node@v4
           with:
             node-version: 18
             cache: 'pnpm'
         - run: pnpm install --frozen-lockfile
         - run: turbo build
         - run: turbo lint
         - run: turbo check-types
         - run: turbo test
   ```

2. Consider caching Turbo's cache directory for faster subsequent runs:
   ```yaml
   - uses: actions/cache@v4
     with:
       path: .turbo
       key: turbo-${{ runner.os }}-${{ hashFiles('**/pnpm-lock.yaml') }}
   ```

3. Consider splitting into parallel jobs (build, lint, check-types, test) for faster feedback — but start with sequential for simplicity

4. Test by pushing to a branch and verifying the workflow runs successfully

**Test requirements:**
- Workflow triggers on push to main and on PRs
- All steps pass: install, build, lint, check-types, test
- Workflow completes in a reasonable time (<10 minutes)

**Integration with previous work:** Depends on Steps 20–21 (ESLint config and hooks in place). This is the final step.

**Demo:** Push a branch, open a PR — GitHub Actions runs the full CI pipeline. Green checkmark on the PR confirms all quality gates pass. This is the Phase 4 and overall project completion checkpoint.
