# EatMe — Codebase Improvements Audit

> **Date:** March 5, 2026  
> **Scope:** Full monorepo scan — web portal, mobile app, shared packages, database migrations, infrastructure.  
> **Status:** Identification only. No code has been changed.  
> **Legend**: 🔴 High priority (blocks launch quality) · 🟡 Medium (tech debt) · 🟢 Low / Future

---

## New Findings (March 5, 2026 audit)

The sections below document issues found in a fresh deep-dive of the full codebase that were **not covered** in the original backlog above.

---

## N1. Dead / Unused Code

| #    | Priority | Location                                                 | Issue                                                                                                                                                                                                                                                            |
| ---- | -------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N1.1 | 🟡       | `apps/web-portal/lib/export.ts`                          | `exportAsJSON`, `exportAsCSV`, and `downloadCSVTemplate` are defined but **never imported anywhere** in the portal. The download feature was designed but never wired up to any UI button. Either delete or connect to the dashboard.                            |
| N1.2 | 🟢       | `packages/database/src/client.ts` → `getWebClient()`     | The JSDoc says _"The web portal no longer uses this"_, yet the function is still exported. The web portal uses `createBrowserClient` from `@supabase/ssr` directly. `getWebClient` is dead code in the shared package.                                           |
| N1.3 | 🟢       | `packages/database/src/repositories/`                    | Directory exists but is completely **empty**. Either seed it with the planned repository pattern or remove the directory.                                                                                                                                        |
| N1.4 | 🟢       | `apps/mobile/src/data/`                                  | Directory exists but is completely **empty**. Remove or document its intended purpose.                                                                                                                                                                           |
| N1.5 | 🟡       | `apps/web-portal/app/onboard/page.tsx`                   | Redirect sends users to `/onboard/menu` with a stale comment _"we can change this to basic-info when that's ready"_. The basic-info step has been ready for a long time. The intended flow is `basic-info → menu → review`; this redirect silently skips step 1. |
| N1.6 | 🟡       | `apps/mobile/src/hooks/useRestaurants.ts`                | Generic `.select('*')` hook with a `// TODO: sort by distance` that was never implemented, functionally superseded by `restaurantStore.loadNearbyRestaurants`. Verify it is still used; remove if not.                                                           |
| N1.7 | 🟡       | `apps/mobile/src/screens/BasicMapScreen.tsx` (line ~122) | `parseLocation()` is defined inline but **never called** — the restaurants from the geospatial Edge Function already have a structured `{ lat, lng }` object. Dead code within the file.                                                                         |
| N1.8 | 🟢       | `apps/web-portal/app/onboard/review/page.tsx`            | `handleBack()` and `handleEditRestaurantInfo()` are two separate handler functions that both execute `router.push('/')`. Merge into one.                                                                                                                         |

---

## N2. Hardcoded Values That Should Be Dynamic

| #    | Priority | Location                                                  | Issue                                                                                                                                                                                                   |
| ---- | -------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N2.1 | ✅       | `apps/mobile/src/screens/BasicMapScreen.tsx`              | **Fixed.** Added `open_hours` to `RestaurantWithDistance` and computed `isOpen` via `isRestaurantOpenNow()` utility. Also computes `openingHours` from today's actual hours.                            |
| N2.2 | ✅       | `apps/mobile/src/screens/RestaurantDetailScreen.tsx`      | **Fixed.** `isOpenNow` now calls `isRestaurantOpenNow()` which checks the current time against `open_hours`. Tab badge updated to use `isOpenNow` instead of the presence-only `todayHours` check.      |
| N2.3 | ✅       | `apps/mobile/src/screens/BasicMapScreen.tsx`        | **Fixed.** Added `estimateAvgPrice(serviceSpeed, restaurantType)` to `filterService.ts`; derives a heuristic price from the already-returned `service_speed` and `restaurant_type` fields instead of hardcoding 20. |
| N2.4 | ✅       | `apps/mobile/src/components/map/DailyFilterModal.tsx` | **Fixed.** Created `apps/mobile/src/constants/index.ts` with `POPULAR_CUISINES` and `ALL_CUISINES`. Replaced both the inline 7-item array and the local `ALL_CUISINES` constant with imports from that file. |
| N2.5 | ✅       | `apps/mobile/src/components/DrawerFilters.tsx`        | **Fixed.** Created `apps/mobile/src/services/ingredientService.ts` with `fetchIngredientNames()` querying `ingredients_master`. `DrawerFilters` now loads live data on mount via `useEffect`, falling back to the hardcoded list if the fetch fails. |
| N2.6 | ✅       | `apps/web-portal/app/restaurant/edit/page.tsx`        | **Fixed.** Removed the local `DAYS_OF_WEEK` definition; now imports from `@/lib/constants`. |
| N2.7 | 🟡       | `apps/mobile/src/utils/i18nUtils.ts` → `formatCurrency()` | Accesses Zustand settings store **outside a React component** via `useSettingsStore.getState()` wrapped in a try/catch — an anti-pattern. Pass currency as a parameter instead.                         |
| N2.8 | 🟢       | `apps/web-portal/components/LocationPicker.tsx`           | Default fallback location when geolocation fails is hardcoded to New York (`40.7128, -74.006`). For a product targeting MX/PL/CA markets this is a poor default.                                        |

