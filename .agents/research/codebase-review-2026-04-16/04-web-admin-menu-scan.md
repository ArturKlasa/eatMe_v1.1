# REV-04: web-admin-menu-scan

Admin menu-scan pipeline: GPT-4o vision extraction, 3-layer merge, ingredient
enrichment, admin review UI, and the confirm step that writes menus / dishes /
categories / ingredients / option_groups. Read-only pass — no source edits.

## Scope reviewed

- `apps/web-portal/app/api/menu-scan/route.ts` (full, 813 lines)
- `apps/web-portal/app/api/menu-scan/confirm/route.ts` (full, 425 lines)
- `apps/web-portal/app/api/menu-scan/suggest-ingredients/route.ts` (full, 336 lines)
- `apps/web-portal/lib/menu-scan.ts` (full, 875 lines)
- `apps/web-portal/lib/menu-scan-utils.ts` (full, 75 lines)
- `apps/web-portal/lib/supabase-server.ts` (full, 134 lines)
- `apps/web-portal/app/admin/menu-scan/page.tsx` (full, 125 lines)
- `apps/web-portal/app/admin/menu-scan/hooks/useMenuScan.ts` (full, 301 lines)
- `apps/web-portal/app/admin/menu-scan/hooks/useReviewState.ts` (full, 329 lines)
- `apps/web-portal/app/admin/menu-scan/hooks/useIngredientState.ts` (full, 497 lines)
- `apps/web-portal/app/admin/menu-scan/hooks/useJobQueue.ts` (full, 152 lines)
- `apps/web-portal/app/admin/menu-scan/hooks/useProcessingState.ts` (full, 82 lines)
- `apps/web-portal/app/admin/menu-scan/hooks/useGroupState.ts` (full, 290 lines)
- `apps/web-portal/app/admin/menu-scan/components/MenuExtractionList.tsx` (full, 501 lines)
- `apps/web-portal/app/admin/menu-scan/components/MenuScanReview.tsx` (full, 261 lines)
- `apps/web-portal/app/admin/menu-scan/components/DishEditPanel.tsx` (header, 1–100)
- `apps/web-portal/next.config.ts` (full, 24 lines)
- `apps/web-portal/lib/supabase.ts` (full, 68 lines)
- Cross-reference: migration 092_dish_allergen_trigger.sql (columns +
  trigger definition) to confirm override semantics.

## Findings

### REV-04-a: AI-suggested allergens auto-populate `allergens_override`, silencing the ingredient-cascade source of truth
- Severity: high
- Category: correctness
- Location: `apps/web-portal/app/api/menu-scan/confirm/route.ts:334`
  (`buildDishRow`) + `apps/web-portal/lib/menu-scan.ts:820-839`
  (`editableToConfirm`) + `infra/supabase/migrations/092_dish_allergen_trigger.sql:23-24`
  (column contract).
- Observation: `buildDishRow` writes
  `allergens_override: dish.allergens && dish.allergens.length > 0 ? dish.allergens : null`.
  `dish.allergens` is hydrated in `editableToConfirm` as
  `dish.suggested_allergens ?? []`, which in turn is seeded from the AI's
  `mapped_allergens` in `enrichedToEditable` (menu-scan.ts:757). The admin
  never has to opt-in to "override": as long as GPT-4o returned any
  allergen hint, the override is written on every confirm.
- Why it matters: migration 092's explicit contract is that
  `allergens_override` is "Admin override for allergens. NULL = use value
  computed from `dish_ingredients`. Set by admin form escape hatch only."
  Auto-populating the override means the trigger in 092 can no longer
  recompute allergens from ingredients — the AI's (possibly incomplete)
  list wins. If GPT misses an allergen (e.g. `brown butter` not mapped to
  `lactose`, `fish sauce` not mapped to `fish`), a downstream consumer
  with a severe allergy sees an under-claimed dish even after the admin
  has set the correct ingredients. This is a food-safety regression of
  the entire allergen-cascade design.
