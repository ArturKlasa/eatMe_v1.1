## 2026-04-10 — Step 1 complete

Implemented Step 1: Database migration for admin restaurant ingestion.

Changes made:
- `infra/supabase/migrations/080_restaurant_import.sql`: created with exact SQL from design document
  - Added `google_place_id text` column to `restaurants` with UNIQUE constraint + partial index
  - Created `restaurant_import_jobs` table with all specified columns and RLS enabled
  - Created `google_api_usage` table with month UNIQUE constraint and RLS enabled
- `packages/database/src/types.ts`: manually updated (local Supabase unavailable — Docker not running)
  - Added `google_place_id: string | null` to restaurants Row/Insert/Update
  - Added `restaurant_import_jobs` table type (Row/Insert/Update)
  - Added `google_api_usage` table type (Row/Insert/Update)

Note: Docker was not running so `supabase db reset` and `pnpm supabase gen types typescript --local` could not be run. Types updated manually from the SQL schema. The migration file is ready to apply when local Supabase is available.

Build check: `pnpm turbo run build --filter=web-portal` — 3 successful, no errors.

## 2026-04-10 — Step 2 complete (admin restaurant ingestion)

Implemented Step 2: Shared types, validation, and import service.

Changes made:
- `lib/import-types.ts`: `MappedRestaurant`, `WarningFlag`, `ImportSummary`, `ImportedRestaurantSummary`, `ImportError`, `SkippedRestaurant`, `ValidationResult`
- `lib/import-validation.ts`: `validateImportedRestaurant()` — Zod v4 schema, applies defaults (restaurant_type→'restaurant', country_code→'MX'), filters unknown cuisines
- `lib/import-service.ts`: `deduplicateRestaurants()`, `importRestaurants()` (location:{lat,lng} NOT location_point), `computeWarningFlags()`
- `test/import-validation.test.ts` + `test/import-service.test.ts`: 145 tests passing

Build: ✓ clean. Tests: 145 passed. Lint: 0 errors.

## 2026-04-10 — Verifier: Step 1 lint failure (pre-existing)

Build passes. Lint FAILS with 10 pre-existing errors (none introduced by Step 1):
- `public/pdf.worker.min.mjs` — 7x `@typescript-eslint/no-this-alias` (vendor minified file, should be excluded from lint)
- `app/admin/menu-scan/page.tsx:2184` — `react/no-children-prop`
- `components/admin/AddIngredientPanel.tsx:244` — 2x `react/no-unescaped-entities`

None of these files were modified by Step 1 (`git diff` confirms). The Implementer must fix these before Step 1 can be verified. Recommended fixes:
1. Add `public/**` to ESLint ignore in `apps/web-portal/eslint.config.mjs` to exclude the vendor file
2. Fix `react/no-children-prop` in `app/admin/menu-scan/page.tsx:2184`
3. Escape quotes in `components/admin/AddIngredientPanel.tsx:244`

Emitting `step.retry` per verifier mandate (lint must pass with zero errors).

## 2026-04-10 — Step 4 complete

Implemented Step 4: POST /api/admin/import/google route.

Changes made:
- `app/api/admin/import/google/route.ts`: new file — verifies admin auth via `verifyAdminRequest`, validates body (lat/lng/radius/maxPages), checks monthly budget, paginates up to maxPages calls to `nearbySearchRestaurants`/`textSearchRestaurants`, maps each place via `mapGooglePlaceToRestaurant`, calls `importRestaurants`, increments API usage tracking, handles 403 quota errors (stops pagination, imports partial results with warning). Returns ImportSummary + optional warnings array.
- `plan.md`: Step 4 marked [x]

Build: ✓ 3 successful. Lint: 0 errors (28 pre-existing warnings only).

## 2026-04-10 — Step 3 complete

Implemented Step 3: Google Places API client.

Changes made:
- `lib/google-places.ts`: new file — `nearbySearchRestaurants`, `textSearchRestaurants` (both with correct POST body, X-Goog-Api-Key / X-Goog-FieldMask headers, backoff for 429), `mapGooglePlaceToRestaurant`, `inferCuisineFromGoogleTypes`, `mapGoogleHoursToOpenHours` (handles standard, 24h, overnight, multiple-periods-per-day, missing), `mapAddressComponents` (Mexican addresses: delegación/colonia/estado), `getMonthlyApiUsage`, `incrementApiUsage`
- `test/google-places.test.ts`: 36 tests, all passing
- `.env.example`: added `GOOGLE_PLACES_API_KEY` with placeholder comment
- `plan.md`: Step 3 marked [x]

Build: ✓ 3 successful. Tests: 36 passed. Lint: 0 errors (28 pre-existing warnings only).

## 2026-04-10 — Step 5 complete

Implemented Step 5: Warning flags and RestaurantTable enhancements.

Changes made:
- `components/admin/RestaurantWarningBadge.tsx`: new component — shows amber AlertTriangle + count when warnings present, uses `title` attribute for tooltip with human-readable flag labels, renders nothing when empty
- `components/admin/RestaurantTable.tsx`: added `warnings`, `showFlaggedOnly`, `onToggleFlaggedOnly` props; added "Show flagged only" checkbox above table; added `RestaurantWarningBadge` in Status column; added `ScanLine` "Scan Menu" icon button in Actions column linking to `/admin/menu-scan?restaurant_id={id}`
- `app/admin/restaurants/page.tsx`: added second Supabase query to fetch dish counts per restaurant; compute `computeWarningFlags()` for each row; added `warningsMap` state and `showFlaggedOnly` state; passes all new props to `RestaurantTable`; flagged-only filter applied before pagination

