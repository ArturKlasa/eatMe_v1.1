# Implementation Plan: Admin Restaurant Data Ingestion

## Checklist

- [x] Step 1: Database migration — `google_place_id`, `restaurant_import_jobs`, `google_api_usage`
- [x] Step 2: Shared types, validation, and import service — `import-types.ts`, `import-validation.ts`, `import-service.ts`
- [x] Step 3: Google Places API client — `google-places.ts` with Nearby Search, Text Search, field mapping
- [x] Step 4: Google import API route — `POST /api/admin/import/google` (search + dedup + insert)
- [x] Step 5: Warning flags and RestaurantTable enhancements — `computeWarningFlags()`, warning badge, flagged filter, scan menu button
- [x] Step 6: Import page UI — `/admin/restaurants/import` with area selector, import button, results table
- [x] Step 7: CSV import — `csv-import.ts`, `POST /api/admin/import/csv`, CSV tab on import page
- [x] Step 8: Menu-scan query param support — accept `restaurant_id` in menu-scan page
- [x] Step 9: Admin sidebar and dashboard integration — nav item, dashboard stats update
- [x] Step 10: End-to-end testing and polish — full flow tests, error edge cases, UX refinements

---

## Step 1: Database Migration

**Objective:** Add the `google_place_id` column to restaurants and create the `restaurant_import_jobs` and `google_api_usage` tables needed by the import system.

**Implementation guidance:**
- Create `infra/supabase/migrations/080_restaurant_import.sql`
- Add nullable `google_place_id text` column to `restaurants` with a UNIQUE constraint and partial index (WHERE NOT NULL)
- Create `restaurant_import_jobs` table with columns: `id`, `admin_id`, `admin_email`, `source`, `status`, `search_params`, `total_fetched`, `total_inserted`, `total_skipped`, `total_flagged`, `errors`, `restaurant_ids`, `api_calls_used`, `estimated_cost_usd`, `created_at`, `completed_at`
- Create `google_api_usage` table with columns: `id`, `month` (unique), `api_calls`, `estimated_cost_usd`, `updated_at`
- Enable RLS on both new tables (service-role-only access, no per-user policies)
- Regenerate database types: run `pnpm supabase gen types typescript --local > packages/database/src/types.ts` so the generated types include the new column and tables

**Test requirements:**
- Apply migration to local Supabase, verify `google_place_id` column exists on `restaurants`
- Verify UNIQUE constraint: inserting two restaurants with the same `google_place_id` fails
- Verify NULL is allowed (multiple restaurants can have NULL `google_place_id`)
- Verify both new tables exist with correct columns and constraints
- Verify RLS is enabled on both tables

**Integration with previous work:** This is the foundation — all subsequent steps depend on these schema changes.

**Demo:** Run `supabase db reset` or apply migration. Query `restaurants` table and see `google_place_id` column. Insert a test row into `restaurant_import_jobs` and `google_api_usage`.

---

## Step 2: Shared Types, Validation, and Import Service

**Objective:** Build the shared data types, validation logic, and core import service that both the Google and CSV import paths will use.

**Implementation guidance:**

Create `lib/import-types.ts`:
- Define `MappedRestaurant` interface (all fields from design: name, address, latitude, longitude, phone, website, restaurant_type, cuisine_types, country_code, city, state, postal_code, neighbourhood, open_hours, delivery_available, takeout_available, dine_in_available, accepts_reservations, payment_methods, google_place_id)
- Define `WarningFlag` union type, `ImportSummary`, `ImportedRestaurantSummary`, `ImportError`, `SkippedRestaurant`

Create `lib/import-validation.ts`:
- `validateImportedRestaurant(r: MappedRestaurant): ValidationResult` — checks name present, lat/lng valid numbers in range (-90 to 90 / -180 to 180), restaurant_type in allowed enum (fall back to "restaurant"), country_code valid. Returns `{ valid: boolean, errors: ImportError[], sanitized: MappedRestaurant }` with defaults applied
- Use Zod for schema definition, reuse existing constants from `lib/constants.ts` for valid restaurant_type and cuisine_type values

