# PostGIS POINT order & location_point sync

## Scope reviewed

SQL + TS construction/read sites for PostGIS coordinates across the repo:

- Migrations with PostGIS ops:
  - `infra/supabase/migrations/database_schema.sql:355-373` (restaurants table)
  - `infra/supabase/migrations/database_schema.sql:167-178` (eat_together_members)
  - `infra/supabase/migrations/071_generate_candidates_exclude_params.sql:106-196`
  - `infra/supabase/migrations/072_remove_swipe_feature.sql:120-212`
  - `infra/supabase/migrations/073_universal_dish_structure.sql:155-410`
  - `infra/supabase/migrations/088_group_candidates_open_now.sql:90-154`
- Web-portal write/read paths:
  - `apps/web-portal/lib/supabase.ts:29-46` (`formatLocationForSupabase`)
  - `apps/web-portal/lib/restaurantService.ts:100-107, 260-300`
  - `apps/web-portal/lib/import-service.ts:190-220`
  - `apps/web-portal/lib/export.ts:18-46`
  - `apps/web-portal/lib/google-places.ts:88-250, 440-445`
  - `apps/web-portal/lib/import-validation.ts:80-125`
  - `apps/web-portal/lib/csv-import.ts` (column order)
  - `apps/web-portal/app/admin/restaurants/[id]/page.tsx:60-80`
  - `apps/web-portal/app/admin/restaurants/page.tsx:310-332`
  - `apps/web-portal/app/admin/menu-scan/hooks/useReviewState.ts:100-125`
  - `apps/web-portal/app/onboard/basic-info/page.tsx:40-80`
  - `apps/web-portal/app/api/admin/import/google/route.ts:40-100`
  - `apps/web-portal/components/admin/RestaurantForm.tsx:200-400`
  - `apps/web-portal/components/admin/ImportAreaSelector.tsx:100-170`
  - `apps/web-portal/components/LocationPicker.tsx:1-180`
- Mobile read/write paths:
  - `apps/mobile/src/services/eatTogetherService.ts:18-250`
  - `apps/mobile/src/services/geoService.ts:1-192`
  - `apps/mobile/src/screens/BasicMapScreen.tsx:120-340, 520-610`
  - `apps/mobile/src/components/map/{RestaurantMarkers,DishMarkers}.tsx`
  - `apps/mobile/src/services/filterService.ts:30-40`
- Edge functions:
  - `infra/supabase/functions/feed/index.ts:560-760`
  - `infra/supabase/functions/nearby-restaurants/index.ts:1-307`
  - `infra/supabase/functions/group-recommendations/index.ts:140-330`
- Shared types: `packages/shared/src/types/restaurant.ts:1-5`
- Generated types: `packages/database/src/types.ts:1286-1360` (read-only)

## Findings

### REV-08-a: `restaurants.location_point` uses DEFAULT, not GENERATED — UPDATE leaves it stale
- Severity: high
- Category: correctness
- Location: `infra/supabase/migrations/database_schema.sql:365`
- Observation: The column is defined as
  `location_point USER-DEFINED DEFAULT (st_setsrid(st_makepoint(((location ->> 'lng')::double precision), ((location ->> 'lat')::double precision)), 4326))::geography`.
  There is no `GENERATED ALWAYS AS ... STORED` clause and no trigger in
  migrations 071–097 that syncs `location_point` when `location` changes
  (grep across `infra/supabase/migrations/` shows `GENERATED ALWAYS AS` only
  on `dishes.price_per_person` at `073_universal_dish_structure.sql:23`).
  Postgres `DEFAULT` expressions are evaluated only on INSERT when the
  column is omitted; they do not re-evaluate on UPDATE. So any UPDATE that
  mutates `location` without also writing `location_point` leaves
  `location_point` pointing at the old coordinates.