---

## N3. Debug / Logging Leftovers in Production Code

| #    | Priority | Location                                         | Issue                                                                                                                                                                                     |
| ---- | -------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N3.1 | 🟡       | `apps/web-portal/components/LocationPicker.tsx`  | **9 `console.log` statements** covering component render, mount/unmount, geocoding URL, response status, response data, and address callback. Will print to every user's browser console. |
| N3.2 | 🟡       | `apps/web-portal/app/admin/restaurants/page.tsx` | `console.log('[Admin] Starting restaurant fetch...')` and `console.log('[Admin] Mapped restaurants:', ...)` are debug logs that should be removed or gated.                               |

---

## N4. TypeScript Type Safety Gaps

| #    | Priority | Location                                              | Issue                                                                                                                                                                  |
| ---- | -------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| N4.1 | 🟡       | `apps/web-portal/lib/restaurantService.ts`            | Multiple `(menu: any)`, `(cat: any)`, `(m: any)` casts for Supabase join results. Should use generated `Tables<'menus'>` / `Tables<'menu_categories'>` types.          |
| N4.2 | 🟡       | `apps/web-portal/lib/ingredients.ts` (line ~87)       | `(data ?? []).map((row: any) => {...})` — cast to `any` instead of a typed interface matching the select shape.                                                        |
| N4.3 | 🟡       | `apps/mobile/src/services/favoritesService.ts`        | Entire client re-cast as `any` because the `favorites` table is missing from generated DB types. Types need regenerating after the migration that added this table.    |
| N4.4 | 🟡       | `apps/mobile/src/components/common/` (multiple files) | Style props typed as `any` in `EmptyState`, `FeatureList`, `SectionContainer`, `SettingItem`. Use `StyleProp<ViewStyle>` / `StyleProp<TextStyle>` from `react-native`. |
| N4.5 | 🟡       | `apps/mobile/src/screens/BasicMapScreen.tsx`          | `(menu as any).dishes` cast in the `dishes` useMemo — the menu structure is known; type it properly.                                                                   |
| N4.6 | 🟢       | `apps/web-portal/lib/supabase-server.ts` (line ~123)  | `return { user: user as any, error: null }` — user should be typed as `User                                                                                            | null`from`@supabase/supabase-js`. |

---

## N5. Disabled / Commented-Out Features (Require Decision)

| #    | Priority | Location                                                               | Issue                                                                                                                                                                                                                                          |
| ---- | -------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N5.1 | 🔴       | `apps/mobile/App.tsx` (lines 73–74)                                    | AppState listener for session end is **commented out** (`// Disabled: AppState listener causes too many re-renders / TODO: Add debouncing`). Sessions are never ended when the app goes to background, breaking the "rate after visit" prompt. |
| N5.2 | 🔴       | `apps/mobile/src/screens/BasicMapScreen.tsx` (line 323)                | A comment marks an Edge Function path as `// DISABLED: Edge function is failing`. Needs investigation and fix before launch.                                                                                                                   |
| N5.3 | 🟡       | `apps/mobile/src/components/map/DailyFilterModal.tsx` (lines 410, 438) | Spice Level (section 4) and Hunger Level (section 5) are `{/* TEMPORARILY HIDDEN */}`. Decide: ship, formally remove, or track in a backlog issue.                                                                                             |
| N5.4 | 🟡       | `apps/mobile/src/components/FilterComponents.tsx` (line 307)           | `// Temporarily disabled - spice level not part of daily filters` — but `DailyFilters` in `filterStore.ts` _does_ have a `spiceLevel` field. Data model and UI are inconsistent.                                                               |
| N5.5 | 🟡       | `apps/web-portal/components/admin/RestaurantTable.tsx` (line 48)       | `// TODO: Implement suspend/activate API call with audit logging` — the suspend/activate button exists in the UI but the database operation is not implemented.                                                                                |