Create `lib/import-service.ts`:
- `deduplicateRestaurants(incoming, supabase)` — queries existing restaurants by `google_place_id` (exact IN match) and by PostGIS `ST_DWithin(location_point, ...)` + `string-similarity` name comparison for fuzzy matches. Returns `{ toInsert, toSkip, toFlag }`
- `importRestaurants(restaurants, source, adminId, adminEmail, supabase)`:
  1. Validate each restaurant via `validateImportedRestaurant()`
  2. Run `deduplicateRestaurants()` to split into toInsert/toSkip/toFlag
  3. Build DB rows from `MappedRestaurant` — **critical:** set `location` as `{ lat: restaurant.latitude, lng: restaurant.longitude }` jsonb. Do NOT set `location_point` — the DB auto-computes it from `location` via the DEFAULT expression
  4. Batch INSERT into `restaurants` table via `supabase.from('restaurants').insert(rows)`
  5. Create `restaurant_import_jobs` record with all counts and metadata
  6. Write `admin_audit_log` entry: `{ admin_id: adminId, admin_email: adminEmail, action: 'bulk_import', resource_type: 'restaurants', resource_id: jobId, new_data: { source, total_inserted, total_skipped, total_flagged, total_errors: errors.length } }`
  7. Return `ImportSummary`
- `computeWarningFlags(restaurant, dishCount)` — pure function, returns `WarningFlag[]`

**Test requirements:**
- `validateImportedRestaurant`: valid data passes, missing name fails, invalid lat (91) fails, unknown restaurant_type falls back to "restaurant", empty cuisine_types passes validation (but will be flagged as warning)
- `deduplicateRestaurants`: exact google_place_id match → toSkip, fuzzy name within 200m → toFlag, name match but >200m → toInsert, no matches → toInsert
- `importRestaurants`: mock Supabase client, verify batch insert payload includes `location: { lat, lng }` and does NOT include `location_point`. Verify job record created with correct counts. Verify audit log entry written with correct fields. Verify correct ImportSummary counts
- `computeWarningFlags`: empty cuisine → missing_cuisine, empty hours → missing_hours, no phone+website → missing_contact, dishCount=0 → missing_menu, all present → empty array

**Integration with previous work:** Depends on Step 1 (migration applied, types generated). Uses existing `string-similarity` package, `lib/constants.ts` enums, and `lib/supabase-server.ts` for service role client.

**Demo:** Run unit tests. Demonstrate `importRestaurants()` with mock data inserting into local Supabase and returning a correct `ImportSummary`.

---

## Step 3: Google Places API Client

**Objective:** Build the Google Places API client library that handles Nearby Search, Text Search, and maps Google data to our `MappedRestaurant` format. No separate Place Details calls needed — Nearby Search and Text Search return full details via FieldMask.

**Implementation guidance:**

Add `GOOGLE_PLACES_API_KEY` environment variable:
- Add to `.env.local`: `GOOGLE_PLACES_API_KEY=your_key_here`
- Document in README or `.env.example` that this key is required for the import feature
- Key must have Places API (New) enabled in Google Cloud Console

Create `lib/google-places.ts`:
- `nearbySearchRestaurants(lat, lng, radiusMeters, pageToken?)` — POST to `https://places.googleapis.com/v1/places:searchNearby` with:
  - `includedTypes: ["restaurant", "cafe", "bakery", "bar", "meal_takeaway", "fast_food_restaurant"]`
  - `locationRestriction.circle: { center: { latitude, longitude }, radius }`
  - `maxResultCount: 20`
  - `X-Goog-FieldMask` header with full field mask from design (Essentials + Enterprise + Enterprise Plus fields)
  - `X-Goog-Api-Key` header with `GOOGLE_PLACES_API_KEY`
  - Returns `{ places: GooglePlace[], nextPageToken: string | null }` — places include ALL requested fields directly (no separate Place Details needed)
