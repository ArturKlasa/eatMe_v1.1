---
status: resolved
trigger: "In the mobile app I don't see restaurants even though they are near me, are open, and I don't have any filters on"
created: 2026-05-21
updated: 2026-06-24
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED (cycle 3). Restaurants added via the Admin menu-scan flow are saved with empty open_hours ({}). The `feed` Edge Function hard-filters the dish pool with isOpenNow() (feed/index.ts:877), and isOpenNow() returns false for null/empty open_hours. So every dish from a menu-scanned restaurant is excluded from the feed permanently — the feed returns dishes:0 for them. The mobile map's dish markers and recommended-dish footer are driven by feed dishes, so these restaurants never appear in dish-centric views.
test: Queried the live remote DB + called the live generate_candidates RPC and the live feed Edge Function with the user's coordinates.
expecting: DB healthy; generate_candidates returns the restaurant's dishes; feed returns the restaurant in `restaurants` but with dishes:0; the restaurant's open_hours is empty.
next_action: RESOLVED 2026-06-24. User deployed the feed Edge Function, redeployed the admin app, and ran the open-hours backfill, then confirmed on-device that recently-added restaurants now appear on the mobile map. No further action.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: Recently-added restaurants that are nearby and open should appear on the mobile Map view when no filters are applied.
actual: Only restaurants added a long time ago appear on the map. Recently-added restaurants do not show up, despite being nearby, open, and with no filters active.
errors: Not yet checked (user has not inspected dev console or network logs).
reproduction: Open the mobile app, navigate to the Map view; recently-added nearby restaurants are missing while older ones render.
started: Unknown — user cannot pinpoint when it began. Note: ingredient-pipeline Phase A retirement landed 2026-05-17; possible correlation (now ruled out — see Eliminated).

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- timestamp: 2026-05-21 — Ingredient-pipeline Phase A retirement: NOT the cause. The feed/nearby-restaurants Edge Functions do not touch the ingredient tables.
- timestamp: 2026-05-21 — PostGIS POINT shape mismatch: NOT the cause. restaurants.location is jsonb {lat,lng}; the PostGIS geography is the separate location_point column. Shapes match.
- timestamp: 2026-05-21 — primary_protein / dish_kind NOT NULL enum: NOT the cause. Verified on live data — El Crustaceo's 41 dishes all have valid primary_protein (shellfish/fish/vegetarian/chicken/vegan), dish_kind='standard', is_template=false.
- timestamp: 2026-05-21 — Admin "Add New Restaurant" form: NOT the cause. Insert omits status, so DB default 'published' applies.
- timestamp: 2026-05-21 — CYCLE 2: status='draft' as the whole story: NOT the whole cause. adminPublishRestaurant correctly flips status to 'published'.
- timestamp: 2026-05-21 — CYCLE 2: nearby-restaurants Edge Function status filter: NOT the cause. That function is not on the mobile map's data path; the map uses the `feed` function.
- timestamp: 2026-05-21 — CYCLE 2: location_point NULL on imports: NOT the cause. location_point has a column DEFAULT; imported rows get a valid geography. Verified: feed returns El Crustaceo with a valid location {lat,lng}.
- timestamp: 2026-05-21 — CYCLE 2 conclusion (dish-less imports): TRUE for bulk Google Places imports (0 dishes) but NOT the user's actual case. The user adds restaurants WITH dishes via Admin menu scan (El Crustaceo has 41 published dishes). Cycle 2 chased the bulk-import path; the real symptom is menu-scan restaurants WITH dishes.
- timestamp: 2026-05-21 — CYCLE 2 secondary note ("open_hours is NOT the cause"): INCORRECT — superseded by cycle 3. Cycle 2 only checked whether open_hours gates restaurant PINS (it does not). It does gate the DISH pool (feed/index.ts:877), which is what drives the dish-centric map views and the recommended-dishes footer. open_hours IS the root cause.
- timestamp: 2026-05-21 — Stale deployed feed function: NOT the cause. The live feed function's behaviour (returns restaurants, dishes:0, crashes on missing `filters`) matches the repo source at infra/supabase/functions/feed/index.ts.

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-05-21 — Mobile map data path: BasicMapScreen -> getCombinedFeed -> `feed` Edge Function (POST /functions/v1/feed, mode='combined'). Restaurant pins: mode==='restaurant' renders RestaurantMarkers from mapPinRestaurants (<- filteredRestaurants <- feed.restaurants). Dish pins: otherwise renders DishMarkers from mapPinDishes (<- feedDishes <- feed.dishes). BasicMapScreen.tsx:249-280, :639-644.
- timestamp: 2026-05-21 — CYCLE 1/2 (superseded for this user's case): bulk Google Places import inserts dish-less restaurants as status='draft'. Real but a different issue from the reported symptom.

### Cycle 3 — live-data investigation (the real root cause)

- timestamp: 2026-05-21 — User clarified the add path: restaurants are created via "menu scan in Admin panel", and "everything shows as published in the admin UI, yet still no map pin".
- timestamp: 2026-05-21 — Both apps point at the REMOTE Supabase project tqroqqvxabolydyznewa.supabase.co (apps/mobile/.env, apps/admin/.env.local). The local Supabase (port 54322) is empty and unused — a red herring.
- timestamp: 2026-05-21 — Live DB: 179 restaurants total. Recent ones (created 2026-05-19): a mix of status='draft' dish-less Google Places imports AND status='published' restaurants WITH dishes — e.g. El Crustaceo (published, 41 dishes), Enjoy coffee (published, 36), LAWA Cocina Ecuatoriana (published, 11).
- timestamp: 2026-05-21 — Live DB: El Crustaceo's 41 dishes are ALL status='published', is_available=true, dish_kind='standard', is_template=false, with valid primary_protein. The restaurant + dish data is completely healthy.
- timestamp: 2026-05-21 — Live RPC: generate_candidates(p_lat=19.4246,p_lng=-99.1496,p_radius_m=2000) returns 145 candidate rows across 5 restaurants, 34 of them El Crustaceo's. The DB candidate layer surfaces the restaurant fine.
- timestamp: 2026-05-21 — Live feed function, mode='combined', proper request (with `filters` object), at El Crustaceo coords AND at the mobile default coords: returns 7-8 restaurants INCLUDING El Crustaceo / Enjoy coffee / LAWA, each with a valid location {lat,lng} — but returns dishes:0 and every restaurant flagged is_open:false.
- timestamp: 2026-05-21 — feed/index.ts:877 — `const dishPool = diversified.filter(d => isOpenNow(openHoursMap.get(d.restaurant_id)))`. The dish result is built ONLY from dishPool. Comment at :874-876 states this is intentional ("a dish you can't buy right now is not a useful recommendation").
- timestamp: 2026-05-21 — feed/index.ts:604 isOpenNow(): `if (!openHours) return false;` then `const entry = openHours[today]; if (!entry) return false;`. So isOpenNow(null) === false AND isOpenNow({}) === false. A restaurant with null or empty open_hours is treated as permanently closed.
- timestamp: 2026-05-21 — Live DB: El Crustaceo, Enjoy coffee, LAWA all have open_hours = {} (empty). Across all 80 published restaurants: 40 have populated open_hours, 40 have empty/NULL. The menu-scan / import flow does not capture opening hours.
- timestamp: 2026-05-21 — CONSEQUENCE: every menu-scanned restaurant (open_hours={}) is permanently "closed" per isOpenNow, so 100% of its dishes are dropped from dishPool -> feed returns dishes:0 for it, at every time of day. Older restaurants have real open_hours and their dishes appear when currently open. This is exactly "I see only restaurants added a long time ago".
- timestamp: 2026-05-21 — Restaurant pins (feed/index.ts:925-943) are built from `diversified` (before the isOpenNow dish filter), so menu-scanned restaurants ARE returned in feed.restaurants with is_open:false. In restaurant view mode they would render as "closed"-styled pins (RestaurantMarkers.tsx does not hide closed). The symptom manifests in dish view mode (DishMarkers fed by feedDishes=0) and in the MapFooter recommended-dishes list (also fed by feedDishes=0).
- timestamp: 2026-05-21 — Side bug found: the feed function crashes with "Cannot read properties of undefined (reading 'spiceTolerance')" at feed/index.ts:777 (`filters.spiceTolerance`) when a request omits the `filters` field entirely. The mobile app always sends `filters`, so it does not hit this — but the function should default `filters` to `{}`.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: Restaurants added through the Admin menu-scan / Google Places import flow are saved with an empty open_hours ({}) — the import captures dishes and basic restaurant fields but never opening hours. The `feed` Edge Function (the sole data source for the mobile map) unconditionally filters its dish pool to "open now" restaurants (feed/index.ts:877, by design per the comment at :874-876). Its isOpenNow() helper (feed/index.ts:604) returns false for any null or empty open_hours. Therefore every menu-scanned restaurant is treated as permanently closed and 100% of its dishes are excluded from the feed — feed returns dishes:0 for them at all times. The mobile map's dish markers (DishMarkers <- feedDishes) and the recommended-dishes footer (MapFooter <- feedDishes) are driven by that dish list, so menu-scanned restaurants are invisible there. Older restaurants are visible because they have populated open_hours (40 of 80 published restaurants do; the other 40, the recent ones, do not). The restaurant itself, its status, its dishes, its primary_protein/dish_kind, and its location are all healthy and correct — the single missing field is open_hours.

fix: Applied the data-correctness fix set (user chose to capture real hours rather than soften isOpenNow semantics):
  1. Capture-on-import — apps/admin/src/app/(admin)/imports/actions/places.ts now requests `places.regularOpeningHours` in the Places API FieldMask and maps it onto the new restaurant's open_hours. New helper apps/admin/src/lib/google/openingHours.ts (mapGoogleOpeningHours) converts Google's regularOpeningHours.periods to the open_hours jsonb shape (lowercase day keys, 24h HH:MM spans; handles overnight close, 24h days, and split hours).
  2. Backfill — new infra/scripts/backfill-open-hours.ts fetches regularOpeningHours from the Google Places Details API for every restaurant with a google_place_id and empty/NULL open_hours, and writes the mapped hours back. Supports --dry-run. package.json gains a `backfill-open-hours` script.
  3. Crash guard — infra/supabase/functions/feed/index.ts:634 now defaults `filters` to `{}` so a request missing the filters field no longer throws "Cannot read properties of undefined (reading 'spiceTolerance')".
  NOT done by design: isOpenNow() semantics were left unchanged (user declined the "unknown hours = open" runtime fallback). Consequence: a restaurant Google has no hours for at all stays invisible until hours are entered manually; and a restaurant with real hours still won't surface its dishes while it is currently closed (intended behaviour).

verification: VERIFIED RESOLVED 2026-06-24. Static checks (done during the fix): admin `tsc --noEmit` passes, infra/scripts `tsc --noEmit` passes, eslint clean on changed admin files, mapGoogleOpeningHours unit-sanity-checked (normal, overnight, 24h, split-hours, empty). Human verification (2026-06-24): user (a) deployed the feed Edge Function and (b) redeployed the admin app, then confirmed on-device that the recently-added restaurants now appear on the mobile map. The reported symptom is resolved.

BACKFILL COMPLETE — all three remediation steps are done. User ran `pnpm backfill-open-hours` (2026-06-24/25) to populate open_hours for the pre-existing restaurants that were imported with empty/NULL hours (~40 of 80 published at cycle-3 investigation time). Combined with the capture-on-import fix (covers restaurants imported after the admin redeploy) and the deployed feed function, the open_hours gap is closed for both old and new restaurants.
files_changed:
  - infra/supabase/functions/feed/index.ts
  - apps/admin/src/app/(admin)/imports/actions/places.ts
  - apps/admin/src/lib/google/openingHours.ts (new)
  - infra/scripts/backfill-open-hours.ts (new)
  - infra/scripts/package.json