---

## N6. Duplicated Infrastructure

| #    | Priority | Location                                                      | Issue                                                                                                                                                                                                                                              |
| ---- | -------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N6.1 | 🔴       | `supabase/functions/` (root) vs `infra/supabase/functions/`   | Edge function source code exists in **two places**. `feed/`, `group-recommendations/`, `nearby-restaurants/`, `swipe/` appear in both the root `supabase/` directory and under `infra/supabase/functions/`. Only one location should be canonical. |
| N6.2 | 🟡       | `supabase/migrations/` (root) vs `infra/supabase/migrations/` | Same duplication for migrations. Consolidate and remove the root-level copy.                                                                                                                                                                       |

---

## N7. Code-Quality Patterns

| #    | Priority | Location                                       | Issue                                                                                                                                                                                                                                             |
| ---- | -------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N7.1 | 🟡       | `apps/mobile/src/stores/authStore.ts`          | Module-level `let authListenerSubscription: Subscription \| null = null` is declared to prevent duplicate listeners, but `initialize()` sets up a listener without assigning to that variable. The de-duplication guard exists but is incomplete. |
| N7.2 | 🟡       | `apps/mobile/src/screens/SwipeScreen.tsx`      | `loadDishes` is defined inside the component and referenced in two `useEffect` hooks. It should be wrapped in `useCallback` to make the dependency relationship explicit.                                                                         |
| N7.3 | 🟡       | `apps/web-portal/app/onboard/review/page.tsx`  | After submit, `clearRestaurantData()` is called then `setTimeout(() => router.push('/'), 2000)`. If the component unmounts before the timeout fires, the push executes on an unmounted component. Cancel the timeout in a cleanup function.       |
| N7.4 | 🟡       | `apps/mobile/src/screens/BasicMapScreen.tsx`   | `feedLoading` state is set `true`/`false` during the Edge Function fetch but **never read** in the JSX — no loading indicator is shown for the recommended dishes footer. Either use it or remove it.                                             |
| N7.5 | 🟢       | `apps/web-portal/app/admin/page.tsx`           | `statsData` is stored as a state object, then immediately destructured into 6 individual `const` variables in the render. The intermediate variables are redundant — use `statsData.*` directly.                                                  |
| N7.6 | 🟢       | `apps/mobile/src/components/DrawerFilters.tsx` | `formatLabel` and `formatCamelCase` are two nearly-identical camelCase-to-readable-string functions in the same file. Consolidate into one.                                                                                                       |
| N7.7 | 🟢       | `apps/web-portal/lib/supabase-server.ts`       | Uses `!` non-null assertions for env vars inside `createServerSupabaseClient()` rather than the validated startup check pattern used in `lib/supabase.ts`. Inconsistent within the same codebase.                                                 |

---

## N8. Ingredient / Schema Maintenance Debt

| #    | Priority | Issue                                                                                                                                                                                                                                |
| ---- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| N8.1 | 🟡       | Generated DB types are out of sync. `favoritesService.ts` casts `supabase` to `any` because the `favorites` table is not in the generated types. Running `supabase gen types typescript` after the latest migrations would fix this. |
| N8.2 | 🟢       | Ingredient data is scattered across **8+ migration files** (013a, 015b, 027, 028, 029, 035–040), making it very hard to audit what's in the master list. A single managed seed script or CSV would be more maintainable.             |
| N8.3 | 🟢       | `infra/supabase/migrations/ingredient_aliases.csv` — exists in the migrations folder but it's unclear if it is actively used or a leftover from an import attempt.                                                                   |

---

## N9. Missing Infrastructure

| #    | Priority | Improvement                                                                                                                                                                                          |
| ---- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N9.1 | 🔴       | **No error monitoring.** No Sentry, Bugsnag, or equivalent. Production crashes and API errors are invisible unless a user reports them.                                                              |
| N9.2 | 🟡       | **No `.env.example` at monorepo root.** Mobile required env vars (`EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN`, etc.) are only documented in markdown guides. Add root and `apps/mobile/` `.env.example` files. |
| N9.3 | 🟢       | **No CI pipeline.** No GitHub Actions workflows to run type checks, lint, or builds on PRs. `turbo run check-types` and `pnpm lint` would catch many issues automatically.                           |

---

## N10. Quick Wins (< 1 hour each)

