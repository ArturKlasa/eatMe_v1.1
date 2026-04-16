# REV-05: web-api-routes

Web-portal server API surface outside the menu-scan pipeline (which was reviewed
in REV-04). Covers the ingredients admin endpoint, bulk restaurant import
(CSV + Google Places), the shared import service, and the request-validation /
auth helpers they rely on. No Next.js Server Actions (`'use server'`) exist
in `apps/web-portal/` — all mutations flow through Route Handlers under
`app/api/`. Read-only pass.

## Scope reviewed

- `apps/web-portal/app/api/ingredients/route.ts` (full, 123 lines)
- `apps/web-portal/app/api/admin/import/csv/route.ts` (full, 75 lines)
- `apps/web-portal/app/api/admin/import/google/route.ts` (full, 154 lines)
- `apps/web-portal/app/api/admin/import/csv/route.test.ts` (first 50 lines, structure only)
- `apps/web-portal/lib/import-service.ts` (full, 344 lines)
- `apps/web-portal/lib/import-validation.ts` (full, 98 lines)
- `apps/web-portal/lib/csv-import.ts` (full, 151 lines)
- `apps/web-portal/lib/google-places.ts` (full, 519 lines)
- `apps/web-portal/lib/import-types.ts` (full, 76 lines)
- `apps/web-portal/lib/supabase-server.ts` (full, 134 lines)
- Cross-reference: `infra/supabase/migrations/database_schema.sql:365` for
  `restaurants.location_point` generated-column definition;
  `infra/supabase/migrations/080_restaurant_import.sql` for
  `restaurant_import_jobs` and `google_api_usage` table definitions.
- Server-action search: `rg "'use server'" apps/web-portal` returned no
  results — all writes go through the Route Handlers above.

## Findings

### REV-05-a: Bounding-box dedup query does text comparison on `location->>lat`/`lng`, silently misses nearby rows
- Severity: medium
- Category: correctness
- Location: `apps/web-portal/lib/import-service.ts:74-81`.
- Observation: the dedup fetch filters with
  `.filter('location->>lat', 'gte', String(minLat))` and similar for the
  other three bounds. `location->>lat` is a `jsonb ->> text` expression,
  which returns `text`. PostgREST passes the bound as a string literal,
  so Postgres does a text-wise comparison, not a numeric one.
- Why it matters: the bounding box around `(lat=19.39, lng=-99.167)` is
  `minLat=-99.169, maxLng=-99.165`. As strings: `'-99.165' < '-99.169'`
  (because `'5' < '9'` at position 6), so a restaurant with
  `location->>lng = '-99.165'` fails `lng >= '-99.169'` in text order
  and is excluded from the dedup candidate set, even though it sits
  inside the intended 200-m box. The bug is worse for any two values
  of different decimal widths (e.g. `'-99.1'` vs `'-99.10'`). Net effect:
  the fuzzy-name + proximity dedup can **fail to detect a
  duplicate**, so both the incoming row and the existing one persist.
- Suggested direction: cast the JSON field to numeric in the filter —
  PostgREST supports `location->>lat::numeric`; or move `lat`/`lng` to
  dedicated `double precision` columns (or rely on `location_point`
  PostGIS column) and filter on those; or fetch by an RPC that uses
  `ST_DWithin(location_point, ST_MakePoint(lng, lat)::geography, 200)`.
- Confidence: confirmed
- Evidence: `import-service.ts:74-81`; `database_schema.sql:365`
  defines `location_point` as a generated geography column —
  proximity math should use it rather than the text-cast JSON keys.

### REV-05-b: `incrementApiUsage` is a read-modify-write — concurrent imports lose increments
- Severity: medium
- Category: correctness
- Location: `apps/web-portal/lib/google-places.ts:485-518`.
- Observation: the function `SELECT`s the current row, then UPDATEs with
  `api_calls = (existing.api_calls ?? 0) + calls`. Two concurrent admin
  imports that both read `api_calls = 50`, both compute `50 + 10 = 60`
  and both write `60` — the second call's +10 is lost. The `UNIQUE (month)`
  constraint at `080_restaurant_import.sql:59` prevents duplicate rows
  but doesn't guard against lost updates on the same row.
