## 2026-04-11 — Steps 12 & 13 complete

### Step 12: RestaurantDetailScreen.tsx split

Split `apps/mobile/src/screens/RestaurantDetailScreen.tsx` (1,003 lines) into `restaurant-detail/` subdirectory:
- `useRestaurantDetail.ts` (402 lines) — All state/effects/data loading/ratings/favorites
- `RestaurantMetadata.ts` (43 lines) — Pure helpers: getCurrentDayHours, getPaymentNote
- `DishGrouping.ts` (62 lines) — groupDishesByParent with types
- `AddressModal.tsx` (75 lines) — Address overlay modal
- `DishMenuItem.tsx` (106 lines) — Single dish row with ratings
- `FoodTab.tsx` (158 lines) — Food & Drinks tab with menus/categories
- `HoursMoreTab.tsx` (185 lines) — Hours & More tab
- `RestaurantDetailScreen.tsx` (309 lines) — Orchestrator
- `index.tsx` — Barrel re-export
- `screens/index.ts` updated to point to `./restaurant-detail`

### Step 13: common.ts split

Split `apps/mobile/src/styles/common.ts` (1,202 lines) into 11 focused modules:
factories.ts, atomic.ts, bases.ts, containers.ts, typography.ts, buttons.ts, forms.ts, cards.ts, modalScreen.ts, modals.ts, spacing.ts
- `styles/index.ts` updated — all original export names preserved
- `filters.ts`, `map.ts`, `navigation.ts` updated to import from new modules

Build passes (turbo build + check-types). Pre-existing errors in gamificationService.ts and userPreferencesService.ts — not from these changes.

## 2026-04-11 — Step 16 complete

JSDoc pass on mobile services, stores, and hooks.

Changes made:
- `filterService.ts`: added JSDoc to `Restaurant` interface (lightweight shape for filter algorithms) and `FilterEngine` class (hash-based cache rationale)
- `geoService.ts`: added JSDoc to `NearbyRestaurantsRequest`, `RestaurantWithDistance`, `NearbyRestaurantsResponse` interfaces
- `dishRatingService.ts`: added JSDoc to `DishRating` interface (percentages null below 3 ratings)
- `restaurantRatingService.ts`: added JSDoc to `RestaurantRating` interface (materialized view, 0-100 percentages)
- `filterStore.ts`: added JSDoc to `DailyFilters` interface (session-scoped, not persisted)
- `authStore.ts`: added JSDoc to `AuthState`, `AuthActions`, `useAuthStore`, and all 5 selector hooks
- `sessionStore.ts`: added JSDoc to `SessionState` and `useSessionStore`
- `useDish.ts`: added module-level JSDoc comment

Build passes (turbo build). Pre-existing errors in gamificationService.ts and userPreferencesService.ts — not from these changes.

## 2026-04-11 — Step 17 complete

Document magic numbers and add module-level JSDoc comments.

Changes made:
- `filterStore.ts`: added inline comments for price defaults (min: 10 USD = cheapest street food, max: 50 USD = casual restaurant meal) and calorie range defaults (min: 200 kcal = small snack, max: 800 kcal = full entrée)
- `restaurantService.ts`: added 3 comments explaining PGRST116 = PostgREST "row not found" — expected when owner has no restaurant yet
- `infra/supabase/functions/feed/index.ts`: documented scoring weight rationale in block comment above W const and added inline comments on each weight field
- Added module-level JSDoc to 14 files missing them:
  - `lib/dish-categories.ts`, `lib/import-service.ts`, `lib/import-validation.ts`, `lib/ingredients.ts`, `lib/storage.ts`, `lib/supabase.ts`, `lib/ui-constants.ts`
  - `lib/hooks/useDishFormData.ts`, `lib/hooks/useRestaurantDraft.ts`
  - `hooks/useFilters.ts`
  - `app/api/menu-scan/confirm/route.ts`, `app/api/menu-scan/route.ts`, `app/api/admin/import/google/route.ts`
  - `apps/mobile/src/hooks/useUserLocation.ts`

Build passes. Pre-existing TypeScript errors in DataTable.test.tsx are not from these changes.

## 2026-04-11 — Steps 19-22 complete (ALL 22 STEPS DONE)

### Step 19: Test mock consolidation

- Created `apps/web-portal/test/helpers/` with `mockToast.ts`, `mockSupabase.ts`, `mockRouter.ts`, `index.ts`
- Added global sonner mock to `test/setup.ts` (Object.assign pattern covering all method variants)
- Removed inline `vi.mock('sonner', ...)` from all 14 test files (replaced with comment)
- All 49 test files pass (444 tests), ~70 LOC removed

### Step 20: eslint-plugin-jsdoc

- Installed `eslint-plugin-jsdoc@^62.9.0` at monorepo root
- Added jsdoc plugin + 4 rules (require-jsdoc, require-param, require-returns, check-param-names) as warnings to both web-portal and mobile ESLint configs
- `turbo lint` passes with 0 errors, 417 warnings (expected baseline)

### Step 21: Husky + lint-staged

- Installed `husky` and `lint-staged` at root
- `pnpm prepare` script already set to `husky` by `husky init`
- `.husky/pre-commit` → `pnpm lint-staged`
- lint-staged config added to root `package.json` — runs `eslint --fix` on staged `*.{ts,tsx}` files

### Step 22: GitHub Actions CI

- Created `.github/workflows/ci.yml`
- Runs on push/PR to main: install → turbo build → turbo lint → turbo check-types → turbo test
- Includes Turbo cache (`actions/cache@v4`) keyed by pnpm-lock.yaml hash

Full pipeline: `turbo build && turbo lint && turbo check-types` passes. All 49 web-portal tests pass.

## Prior: Step 10 Retry complete

Step 10 retry complete

## 2026-04-11 — Step 10 Retry: useReviewState split + barrel export

Fixed two issues from critic review:

1. **useReviewState.ts split** — Extracted ingredient logic (~500 lines) into `useIngredientState.ts`:
   - State: addIngredientTarget, suggestingDishId, isSuggestingAll, suggestAllProgress, inlineSearchTarget, subIngredientEditTarget
   - Functions: resolveIngredient, addIngredientToDish, removeIngredientFromDish, addSubIngredient, removeSubIngredient, suggestIngredients, suggestAllDishes
   - useReviewState now composes useIngredientState via deps pattern and spreads its return
   - useReviewState: 312 lines (was 770), useIngredientState: 496 lines — both under 500

2. **hooks/index.ts barrel export** — Created barrel re-exporting all hooks and types from the hooks directory

Build passes, type-check passes, all 49 test files pass (444 tests).