- Why it matters: every proximity path uses `r.location_point`, not
  `r.location` — `generate_candidates`, `generate_group_candidates`,
  `ST_DWithin`/`ST_Distance` sites in migrations 071/072/073/088 all read
  the geography column. If an owner relocates their restaurant after
  initial import (e.g., menu-scan address correction), distance ranking
  and radius filtering silently use the old coordinates indefinitely.
  Team docs assert "auto-computed" (`docs/project/06-database-schema.md:286,300`),
  and at least one design doc instructs new code to *not* set
  `location_point` explicitly
  (`.agents/planning/2026-04-10-admin-restaurant-ingestion/design/detailed-design.md:277`),
  so the invariant callers expect is not actually upheld on UPDATE.
- Suggested direction: a NEW migration should convert `location_point`
  to `GENERATED ALWAYS AS (...) STORED` (or add a BEFORE INSERT OR UPDATE
  trigger that recomputes it). Either option fixes all current and
  future writers without touching call-site code.
- Confidence: confirmed
- Evidence: schema dump at `database_schema.sql:365` shows `DEFAULT`; no
  trigger on `restaurants` found in migrations; docs use
  "auto-computed"/"generated" language that does not match the DEFAULT
  reality (`docs/project/06-database-schema.md:286,300,1256`;
  `.agents/research/codebase-review-2026-04-16/05-web-api-routes.md:56`
  and 05-web-api-routes REV-05-r already flagged the same inconsistency
  from a different angle).

### REV-08-b: Menu-scan review UPDATE patches `location` only — triggers the 08-a drift
- Severity: high
- Category: correctness
- Location: `apps/web-portal/app/admin/menu-scan/hooks/useReviewState.ts:104-122`
- Observation: When the reviewer edits restaurant address during
  menu-scan confirm, the code builds a patch object and sets
  `patch.location = formatLocationForSupabase(restaurantDetails.lat, restaurantDetails.lng)`
  (JSON shape `{lat,lng}`) at line 117, then calls
  `supabase.from('restaurants').update(patch).eq('id', ...)`. `location_point`
  is never written.
- Why it matters: combined with REV-08-a, every menu-scan address
  correction leaves `location_point` pointing at the original coordinates.
  Subsequent feed ranking, group-recommendations distance scoring, and
  nearby-radius filtering will use the stale point. The mismatch is
  silent — `location` (used for display) is correct, but the geography
  column used for math is wrong.
- Suggested direction: until the schema fix in 08-a lands, the patch
  should either include an explicit
  `location_point: \`POINT(${lng} ${lat})\`` alongside `location`, or the
  write path should go through a wrapper that always sets both.
- Confidence: confirmed
- Evidence: line 117 sets only `patch.location`; reading up from the
  surrounding `if (restaurantDetails.dirty)` block shows no separate
  `location_point` assignment.

### REV-08-c: Admin "open in Maps" URL uses wrong `location` cast — always falls back to address search
- Severity: medium
- Category: correctness
- Location:
  `apps/web-portal/app/admin/restaurants/[id]/page.tsx:74-78` and
  `apps/web-portal/app/admin/restaurants/page.tsx:326-330`
- Observation: `getMapsUrl` casts `restaurant.location` to
  `{ type?: string; coordinates?: [number, number] } | null` and
  destructures `loc.coordinates` as `[lng, lat]`. But the
  `restaurants.location` column is a plain jsonb `{lat,lng}` per the
  schema (`database_schema.sql:360`) and every writer
  (`import-service.ts:198-199`, `restaurantService.ts:273` via
  `formatLocationForSupabase(..., 'json')`, `RestaurantForm.tsx:215`).
  `loc.coordinates` is always `undefined`, so the function always takes
  the final fallback branch and produces a text-search URL instead of a
  `?q=lat,lng` URL.
- Why it matters: admin users expect the map pin/link to open on the
  actual coordinates; feature is silently degraded. Low severity on its
  own, but a clear signal that the GeoJSON `{type, coordinates}` mental
  model is leaking into places the jsonb `{lat,lng}` model is used.
- Suggested direction: cast to `{ lat?: number; lng?: number } | null`
  and build the URL from `lat`/`lng`. Better: introduce a typed helper
  in `@eatme/shared` that returns a maps URL from a `Location`.
- Confidence: confirmed
- Evidence: `database_schema.sql:360` (`location jsonb NOT NULL`) plus
  every insert path writing `{lat, lng}`.