- `textSearchRestaurants(query, lat, lng, radiusMeters, pageToken?)` — POST to `https://places.googleapis.com/v1/places:searchText` with `textQuery`, `locationBias`, same FieldMask. Returns same shape. Used when admin provides a text query (e.g., "tacos in Roma Norte")
- `mapGooglePlaceToRestaurant(place)` — maps all Google fields to `MappedRestaurant`. Calls helper functions below
- `inferCuisineFromGoogleTypes(types)` — uses `GOOGLE_TYPE_TO_CUISINE` mapping from design, returns string[]. Filters out unknown types, deduplicates
- `mapGoogleHoursToOpenHours(periods)` — converts Google period objects to our `{ day: { open, close } }` format. Handles edge cases:
  - 24h restaurants: `open.hour=0, close.hour=0` on next day → `"00:00"-"23:59"`
  - Overnight hours: `close.day != open.day` → store close time on open day
  - Multiple periods per day: merge using earliest open + latest close
  - Missing hours: `regularOpeningHours` is null → return `{}` (flagged as `missing_hours`)
- `mapAddressComponents(components)` — extracts city, state, postal_code, country_code, neighbourhood from Google's structured address. Mexican address specifics: `sublocality`/`administrative_area_level_2` → city (delegación), `neighborhood`/`sublocality_level_1` → neighbourhood (colonia), `administrative_area_level_1` → state (estado)
- `getMonthlyApiUsage(supabase)` / `incrementApiUsage(supabase, calls)` — reads/updates `google_api_usage` table, UPSERT on month key (format: "2026-04")
- Implement exponential backoff for 429 errors (retry up to 3 times, delays: 1s, 2s, 4s)

**Test requirements:**
- `nearbySearchRestaurants`: mock fetch, verify POST body includes correct `includedTypes`, `locationRestriction`, `maxResultCount: 20`, correct FieldMask header, correct API key header. Verify pagination token passthrough
- `textSearchRestaurants`: mock fetch, verify `textQuery` and `locationBias` in body, same FieldMask
- `mapGooglePlaceToRestaurant`: complete Google place → all fields mapped correctly. Sparse place (missing hours, phone, no cuisine-specific type) → defaults applied, no crash, empty optional fields
- `inferCuisineFromGoogleTypes`: `["mexican_restaurant"]` → `["Mexican"]`, `["restaurant"]` → `[]`, `["italian_restaurant", "pizza_restaurant"]` → `["Italian", "Pizza"]`, `["unknown_type"]` → `[]`
- `mapGoogleHoursToOpenHours`: standard hours, 24h, overnight (Fri 18:00 → Sat 02:00), multiple periods per day, missing (null → `{}`)
- `mapAddressComponents`: Mexican address with delegación/colonia/estado, minimal components (just country), missing components
- `incrementApiUsage`: first call creates row for current month, second call increments existing row

**Integration with previous work:** Uses `MappedRestaurant` type from Step 2. `incrementApiUsage` writes to `google_api_usage` table from Step 1.

**Demo:** Write a small test script that calls `nearbySearchRestaurants` with lat=19.4326, lng=-99.1332 (Mexico City center), radius=5000. Requires `GOOGLE_PLACES_API_KEY` env var set. Print the mapped restaurants and verify field mapping looks correct. Verify that all fields (hours, phone, dineIn, etc.) are returned directly from the search — no Place Details calls.

---

## Step 4: Google Import API Route

**Objective:** Create the `POST /api/admin/import/google` endpoint that combines Google Places search with the import service to fetch and insert restaurants in a single call.

**Implementation guidance:**

Create `app/api/admin/import/google/route.ts`:
- Verify admin auth via `verifyAdminRequest(request)` (existing pattern from menu-scan route)
- Parse request body: `{ lat, lng, radius, maxPages?, textQuery? }`
- Validate: radius 100-50000m, maxPages 1-10 (default 1), lat/lng in valid range
- Check monthly API usage via `getMonthlyApiUsage()`: if approaching budget, include warning in response
- Loop up to `maxPages` pages:
  - If `textQuery` provided: call `textSearchRestaurants()`, else call `nearbySearchRestaurants()`
  - Each call returns up to 20 restaurants WITH full details (no Place Details needed)
  - Map results via `mapGooglePlaceToRestaurant()` for each place
  - Track API call count (1 call per page)
  - If no `nextPageToken` in response, break