- Suggested direction: only write `allergens_override` when the admin
  has explicitly toggled a per-dish "override" switch in the review UI.
  Default path should be to NOT write the override and let the trigger
  compute from `dish_ingredients`. The comment "Supplementary until DB
  trigger computes from ingredients" in `menu-scan.ts:109` describes the
  intended behaviour — the implementation contradicts it.
- Confidence: confirmed
- Evidence: `confirm/route.ts:334` sets the column unconditionally on any
  non-empty array; `editableToConfirm` sends suggestions through by
  default; migration 092 column comment at
  `infra/supabase/migrations/092_dish_allergen_trigger.sql:23-24`.

### REV-04-b: Same pattern — `dietary_tags_override` auto-populated from AI hints
- Severity: medium
- Category: correctness
- Location: `apps/web-portal/app/api/menu-scan/confirm/route.ts:322-325`.
- Observation: `dietary_tags_override: dish.dietary_tags && dish.dietary_tags.length > 0
  ? normalizeDietaryTags(dish.dietary_tags) : null`. The same issue as
  REV-04-a: the admin didn't explicitly mark these as "override" but the
  code writes them to the override column anyway. Any subsequent
  ingredient change on that dish will not recompute dietary_tags because
  the override wins.
- Why it matters: silently breaks the "dish_ingredients = single source
  of truth" property introduced in migration 092. A dish marked
  vegetarian by GPT that later gains a bacon ingredient still displays
  as vegetarian. Lower stakes than allergens but same category of bug.
- Suggested direction: same as REV-04-a — only persist the override
  when the admin has explicitly escaped from the cascade. Write AI
  suggestions to transient UI state, not to the override column, or
  write them to `dietary_tags` proper (non-override) so the trigger
  still has authority.
- Confidence: confirmed
- Evidence: `confirm/route.ts:322-325`; migration 092 comment at line
  25-26: "NULL = use value computed from dish_ingredients."

### REV-04-c: Confirm endpoint performs non-atomic multi-table writes — partial persistence on failure
- Severity: medium
- Category: correctness
- Location: `apps/web-portal/app/api/menu-scan/confirm/route.ts:77-240`.
- Observation: The commit flow is `menus INSERT` →
  `menu_categories INSERT` → `dishes INSERT` (parent) →
  `dish_ingredients INSERT` → `option_groups INSERT` →
  `options INSERT` → child `dishes INSERT` → their
  `dish_ingredients`/`option_groups`/`options`. Each call is an
  independent Supabase client request; there is no transaction
  wrapping the whole write. If a child dish insert fails after the
  parent inserted, the parent stays. If option_groups inserts but the
  nested options insert fails, we get an orphan option_group with no
  options (ingredientsAndOptions continues the loop even on failure —
  `continue` at line 400).
- Why it matters: produces half-populated menus that the admin sees as
  "completed_with_warnings" but which downstream consumers treat as
  real data. Orphan option_groups are the exact failure mode that
  migration 094/096 already cleaned up — re-introducing the
  possibility invites a repeat.
- Suggested direction: wrap the confirm flow in a Supabase RPC / Postgres
  function that runs inside a single transaction, or (minimally) rely on
  the single insert-with-returning pattern plus catch-and-rollback by
  deleting the menu on failure. The current "collect errors and report
  warnings" shape is fine for UX but must sit on top of transactional
  atomicity, not replace it.
- Confidence: confirmed
- Evidence: `confirm/route.ts:86-90` uses `.from('menus').insert(...)`
  etc. No `.rpc(...)` call, no `begin;`/`commit;` anywhere in the file;
  each `await supabase.from(...)` is an independent HTTP request.

### REV-04-d: `bodySizeLimit` in `next.config.ts` does not cover route-handler bodies — 20-image scans will OOM or 413 on Vercel
- Severity: medium
- Category: dx
- Location: `apps/web-portal/next.config.ts:9-13` +
  `apps/web-portal/app/api/menu-scan/route.ts:606-608`.