### REV-08-d: `current_location` cast lies about the runtime shape
- Severity: medium
- Category: correctness
- Location:
  `apps/mobile/src/services/eatTogetherService.ts:22` (type `SessionMember.current_location`)
  and `apps/mobile/src/services/eatTogetherService.ts:220`
  (cast `m.current_location as { lat: number; lng: number } | null`)
- Observation: Column `eat_together_members.current_location` is a
  PostGIS geography column (USER-DEFINED at
  `database_schema.sql:172`; write path at line 237 uses WKT
  `` `POINT(${location.lng} ${location.lat})` ``). PostgREST returns
  geography/geometry columns as hex-EWKB strings by default, not as
  `{lat, lng}` objects. The cast at line 220 is therefore not a truthful
  type.
- Why it matters: current consumers
  (`apps/mobile/src/screens/eatTogether/SessionLobbyScreen.tsx:160, 214, 288`)
  only test truthiness (`m => m.current_location`), so the bug is latent.
  However, the type contract invites future code to read `.lat`/`.lng`
  directly, which will yield `undefined` at runtime and break location-aware
  UX for sessions. The Edge Function `group-recommendations/index.ts:154-166`
  has already had to handle WKT string inputs (see 08-e), showing the
  shape mismatch is real.
- Suggested direction: type `current_location` as `string | null`
  (the actual EWKB/WKT payload) and expose a helper
  `parseGeographyPoint(raw): {lat, lng} | null` that accepts both WKT and
  hex-EWKB, mirroring what the Edge Function already attempts.
- Confidence: likely (runtime shape is inferred from PostgREST defaults
  and the parsing logic already present in the Edge Function — see 08-e).

### REV-08-e: `parseLocation` in group-recommendations may not handle PostgREST's actual geography format
- Severity: medium
- Category: correctness
- Location: `infra/supabase/functions/group-recommendations/index.ts:154-166, 274-302`
- Observation: `parseLocation` handles two shapes:
  - object with `.lat`/`.lng` numbers (lines 156-160)
  - string starting with `"POINT"` parsed via regex
    `/POINT\(([^ ]+) ([^ ]+)\)/` (lines 161-164)
  Neither matches the hex-EWKB string PostgREST returns by default for
  geography columns (shape like `'0101000020E61000005F7D...'`). The
  member select at line 244 does not ST_AsText/ST_AsGeoJSON-cast
  `current_location`, so it will come back as hex. `parseLocation` then
  returns `null` for every member, `calculateSearchCenter` returns
  `null`, and the endpoint answers "Unable to determine search location
  — members must share location" (line 298) for every request.
- Why it matters: the group-recommendations flow is the whole point of
  Eat Together; if this path is broken, host-initiated recommendations
  always 400 even when every member has actively shared their location.
- Suggested direction: add a SQL-side cast when selecting, e.g.
  `select('user_id, is_host, current_location::text, ...')` (returns WKT
  which matches the existing regex branch) or add hex-EWKB decoding in
  `parseLocation` using a tiny WKB parser (first byte endianness, uint32
  type, two float64s).
- Confidence: needs-verification (PostgREST's default geography
  serialization in this Supabase project is not observable from code
  alone — a live response from `select current_location from
  eat_together_members` would resolve this immediately).
- Evidence: function matches a `POINT(…)` WKT string, but the select at
  line 244 asks for the raw geography column without a cast; local
  testing / a sample response is required to confirm the format.

### REV-08-f: Eager `POINT(${lng} ${lat})` WKT inserts depend on PostGIS text-cast into geography
- Severity: info
- Category: correctness
- Location:
  `apps/mobile/src/services/eatTogetherService.ts:153, 237`
- Observation: These two writers send
  `current_location: \`POINT(${lng} ${lat})\``
  as a WKT string to a geography column. PostGIS accepts this via
  implicit cast (`text::geography`) and defaults to SRID 4326 for WKT
  `POINT`. Migrations use the more explicit pattern
  `ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography`. The lng/lat
  order is correct.
- Why it matters: non-issue today; flagged only because swapping to
  `formatLocationForSupabase(..., 'point')` (also used by the web
  portal) would give a single code path and protect against future WKT
  typos.