- Why it matters: the monthly call count drives both the admin-visible
  budget warning (`> 900 calls`) in
  `app/api/admin/import/google/route.ts:86-89` and the monthly cost
  estimate persisted in `google_api_usage.estimated_cost_usd`. Two
  admins running large imports on the same day can silently drift the
  counter below reality, delaying the "approaching 1000-call limit"
  alert. Billing drift is small per row but compounds over a month.
- Suggested direction: do it atomically: single `INSERT ... ON CONFLICT
  (month) DO UPDATE SET api_calls = google_api_usage.api_calls +
  EXCLUDED.api_calls, estimated_cost_usd = google_api_usage.estimated_cost_usd
  + EXCLUDED.estimated_cost_usd` via `supabase.rpc(...)` or PostgREST's
  upsert with `ignoreDuplicates:false` plus an atomic add expression.
  Alternatively, move the increment to a Postgres function.
- Confidence: confirmed
- Evidence: `google-places.ts:495-509` (SELECT then UPDATE with plus);
  migration `080_restaurant_import.sql:53-60` (UNIQUE on month).

### REV-05-c: No `maxDuration` on either import Route Handler — bulk imports will be killed by the default Vercel 10-s limit
- Severity: medium
- Category: dx
- Location: `apps/web-portal/app/api/admin/import/google/route.ts`
  and `apps/web-portal/app/api/admin/import/csv/route.ts` (no
  `export const maxDuration` anywhere).
- Observation: the Google POST path does up to 10 `maxPages` of Google
  Places calls (`route.ts:76-81`), each with its own backoff retry
  (`google-places.ts:148-163`), followed by a dedup round-trip, a
  `restaurants` batch insert, and audit-log write. The CSV path parses
  the entire file into memory, validates, dedups, batch-inserts — all
  synchronously. Realistic large-scale imports take 15-60 s; Vercel's
  default Hobby timeout is 10 s, Pro is 60 s.
- Why it matters: the request is killed mid-insert. Some rows make it
  in (the batch insert is a single statement so usually all-or-nothing),
  but the audit log / import-job row may not, leaving the DB without a
  record of what happened. The admin sees no response — the same
  failure mode as REV-04-e but for the import routes.
- Suggested direction: export `maxDuration = 60` (or 300 on Pro) from
  each route. For very large CSVs, upload to Storage and process via a
  background worker / Supabase Edge Function instead of doing it
  inline.
- Confidence: likely
- Evidence: `grep -n "maxDuration" apps/web-portal/app/api` shows only
  `menu-scan/confirm/route.ts:15` — the import routes are bare.

### REV-05-d: CSV route reads the full uploaded file into memory with no size cap — OOM / DoS surface even for admins
- Severity: medium
- Category: security
- Location: `apps/web-portal/app/api/admin/import/csv/route.ts:31-41`
  + `apps/web-portal/lib/csv-import.ts:43-47`.
- Observation: the route does `await (file as File).arrayBuffer()` and
  passes the entire string to Papa.parse synchronously with
  `header: true, skipEmptyLines: true` — no streaming, no size check,
  no row-count cap. Vercel's platform cap (4.5 MB Hobby / 50 MB Pro)
  sets an upper bound on the HTTP body, but nothing in the app layer
  bounds memory usage. For a 50 MB CSV the route decodes two 50-MB
  copies (UTF-8 then the Papa-parse working buffer) and allocates one
  MappedRestaurant per row.
- Why it matters: even with admin-only access, a runaway script or a
  mis-pasted CSV can OOM the Lambda. More consequentially, because
  there's no row-count ceiling, validation errors produced for every
  row blow up the response body and the audit-log `new_data` JSONB
  entry at `import-service.ts:300-313` (which already stores up to
  thousands of error objects).
- Suggested direction: reject requests with `Content-Length` above
  (e.g.) 10 MB early, cap the number of rows, and stream the parse
  (`Papa.parse(stream, { step: ... })`) rather than materializing the
  whole array. Truncate the `errors` array written to
  `admin_audit_log` and `restaurant_import_jobs`.
- Confidence: confirmed
- Evidence: `csv/route.ts:31-41` reads entire body; `csv-import.ts:43-47`
  parses full string; no early-return on size anywhere in either file.

### REV-05-e: `deduplicateRestaurants` uses `Math.min(...lats)` spread — stack overflow on large CSV imports
- Severity: low
- Category: correctness
- Location: `apps/web-portal/lib/import-service.ts:64-69`.
- Observation: `const minLat = Math.min(...lats) - 0.002` spreads the
  `lats` array into arguments. V8's call-stack argument limit is
  ~125 k on Node but some engines cap much lower. A large CSV with
  100 k+ rows would crash with `RangeError: Maximum call stack size
  exceeded`.