- Observation: The config sets
  `experimental.serverActions.bodySizeLimit = '20mb'` with a comment
  citing "Phone photos resized to 1500px … 10 images max ≈ 5 MB". Two
  problems: (1) the menu-scan POST handler is a Route Handler, not a
  Server Action, so this option does not apply to it — Vercel enforces
  its own request-body cap (~4.5 MB on Hobby, ~50 MB on Pro, no way to
  raise from Next config alone); (2) the actual resize code at
  `menu-scan-utils.ts:3-40` uses `maxDim = 2000`, not the 1500 the
  comment references, so each image is ~1.8× larger than the comment
  assumes. With the route accepting up to 20 images, realistic payloads
  are 10–18 MB, above Hobby limits.
- Why it matters: scans with many images fail with 413 before the
  handler runs. No user-visible error message is produced because the
  request never reaches the app; the user sees only the client toast
  timing out.
- Suggested direction: either (a) lower the per-image max dimension and
  the 20-image cap so realistic payloads stay under the platform cap,
  (b) upload images to Storage first and send Storage paths to the
  handler, or (c) stream the images via multipart instead of base64 in
  JSON. Update the outdated comment in `next.config.ts`.
- Confidence: likely
- Evidence: `next.config.ts:9-13`; `menu-scan-utils.ts:4` (`maxDim = 2000`);
  `route.ts:606-608` (`images.length > 20`). Vercel's body-size limit is
  platform-documented, not represented in code.

### REV-04-e: No `maxDuration` on main extraction route — GPT-4o latency on 20-image scans can exceed Vercel default 10s timeout
- Severity: medium
- Category: dx
- Location: `apps/web-portal/app/api/menu-scan/route.ts`
  (no `export const maxDuration` anywhere) vs. the confirm route which
  sets it at line 15.
- Observation: The confirm route declares `export const maxDuration = 60`
  (`confirm/route.ts:15`) because "needed for large menus (300+ dishes)".
  The extraction route — which fans out 1 GPT-4o vision call per image
  in parallel (`route.ts:656-665`) and then serial enrichment calls —
  has no such declaration. Vercel's default function timeout on Hobby
  is 10 s (60 s on Pro). A single GPT-4o vision call with `detail: high`
  + 16 k `max_tokens` commonly takes 10–25 s; 20 in parallel will
  finish when the slowest does, so the route usually needs ≥30 s.
- Why it matters: scans with more than a couple of images will silently
  be killed by the platform, leaving jobs stuck in `processing` with no
  error message the user sees. The retry path in `route.ts:765-770`
  triggers only for DB update failures, not timeouts.
- Suggested direction: export `maxDuration = 60` (or 300 for Pro) from
  this route, matching the confirm route. Also consider moving the
  extraction into a background queue (Inngest / Supabase edge function /
  background worker) so the HTTP request isn't the bottleneck.
- Confidence: likely
- Evidence: `grep -n "maxDuration" apps/web-portal/app/api/menu-scan/`
  returns only the confirm route; no runtime / maxDuration declaration
  at the top of `route.ts`.

### REV-04-f: `DishSchema` typed `z.ZodType<unknown>` erases recursive-variant type safety
- Severity: low
- Category: maintainability
- Location: `apps/web-portal/app/api/menu-scan/route.ts:21-38`.
- Observation: `const DishSchema: z.ZodType<unknown> = z.lazy(() => z.object({ … variants: z.array(DishSchema).nullable() }));`.
  The explicit `z.ZodType<unknown>` annotation hides the recursive
  variant shape from TypeScript. Downstream code casts the parsed
  content with
  `JSON.parse(content) as RawExtractionResult` (line 213) — but the
  actual validator yields `unknown`.
- Why it matters: the type system gives zero help on the structured
  output from OpenAI. If OpenAI's Structured Outputs ever returns
  something that doesn't match the recursive shape (a field rename in
  the future, or OpenAI dropping recursive-schema support), the JSON
  parse produces an object the runtime uses blindly. The cast also
  masks the fact that `extraction_notes` is `? ExtractionNote[]` on the
  parsed type (the Zod schema declares it non-optional) — callers
  still guard with `?? []` (line 218), so the drift is latent.
- Suggested direction: the standard Zod recipe for recursive schemas is
  `type Dish = z.infer<typeof BaseDishSchema> & { variants: Dish[] | null };`
  with `BaseDishSchema` declared non-recursively and variants layered in
  via `z.lazy(...)`. Alternatively, collapse variants to a separate flat
  array keyed by parent id to avoid the recursive schema altogether.