- Suggested direction: optional — route both mobile writers through the
  same `formatLocationForSupabase(lat, lng, 'point')` helper that the
  web portal already uses.
- Confidence: confirmed

## No issues found in

- SQL `ST_MakePoint(p_lng, p_lat)` call sites in migrations 071/072/073/088
  — all pass `(lng, lat)` in the correct order.
- `apps/web-portal/lib/supabase.ts:45` `formatLocationForSupabase`
  emits `POINT(${lng} ${lat})` — correct.
- `apps/mobile/src/services/eatTogetherService.ts:153, 237` WKT
  construction — correct order (also see 08-f).
- `apps/web-portal/lib/import-service.ts:198-199` — stores
  `location: { lat, lng }` jsonb; relies on DEFAULT on INSERT only
  (INSERT path, so 08-a does not bite here).
- CSV import column ordering
  (`apps/web-portal/lib/import-validation.ts:88-125`,
  `apps/web-portal/lib/csv-import.ts`) — reads `latitude` column into
  `lat`, `longitude` into `lng`.
- Google Places mapping (`apps/web-portal/lib/google-places.ts:91-94,
  192-194, 442-443`) — `place.location.latitude/longitude` preserved
  into `latitude`/`longitude` fields without swap.
- Google import API route
  (`apps/web-portal/app/api/admin/import/google/route.ts:49-75, 98-100`)
  — validates lat ∈ [-90, 90], lng ∈ [-180, 180] and calls
  `nearbySearchRestaurants(lat, lng, …)` in that order.
- Feed Edge Function (`infra/supabase/functions/feed/index.ts:574-591`)
  — calls `supabase.rpc('generate_candidates', { p_lat, p_lng, ... })`
  by name; migration signature matches.
- nearby-restaurants Edge Function
  (`infra/supabase/functions/nearby-restaurants/index.ts:242-247`) —
  reads `restaurant.location.lat/lng` from jsonb; Haversine arg order
  `(lat1, lng1, lat2, lng2)` matches its own signature (lines 69-80).
- Mapbox integration in mobile
  (`apps/mobile/src/screens/BasicMapScreen.tsx:140, 161, 245, 334, 399,
  607-608`, `RestaurantMarkers.tsx`, `DishMarkers.tsx`,
  `filterService.ts:33`) — Mapbox expects `[lng, lat]` and all sites
  pass that order.
- Leaflet integration in web portal
  (`apps/web-portal/components/LocationPicker.tsx:85, 93, 103, 106, 108,
  124`,
  `apps/web-portal/components/admin/ImportAreaSelector.tsx:131-142`) —
  Leaflet expects `[lat, lng]` and all sites pass that order.
- Shared `Location` type (`packages/shared/src/types/restaurant.ts:1-5`)
  — `{lat, lng}` with doc comment naming the DB invariant.
- `docs/supabase-setup.md:603-609` — shows the wrong order only as an
  explicit "❌ Wrong" negative example; correct order immediately after.
- `apps/web-portal/app/onboard/basic-info/page.tsx:62` — saves
  `{lat, lng}` in the correct order.
- `apps/web-portal/components/admin/RestaurantForm.tsx:215, 343-344,
  390-391` — keeps `lat`/`lng` as named fields through the form
  pipeline, never relies on positional tuples.

## Follow-up questions

- **For REV-08-a/b**: is `location_point` kept in sync in production by
  something outside this migration set (e.g., a manually-applied trigger
  that is missing from the repo)? A quick `pg_trigger` inspection would
  resolve this in seconds; if there is no such trigger, this is a real,
  silent correctness bug on every restaurant relocation.
- **For REV-08-d/e**: what does
  `select current_location from eat_together_members limit 1` actually
  return through the Supabase PostgREST proxy — hex EWKB, WKT, or
  GeoJSON? The answer determines whether `parseLocation` in the Edge
  Function is a no-op for every request.
- **For REV-08-c**: does any other admin surface read `restaurant.location`
  through the same incorrect `{type, coordinates}` cast? Grep hit only
  two sites, but the pattern hints at a shared mental model drift worth
  checking during any future touch on admin list/detail components.