| #     | File                                            | Action                                                              |
| ----- | ----------------------------------------------- | ------------------------------------------------------------------- |
| QW-1  | `apps/web-portal/components/LocationPicker.tsx` | Remove all 9 debug `console.log` calls                              |
| QW-2  | `apps/web-portal/app/restaurant/edit/page.tsx`  | Replace local `DAYS_OF_WEEK` with import from `lib/constants.ts`    |
| QW-3  | `apps/web-portal/app/onboard/review/page.tsx`   | Merge `handleBack` and `handleEditRestaurantInfo` into one          |
| QW-4  | `apps/web-portal/app/onboard/page.tsx`          | Fix redirect to `/onboard/basic-info` (not `/onboard/menu`)         |
| QW-5  | `packages/database/src/repositories/`           | Delete the empty directory                                          |
| QW-6  | `apps/mobile/src/data/`                         | Delete the empty directory                                          |
| QW-7  | `apps/mobile/src/screens/BasicMapScreen.tsx`    | Remove the unused inline `parseLocation()` function                 |
| QW-8  | `apps/mobile/src/screens/BasicMapScreen.tsx`    | Either render `feedLoading` in the JSX or remove the state variable |
| QW-9  | `apps/web-portal/app/admin/page.tsx`            | Remove the 6 redundant intermediate `const` variables               |
| QW-10 | `apps/mobile/src/components/DrawerFilters.tsx`  | Merge `formatLabel` and `formatCamelCase` into one function         |

---

## 1. Bugs & Correctness Issues

| #   | Location                                                    | Issue                                                                                                                                                                                                                                                                                                     | Priority |
| --- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | --------------- |
| B1  | `apps/web-portal/lib/storage.ts` — `autoSave()`             | The function calls `saveRestaurantData(data)` without a `userId` argument, which is the first required parameter of that function. This will cause a TypeScript error at runtime. The function is also **never called** anywhere in the codebase — it can be deleted or fixed.                            | 🔴       |
| B2  | `apps/web-portal/app/onboard/review/page.tsx` — update path | When updating an existing restaurant, the code **deletes all menus** then re-inserts them. This is not atomic: if the insertion of a menu fails mid-loop, the restaurant is left with no menus. Should use a transaction or upsert strategy.                                                              | 🔴       |
| B3  | `apps/web-portal/app/onboard/review/page.tsx`               | After successful submission the code calls `localStorage.removeItem(…)` directly instead of going through `clearRestaurantData(userId)` from `lib/storage.ts`. Breaks the single-responsibility principle and misses any future logic added there.                                                        | 🟡       | ✅ this session |
| B4  | `infra/supabase/migrations/`                                | **Duplicate migration numbers**: pairs `006`, `007`, `008`, `009`, `011`, `012`, `013`, `014` all have two files each. Most migration runners (including Supabase CLI) execute files in lexicographic order and will error or skip one of the duplicates. The history needs a full audit and renumbering. | 🔴       |
| B5  | `infra/supabase/migrations/databa_schema.sql`               | Typo in filename — likely meant `database_schema.sql`.                                                                                                                                                                                                                                                    | 🟢       |
| B6  | `apps/web-portal/lib/validation.ts`                         | Validation schema includes `price_range` and `average_prep_time_minutes` fields, but the `basic-info` and `operations` forms no longer collect these values. Dead schema fields.                                                                                                                          | 🟡       |

---

## 2. Type Safety

| #   | Location                                             | Issue                                                                                                                                                                                                                                                                                      | Priority |
| --- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| T1  | `apps/web-portal/app/onboard/review/page.tsx`        | `restaurantData` is typed as `any`. Should use the `FormProgress` type (already defined in `types/restaurant.ts`).                                                                                                                                                                         | 🔴       |
| T2  | `apps/web-portal/app/page.tsx` (Dashboard)           | `userRestaurant` is typed as `any`. Should use a typed shape, ideally the `Restaurant` type from `lib/supabase.ts`.                                                                                                                                                                        | 🟡       |
| T3  | `apps/mobile/src/screens/RestaurantDetailScreen.tsx` | `restaurant` state is typed as `any`. A proper typed interface exists in `lib/supabase.ts`.                                                                                                                                                                                                | 🟡       |
| T4  | `apps/mobile/src/screens/SwipeScreen.tsx`            | `feedMetadata` is typed as `any`. The `FeedResponse` interface already has a `metadata` type in `edgeFunctionsService.ts` — use it.                                                                                                                                                        | 🟢       |
| T5  | `apps/web-portal/app/onboard/menu/page.tsx`          | Several inline casts to `(dish as any)` to access `description_visibility` and `ingredients_visibility`. These fields should be added to the `Dish` type in `types/restaurant.ts` (they already exist in the Zod schema).                                                                  | 🟡       |
| T6  | Across web-portal pages                              | Zod schemas defined in `lib/validation.ts` are used only for type inference (`z.infer<>`), but forms do **not** call `schema.parse()` or `schema.safeParse()` at runtime before submission. This means invalid data can reach Supabase. Wire validation into React Hook Form's `resolver`. | 🔴       |