- Why it matters: low risk given the CSV size cap from REV-05-d, but
  worth fixing alongside it. Fails noisily rather than silently, so
  acceptable as-is if a row-count ceiling is added.
- Suggested direction: replace with a single reduce:
  `const minLat = lats.reduce((m, v) => Math.min(m, v), Infinity)`.
  Same for `maxLat`, `minLng`, `maxLng`.
- Confidence: confirmed
- Evidence: `import-service.ts:66-69`.

### REV-05-f: Google Places overnight hours drop the cross-midnight close time
- Severity: low
- Category: correctness
- Location: `apps/web-portal/lib/google-places.ts:358-410`.
- Observation: for a period where `close.day !== open.day` (e.g. open
  Fri 18:00, close Sat 02:00), `closeMin` stays as `120` (= 02:00).
  The per-day aggregation at line 398-399 then picks
  `latestClose = Math.max(...ranges.map(r => r.closeMin))`. If Friday
  also has a daytime period open 08:00-15:00 (closeMin=900), then
  `Math.max(120, 900) = 900`, i.e. the code reports Friday closes at
  15:00 — losing the late-night session entirely.
- Why it matters: restaurants with bar/late-night hours show incorrect
  closing times in the feed's open-now filter
  (`generate_candidates`-style RPCs). The user-visible effect is
  "this place is closed" when it actually isn't. The
  `088_group_candidates_open_now.sql` migration relies on the
  `open_hours` JSON being accurate.
- Suggested direction: store multiple sessions per day
  (`Record<day, { open, close }[]>`) rather than flattening to a single
  range; or, at minimum, handle the overnight case by writing the
  post-midnight session onto the next day. The current open_hours
  schema is `Record<day, { open, close }>` (single session), so a
  schema change is needed.
- Confidence: confirmed
- Evidence: `google-places.ts:378-390` sets `closeMin` without day
  bookkeeping; line 398-399 reduces to a single range; `import-types.ts:20`
  shows the open_hours type is single-range per day.

### REV-05-g: `import-validation.ts` accepts arbitrary strings in `website` / `phone` — `javascript:` URIs can reach the UI
- Severity: low
- Category: security
- Location: `apps/web-portal/lib/import-validation.ts:28-29` +
  persistence at `import-service.ts:204-205`.
- Observation: the Zod schema declares `website: z.string().optional()`
  with no URL validation. The CSV parser at `csv-import.ts:128` accepts
  any trimmed string for the `website` column. The value persists to
  `restaurants.website` and (depending on the rendering layer) may be
  applied as an `<a href>`. A `javascript:alert(1)` value round-trips.
- Why it matters: XSS on the admin dashboard (or wherever the restaurant
  link is rendered) requires a user to click, but because CSVs are
  admin-imported the trust model is "an admin vouched for this data".
  React's JSX escapes the text content, but `href` is not auto-sanitized
  in React 19 — a malicious value flows through to the browser's URL
  parser unchanged.
- Suggested direction: enforce `z.string().url()` (or
  `z.string().regex(/^https?:\/\//)`) in the Zod schema and reject rows
  that fail. For phones, at minimum strip control characters and cap
  length.
- Confidence: needs-verification
- Evidence: `import-validation.ts:28-29` is permissive; the specific
  render path that turns `website` into an `<a href>` was not read in
  this review pass — see Follow-up questions.

### REV-05-h: Ingredients POST error responses leak raw Postgres messages
- Severity: low
- Category: security
- Location: `apps/web-portal/app/api/ingredients/route.ts:67-70`.
- Observation: on `canonical_ingredients` insert failure the route
  returns `{ error: \`Failed to create ingredient: ${ingError?.message}\` }`.
  If the underlying race (admin checks via `ilike` at line 41-45,
  another admin then inserts, then this admin inserts) triggers the
  `canonical_name UNIQUE` constraint, the client receives the full PG
  message including the constraint name.
- Why it matters: weak. Endpoint is admin-only so risk is muted; the
  main cost is developer confusion when the "already exists" branch
  (line 47-52) and the 500 branch emit different shapes for what is
  morally the same condition.