- Call `importRestaurants()` from import-service with all mapped restaurants
- Call `incrementApiUsage()` with total API calls used (= number of pages fetched)
- Return `ImportSummary` as JSON response

**Error handling:**
- Google API 429 → exponential backoff in google-places.ts, transparent to this route
- Google API 403 (quota) → stop pagination, import what we have so far, return partial results with warning
- Individual page failures → log error, skip that page, continue with remaining pages
- Auth failure → 401
- Validation failure (bad lat/lng/radius) → 400

**Test requirements:**
- Auth: reject non-admin (401), reject unauthenticated (401)
- Success: mock Google API returning 2 pages of results (40 restaurants), verify all inserted, correct ImportSummary with apiCallsUsed=2
- Pagination: maxPages=3, mock returns 3 pages, verify three search calls made
- Pagination stops: maxPages=5 but Google returns no nextPageToken after page 2, verify only 2 calls made
- Dedup: import same area twice, second time all skipped (google_place_id match)
- Partial failure: one search page returns error, others succeed, verify partial results imported
- Budget tracking: verify `google_api_usage` table updated with correct call count

**Integration with previous work:** Depends on Steps 1-3. Uses `verifyAdminRequest` from `lib/supabase-server.ts`, `importRestaurants` from Step 2, Google Places functions from Step 3.

**Demo:** Using Postman or curl, call `POST /api/admin/import/google` with `{ lat: 19.4326, lng: -99.1332, radius: 5000, maxPages: 1 }` (Mexico City center). See ~20 restaurants inserted into local DB. Run again to verify dedup (all skipped). Check `restaurant_import_jobs` and `admin_audit_log` for records. Check `google_api_usage` shows 1 call used.

---

## Step 5: Warning Flags and RestaurantTable Enhancements

**Objective:** Add warning badges to the existing restaurant list so admins can see which restaurants need attention, and add a "Scan Menu" action button.

**Implementation guidance:**

Create `components/admin/RestaurantWarningBadge.tsx`:
- Accept `warnings: WarningFlag[]` prop
- Render amber `AlertTriangle` icon (from lucide-react) when warnings is non-empty
- Tooltip (use Radix Tooltip or title attribute) listing each flag in human-readable text: "Missing cuisine types", "Missing hours", "Missing contact info", "No menu data", "Possible duplicate"
- Render nothing when warnings is empty

Modify `app/admin/restaurants/page.tsx`:
- Update Supabase query to include dish count subquery: `SELECT r.*, (SELECT COUNT(*) FROM dishes d WHERE d.restaurant_id = r.id) AS dish_count FROM restaurants r`
- Import `computeWarningFlags` from `lib/import-service.ts`
- Compute warnings for each restaurant row and pass to `RestaurantTable`
- Add state for "flagged only" filter
- Pass filter state and setter to `RestaurantTable`

Modify `components/admin/RestaurantTable.tsx`:
- Accept new props: `warnings: Map<string, WarningFlag[]>` (restaurant_id → warnings), `showFlaggedOnly` filter state, `onToggleFlaggedOnly` callback
- Add `RestaurantWarningBadge` in the Status column, after the Active/Suspended badge
- Add "Show flagged only" checkbox above the table (next to existing search/filters)
- When checked, filter displayed rows to only those with non-empty warnings
- Add "Scan Menu" icon button (`ScanLine` from lucide-react) in the actions column, navigating to `/admin/menu-scan?restaurant_id={id}`

**Test requirements:**
- `RestaurantWarningBadge`: renders amber icon when warnings present, renders nothing when empty, tooltip text matches flags
- `RestaurantTable`: warning badge appears for flagged restaurants, "Flagged only" filter hides clean restaurants, "Scan Menu" button navigates to correct URL with restaurant_id
- `restaurants/page.tsx`: dish count subquery works, warnings computed correctly, filter state toggles