---

## 3. Code Duplication

| #   | Duplicated Code                             | Locations                                                                                                                                                            | Recommended Fix                                                                                                                                                                                         | Priority |
| --- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| D1  | **Supabase client**                         | `apps/web-portal/lib/supabase.ts`, `apps/mobile/src/lib/supabase.ts`, `packages/database/src/`                                                                       | Use `@eatme/database` (the shared package already exists) everywhere. Currently neither app uses it.                                                                                                    | 🟡       |
| D2  | **Database type definitions**               | `apps/web-portal/lib/supabase.ts` (Restaurant, Menu, Dish types) and `apps/web-portal/types/restaurant.ts` — partial overlapping types                               | Consolidate into one canonical source. Either generate from Supabase's type-gen CLI and export from `@eatme/database`, or keep only `types/restaurant.ts` and remove duplicates from `lib/supabase.ts`. | 🟡       |
| D3  | **Mobile Database types**                   | `apps/mobile/src/lib/supabase.ts` defines its own `Restaurant`, `Menu`, `MenuCategory`, `Dish` shapes that differ slightly from the web portal types                 | Generate a single shared type definition via `supabase gen types typescript` and share via `@eatme/database`.                                                                                           | 🟡       |
| D4  | **`PanResponder` swipe-to-close logic**     | `apps/mobile/src/screens/FiltersScreen.tsx` and `apps/mobile/src/screens/FavoritesScreen.tsx` — identical 40-line `PanResponder` + `Animated` block in both files    | Extract a `useSwipeToClose(onClose, translateY)` custom hook or a `SwipeableModal` wrapper component.                                                                                                   | 🟡       |
| D5  | **`DAYS_OF_WEEK` constant**                 | Defined inline inside `apps/web-portal/app/onboard/basic-info/page.tsx`                                                                                              | Move to `lib/constants.ts` alongside the other constants.                                                                                                                                               | 🟢       |
| D6  | **Local `Restaurant` and `Dish` interface** | `apps/mobile/src/screens/BasicMapScreen.tsx` defines local `Restaurant` and `Dish` interfaces near the top of the file that are slightly different from the DB types | Delete and import the canonical types.                                                                                                                                                                  | 🟡       |

---

## 4. File Size & Component Decomposition

| #   | File                                              | Lines | Problem                                                                                                                                                                  | Recommended Action                                                                                                                                                              | Priority |
| --- | ------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| F1  | `apps/web-portal/app/onboard/basic-info/page.tsx` | ~988  | Single page component handles form state, localStorage, map integration, operating hours, cuisine selection, service options, and validation                             | Split into sub-components: `<OperatingHoursSection>`, `<CuisineSelector>`, `<ServiceOptions>`, `<LocationSection>`. Extract form submission logic to a hook `useBasicInfoForm`. | 🟡       |
| F2  | `apps/mobile/src/screens/BasicMapScreen.tsx`      | ~872  | Map screen handles restaurant data loading, dish data loading, filter application, marker rendering, rating flow, profile completion, drawer filters, and mode switching | Already partially decomposed (markers are extracted); extract remaining logic into custom hooks: `useMapData`, `useMapFilters`, `useMapRating`.                                 | 🟡       |
| F3  | `apps/mobile/src/stores/filterStore.ts`           | ~1095 | Single Zustand store file containing state shape, default values, actions, database sync, and currency helpers                                                           | Split into `filterStore.ts` (state & actions) and `userPreferencesSync.ts` (DB sync logic).                                                                                     | 🟢       |
| F4  | `apps/web-portal/app/onboard/review/page.tsx`     | ~571  | All Supabase mutation logic lives inline in the page component                                                                                                           | Move restaurant/menu/dish insertion logic to a dedicated service `lib/restaurantService.ts`.                                                                                    | 🟡       |
| F5  | `apps/mobile/src/screens/auth/LoginScreen.tsx`    | ~509  | Inline SVG icon components (`GoogleIcon`, `FacebookIcon`) and language selector alongside auth logic                                                                     | Extract SVG icons to `components/icons/` and language selector to a separate component.                                                                                         | 🟢       |