Build: ✓ 3 successful. Lint: 0 errors (28 pre-existing warnings only).

## 2026-04-10 — Recovery: Steps 1-5 done, starting Step 6

Steps 1-5 all marked [x] in plan. Previous iteration did not publish an event (RECOVERY).
Next step is Step 6: Import page UI — `/admin/restaurants/import` with map area selector,
ImportAreaSelector, ImportSummaryCard, ImportResultsTable components, and the page itself.
Emitting `start` to hand off to Implementer.

## 2026-04-10 — Step 6 retry fixes complete

Fixed three issues from step.retry event:

1. Sort order in `ImportResultsTable.tsx`: changed statusOrder() so errors=0 (first), flagged=1, clean=2, skipped=3 (last). Previous code had clean=0 first.

2. Added `error?: string` to `ImportedRestaurantSummary` in `import-types.ts`. Updated `import-service.ts` to populate `error` on batch insert failure (adds error summaries to results table). Updated `ImportResultsTable.tsx` to show red "Error" badge when `r.error` is set (checked before skipped/imported).

3. Monthly API usage display: added GET handler to `/api/admin/import/google/route.ts` returning `{ calls, estimatedCost }`. Import page fetches on mount via `useEffect` and shows "{N} calls this month" above the import controls.

Build: ✓ 3 successful, 0 errors. Lint: 0 errors (29 pre-existing warnings). Tests: 181 passed.

## 2026-04-10 — Step 7 complete

Implemented Step 7: CSV import.

Changes made:
- Added `papaparse` (5.5.3) + `@types/papaparse` to web-portal deps
- `lib/csv-import.ts`: new file — `parseCsvToRestaurants()` (papaparse header parse, BOM stripping, semicolon-split cuisine_types, HH:MM-HH:MM hours parsing, required column validation, UTF-8/Latin-1 encoding hint via BOM detection) and `generateCsvTemplate()` (header + example row)
- `app/api/admin/import/csv/route.ts`: new API route — verifyAdminRequest, multipart form data, UTF-8 with Latin-1 fallback, parseCsvToRestaurants(), structural error → 400, shared importRestaurants(), row-level parse errors merged into summary
- `app/admin/restaurants/import/page.tsx`: replaced CSV tab placeholder with full UI — drag-and-drop file zone, file name display, "Download Template" button, "Upload & Import" button, inline parse error display, same ImportSummaryCard + ImportResultsTable as Google tab

Tests: 17 tests in test/csv-import.test.ts — all pass.
Build: ✓ 3 successful. Lint: 0 errors (29 pre-existing warnings only).

## 2026-04-10 — Step 8 complete

Implemented Step 8: menu-scan query param support.

Changes made:
- `app/admin/menu-scan/page.tsx`:
  - Added `useSearchParams` from `next/navigation`
  - Added `isPreSelected` state
  - Added `useEffect` that reads `restaurant_id` from query params, fetches restaurant via Supabase `.single()`, sets selectedRestaurant + isPreSelected; on error/not-found shows `toast.warning` and falls back to dropdown
  - Modified Restaurant selector section: when `isPreSelected`, shows green "pre-selected" banner with restaurant name + "Change" button (clears isPreSelected, selectedRestaurant, restaurantSearch); normal dropdown shown only when `!isPreSelected`

Build: ✓ 3 successful, 0 errors.

Step 10: E2E tests and UX polish — loading states, toasts, edge cases.

Emitting `start` to hand off to Implementer for Step 8.

## 2026-04-10 — Step 9 complete

Implemented Step 9: Admin sidebar and dashboard integration.

Changes made:
- `components/admin/AdminSidebar.tsx`: Added `Download` icon import; added "Import" nav item after "Restaurants"; added `exact` flag to Dashboard to prevent over-matching; added `exclude` field to Restaurants item so it doesn't highlight when on `/admin/restaurants/import`; updated active check logic to respect both flags
- `app/admin/page.tsx`: Added `ImportJob` type; added `recentImports` state; updated `loadStats` to run 3 parallel queries (dashboard stats, imported restaurants count, last 5 import jobs); added "Imported Restaurants" stats card (orange); changed grid from 3 to 4 columns; added "Recent Imports" section with empty state and list of last 5 jobs showing source, date, inserted/fetched counts

Build passes cleanly.

## 2026-04-10 — Step 10 complete (retry: API route integration tests)

Implemented the missing API route integration tests per step.retry event.

Created:
- `apps/web-portal/app/api/admin/import/google/route.test.ts` — 23 tests covering:
  auth (401 unauthenticated, 401 non-admin), GET monthly usage, validation (lat/lng/radius/maxPages),
  success flow (nearbySearch, textSearch, incrementApiUsage, mapGooglePlaceToRestaurant),
  pagination (maxPages, early stop on no nextPageToken, pageToken passthrough, apiCallsUsed count),
  partial failure (skip failing page, 403 quota stop with warning, place mapping error),
  budget warning (>900 calls shows warning, <=900 no warning)

- `apps/web-portal/app/api/admin/import/csv/route.test.ts` — 9 tests covering:
  auth (401), file validation (no file → 400, structural parse errors → 400),
  success flow (parseCsv + importRestaurants called, parse errors merged into summary),
  dedup (skipped count returned correctly), encoding (special characters handled without crash)

All 230 tests pass (25 files). Plan step 10 marked [x].
