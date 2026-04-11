# Idea Honing: Admin Restaurant Data Ingestion

Requirements clarification through iterative Q&A.

---

## Q1: How should restaurant data be sourced?

**Proposed Answer:** **Google Places API for restaurant metadata + existing GPT-4o menu scanner for dish data.**

**Rationale:** Based on research, Google Places API provides the best quality restaurant metadata (name, address, lat/lng, phone, website, hours, cuisine types) with good Mexico coverage. It's legally clean, and the $200/mo free credit covers ~5,700 Advanced detail lookups. For menu/dish data, Google's `businessMenus` field has poor coverage in Mexico (opt-in, most restaurants haven't filled it in), so we rely on the existing GPT-4o menu scanner which already handles Spanish menus (translation, dietary hint mapping for "vegetariano", "sin gluten", etc.).

**Pipeline:**
1. Admin selects target area (city/neighborhood in Mexico)
2. Google Places API Text Search → finds restaurants in area (20 per page, paginated)
3. Google Places API Place Details → fetches full metadata per restaurant
4. Admin previews results, selects which to import → batch insert into DB
5. Per imported restaurant → admin uploads menu photos → existing GPT-4o scanner extracts dishes

**Cost estimate:** ~$37 per 1,000 restaurants (Advanced tier), covered by $200/mo free credit.

**Alternatives considered:**
- Delivery platform scraping (Rappi/Uber Eats) — structured menu data but ToS grey area
- OpenStreetMap — free but incomplete data in Mexico
- Manual entry only — doesn't scale
- Google Maps menu data — poor coverage in Mexico

---

## Q2: What is the scope of the bulk import — full pipeline or restaurant metadata only?

**Proposed Answer:** **Two-phase: (1) Google Places API → bulk restaurant metadata import with admin review, (2) menu/dish data per restaurant via the existing GPT-4o menu scanner.**

**Rationale:** The DB has a clear hierarchy: `restaurants → menus → menu_categories → dishes → dish_ingredients`. Restaurant metadata (name, address, hours, etc.) maps cleanly from Google Places. Menu/dish data is a separate, richer problem that the existing scanner already solves well. Decoupling these two phases keeps the bulk import simple and leverages existing infrastructure.

**Alternatives considered:**
- Combined restaurant + menu import in one step — too complex, different data sources
- Restaurant-only with no menu path — misses the end-to-end workflow

---

## Q3: How should the Google Places API integration work in the admin UI?

**Proposed Answer:** **A new admin page (`/admin/restaurants/import`) with an area search interface: admin enters a city/neighborhood or drops a pin on a map, sets a radius, and the system queries Google Places API for restaurants in that area.**

**Rationale:** The codebase already has a `LocationPicker` component (Leaflet + OpenStreetMap tiles) that could be reused for area selection. The flow would be: select area → fetch results from Google → preview table → select/deselect restaurants → confirm import. This is more intuitive than requiring the admin to know exact search queries.

**UI flow:**
1. Admin navigates to `/admin/restaurants/import`
2. Picks a location (map click or city name) + radius (default 5km)
3. System calls Google Places Text Search: "restaurants in [area]"
4. Results displayed in a paginated preview table
5. Admin selects which restaurants to import (select all / deselect individually)
6. Confirm → batch insert

**Alternatives considered:**
- Text-only search box — less intuitive, no visual feedback on coverage area
- CSV upload of Google Place IDs — requires admin to know Place IDs
- Background crawl of entire city — expensive, admin loses control over what gets imported

---

## Q4: How should we map Google Places API fields to our database schema?

**Proposed Answer:** **Direct mapping for most fields, with sensible defaults for fields Google doesn't provide.**

**Field mapping:**

| Google Places Field | Our DB Column | Notes |
|---|---|---|
| `displayName.text` | `name` | Direct |
| `formattedAddress` | `address` | Direct |
| `location.latitude/longitude` | `location` (jsonb) | `{ lat, lng }` format |
| `nationalPhoneNumber` | `phone` | Direct |
| `websiteUri` | `website` | Direct |
| `primaryType` / `types[]` | `restaurant_type` | Map Google type to our enum (see below) |
| `regularOpeningHours.periods[]` | `open_hours` (jsonb) | Convert period objects to `{ day: { open, close } }` |
| `addressComponents` | `city`, `state`, `postal_code`, `country_code`, `neighbourhood` | Parse from structured components |
| — | `cuisine_types` | **Not directly available from Google.** Infer from `primaryType` + `types[]` where possible (e.g., "mexican_restaurant" → "Mexican"). Admin can edit in preview. |
| — | `delivery_available`, `takeout_available`, `dine_in_available` | Google has `dineIn`, `delivery`, `takeout` boolean fields (Advanced tier) |
| — | `payment_methods` | Default: `cash_and_card` (Google doesn't reliably provide this) |
| — | `accepts_reservations` | Google has `reservable` field (Advanced tier) |
| `id` (Google place_id) | — | Store as reference for dedup (not in current schema — could add `google_place_id` column) |

**Google type → restaurant_type mapping:**
- `restaurant` → `restaurant`
- `cafe`, `coffee_shop` → `cafe`
- `bakery` → `bakery`
- `bar`, `pub` → default `restaurant`
- `meal_takeaway` → `restaurant` (with `takeout_available: true`)
- `food_truck` → not available from Google (default `restaurant`)

**Rationale:** Most fields map directly. The main gap is `cuisine_types` — Google uses typed place categories (e.g., "mexican_restaurant", "italian_restaurant") rather than a separate cuisine field. We can extract cuisine from the type name and let the admin refine during preview.

**Alternatives considered:**
- Require admin to fill all unmapped fields manually — defeats the purpose of bulk import
- Skip unmapped fields entirely — leaves records incomplete

---

## Q5: How should duplicate restaurants be detected and handled?

**Proposed Answer:** **Match on `google_place_id` (exact, if we store it) + fuzzy name + proximity (within 200m) for existing DB records. Flag duplicates in preview for admin decision.**

**Rationale:** Adding a `google_place_id` column to the restaurants table gives us a perfect dedup key for re-imports from Google. For matching against manually-created restaurants (no place_id), we fall back to name similarity (`string-similarity` library already in deps) + geographic proximity. The admin sees flagged duplicates in the preview table and decides: skip, import anyway, or replace.

**Alternatives considered:**
- Exact name match only — misses "Joe's Pizza" vs "Joe's Pizza Restaurant"
- Auto-reject duplicates — too aggressive
- No dedup — pollutes database on re-import of same area

---

## Q6: What error handling strategy — fail entire batch, or allow partial success?

**Proposed Answer:** **Partial success with per-row status reporting in the preview/results UI.**

**Rationale:** Google Places API calls can fail for individual restaurants (rate limits, missing data). The preview should show per-row status: valid / incomplete (missing fields) / duplicate / error. Admin can fix, skip, or retry individual rows. On confirm, valid + admin-approved rows are inserted; others are skipped with a summary report.

**Alternatives considered:**
- All-or-nothing — one failure blocks everything
- Auto-fix errors — risky, could introduce bad data

---

## Q7: What validation rules should apply to imported restaurants?

**Proposed Answer:** **Minimum: `name` + `location` (lat/lng) required. `country_code` defaults to "MX" for Mexico. `restaurant_type` defaults to "restaurant". `cuisine_types` should have at least 1 (inferred from Google types, editable by admin).**

**Rationale:** Google Places API always provides name and coordinates, so these are guaranteed. For Mexico launch, defaulting `country_code` to "MX" makes sense. The admin form currently requires name + restaurant_type + country_code + at least 1 cuisine. Since Google provides the first three reliably, the main gap is cuisine_types which we can infer from Google's place types.

**Alternatives considered:**
- Require all fields that the manual form requires — blocks import for restaurants with sparse Google data
- No validation, import everything — risks bad data

---

## Q8: Should we store the Google Place ID for future reference?

**Proposed Answer:** **Yes — add a `google_place_id` column (nullable, unique) to the `restaurants` table.**

**Rationale:** Storing the Google Place ID enables: (a) perfect deduplication on re-imports, (b) future data refresh from Google (update hours, address changes), (c) linking to Google Maps for verification. The column should be nullable (manually-created restaurants won't have one) and unique (prevent duplicate imports).

**Alternatives considered:**
- Don't store it — lose dedup ability, can't refresh data later
- Store in a separate mapping table — over-engineered for a single ID

---

## Q9: Should the Google Places API fetch be synchronous or async?

**Proposed Answer:** **Synchronous with streaming progress for the search phase, async job for the import phase.**

**Rationale:** A Google Places Text Search for "restaurants in Condesa, Mexico City" returns ~20 results per page. Fetching 5-10 pages (~100-200 restaurants) takes a few seconds per page. This is fast enough to do synchronously with a progress indicator. The actual DB import (after admin confirms) should be async for large batches (100+ restaurants), following the existing `menu_scan_jobs` pattern.

**Alternatives considered:**
- Fully async for everything — unnecessary complexity for the search phase
- Fully sync — may timeout on large imports with 200+ restaurants

---

## Q10: Should there be a preview/review step before importing?

**Proposed Answer:** **No blocking review step. Import all fetched restaurants immediately into the DB, but flag records that need attention with a warning icon in the admin panel.**

**Rationale:** Speed is the priority for bulk ingestion. Requiring admin approval for every restaurant defeats the purpose of automation. Instead, all Google Places results are inserted on fetch, and the admin restaurants list (`/admin/restaurants`) shows a warning icon (e.g., amber triangle) next to restaurants that have issues: missing cuisine types, incomplete hours, possible duplicates, etc. The admin can then review and fix flagged restaurants at their own pace.

**Flagging criteria (warning icon shown when):**
- Missing `cuisine_types` (empty array)
- Missing `open_hours` (no hours from Google)
- Missing `phone` and `website` (no contact info)
- Possible duplicate detected (fuzzy name + proximity match)
- No menu data yet (no dishes linked)

**Admin panel changes:**
- Restaurant list table gets a new "status" column with warning icon
- Filter option: "Show flagged only" to focus on restaurants needing attention
- Clicking warning icon shows what's missing/flagged

**Alternatives considered:**
- Mandatory preview before import — slows down bulk ingestion, admin bottleneck
- Preview but non-editable — worst of both worlds
- No flagging at all — admin loses visibility into data quality

---

## Q11: How should the menu scanning workflow connect to bulk-imported restaurants?

**Proposed Answer:** **After bulk import, the admin can select one or more imported restaurants and launch menu scans from the import results page — linking directly to the existing `/admin/menu-scan` flow with the restaurant pre-selected.**

**Rationale:** The existing menu scanner at `/admin/menu-scan` already supports selecting a restaurant and uploading images. The new import flow should provide a smooth handoff: after importing 50 restaurants, the admin can click "Scan Menu" on any of them, which navigates to `/admin/menu-scan?restaurant_id=xxx` with the restaurant pre-selected. This avoids building a new menu scanning UI.

**Future enhancement:** Batch menu scanning — admin uploads menu photos for multiple restaurants in one session.

**Alternatives considered:**
- Build a new menu scanner into the import page — duplicates existing functionality
- No direct link — admin has to navigate to menu-scan and find the restaurant manually
- Auto-fetch menu images from Google — API doesn't support photo type filtering

---

## Q12: Should we also support CSV upload as a secondary import method?

**Proposed Answer:** **Yes, as a secondary method alongside Google Places API import.** CSV upload covers cases where the admin has restaurant data from other sources (personal spreadsheets, partner lists, government registries, etc.).

**Rationale:** Google Places API is the primary method, but admins may also have restaurant lists from non-Google sources. A CSV upload with the same preview/validation flow provides flexibility. The CSV schema should match the same fields as the Google import preview table, so both paths share the same validation and insert logic.

**CSV columns:** name (required), address, latitude, longitude, phone, website, restaurant_type, cuisine_types (semicolon-separated), country_code, mon_hours through sun_hours ("HH:MM-HH:MM" or "closed")

**Alternatives considered:**
- Google Places only — too restrictive
- CSV only (original plan) — misses the biggest productivity gain (auto-fetch from Google)
- JSON as secondary — less accessible than CSV for non-technical admins

---

## Q13: What audit trail should bulk imports leave?

**Proposed Answer:** **One `admin_audit_log` entry per import job, linking to an `import_jobs` record with per-restaurant details.**

**Rationale:** The `admin_audit_log` table already exists with fields for `action`, `resource_type`, `old_data`, `new_data`. For bulk imports, one audit entry with `action: "bulk_import"`, `resource_type: "restaurants"`, and `new_data` containing the job summary (count, source, errors). Detailed per-restaurant results stored in a new `import_jobs` table (or reuse `menu_scan_jobs` pattern).

**Alternatives considered:**
- One audit entry per restaurant — too noisy
- No audit logging — misses accountability
- Separate import history page — nice but can be v2

---

## Q14: What Google Places API billing controls should we implement?

**Proposed Answer:** **Request-level field masking to minimize cost, configurable search limits in the UI, and a monthly usage counter with admin-visible warnings.**

**Rationale:** Google charges per request and by data tier. By requesting only needed fields (Advanced tier: name, address, location, hours, phone, website, types, dineIn, delivery, takeout, reservable), we avoid Preferred tier pricing ($40 vs $35 per 1K). The UI should cap results per search (e.g., max 200 restaurants per import) and show the admin how much of the $200/mo credit has been used.

**Cost controls:**
- Field mask: request only Advanced-tier fields (not reviews, ratings, or photos)
- Max pages per search: configurable, default 10 (200 restaurants)
- Monthly counter: track API calls, warn at 80% of budget
- No auto-pagination: admin explicitly clicks "Load more results"

**Alternatives considered:**
- No cost controls — risk blowing through $200 credit
- Strict per-day limits — too restrictive for initial data seeding of a new city

---