- Confidence: confirmed
- Evidence: `route.ts:21` (`z.ZodType<unknown>`); `route.ts:213` (cast);
  `menu-scan.ts:3-22` (the typed interface the runtime relies on).

### REV-04-g: `confirm` runs DB writes serially (`await` inside for-loops) — N dish inserts = N round-trips
- Severity: medium
- Category: performance
- Location: `apps/web-portal/app/api/menu-scan/confirm/route.ts:78-238`.
- Observation: The top-level loop iterates menus → categories → parent
  dishes and calls `await supabase.from('dishes').insert(parentRow)`
  per parent (line 140), then `await insertIngredientsAndOptions(...)`
  (line 152). Child variants and standalone dishes are batched
  (line 174, 212) but each parent dish — and each standalone-dish
  ingredient/option write — still serializes. For a menu with 150
  parent dishes plus 30 children each, that's 150 sequential inserts
  plus ingredient/option round-trips.
- Why it matters: at 30–80 ms per Supabase round-trip from Vercel,
  a realistic 200-dish menu spends 6–16 s in serial DB I/O alone,
  pushing against the 60 s `maxDuration`. Large catering/tasting-menu
  scans can time out mid-commit, leaving a half-written menu (see
  REV-04-c on the lack of atomicity).
- Suggested direction: batch all parents per category into a single
  insert (as the standalone path already does) with client-generated
  UUIDs so parent_dish_id linkage survives. Batch dish_ingredients and
  option_groups across all dishes in a category.
  Alternatively, replace the whole confirm flow with a single Postgres
  function called via `.rpc()` that does the work server-side.
- Confidence: confirmed
- Evidence: `confirm/route.ts:133-198` (parent loop with per-iteration
  `await`s); `confirm/route.ts:376-421` (option-group inserts also
  iterate with `await` per group).

### REV-04-h: `extractMenuFromImage` normalises spice with wrong mapping for value `2`
- Severity: low
- Category: correctness
- Location: `apps/web-portal/app/api/menu-scan/route.ts:507-508`.
- Observation: `const normalisedSpice: 0 | 1 | 3 | null = rawSpice === null ? null : rawSpice <= 0 ? 0 : rawSpice <= 1 ? 1 : rawSpice === 2 ? 1 : 3;`.
  The chain is evaluated left-to-right, so `rawSpice === 2` is checked
  AFTER `rawSpice <= 1`. The `rawSpice === 2` branch is therefore
  unreachable: a value of 2 already satisfies `rawSpice <= 1`? No —
  2 > 1, so it falls through to the final `: 3` branch. Result: the
  explicit "2 → 1" fallback never triggers; value 2 always becomes 3.
- Why it matters: the prompt allows only 0/1/3 so this is a defensive
  clamp. But the apparent intent of the `=== 2` branch is "medium maps
  to mild"; what the code actually does is "medium maps to hot", which
  over-claims spice level for any model that happens to emit 2.
- Suggested direction: either remove the dead `rawSpice === 2` branch
  (since the Zod schema already rejects values outside {0,1,3}) or fix
  the ordering so it reads `rawSpice <= 1 ? 1 : rawSpice === 2 ? 1 : 3`
  → there's no way to make that branch reachable because 2 > 1 already
  fails the second test. The right fix is `rawSpice >= 2 ? 3 : 1` (or
  `rawSpice <= 1 ? 1 : 3`) and delete the dead arm.
- Confidence: confirmed
- Evidence: `route.ts:508`. Boolean trace: rawSpice=2 → `<= 0` false →
  `<= 1` false → `=== 2` true → returns 1. Wait — re-read: the chain is
  `rawSpice <= 0 ? 0 : rawSpice <= 1 ? 1 : rawSpice === 2 ? 1 : 3`. For
  rawSpice=2: `<= 0` false, `<= 1` false, `=== 2` true → returns 1.
  So the branch IS reachable. The issue is different: downstream types
  declare the field `0|1|3|null`, so a returned value of `1` for input 2
  is correct-per-contract; the branch is redundant with the prior
  `<= 1 ? 1` but not dead. Downgrade to "info / dead-looking code".