**Integration with previous work:** Uses `computeWarningFlags` from Step 2. Modifies existing `RestaurantTable` component (currently has 6 columns + 4 action buttons per the codebase exploration).

**Demo:** After importing restaurants in Step 4 (which have no dishes), navigate to `/admin/restaurants`. See amber warning badges on all imported restaurants (at minimum `missing_menu`). Toggle "flagged only" filter. Click "Scan Menu" on a restaurant and arrive at menu-scan page.

---

## Step 6: Import Page UI

**Objective:** Build the `/admin/restaurants/import` page with the Google Places area search interface and import results display.

**Implementation guidance:**

Create `components/admin/ImportAreaSelector.tsx`:
- Leaflet map (reuse patterns from `LocationPicker.tsx`: dynamic import via `next/dynamic` with `ssr: false`, OpenStreetMap tiles, marker management)
- Click on map places a center pin marker
- Draggable circle overlay showing the search radius (use Leaflet `L.circle`)
- Radius control: slider (1-50 km) or number input, default 5km
- City search input above map: forward geocode via Nominatim (`https://nominatim.openstreetmap.org/search?q=...&format=json`), center map + place pin on result. Throttle to 1 req/sec (matching existing Nominatim throttle pattern in LocationPicker)
- Optional text query input field (for targeted search like "tacos in Roma Norte")
- Emit `onAreaSelect({ lat, lng, radius, textQuery? })` callback when area is set
- Display current selection summary: "Mexico City, 5km radius"

Create `components/admin/ImportSummaryCard.tsx`:
- Accept `ImportSummary` prop
- Display stat cards in a row: Imported (green), Flagged (amber), Skipped (grey), Errors (red), API Cost
- Each card shows count + icon

Create `components/admin/ImportResultsTable.tsx`:
- Accept `ImportedRestaurantSummary[]` prop
- Columns: Name, Address, Status, Warnings, Actions
- Status column: green "Imported" badge, grey "Skipped" badge (with reason tooltip), red "Error" badge
- Warnings column: `RestaurantWarningBadge`
- Actions: "Scan Menu" button for imported restaurants (links to `/admin/menu-scan?restaurant_id=xxx`), "View" button (links to `/admin/restaurants/{id}`)
- Sortable by status (errors first, then flagged, then clean)

Create `app/admin/restaurants/import/page.tsx`:
- Two tabs using Radix Tabs: "Google Places" | "CSV Upload"
- Google Places tab:
  - `ImportAreaSelector` at top
  - "Import Restaurants" button (disabled until area selected). Shows loading spinner while API call in progress
  - `maxPages` selector: dropdown 1-10, default 1 (~20 restaurants)
  - After import: `ImportSummaryCard` + `ImportResultsTable`
  - "Import More" button to search again (different area or more pages)
  - Monthly API usage display via `getMonthlyApiUsage()`: "{N} calls this month"
- CSV tab: placeholder for Step 7
- State management: `useState` for area selection, import loading, results

**Test requirements:**
- `ImportAreaSelector`: map renders, click sets pin coordinates, radius slider updates circle, city search triggers geocode
- `ImportSummaryCard`: renders correct counts and colors from ImportSummary data
- `ImportResultsTable`: renders rows with correct status badges, "Scan Menu" links to correct URL, sorting works
- `import/page.tsx`: tab switching works, "Import Restaurants" button calls API with correct params, loading state shown during import, results displayed after completion

**Integration with previous work:** Calls `POST /api/admin/import/google` from Step 4. Uses `RestaurantWarningBadge` from Step 5. Reuses Leaflet patterns from `LocationPicker.tsx`.

**Demo:** Navigate to `/admin/restaurants/import`. Click on map to select Mexico City center, set 5km radius. Click "Import Restaurants" with maxPages=1. See ~20 restaurants imported with summary card and results table. Click "Scan Menu" on a restaurant.