- Suggested direction: detect `23505` (unique violation) from the
  Supabase error code and convert to a 409 with a stable message.
  Also return a generic 500 for other failures and log the detail
  server-side.
- Confidence: confirmed
- Evidence: `ingredients/route.ts:67-70`; `database_schema.sql:45`
  confirms `canonical_name text NOT NULL UNIQUE`.

### REV-05-i: Ingredients POST TOCTOU between ilike-check and insert
- Severity: low
- Category: correctness
- Location: `apps/web-portal/app/api/ingredients/route.ts:41-71`.
- Observation: the route does `SELECT ... ILIKE cleanName` (line 44),
  returns 409 if found, otherwise `INSERT`. Two concurrent requests
  with the same name both see "not found" and race on the insert —
  one wins by the UNIQUE constraint, the other gets a 500 via the
  path in REV-05-h.
- Why it matters: the 500 from the loser request is misleading but the
  data integrity is preserved by the UNIQUE constraint. Fixing is
  cheap: use `upsert({...}, { onConflict: 'canonical_name', ignoreDuplicates: false })`
  and then check whether the returned row matches the requested one.
- Suggested direction: swap the `SELECT → INSERT` pair for a single
  `upsert(..., { onConflict: 'canonical_name' })` and return 409 if
  the returned row's id predates this request (or just return the
  existing row every time).
- Confidence: confirmed
- Evidence: `ingredients/route.ts:41-71`.

### REV-05-j: Ingredients alias insert doesn't de-duplicate across ingredients — UNIQUE on `ingredient_aliases.display_name` likely collides
- Severity: low
- Category: correctness
- Location: `apps/web-portal/app/api/ingredients/route.ts:96-114` +
  `infra/supabase/migrations/database_schema.sql:236` (FK, not
  uniqueness — see evidence).
- Observation: the route builds `allAliases` from the canonical name
  plus user-supplied `extra_aliases` and inserts them as
  `ingredient_aliases` rows without conflict handling. If another
  canonical ingredient already owns an alias with the same
  `display_name` — and `ingredient_aliases` has a `display_name`
  UNIQUE index — the insert throws and the warning path at line
  111-114 logs but returns 200 (the ingredient exists without any
  aliases). If there's no UNIQUE, two rows persist and the lookup
  becomes ambiguous.
- Why it matters: either way the alias table is broken: either no
  aliases for this ingredient (making the scan's `bulkLookupAliases`
  miss), or duplicate aliases that map the same string to two
  canonical ingredients nondeterministically. The existence of
  UNIQUE on `ingredient_aliases.display_name` is unverified (only the
  FK is visible in the schema dump).
- Suggested direction: confirm the unique constraints on
  `ingredient_aliases`; if `display_name` is unique, use `upsert` and
  return a warning if any alias was already owned by a different
  ingredient. If it isn't unique, add one in a new migration and gate
  the insert with `onConflict`.
- Confidence: needs-verification
- Evidence: `ingredients/route.ts:96-114`; `database_schema.sql:236`
  (FK only).

### REV-05-k: Google/CSV route returns full PG error message via import summary on batch-insert failure
- Severity: low
- Category: security
- Location: `apps/web-portal/lib/import-service.ts:219-240`.
- Observation: when the bulk `restaurants` insert fails (`insertError`),
  the handler pushes `insertError.message` into every per-row error
  and into each `ImportedRestaurantSummary.error`, then returns them
  to the client. Postgres-side errors typically include the column or
  constraint name (`insert or update on table "restaurants" violates
  foreign key constraint "restaurants_owner_id_fkey"`), revealing
  schema details.
- Why it matters: admin-only surface so risk is limited, but the same
  generic-error discipline as REV-04-p would avoid leaking DB internals
  if an admin session is ever exposed.
- Suggested direction: log the full error server-side, return a stable
  code + generic message to the client.
- Confidence: confirmed
- Evidence: `import-service.ts:224-240` — `insertError.message`
  assigned to every row.

### REV-05-l: `incrementApiUsage` fails silent — counter drift, no surfaced error
- Severity: low
- Category: maintainability
- Location: `apps/web-portal/app/api/admin/import/google/route.ts:142-144`.
- Observation: `await incrementApiUsage(supabase, apiCallsUsed).catch(() => null)`
  swallows all errors. If the monthly row's UPDATE fails (permission,
  type, constraint), the import succeeds but the counter is wrong —
  silently forever.