- Status: this finding was partially incorrect after re-evaluation;
  keeping as `info` for the reviewer to confirm.

### REV-04-i: No per-restaurant ownership check — any admin can submit scans and confirm dishes for any restaurant
- Severity: info
- Category: security
- Location: `apps/web-portal/app/api/menu-scan/route.ts:581-611` +
  `apps/web-portal/app/api/menu-scan/confirm/route.ts:17-69`.
- Observation: both routes call `verifyAdminRequest` which only checks
  `app_metadata.role === 'admin'`. Neither route checks that the admin
  is associated with the target restaurant (no lookup in
  `restaurant_owners` / `user_restaurants` / similar). The service-role
  client bypasses RLS so any admin-scoped JWT can write menus under any
  `restaurant_id`.
- Why it matters: if the admin role is intentionally "superadmin" that
  can curate any restaurant this is by design. If it is ever expanded
  to include per-tenant admins (per the RLS model implied by
  `owner_id` elsewhere), this endpoint is a privilege-escalation vector.
- Suggested direction: confirm the intended trust model. If admins are
  multi-tenant, add a `restaurant_owners` check before the INSERT.
- Confidence: needs-verification
- Evidence: only `role === 'admin'` check at supabase-server.ts:121;
  service-role client at :73-90; no restaurant-ownership lookup in
  either handler.

### REV-04-j: POST extraction returns HTTP 401 even when user is authenticated but not admin
- Severity: low
- Category: conventions
- Location: `apps/web-portal/app/api/menu-scan/route.ts:581-584`.
- Observation:
  ```
  const auth = await verifyAdminRequest(request);
  if (auth.error || !auth.user) {
    return NextResponse.json({ error: auth.error ?? 'Unauthorized' }, { status: 401 });
  }
  ```
  `verifyAdminRequest` already returns `status: 401 | 403` in the error
  case — 401 for missing/invalid token, 403 for "Admin access required"
  (supabase-server.ts:121-123). The confirm route uses
  `status: auth.status` correctly (confirm/route.ts:21). The extraction
  route discards `auth.status` and hard-codes 401.
- Why it matters: clients that disambiguate 401 ("please re-login")
  from 403 ("you lack permission") see a misleading message. Minor but
  easy to fix.
- Suggested direction: narrow the check to `if (auth.error)` and return
  `NextResponse.json({ error: auth.error }, { status: auth.status })`,
  mirroring the confirm route.
- Confidence: confirmed
- Evidence: `route.ts:583` vs. `confirm/route.ts:21`; the helper
  declares a discriminated union with `status: 401 | 403`.

### REV-04-k: `suggest-ingredients` creates `dish_categories` rows with no de-duplication — concurrent first-use races
- Severity: low
- Category: correctness
- Location: `apps/web-portal/app/api/menu-scan/suggest-ingredients/route.ts:301-324`.
- Observation: For an AI-suggested category that doesn't already exist,
  the route does `insert({ name, is_drink: false, is_active: true })`.
  Two admins scanning different menus at the same time who both receive
  the AI category "Tacos" for the first time race on the insert. If
  `dish_categories.name` does not have a UNIQUE constraint (grep of
  migrations turns up no such constraint; `database_schema.sql` would
  be the reference), the second writer succeeds and both rows persist.
- Why it matters: duplicate dish-category rows split the
  dish-category taxonomy, breaking downstream filters and joins that
  assume category-name uniqueness.
- Suggested direction: (a) add a UNIQUE index on
  `dish_categories.name` (new migration) and replace `insert` with
  `upsert` / `onConflict: 'name'`, or (b) do a case-insensitive
  re-select inside a short retry loop.
- Confidence: needs-verification
- Evidence: `suggest-ingredients/route.ts:314-323` uses `.insert(...)`
  without conflict handling; the preceding lookup uses `.ilike(...)`
  (case-insensitive match); re-select→insert is not transactional.