---

## Step 7: CSV Import

**Objective:** Add CSV file upload and import as a secondary import method, sharing the same validation and insert logic as the Google import.

**Implementation guidance:**

Add `papaparse` dependency: `pnpm add papaparse` + `pnpm add -D @types/papaparse` (in web-portal workspace)

Create `lib/csv-import.ts`:
- `parseCsvToRestaurants(csvText: string): ParseResult<MappedRestaurant[]>` — uses `papaparse.parse()` with `header: true, skipEmptyLines: true`. Maps CSV columns to `MappedRestaurant` fields. Parses `cuisine_types` as semicolon-separated. Parses `mon_hours` through `sun_hours` as "HH:MM-HH:MM" or "closed" into `open_hours` JSONB format. Returns `{ restaurants, parseErrors }`
- `generateCsvTemplate(): string` — returns the CSV header + example row from the design
- Handle encoding: try UTF-8 first, detect BOM, fall back to Latin-1 if UTF-8 fails (important for Mexican data with accents: ñ, á, é, etc.)

Create `app/api/admin/import/csv/route.ts`:
- Verify admin auth via `verifyAdminRequest(request)`
- Parse multipart form data to extract CSV file
- Read file content as text
- Call `parseCsvToRestaurants()` to get `MappedRestaurant[]`
- If parse fails (invalid structure, missing required columns): return 400 with error
- Call `importRestaurants()` from import-service (same function as Google path — shared dedup, validation, insert, audit logic)
- Return `ImportSummary`

Update `app/admin/restaurants/import/page.tsx` — CSV tab:
- File drop zone (drag-and-drop + click-to-browse). Accept `.csv` files only
- "Download Template" link that triggers `generateCsvTemplate()` download
- "Upload & Import" button. Shows file name when selected. Disabled until file chosen
- After import: same `ImportSummaryCard` + `ImportResultsTable` as Google tab
- Error display: if CSV parse fails, show error message inline (not just toast)

**Test requirements:**
- `parseCsvToRestaurants`: valid CSV with all columns, minimal CSV (name + lat + lng only), missing required column (name) → error, special characters (accents, ñ), semicolon-separated cuisines parsed correctly, hours parsing ("09:00-21:00" → object, "closed" → omitted, empty → null, "invalid" → error), UTF-8 with BOM handled, empty rows skipped
- `generateCsvTemplate`: returns valid CSV string with header and example row
- CSV API route: auth check, valid CSV upload returns correct ImportSummary, invalid CSV returns 400, dedup works against existing DB records
- CSV tab UI: file drop zone accepts .csv, template download works, upload triggers API call, results displayed

**Integration with previous work:** Uses `importRestaurants()` from Step 2, shares types from Step 2, same `ImportSummaryCard`/`ImportResultsTable` components from Step 6.

**Demo:** Download CSV template from the import page. Fill in 3-5 Mexican restaurants. Upload the CSV. See them imported with summary and results. Verify they appear in `/admin/restaurants` with warning badges.

---

## Step 8: Menu-Scan Query Param Support

**Objective:** Update the existing menu-scan page to accept a `restaurant_id` query parameter, enabling the "Scan Menu" button from the import results and restaurant list to pre-select the restaurant.

**Implementation guidance:**

Modify `app/admin/menu-scan/page.tsx`:
- Add `useSearchParams()` from `next/navigation` to read `restaurant_id` query param
- On component mount: if `restaurant_id` is present, fetch that restaurant from Supabase (`restaurants` table by ID)
- If found, set it as `selectedRestaurant` state (same state the manual dropdown sets at line ~218)
- Skip the restaurant selection step in the UI when pre-selected (show selected restaurant name with a "Change" button to go back to dropdown)
- If `restaurant_id` is invalid or restaurant not found, show toast warning and fall back to normal dropdown selection
- Rest of the menu-scan flow (image upload, processing, review) remains unchanged

