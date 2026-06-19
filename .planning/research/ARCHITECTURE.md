# Architecture Research

**Domain:** Brownfield codebase-hardening — Supabase (Postgres 15 + PostGIS + pgvector) + Deno edge + Expo/RN mobile + Next.js admin
**Researched:** 2026-06-18
**Confidence:** HIGH (grounded in the actual source: migrations 151/169, `invalidate-cache/index.ts`, `feed/index.ts`, `filterStore.ts`, Phase C plan)

> This document does **not** re-document the existing architecture (that lives in `.planning/codebase/ARCHITECTURE.md`). It answers *how to structure the four specific hardening changes* this milestone requires, with seams, safe sequencing, build-order, and recommendations.

---

## Q1 — Postgres teardown sequencing (ingredient pipeline: Phase B triggers → Phase C schema)

### What the code already tells us

- **Phase B is already written and safe-by-construction.** `infra/supabase/migrations/151_retire_ingredient_triggers.sql` drops 3 triggers, then their trigger functions, then helper functions, all inside one `BEGIN/COMMIT`. The header documents the grep that proves no `supabase.rpc()` callers exist. A paired `151_REVERSE_ONLY_*.sql` restores them. **This is ready to deploy as-is.**
- **Phase C is planned but not authored.** `docs/plans/ingredient-pipeline-phase-c-schema-retirement.md` is thorough: snapshot → drop 9 tables (dependency order, CASCADE) → drop 3 dead columns → regenerate types → 7-day watch.
- The original 4–6 week observation gate between B and C was justified by *production traffic*. **There are no production users** (per migration 151's own header and PROJECT.md). The calendar gate collapses; what remains is a *correctness* gate, not a *time* gate.

### Recommended teardown order (explicit, safe for stage-don't-apply + no local psql)

```
Step 0  PRE-FLIGHT (grep gates — agent runs these, zero hits required)
        git grep "canonical_ingredient_id"
        git grep "allergens_override\|dietary_tags_override"
        git grep "canonical_ingredient_allergens"
        git grep "dish_ingredients\|ingredient_concepts\|ingredient_variants"
        → any hit in apps/ or infra/supabase/functions/ = fix first, do NOT proceed
           (web-portal-v2 hits are acceptable — it is on ice and not deployed)

Step 1  Phase B — drop inert TRIGGERS (mig 151, already authored)
        Order inside the txn (already correct in 151):
          triggers → trigger functions → helper functions (refresh→compute)
        User deploys 151 + its REVERSE pair.

Step 2  GATE: verify triggers gone (REST-friendly, no psql)
        A tiny SECURITY DEFINER verification RPC OR a Supabase SQL-editor snippet:
          SELECT tgname FROM pg_trigger WHERE tgname IN
            ('dish_ingredients_refresh','dishes_override_refresh',
             'trg_enrich_on_ingredient_change');   -- expect 0 rows
        Run via supabase-js .rpc() to a one-shot verify function, or paste in
        the Supabase dashboard SQL editor. This is the no-local-psql substitute.

Step 3  SNAPSHOT before any DROP TABLE (one-way action insurance)
        pg_dump --data-only of all 9 ingredient tables (Phase C plan §5.1) to
        cold storage. Author the snapshot procedure file; user runs the dump.
        Do NOT proceed to Step 4 until the snapshot URI is recorded.

Step 4  Phase C-a — drop TABLES (new migration NNN_drop_ingredient_pipeline.sql)
        Dependency order (children → parents), CASCADE as catch-all:
          variant_translations → concept_translations → ingredient_variants
          → canonical_ingredient_allergens → dish_ingredients
          → ingredient_aliases → ingredient_aliases_v2 → ingredient_concepts
          → canonical_ingredients
        One BEGIN/COMMIT (all-or-nothing).

Step 5  Phase C-b — drop dead COLUMNS (separate migration NNN+1)
          dishes.allergens_override, dishes.dietary_tags_override,
          options.canonical_ingredient_id
        Separate from the table drop so a column-only rollback is a simple
        ADD COLUMN.  Keep dishes.protein_canonical_names (feed uses it; derived
        from primary_protein, NOT from the ingredient pipeline).

Step 6  REGENERATE types  →  COMPILE GATE (this is the real verification)
        supabase gen types typescript --linked > packages/database/src/types.ts
        pnpm build && pnpm check-types across the workspace.
        Any leftover reference to a dropped table/column surfaces as a compile
        error here. This is the strongest verification available without psql.

Step 7  Commit slimmed types.ts (also resolves the "stale 3226-line types" finding).
```

### Why this ordering is safe given the constraints

- **No local psql** → verification leans on three substitutes, in order of strength: (1) `git grep` pre-flight (catches app/edge refs before any DB change), (2) a one-shot SECURITY DEFINER verify RPC or the Supabase SQL editor for `pg_trigger`/`information_schema` checks, (3) **the TypeScript compile after regen is the load-bearing gate** — it mechanically proves nothing in the codebase references the dropped schema.
- **Stage-don't-apply** → every step is an authored `.sql` file with a REVERSE pair; the user applies dry-run → sample → full. The agent never mutates prod.
- **CASCADE is defensive, not load-bearing.** The pre-flight FK query (Phase C plan §7 risk row) should return zero external FKs; CASCADE only catches an unknown view/policy.
- **Triggers before tables** is mandatory: dropping a table out from under a live trigger errors; dropping the trigger first makes the table inert and independently droppable.

### Build-order dependency
**Step 1 (B) must fully precede Steps 4–5 (C).** Phase B makes the tables trigger-free so they can be dropped without trigger-fire side effects. Steps 4 and 5 are independent of each other but both depend on Step 3 (snapshot) and Step 0 (grep). Step 6 depends on 4+5.

---

## Q2 — Geo-aware vector retrieval (generate_candidates timeout past ~5km)

### Root cause confirmed in source

`generate_candidates` (mig 169) computes `vector_distance = d.embedding <=> p_preference_vector` **inside** a `WITH candidates AS MATERIALIZED` CTE that first applies `ST_DWithin` + ~12 other predicates, then `ORDER BY vector_distance … LIMIT p_limit`. **This is geo-filter-then-rank, NOT an HNSW ANN scan.** The HNSW index from mig 136 is therefore *unusable* here: HNSW only accelerates a top-K `ORDER BY embedding <=> v LIMIT k` over the *whole table with no other WHERE predicates*. The moment you add `ST_DWithin` + diet + time filters, the planner must do a sequential `<=>` distance computation over every in-radius row. Past ~5km the in-radius row count explodes and the per-row `<=>` (1536-dim cosine) blows the 8s `statement_timeout`. Mig 169's MATERIALIZED pushdown narrowed it (cheap filters before LATERAL modifier work) but, as its own header admits, did not eliminate it.

### Options, trade-offs, recommendation

| Option | What it is | Pros | Cons | Verdict |
|--------|-----------|------|------|---------|
| **A. Tiered / expanding radius** | Query 3km first; if `< N` results, re-query at 6km, then 10km. Driven from the feed edge function (Stage 1 loop) — no schema change. | Smallest change; no DB migration; HNSW still irrelevant but the common case (dense urban 3km) stays tiny and fast; instantly shrinks the timeout surface | Two round-trips on sparse areas; "N" needs tuning; worst case (rural) still hits the big radius | **RECOMMENDED first.** Highest value / lowest risk; ships behind no schema change; reversible by config. |
| **B. Per-restaurant cached vector / coarse pre-filter** | Precompute a per-restaurant centroid embedding; ANN-rank *restaurants* by `<=>` (HNSW-eligible — restaurants table is ~100s of rows, geo-filterable cheaply), then fetch dishes only from the top restaurants. | Turns the hot path into restaurant-level ANN (tiny N) + dish fetch by FK; HNSW finally usable on the small set; bounded work regardless of radius | New column + backfill + maintenance trigger on dish embedding change; centroid is a lossy proxy for dish-level taste; needs a migration + backfill script | **RECOMMENDED second**, as the durable fix once A's headroom is consumed by catalog growth. |
| **C. Geographic tiling / partitioning** | Partition `dishes` (or a denormalized candidate table) by geohash/H3 tile; query only neighboring tiles. | Bounds scan to a fixed tile set; scales to large catalogs | Heaviest change (partition strategy, tile assignment, cross-tile-boundary stitching, repartition on restaurant move); premature for current row counts | **DEFER.** Only if A+B prove insufficient at much larger scale. |
| **D. Reorder ANN-then-geo (true ANN first)** | `ORDER BY embedding <=> v LIMIT 500` (HNSW) *then* geo-filter the 500 in an outer query. | Uses HNSW as designed | For a *personalized, geo-local* feed, the global top-500 by taste may contain few/zero dishes inside the user's radius → empty feeds in any non-dense city; correctness regression | **REJECT** as the primary path; the feed is inherently geo-bounded first. |
| **E. Dedicated vector store (pgvector → external)** | Move ANN to a geo-aware vector DB. | Purpose-built | Massive infra change; new failure mode; violates "prefer incumbent tech" | **OUT OF SCOPE** this cycle. |

**Recommended build order for Q2:** **A now** (edge-function tiered radius, behind a feature flag / config, no migration) → measure → **B next** (per-restaurant centroid + restaurant-level ANN pre-filter, a real migration + backfill in `infra/scripts/`) if growth demands it. C/D/E stay deferred/rejected.

### Seam for Option A
The change lives entirely in `infra/supabase/functions/feed/index.ts` Stage 1 (around the `generate_candidates` call at the cache-key/RPC boundary, ~line 742+) — wrap the single RPC call in an expanding-radius loop. **No mobile change, no schema change, no RLS change.** This keeps it behavior-preserving for the client (same response shape) and independently shippable.

---

## Q3 — Component decomposition (behavior-preserving, persist-safe)

### Critical constraint discovered in source
`filterStore.ts` does **NOT** use Zustand `persist` middleware. It uses plain `create((set,get)=>…)` plus hand-rolled `loadFilters()` / `saveFilters()` (debounced 500ms) writing to `AsyncStorage`, plus `loadPreferencesFromDB`/`savePreferencesToDB`/`syncWithDatabase` for the Supabase round-trip. **The serialized on-disk shape is whatever `saveFilters` writes.** Therefore the persist-safety rule is: *the object `saveFilters` serializes and the object `loadFilters` parses must keep identical field names and nesting.* This is the seam you must not move.

### filterStore.ts (927 lines) — split along slice boundaries, not file size

The store already has a clean conceptual split visible in its interfaces: `DailyFilters` (transient, session-scoped, reset each session) vs `PermanentFilters` (persisted to AsyncStorage + DB). Cut along these:

| New module | Contains | Boundary rule |
|-----------|----------|---------------|
| `filterStore/defaults.ts` | `defaultDailyFilters`, `defaultPermanentFilters`, `defaultFilterState`, the `DailyFilters`/`PermanentFilters`/`FilterState` interfaces | Pure data + types. Zero behavior. Lowest-risk extraction; do this first. |
| `filterStore/dailyActions.ts` | `setDailyPriceRange`, `toggle*`, `setSpiceLevel`, `setSortBy`, `replaceDailyFilters`, `resetDailyFilters`, … | A slice creator `(set,get)=>({…})`. |
| `filterStore/permanentActions.ts` | `setPermanent*`, `toggleExclude`, `setCuisinePreferences`, `applyPreset`, presets, `resetPermanentFilters` | Slice creator. |
| `filterStore/persistence.ts` | `loadFilters`, `saveFilters`, `savePermanentFilters`, `loadPreferencesFromDB`, `savePreferencesToDB`, `syncWithDatabase`, the debounce timer | **The serialization seam. Keep the (de)serialized shape byte-identical.** Extract last, verify on-device. |
| `filterStore/selectors.ts` | `getDailyFilterCount`, `getPermanentFilterCount`, `hasDailyFilters`, `hasPermanentFilters`, currency helpers | Pure derived reads. |
| `filterStore/index.ts` | `create<FilterState & FilterActions>()` composing the slice creators via spread | The single public export `useFilterStore` — **import path and store shape unchanged** for every consumer. |

**Pattern:** Zustand "slices" — each slice is `(set, get) => Partial<Store>`; `index.ts` spreads them into one `create()`. Public API (`useFilterStore`, every action name, every selector) is preserved, so no consumer file changes. This is the only decomposition pattern that is provably behavior-preserving for a Zustand store.

**Verification gate (no emulator):** after extraction, the agent confirms (a) `useFilterStore`'s exported type is unchanged, (b) `saveFilters`/`loadFilters` serialize the same keys (diff the serialized object against pre-refactor), (c) `pnpm check-types` passes; then the **user smoke-tests on-device**: open app with existing saved filters → filters survive (proves persist shape intact), toggle each filter axis, force-close/reopen.

### BasicMapScreen.tsx (608) & DailyFilterModal.tsx (894) — extract by concern

`BasicMapScreen` mixes Mapbox camera, location permission, dish markers, dead restaurant-marker branch, filter subscription, feed calls, deep-link handling. Cut into **custom hooks + presentational children** (the RN-idiomatic seam):

- `useMapCamera()` — camera/region state.
- `useLocationPermission()` — permission flow.
- `useFeedMarkers()` — feed subscription → marker data (calls existing services; no logic change).
- `<DishMarkerLayer />` — pure render of dish markers.
- **Delete** the restaurant-view-mode branch (line ~510) + `viewModeStore` + `ViewModeToggle` — this is a *separate scoped finding* in PROJECT.md; doing it as part of this split removes a whole concern and shrinks the screen for free. Sequence the dead-code removal **before** the extraction so you split less code.

`DailyFilterModal` → one sub-component per filter section (`<PriceSection/>`, `<DietSection/>`, `<ProteinSection/>`, `<CuisineSection/>`, `<SpiceSection/>`), each receiving value+onChange props bound to `filterStore` daily actions. Pure presentational extraction; state stays in the store.

### ReviewDishEditor.tsx (1258, admin) — extract by editor region, keep RPC shape

Coupled to the `admin_confirm_menu_scan` RPC payload shape. Split along the form's regions, **not** the submit boundary:
- `<DishFieldsForm />` (name/desc/price/protein/category), `<ModifierGroupsEditor />` (delegates to existing `DishRowEditor`/modifier helpers), `<DishImagePanel />`.
- Keep **one** `buildConfirmPayload()` function and **one** submit call so the RPC contract stays in a single place (it already has integration-test coverage at `admin-confirm-rpc.test.ts` — that test is the regression gate; do not change the payload shape).

### Build-order within Q3
Extraction order is always **types/defaults → pure selectors → presentational children → action slices → persistence/serialization seam (last, highest-risk)**. For BasicMapScreen, **dead-code removal precedes extraction.**

---

## Q4 — Cache invalidation on menu change

### Major finding: this is ~80% already built

`infra/supabase/functions/invalidate-cache/index.ts` **already exists** and is wired as a **Supabase DB webhook** on `UPDATE` of `restaurants` / `menus` / `dishes`. It clears the entire `feed:v2:*` namespace via cursor-paged SCAN+DEL (correct for a single-operator app — the feed cache key `feed:v2:{user}:{geo}:{filters}` carries no `restaurant_id`, so per-restaurant targeting is impossible anyway and full-flush is the right simple choice). The feed function writes that key with `ex: 300` (5-min TTL). So passive expiry already exists *and* an event-driven buster already exists for UPDATEs.

### The actual gap (narrow)
`admin_confirm_menu_scan` writes dishes via **INSERT** (new dishes from a scan) as well as UPDATE, and the menu-confirm path may write through an RPC. Two things to verify/close:

1. **Webhook event coverage.** Confirm the DB webhook fires on **INSERT and DELETE**, not just UPDATE (the function's header only documents `type: 'UPDATE'`). A fresh menu scan that *inserts* new dishes must bust the feed cache too. **Fix: ensure the webhook is configured for INSERT/UPDATE/DELETE on `dishes`/`menus`/`restaurants`** (Supabase dashboard webhook config or a `supabase_functions` trigger migration).
2. **RPC-path coverage.** If `admin_confirm_menu_scan` performs bulk writes inside a single transaction, confirm the row-level webhook trigger still fires per affected row (it does, for statement/row triggers) — or, more robustly, **add an explicit cache-bust call at the end of the RPC's success path**, calling the existing `invalidate-cache` function (or directly issuing the SCAN+DEL through `pg_net`/`http`).

### Recommended approach (ranked)
- **Preferred:** rely on / repair the existing **DB webhook** (ensure INSERT+UPDATE+DELETE coverage). It is the cleanest seam — invalidation is a *data-change* concern, not an *application-flow* concern, so hooking it at the table-change layer means *every* write path (admin RPC, future scripts, manual edits) is covered automatically. This is strictly better than hooking the RPC.
- **Fallback / belt-and-suspenders:** if webhook event coverage can't be guaranteed for the RPC's write pattern, add an explicit `invalidate-cache` invocation at the tail of `admin_confirm_menu_scan` (or in the admin server action that calls it). This is the "hook the RPC" option the milestone asked about — but treat it as the *secondary* mechanism, not the primary one.

**Do not** build a brand-new invalidation system. The finding in CONCERNS ("relies on passive expiry, not event-driven purge") is partially stale — event-driven purge exists; the work is verifying/completing its event coverage.

### Seam / build-order for Q4
1. Verify webhook config covers INSERT/UPDATE/DELETE on the 3 tables (assessment step — fits the milestone's "assessment-first" register).
2. If a gap: either widen the webhook (preferred) or add explicit bust in the RPC/server action.
3. Tighten `invalidate-cache` CORS at the same time (it currently sets `*` — same finding class as the `feed`/`enrich-dish` CORS lockdown). Webhook callers are server-to-server, so CORS can be locked hard.

---

## Cross-cutting build-order (how the four items sequence)

```
Independent tracks (can run in parallel):
  Q3 refactors ── mobile (filterStore, BasicMapScreen+dead-code, DailyFilterModal)
              └── admin   (ReviewDishEditor)        [on-device / test gates]

  Q4 cache  ── verify webhook → (widen or RPC-hook) + CORS lockdown   [edge only]

  Q2 geo    ── A: edge-function tiered radius (no migration)          [edge only]
            └── B: per-restaurant centroid (migration + backfill)     [later]

Sequenced track (must be ordered):
  Q1  Phase B (mig 151, ready) ──▶ snapshot ──▶ Phase C tables ──▶ Phase C columns
       └──────────────────────────────────────────────────────────▶ regenerate types
                                                                       ▲
  (Q1 Step 6 "regenerate types" is ALSO the fix for the stale-types finding;
   do it once, after Phase C, to capture the slim schema in a single commit.)
```

**Key inter-item dependencies:**
- **Q1 → types regen → typecheck** is the spine; it gates the "regenerate `@eatme/database` types" PROJECT.md item. Don't regenerate types twice — do it after Phase C lands.
- **Q3 mobile dead-code removal (viewModeStore branch)** overlaps the standalone "remove dead map restaurant-view-mode branch" finding — fold them together; remove the branch *before* splitting BasicMapScreen.
- **Q4 CORS lockdown** overlaps the standalone "lock down wildcard CORS" finding — `invalidate-cache` is a third file (alongside `feed`, `enrich-dish`) to lock in that pass.
- **Q2-A** is fully independent and shippable first as the cheapest perf win.

---

## Anti-Patterns (specific to this hardening cycle)

### Reordering the feed to true ANN-first
**What people do:** `ORDER BY embedding <=> v LIMIT 500` then geo-filter, to "use the HNSW index."
**Why it's wrong:** the feed is geo-bounded by definition; global taste-top-500 can contain ~0 dishes in the user's city → empty feeds. Correctness regression masquerading as a perf fix.
**Do this instead:** keep geo-filter-first; reduce the in-radius set with tiered radius (Q2-A) or a restaurant-level ANN pre-filter (Q2-B).

### Moving the persist serialization seam during the store split
**What people do:** "tidy up" field names or nesting while extracting `filterStore` slices.
**Why it's wrong:** `saveFilters`/`loadFilters` define the on-disk AsyncStorage contract (no `persist` middleware = no version/migrate safety net). Any rename silently drops every existing user's saved filters on update.
**Do this instead:** extract `persistence.ts` last, keep the serialized object byte-identical, diff the serialized shape before/after, on-device smoke test that saved filters survive a reinstall-less restart.

### Building a new cache-invalidation system
**What people do:** read "relies on passive expiry" in CONCERNS and architect an event bus.
**Why it's wrong:** `invalidate-cache` already does event-driven SCAN+DEL of `feed:v2:*` via DB webhook. The real gap is *event coverage* (INSERT/DELETE), not the mechanism.
**Do this instead:** verify/widen the existing webhook; only add an RPC-tail bust as a fallback.

### Dropping ingredient tables before the grep + snapshot gates
**What people do:** run Phase C because Phase B shipped.
**Why it's wrong:** Phase C is one-way; with no psql the *compile-after-regen* and *grep* are your only verifications, and the snapshot is the only restore path.
**Do this instead:** Step 0 grep → Step 3 snapshot → drop → Step 6 regen+typecheck, in that order, never skipping.

---

## Integration Points

### Internal boundaries touched this cycle

| Boundary | Communication | Notes |
|----------|---------------|-------|
| feed edge fn ↔ `generate_candidates` RPC | `supabase.rpc()` with service-role | Q2-A wraps this call in an expanding-radius loop; response shape unchanged for mobile |
| dishes/menus/restaurants writes ↔ `invalidate-cache` | Supabase DB webhook (HTTP) | Q4: verify INSERT/UPDATE/DELETE coverage; webhook is the preferred invalidation seam |
| `admin_confirm_menu_scan` RPC ↔ feed cache | (currently) via row webhook; (fallback) explicit call | Q4 fallback only if webhook coverage insufficient |
| mobile consumers ↔ `useFilterStore` | direct Zustand hook import | Q3: public API + import path MUST stay identical across the slice split |
| `@eatme/database` types ↔ all apps | generated `Database` type import | Q1 Step 6 regen slims it; compile is the teardown verification gate |

### External services (unchanged but relevant)

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Upstash Redis | `getRedis()` in feed + invalidate-cache | feed key `feed:v2:{user}:{geo}:{filters}`, `ex:300`; full-namespace flush on menu change |
| pgvector / HNSW (mig 136) | `embedding <=> v` in generate_candidates | currently unused by the planner (geo-filter-first); Q2-B would make it usable at restaurant level |
| Mapbox | mobile map layer | Q3 BasicMapScreen split must preserve camera/marker behavior; on-device only |

---

## Scaling Considerations

| Scale | Architecture adjustments |
|-------|--------------------------|
| Now (≈0 prod users, current catalog) | Q2-A (tiered radius) is sufficient headroom; Phase B/C calendar gates collapse (no traffic to observe) |
| Catalog grows (denser dish/restaurant set) | Q2-B (per-restaurant centroid + restaurant-level ANN) becomes the durable fix; revisit `feed:v2` flush granularity if write rate rises |
| Multi-city / large scale | Q2-C (geo-tiling/partitioning) and per-restaurant feed cache keys become worth their complexity — deferred until then |

### Scaling priorities
1. **First bottleneck:** `generate_candidates` at large radius → Q2-A now, Q2-B next.
2. **Second bottleneck:** feed Stage-2 JS payload size (full dish records, growing modifier groups) → push diversity cap/final sort toward SQL (separate PROJECT.md item; complements Q2 but architecturally independent).

---

## Sources

- `infra/supabase/migrations/151_retire_ingredient_triggers.sql` (Phase B, authored) — HIGH (primary source)
- `infra/supabase/migrations/169_generate_candidates_pushdown.sql` (geo-filter-then-rank confirmed) — HIGH
- `infra/supabase/migrations/136_hnsw_dishes_embedding.sql` (HNSW index, currently unused by planner) — HIGH
- `infra/supabase/functions/invalidate-cache/index.ts` (event-driven buster already exists) — HIGH
- `infra/supabase/functions/feed/index.ts` (cache key + ex:300 + Stage-1 RPC seam) — HIGH
- `apps/mobile/src/stores/filterStore.ts` (manual AsyncStorage persistence, no persist middleware) — HIGH
- `docs/plans/ingredient-pipeline-phase-c-schema-retirement.md` (snapshot + drop order + verification) — HIGH
- `.planning/codebase/CONCERNS.md`, `.planning/PROJECT.md` (scope, constraints) — HIGH

---
*Architecture research for: EatMe codebase-hardening milestone*
*Researched: 2026-06-18*