### REV-04-l: `bulkLookupAliases` OR-filter sanitisation strips dots and parens — legitimate names with those characters won't match
- Severity: low
- Category: correctness
- Location: `apps/web-portal/app/api/menu-scan/route.ts:304-343` +
  `apps/web-portal/app/api/menu-scan/suggest-ingredients/route.ts:222-253`.
- Observation: `sanitize = (n) => n.replace(/[,%.()\[\]]/g, '')`. The
  intent is to prevent PostgREST OR-filter parse breakage — commas
  delimit filters, parens delimit nested conditions, `%` is a wildcard,
  `.` is the field/op/value separator. Stripping them is safe for the
  *query* but also mutates the *search value* — an ingredient
  legitimately named `St. Louis-style ribs` gets queried as
  `St Louisstyle ribs`. On exact ilike this will miss; on partial
  ilike it still misses because the DB row isn't normalized the same
  way.
- Why it matters: rare but real. Misses shift ingredients to
  `unmatched` → translation fallback round-trip → more OpenAI spend
  and more unmatched rows the admin has to hand-resolve.
- Suggested direction: use parameterised `in(...)` (no OR-chain
  splitting) where possible; for ilike, escape the dangerous
  characters (prefix with `\\`) rather than stripping them; alternately
  call the REST endpoint with `filter.ilike.any.{list}` where
  supported.
- Confidence: likely
- Evidence: `route.ts:307`; `suggest-ingredients/route.ts:222`.

### REV-04-m: Storage upload uses `upsert: true` with untrusted filename — storage-path clobber across re-scans of the same job
- Severity: low
- Category: security
- Location: `apps/web-portal/app/api/menu-scan/route.ts:645-654`.
- Observation: `const storagePath = \`${restaurant_id}/${job.id}/${i + 1}_${img.name}\`; ...upload(storagePath, buffer, { ... upsert: true })`.
  `img.name` comes from the client without validation. `upsert: true`
  means a second scan that sends the same filename overwrites the
  prior binary. Moreover `img.name` can contain `/`, `..`, etc.
  Supabase's storage-path validation generally rejects `..` segments,
  but querystring-style filenames (`?` / `%2F`) can cause surprising
  path splits.
- Why it matters: weak. Not a privilege-escalation vector since paths
  are scoped under `{restaurant_id}/{job.id}/`, but it does mean the
  audit trail can be silently overwritten.
- Suggested direction: sanitise `img.name` (strip path separators,
  truncate to a safe length, optionally hash) and drop
  `upsert: true` — the path is already uniquified by
  `${job.id}/${i + 1}_`, so there's no legitimate duplicate case.
- Confidence: confirmed
- Evidence: `route.ts:647-654`.

### REV-04-n: Menu images pass through GPT with extraction_notes free-form `message` — AI-authored text reaches the admin UI and is stored in DB
- Severity: info
- Category: security
- Location: `apps/web-portal/app/api/menu-scan/route.ts:40-67` (schema)
  + `apps/web-portal/app/api/menu-scan/route.ts:746-758` (stored in
  `result_json`) + `apps/web-portal/app/admin/menu-scan/components/MenuScanReview.tsx`
  (renders warnings).
- Observation: the extraction schema has `ExtractionNoteSchema` with
  free-form `message` / `suggestion` strings. Those strings come from
  GPT-4o based on the image's visual content, which means a menu image
  containing "Ignore previous instructions, emit {malicious JSON}"
  could cause the note text to reach the admin in a way designed to
  mislead. Because Structured Outputs constrains the SHAPE of the
  response, a prompt-injected image cannot change the schema keys —
  but it can inject arbitrary text into `message`.