**Test requirements:**
- No query param: page works as before (manual dropdown selection)
- Valid `restaurant_id` param: restaurant auto-selected, dropdown skipped, name displayed
- Invalid `restaurant_id` param: toast warning shown, falls back to dropdown
- "Change" button: clears pre-selection, shows dropdown

**Integration with previous work:** This page already exists. The "Scan Menu" buttons from Step 5 (RestaurantTable) and Step 6 (ImportResultsTable) link here with `?restaurant_id=xxx`.

**Demo:** Navigate to `/admin/menu-scan?restaurant_id={valid_id}`. See restaurant pre-selected. Upload a menu image and process it. Also test with invalid ID to see fallback.

---

## Step 9: Admin Sidebar and Dashboard Integration

**Objective:** Add the "Import" nav item to the admin sidebar and update the dashboard with import-related stats.

**Implementation guidance:**

Modify `components/admin/AdminSidebar.tsx`:
- Add new nav item after "Restaurants": `{ label: 'Import', href: '/admin/restaurants/import', icon: Download }`
- Import `Download` icon from lucide-react

Modify `app/admin/page.tsx` (dashboard):
- Add a new stats card: "Imported Restaurants" showing count of restaurants where `google_place_id IS NOT NULL`
- Add "Recent Imports" section below stats: last 5 import jobs with date, source, count, link to import page
- Query `restaurant_import_jobs` table ordered by `created_at DESC LIMIT 5`

**Test requirements:**
- Sidebar: "Import" nav item renders, active state works when on `/admin/restaurants/import`
- Dashboard: import stats card shows correct count, recent imports section renders last 5 jobs with correct data, works with zero import jobs (shows empty state)

**Integration with previous work:** Sidebar modification is cosmetic. Dashboard queries `restaurant_import_jobs` from Step 1.

**Demo:** Navigate to admin panel. See "Import" in sidebar. Click it to go to import page. Go back to dashboard and see import stats (after running imports from previous steps).

---

## Step 10: End-to-End Testing and Polish

**Objective:** Verify the complete import flow works end-to-end, handle edge cases, and polish the UX.

**Implementation guidance:**

End-to-end flow tests:
- Full Google import flow: select area in Mexico City → import 20 restaurants → see summary → view in restaurant list with warnings → click "Scan Menu" → arrive at menu-scan with restaurant selected
- Full CSV import flow: download template → fill in data → upload → see summary → view in restaurant list
- Re-import same area: verify all restaurants skipped (dedup by google_place_id)
- Import from different area: verify new restaurants added alongside existing ones
- Fix a flagged restaurant: edit to add cuisine_types → warning badge disappears on next list load

Edge case handling:
- Empty Google results (area with no restaurants): clear message, no crash
- Very large import (maxPages=10, ~200 restaurants): verify no timeout, all inserted
- CSV with encoding issues (Latin-1 file with ñ, accents): verify correct parsing
- Network failure mid-import: verify partial results returned, already-inserted restaurants remain in DB
- Concurrent imports: two admins importing simultaneously, verify no conflicts (google_place_id UNIQUE constraint handles dupes gracefully)

UX polish:
- Loading states: spinner on "Import Restaurants" button, progress text ("Fetching page 2 of 3...")
- Toast notifications: success toast after import completes, error toast on failure
- Empty states: no results yet message on import page before first import
- Responsive layout: import page works on smaller screens (map stacks above results)
- Keyboard accessibility: all buttons keyboard-navigable, focus management on tab switch

**Test requirements:**
- E2E: full Google flow completes without errors
- E2E: full CSV flow completes without errors
- E2E: re-import dedup works
- E2E: warning badges appear and disappear correctly after edits
- Edge: empty results handled gracefully
- Edge: large import doesn't timeout
- Edge: encoding edge cases pass

**Integration with previous work:** This step exercises all previous steps together. No new components — only tests and refinements.

**Demo:** Complete walkthrough: import restaurants from Google for a neighborhood in Mexico City, view them in the restaurant list with warning badges, fix one by editing cuisine types, scan a menu for another, verify the full pipeline works smoothly.

---