- Why it matters: budget / cost reporting drifts and no one notices.
- Suggested direction: keep the `.catch()` but log the error with a
  distinctive prefix so monitoring can surface it; or accept the cost
  and return a `warnings` entry in the summary.
- Confidence: confirmed
- Evidence: `google/route.ts:143`.

### REV-05-m: Google import body has no `textQuery` length / char cap
- Severity: low
- Category: security
- Location: `apps/web-portal/app/api/admin/import/google/route.ts:52-56`.
- Observation: `textQuery` is accepted as any non-empty string and
  forwarded to Google's search endpoint. There is no length cap and
  no filtering — an admin can paste megabytes of text and Google will
  accept/trim on its side, or reject. No injection risk (Google handles
  escaping), but the body size of the POST can be unbounded.
- Why it matters: cosmetic / DX — a maliciously crafted textQuery can
  trip Google's own content filters or log noise. Low risk.
- Suggested direction: cap to 500 chars (`body.textQuery.slice(0, 500)`)
  before forwarding and reject obviously-bogus inputs (null bytes,
  newlines).
- Confidence: confirmed
- Evidence: `google/route.ts:52-56`.

### REV-05-n: Google Places `page=0` failure is swallowed silently — import proceeds with empty result
- Severity: low
- Category: correctness
- Location: `apps/web-portal/app/api/admin/import/google/route.ts:96-127`.
- Observation: the page loop catches any error other than 403 and
  continues (`console.error(...)` only). For `maxPages = 1` (the
  default), a first-page failure produces `allMapped = []` and the
  route returns a success summary with `inserted: 0` — the admin can't
  tell whether the search yielded zero places or failed entirely.
- Why it matters: UX confusion. An expired API key or mis-typed
  address produces the same response as "no matching places".
- Suggested direction: if page 0 fails and `allMapped.length === 0`,
  return 502 with a clear error; or always surface the error string
  in the summary's `warnings`.
- Confidence: confirmed
- Evidence: `google/route.ts:116-127`.

### REV-05-o: No per-restaurant ownership check — matches REV-04-i, applies to all admin routes in scope
- Severity: info
- Category: security
- Location: `apps/web-portal/app/api/ingredients/route.ts:6-8`,
  `apps/web-portal/app/api/admin/import/csv/route.ts:8-14`,
  `apps/web-portal/app/api/admin/import/google/route.ts:15-22`.
- Observation: every route relies on `verifyAdminRequest` which checks
  only `app_metadata.role === 'admin'`. Same trust model as REV-04-i —
  if the admin role is ever expanded to per-tenant admins, these routes
  need tenant-scoped checks.
- Why it matters: see REV-04-i.
- Suggested direction: confirm trust model; if multi-tenant admins are
  possible, add a tenant association check.
- Confidence: needs-verification
- Evidence: handler signatures above; `supabase-server.ts:121-123`.

### REV-05-p: `verifyAdminRequest` type lies about `error` when success
- Severity: info
- Category: maintainability
- Location: `apps/web-portal/lib/supabase-server.ts:99-103`.
- Observation: the discriminated union is typed as
  `{ user; error: null } | { user: null; error: string; status }`.
  Every caller matches against `auth.error` (truthy / falsy); callers
  like CSV/Google route also guard `!auth.user` (line `csv/route.ts:9`)
  even though the type guarantees `user !== null` when `error === null`.
  This redundancy is noise; but the related extraction route at
  `menu-scan/route.ts:581-584` (REV-04-j) exposed that some callers
  *don't* read `auth.status` at all.
- Why it matters: low — a simple shape the reader can eventually trust.
  But the inconsistent handling across routes (`?? 401`, `?? 'Unauthorized'`)
  is cargo-culting.
- Suggested direction: change the success branch to return only `user`
  (no `error` field) and export a typed helper `requireAdmin(request)`
  that throws a `NextResponse` on failure so each route is one-line
  `const user = await requireAdmin(request);`.
- Confidence: confirmed
- Evidence: `supabase-server.ts:98-133`; `csv/route.ts:9-14`;
  `google/route.ts:16-22`.