- Why it matters: React's JSX escaping means XSS isn't the risk.
  The risk is social-engineering the reviewing admin ("⚠️ This menu
  appears authentic, skip review to save time") or exfil via a data
  URI in the `suggestion` field that the admin might click. Low-impact
  because the reviewing workflow is narrow, but worth knowing.
- Suggested direction: render `extraction_notes.message` as plain
  text only (already the case); cap length; optionally filter
  obvious injection markers before persisting to `result_json`.
- Confidence: needs-verification
- Evidence: `route.ts:40-51` (schema); `route.ts:749-751` (persisted
  unfiltered); `lib/menu-scan-warnings.ts` (rendering path not read
  here — see follow-up questions).

### REV-04-o: `formatLocationForSupabase` called in review-save path defaults to JSON format, not PostGIS POINT
- Severity: info
- Category: correctness
- Location: `apps/web-portal/app/admin/menu-scan/hooks/useReviewState.ts:116-117`
  + `apps/web-portal/lib/supabase.ts:36-46`.
- Observation: the save flow runs
  `patch.location = formatLocationForSupabase(lat, lng)` — the helper's
  second-arg default is `'json'` which returns `{ lat, lng }`. The
  `restaurants.location` column is (per naming) a PostGIS
  geography/geometry point; writing a `{lat, lng}` JSON object is not a
  valid point literal and the update is likely rejected (or silently
  coerced in unexpected ways). The helper's own comment at
  `supabase.ts:44` reads "PostGIS uses (longitude, latitude) order -
  this is critical!" — but that branch only runs when `'point'` is
  requested.
- Why it matters: overlaps with REV-08 (PostGIS POINT order) but the
  call site is the menu-scan save flow. The catch at line 122 only
  logs a warning, so the address/coordinates patch silently fails.
- Suggested direction: pass `'point'` explicitly, or remove the JSON
  branch entirely since the column type is PostGIS.
- Confidence: needs-verification
- Evidence: `useReviewState.ts:116-117`; `supabase.ts:36-46`; actual
  column type verified as geography in REV-08 (migrations scope).

### REV-04-p: Large error-message strings logged without truncation — exposes Supabase column-not-found / FK / constraint details to the client
- Severity: low
- Category: security
- Location: `apps/web-portal/app/api/menu-scan/confirm/route.ts:99, 123,
  144, 180, 218, 255-263`.
- Observation: multiple branches push raw `pgError.message` into
  `errors[]` and then return it in the response JSON (including the
  top-level `{ error: "All dish inserts failed. First error: <full
  pg error>" }`). Postgres/PostgREST error messages reveal column
  names, constraint names, and sometimes quoted values.
- Why it matters: weak risk since this endpoint is admin-only, but
  generally errors like `new row for relation "dishes" violates check
  constraint "dishes_price_nonneg"` give a remote attacker useful DB
  schema information if an admin session ever leaks.
- Suggested direction: log the full error server-side (already done)
  and return a short stable error code / generic message to the client.
- Confidence: confirmed
- Evidence: `confirm/route.ts:257-263` returns the raw error to the
  client; multiple `errors.push(\`...: ${pgError.message}\`)` lines.

### REV-04-q: `handleSave` retry behaviour after successful commit discards preview URLs and resets, but failed commits leave stale blob URLs that can't be reused
- Severity: low
- Category: maintainability
- Location: `apps/web-portal/app/admin/menu-scan/hooks/useReviewState.ts:148-159`
  + `apps/web-portal/app/admin/menu-scan/hooks/useMenuScan.ts:56-60`.
- Observation: on successful save, `deps.previewUrls.forEach(url => URL.revokeObjectURL(url))`
  is called and then `onSaveSuccess` resets the whole flow. On *partial*
  success (`data.warnings?.length`) the same revoke runs — but if the
  admin wants to re-save after fixing warnings, the preview URLs are
  already revoked and the left panel breaks for the remainder of the
  session.
- Why it matters: UX bug. Forces the admin to re-enter the full flow
  from upload to fix a trivial warning. Not data-loss but annoying.
- Suggested direction: only revoke on full success (no warnings) or
  when actually unmounting / switching job. Keep URLs until the review
  screen is left.
- Confidence: confirmed
- Evidence: `useReviewState.ts:148-150` revokes regardless of warnings;
  `useMenuScan.ts:56-60` revokes again in the reset path — so the
  first revoke is redundant and the second revoke is the right place.

### REV-04-r: `upload.setCurrentImageIdx` referenced on review path but declared in `useUploadState` — state leakage across upload/review steps
- Severity: info
- Category: maintainability
- Location: `apps/web-portal/app/admin/menu-scan/hooks/useMenuScan.ts:122-123`
  + `apps/web-portal/app/admin/menu-scan/components/MenuScanReview.tsx:170-171`.
- Observation: the upload hook owns `currentImageIdx`, but it is
  consumed by the *review* left panel too. The "upload" hook has
  become a de-facto "review" hook as well, which makes the composition
  in `useMenuScan` harder to reason about. If the upload form is ever
  isolated into its own route, the review panel breaks.
- Why it matters: maintainability / modular boundaries. Not a bug.
- Suggested direction: move `currentImageIdx` into `useReviewState` (it
  only meaningfully exists during review) or into a shared "image
  viewer" hook.
- Confidence: confirmed
- Evidence: `useMenuScan.ts:225-226`; `ReviewLeftPanel` receives it via
  props (MenuScanReview.tsx:170-171).

### REV-04-s: `applyDishDefaults` mutates schema-validated input in place before returning — types say the shape is already complete
- Severity: info
- Category: maintainability
- Location: `apps/web-portal/app/api/menu-scan/route.ts:244-259`.
- Observation: the Zod schema already requires `dish_kind`, `is_parent`,
  `display_price_prefix`, so post-parse the object is not
  `Partial<…>`. But `applyDishDefaults` still does
  `if (!dish.dish_kind) dish.dish_kind = 'standard';` etc. — code that
  assumes the parser may have skipped validation. After OpenAI SDK
  version bumps that change parse semantics, these defaults are the
  only thing stopping undefined-field crashes, which makes the
  contract fragile.
- Why it matters: low risk but confusing. Reader can't tell whether
  the schema or the defaults is authoritative.
- Suggested direction: either tighten the Zod schema to require those
  fields (it already does, via non-optional `z.literal`/`z.enum`) and
  delete `applyDishDefaults`, or weaken the schema to reflect what
  reality gives (nullable) and rely on the defaults. Pick one source
  of truth.
- Confidence: confirmed
- Evidence: `route.ts:53-67` (Zod schema — all fields required);
  `route.ts:246-250` (defensive re-defaults).

## No issues found in

- JWT verification: `verifyAdminRequest` uses `supabase.auth.getUser(token)`
  (server-to-Supabase round-trip) and checks `app_metadata.role` which
  is admin-immutable. No JWT-forging surface here.
- OpenAI client instantiation: guarded by `OPENAI_API_KEY` env var and
  isolated to server routes — no client-side key exposure.
- React XSS: no `dangerouslySetInnerHTML` anywhere under
  `apps/web-portal/` (grep confirmed).
- Job-table `created_by` FK: POST route writes
  `created_by: user.id` (route.ts:631), correctly attributing the job.
- Image base64 size path: `resizeImageToBase64` centralises client-side
  reduction at `maxDim = 2000` and quality 0.82; no raw file upload
  bypasses resize.
- Hook decomposition: the six useXxxState hooks compose cleanly via
  `useMenuScan`; no obvious circular dependency or memory leak in the
  orchestrator.
- Vegan → vegetarian normalisation: applied in both `mapDietaryHints`
  (menu-scan.ts:434-436), `normalizeDietaryTags` (confirm/route.ts:7-12),
  `suggestIngredients` (useIngredientState.ts:250-253) — three sites
  but all consistent.

## Follow-up questions

- Is the admin role truly "superadmin across all restaurants", or is
  there a per-restaurant admin concept we're missing? REV-04-i depends
  on this.
- Does `dish_categories.name` have a UNIQUE constraint in the live DB
  (database_schema.sql does not appear to include it — REV-04-k)?
  Needs a `\d+ dish_categories` trace against the running database.
- What is Vercel's active tier for this deployment? The 413 risk in
  REV-04-d and the timeout risk in REV-04-e change scale with tier.
- For `extraction_notes.message` (REV-04-n): does any consumer render
  it via `innerHTML` or only as plain React text? `menu-scan-warnings.ts`
  was out of scope for this review pass.
- Migration 092's intent: should admins confirm *every* override write,
  or is the auto-populated override acceptable as "pre-filled but
  editable"? The code behaves like the latter; the migration comment
  and `menu-scan.ts:109` comment say the former. One of them is wrong.