---

## 5. Dead / Debug Code (remove before launch)

| #   | Location                                         | What to Remove                                                                                                                                                                                                                        | Priority |
| --- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | --------------- |
| X1  | `apps/mobile/src/screens/SupabaseTestScreen.tsx` | Entire file — it is a developer test screen that lists restaurants. It is also registered in `RootNavigator.tsx` (accessible from the main navigator). Should be deleted and removed from navigation and `screens/index.ts`.          | 🔴       | ✅ this session |
| X2  | `apps/mobile/src/navigation/RootNavigator.tsx`   | `SupabaseTest` screen registration in `MainStack`                                                                                                                                                                                     | 🔴       | ✅ this session |
| X3  | `apps/mobile/src/screens/SwipeScreen.tsx`        | File header says **"Demonstration of Edge Functions Integration"** — evaluate whether this is the real swipe screen or a demo placeholder. If placeholder, replace or remove. It is registered in the main navigator as "Swipe Demo". | 🔴       | ✅ this session |
| X4  | `apps/web-portal/app/onboard/review/page.tsx`    | `console.log('Restaurant created/updated successfully:', ...)` in production submission path                                                                                                                                          | 🟡       | ✅ this session |
| X5  | `apps/web-portal/app/page.tsx`                   | `console.log('[Dashboard] Query result:', { data, error })` — leaks internal query results                                                                                                                                            | 🟡       | ✅ this session |
| X6  | `apps/web-portal/app/admin/page.tsx`             | `console.log('[Admin] Stats query result:', { data, error })` — verbose admin logging                                                                                                                                                 | 🟡       | ✅ this session |
| X7  | `apps/mobile/src/stores/authStore.ts`            | Multiple `debugLog` and `console.error` calls — review which are needed in production (use `debugLog` consistently, not raw `console.log`)                                                                                            | 🟡       | ✅ this session |
| X8  | `apps/web-portal/lib/storage.ts`                 | `autoSave()` function — never called, has a bug (see B1). Delete or fix + wire up.                                                                                                                                                    | 🟡       | ✅ this session |
| X9  | `apps/web-portal/components/wizard/`             | Folder exists but is **completely empty**                                                                                                                                                                                             | 🟢       | ✅ DX7 session  |

---

## 6. Architecture & Design