### REV-05-q: `deduplicateRestaurants` doesn't scope nearby lookup by tenant / country
- Severity: info
- Category: correctness
- Location: `apps/web-portal/lib/import-service.ts:74-81`.
- Observation: the nearby query filters by bounding box alone — not by
  `country_code` or any tenant key. Two restaurants on opposite sides
  of the antimeridian with similar names could theoretically collide
  if their lat/lng differ by less than the 0.002 buffer. Realistic
  chance is tiny, but the code doesn't rule it out.
- Why it matters: not a practical bug but a latent one for
  international expansion.
- Suggested direction: when REV-05-a is fixed via a PostGIS RPC, add
  a `country_code` filter (or use `ST_DWithin` which inherently handles
  geodesics correctly).
- Confidence: confirmed
- Evidence: `import-service.ts:74-81`.

### REV-05-r: CSV import stores `location` as JSONB but DB has generated `location_point` — still correct, but confusing comment
- Severity: info
- Category: maintainability
- Location: `apps/web-portal/lib/import-service.ts:195-217` +
  `infra/supabase/migrations/database_schema.sql:365`.
- Observation: the insert writes `location: { lat: r.latitude, lng: r.longitude }`
  with a "CRITICAL: do NOT set location_point" comment. The generated
  column `location_point` at `database_schema.sql:365` derives
  `(location ->> 'lng')::double precision, (location ->> 'lat')::double precision`
  — PostGIS POINT order is honored by the database, not by this code.
  So the import is correct. But the comment could be read as "PostGIS
  is handled elsewhere, trust us" — which is only true because of the
  generated column's definition, which is buried in the schema dump.
- Why it matters: no bug today. But if the schema ever drops the
  generated column in favor of app-side population, this site is a
  trap (CLAUDE.md pitfall #1).
- Suggested direction: the comment should mention that the DB has a
  generated column computing `location_point` from `location` —
  pointing at the migration — so a reader editing this function knows
  where the PostGIS conversion actually happens.
- Confidence: confirmed
- Evidence: `import-service.ts:198-199`; `database_schema.sql:365`.

## No issues found in

- Admin verification JWT handling — `verifyAdminRequest` uses
  `supabase.auth.getUser(token)` which round-trips to Supabase, so
  token forgery is not a surface here (verified in REV-04 No-issues list
  too).
- Secret-key exposure — `GOOGLE_PLACES_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
  are both accessed only via `process.env` in server files; no client
  import path reaches them (grep confirmed: no
  `process.env.SUPABASE_SERVICE_ROLE_KEY` outside `lib/`).
- CSRF — all admin routes require a Bearer token in the
  `Authorization` header, not a cookie, so cross-site form submissions
  cannot authenticate. The matching confirmation is that
  `verifyAdminRequest` reads only `authHeader = request.headers.get('authorization')`,
  never `request.cookies` (supabase-server.ts:104).
- `importRestaurants` batch insert is transactional (single PostgREST
  `.insert([...])` is a single statement, so all-or-nothing at DB
  level). This is different from REV-04-c where the confirm flow
  spans multiple statements.
- Input validation on lat / lng / radius / maxPages ranges in the
  Google POST handler — careful and complete (`route.ts:61-81`).
- CSV parser handles UTF-8 BOM (`csv-import.ts:41`) and falls back
  Latin-1 for legacy Mexican datasets.
- Admin audit log is written on every import (`import-service.ts:300-313`),
  including source, counts and resource id.
- `restaurant_import_jobs.status` is hard-coded `'completed'` even on
  failure; not great, but the summary carries `errors[]` so the UI has
  the truth. Filed as non-issue because the current product accepts it.

## Follow-up questions

- Where is `restaurants.website` rendered as an `<a href="...">` — admin
  dashboard, mobile app, both? REV-05-g depends on this.
- Does `ingredient_aliases.display_name` have a UNIQUE constraint?
  Migrations grep did not surface it; the `database_schema.sql` dump
  shows only the FK. REV-05-j hinges on the answer.
- Is there any server-side rate-limiting on these routes (Vercel Edge
  Config, WAF, Supabase policy)? If not, an admin token leak could be
  used to exhaust budgets before detection.
- What is the expected max CSV size in production use? If it's always
  < 1000 rows (typical curated dataset), the REV-05-d / REV-05-e
  concerns collapse.
- REV-05-b's lost-update race — does anyone monitor the monthly
  `google_api_usage` counter drift? If the Google Cloud console is the
  source of truth and this table is just a hint, the fix is lower
  priority.