| #   | Area                                                    | Issue                                                                                                                                                                                                                                                                                     | Recommendation                                                                                                                                 | Priority | Status          |
| --- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------- | --------------- |
| A1  | **Shared package not used**                             | `packages/database` has a Supabase client and type exports, but neither `web-portal` nor `mobile` import from it. Both apps maintain their own copies of the client and types.                                                                                                            | Complete the migration: configure both apps to use `@eatme/database` for the Supabase client and generated types.                              | 🟡       | ✅ `1dc403b`    |
| A2  | **Web portal auth middleware**                          | `middleware.ts` adds security headers but a comment explicitly says "Auth checks moved to client-side… due to local dev issues." This means the `/admin` routes are only protected at the component level, not at the network edge. A user could navigate directly to an admin API route. | Implement proper server-side session validation in middleware using `@supabase/ssr`. The existing comment acknowledges this is a known gap.    | 🔴       | ✅ `3b4c710`    |
| A3  | **Mobile data source confusion**                        | `BasicMapScreen.tsx` loads data from **three sources**: `useRestaurantStore` (geospatial), `useRestaurants` hook (fallback DB query), and `useAllDishes` hook. There is unclear logic about which takes priority.                                                                         | Define a single authoritative data source for the map. The geospatial store should be the primary. Remove the fallback hooks from this screen. | 🟡       | ✅ this session |
| A4  | **No service layer on web portal**                      | All Supabase queries live directly inside page components (`page.tsx` files). Heavy business logic (upsert restaurant, insert menus, add ingredients) is mixed with rendering logic.                                                                                                      | Create a `lib/restaurantService.ts` (and similar) to encapsulate DB operations, making pages thin and logic testable.                          | 🟡       | ✅ this session |
| A5  | **Store coupling (mobile)**                             | `authStore.ts` directly calls `useFilterStore.getState().syncWithDatabase()` and `useOnboardingStore.getState().loadUserPreferences()` on login. This creates tight coupling between unrelated stores.                                                                                    | Emit an event or use a middleware pattern (Zustand's `subscribeWithSelector`) so each store reacts independently to auth state changes.        | 🟡       | ✅ this session |
| A6  | **No error boundaries**                                 | Neither the web portal nor the mobile app has React Error Boundaries. An unhandled throw in any component will crash the entire app.                                                                                                                                                      | Add a top-level `<ErrorBoundary>` in `layout.tsx` (web) and `App.tsx` (mobile).                                                                | 🟡       | ✅ this session |
| A7  | **Draft lifecycle gap**                                 | If a restaurant partner starts onboarding, completes basic info, but never finishes, their draft stays in localStorage indefinitely. There is no expiry mechanism or cleanup prompt.                                                                                                      | Add a `lastSaved` timestamp check and clear stale drafts (e.g., >7 days old) on login. `lastSaved` is already written by `saveRestaurantData`. | 🟢       | ✅ this session |
| A8  | **OAuth flow type**                                     | The web portal uses `flowType: 'implicit'` in the Supabase client and the auth callback manually parses `hash` params. The comment says "to avoid PKCE verifier issues in dev." Implicit flow is deprecated by OAuth 2.1.                                                                 | Migrate to PKCE flow (`flowType: 'pkce'`) and use the `@supabase/ssr` package which handles the code exchange server-side.                     | 🟡       | ✅ `3b4c710`    |
| A9  | **Mobile: No global error handling for Supabase calls** | Every service file (`favoritesService`, `dishRatingService`, `restaurantRatingService`, etc.) handles errors differently — some throw, some return `null`, some return `{ error }`.                                                                                                       | Define a standard `Result<T, E>` return type and apply it consistently across all service functions.                                           | 🟢       | ✅ this session |

---

## 7. Performance

| #   | Area                                                 | Issue                                                                                                                                                                                                      | Recommendation                                                                                                  | Priority |
| --- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------- | --------------- |
| P1  | `apps/web-portal/app/onboard/review/page.tsx`        | Menus and dishes are inserted in a sequential `for` loop. For a restaurant with 3 menus × 20 dishes, this is 4+ sequential round trips.                                                                    | Batch insert all menus in one call, then batch all dishes in one call (matching `menu_id` after menu creation). | 🟡       | ✅ this session |
| P2  | `apps/mobile/src/screens/RestaurantDetailScreen.tsx` | On open, the screen fetches the restaurant + all menus/categories/dishes, then makes a **second** separate Supabase call for all dish ratings as a batch, then a **third** call for the restaurant rating. | Combine the rating fetches or pre-load ratings when the restaurant marker is tapped (before navigation).        | 🟢       | ✅ this session |
| P3  | `apps/mobile/src/screens/BasicMapScreen.tsx`         | No `React.memo` or `useCallback` on marker components; every state update re-renders all markers.                                                                                                          | Memoize marker list with `useMemo`; ensure `RestaurantMarkers` and `DishMarkers` use `React.memo`.              | 🟢       | ✅ this session |
| P4  | `apps/web-portal/app/onboard/basic-info/page.tsx`    | The `LocationPicker` is dynamically imported (good), but the entire 988-line component still re-renders on every keystroke because the form state is all in one `useState`.                                | Use `React Hook Form`'s uncontrolled inputs (already imported but not fully leveraged) to minimize re-renders.  | 🟢       | ✅ this session |

---

## 8. Security

| #   | Area                                      | Issue                                                                                                                                                                                       | Priority |
| --- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | --------------- |
| S1  | **Admin routes not server-protected**     | See A2 above — middleware is security-header-only. A malicious actor can call admin-facing API routes directly.                                                                             | 🔴       | ✅ this session |
| S2  | **CSP `unsafe-inline` and `unsafe-eval`** | The Content Security Policy in `middleware.ts` allows `unsafe-inline` scripts and `unsafe-eval`. This significantly weakens XSS protections.                                                | 🟡       | ✅ this session |
| S3  | **Debug info in console**                 | Multiple `console.log` calls log `user.id`, query results, and internal state to the browser console in production paths (see X4–X7).                                                       | 🟡       | ✅ this session |
| S4  | **RLS on all tables**                     | The migration history has parallel branches (duplicate numbers), making it hard to verify every table has RLS enabled. A full audit of RLS policies should be done against the live schema. | 🔴       | ✅ this session |

---

## 9. Developer Experience & Maintainability

| #   | Area                                              | Issue                                                                                                                                                                       | Recommendation                                                                                                                                                  | Priority |
| --- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | --------------- |
| DX1 | **No automated tests**                            | No unit or integration tests exist anywhere in the monorepo.                                                                                                                | At minimum, add tests for: `lib/storage.ts`, `lib/validation.ts`, `filterStore.ts`, and the ingredient search function. Use Vitest for web and Jest for mobile. | 🟡       |
| DX2 | **Migration naming chaos**                        | 40 migration files with duplicate numbers make it impossible to know the actual applied order.                                                                              | Renumber all migrations sequentially (001–040+) with no gaps or duplicates. Create a `MIGRATIONS.md` log.                                                       | 🔴       | ✅ this session |
| DX3 | **`@eatme/database` types not generated**         | Types in the shared package are hand-written, meaning they drift from the actual schema as migrations are added.                                                            | Run `supabase gen types typescript --project-id <id> > packages/database/src/types.ts` and commit generated types. Add this to the CI pipeline.                 | 🟡       | ✅ this session |
| DX4 | **No `.env.example` files**                       | Neither `apps/web-portal` nor `apps/mobile` ship an `.env.example` file, making onboarding a new engineer very slow (they must read documentation to discover needed vars). | Add `.env.example` files with placeholder values and documentation comments.                                                                                    | 🟡       | ✅ this session |
| DX5 | **No CI pipeline**                                | No GitHub Actions or similar CI is configured.                                                                                                                              | Add a basic CI: `pnpm install → turbo build → turbo check-types → turbo lint`.                                                                                  | 🟡       |
| DX6 | **`packages/database/src/types.ts`**              | File is likely hand-maintained or empty. A schema mismatch between this and the real Supabase DB will cause silent runtime bugs.                                            | See DX3.                                                                                                                                                        | 🟡       | ✅ this session |
| DX7 | **`apps/web-portal/components/wizard/` is empty** | Wizard was likely planned but never implemented.                                                                                                                            | Either remove the empty folder or implement the wizard wrapper that was originally planned.                                                                     | 🟢       | ✅ this session |
| DX8 | **Inconsistent `console` usage in mobile**        | Some places use `debugLog` (env-gated), others use raw `console.log`/`console.error`. In production builds, raw logs are visible.                                           | Standardise: use `debugLog` everywhere for debug traces; only keep user-facing error logs with `console.error`.                                                 | 🟡       | ✅ S3 session   |

---

## 10. Future Improvements (Post-Launch)

| #    | Area                                | Idea                                                                                                                                                                     |
| ---- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| FU1  | **Analytics**                       | Add structured event tracking (e.g., PostHog or Supabase Analytics) for swipe events, restaurant views, and onboarding drop-off.                                         |
| FU2  | **Offline support (mobile)**        | Cache nearby restaurants to AsyncStorage so the map works without internet.                                                                                              |
| FU3  | **Image optimisation**              | Dish photos stored as raw URLs with no resizing. Add a Supabase Storage Transform or use a CDN with image transformation to serve appropriately sized images per device. |
| FU4  | **Push notifications**              | No push notification infrastructure exists. Needed for Eat Together session invites, rating reminders, etc.                                                              |
| FU5  | **Supabase Realtime**               | Eat Together sessions currently poll or rely on manual refresh. Use Supabase Realtime subscriptions for live session state.                                              |
| FU6  | **i18n on web portal**              | Mobile has `i18n` with EN/ES/PL support. Web portal is English-only. Restaurant partners in non-English markets would benefit from localisation.                         |
| FU7  | **Rate limiting**                   | No rate limiting on the Edge Functions or client-facing API. Should be added to prevent abuse of the feed and swipe tracking endpoints.                                  |
| FU8  | **Accessible UI audit**             | No accessibility (ARIA attributes, colour contrast checks, screen reader support) audit has been done on either platform.                                                |
| FU9  | **Storybook / component catalogue** | With shadcn/ui on web and a custom component library on mobile, a Storybook instance would help maintain visual consistency.                                             |
| FU10 | **Monorepo shared hooks**           | React hooks like `useDebounce` or `usePrevious` are re-implemented per app. A `packages/hooks` package would prevent duplication.                                        |

---

## Quick Wins Summary (High ROI, Low Effort)

These can be done in a single short sprint before launch:

1. **Delete `SupabaseTestScreen`** and remove from navigator (X1, X2)
2. **Remove or rename `SwipeScreen`** — clarify if it's the real screen (X3)
3. **Fix `autoSave` bug** in `storage.ts` (B1)
4. **Add `.env.example`** to both apps (DX4)
5. **Strip production `console.log` statements** from dashboard, review, and admin pages (X4–X7)
6. **Fix duplicate migration numbers** — at minimum document the correct order (DX2, B4)
7. **Delete the empty `components/wizard/` folder** (DX7)
8. **Fix typo** in `databa_schema.sql` (B5)
