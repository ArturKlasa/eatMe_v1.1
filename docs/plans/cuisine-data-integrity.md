# Cuisine Data Integrity — Fix Plan

**Status:** Proposed
**Created:** 2026-05-31
**Owner:** solo (commit straight to `main`)

## Problem

A restaurant's cuisine is a denormalized `restaurants.cuisine_types text[]` matched by **exact
string** against the shared `ALL_CUISINES` constant (`packages/shared/src/constants/cuisine.ts`).
There is no DB constraint and no normalization on match. The result: many restaurants end up with
**empty or non-canonical** `cuisine_types`, and because the mobile map applies a **hard** cuisine
filter, those restaurants silently disappear when a consumer selects a cuisine. (Full problem
inventory: see the 15-row table in the session that produced this plan.)

### Root causes (verified)

| Layer | Fault | Evidence |
|---|---|---|
| Ingestion | `GOOGLE_TYPE_TO_CUISINE` emits non-canonical strings | `web-portal/lib/google-places.ts:60-64` (`'Cafe'`≠`'Café'`, `'Desserts'`, `'Breakfast'`, `'Brunch'`) |
| Ingestion | `place.primaryType` fetched but ignored | `google-places.ts:19,130` vs `:429,434` |
| Validation | Google path **drops** non-canonical → empty array | `web-portal/lib/import-validation.ts:88-89` |
| Validation | Admin CSV path does **no** validation → junk reaches DB | `apps/admin/src/app/api/admin/import-csv/route.ts:171-185,194-197` |
| Recovery | Menu scan never sets cuisine | `web-portal/app/api/menu-scan/route.ts` (no cuisine field) |
| Matching | Exact-string match, no normalization | `feed/index.ts:298`, `nearby-restaurants/index.ts:206` |
| Matching | Map filter is **hard** (`.overlaps`) → empty cuisine = excluded | `nearby-restaurants/index.ts:205-206` (live: `geoService.ts:127`) |
| Mobile | `permanent.cuisinePreferences` is dead (no UI, no DB sync, never sent) | `filterStore.ts:148,677-685`; absent from `DrawerFilters.tsx`, `userPreferencesService.ts` |
| Edge | Group recs hardcode cuisine compatibility `0.5` | `group-recommendations/index.ts:125` |

## Strategy

**Fix the data at the source, normalize once, then backfill.** Keep exact-string matching at query
time (it's correct *when the data is clean*) and instead guarantee every write produces a canonical
value. One shared helper — `normalizeCuisines()` — becomes the single policy used by every ingestion
path, the backfill, and menu-scan inference.

## Open decisions (recommended default in **bold**)

1. **Google types with no canonical home** — ✅ RESOLVED (2026-05-31): added `Breakfast`,
   `Desserts`, and `Taiwanese` to `ALL_CUISINES` (+ en/es/pl labels); `Café` already existed so
   Google's `cafe` is remapped to it. **`Brunch` was deliberately NOT added.** Open sub-decision:
   `brunch_restaurant` still emits non-canonical `'Brunch'` → dropped on import. Remap it to
   `'Breakfast'`, or drop the `brunch_restaurant` mapping entirely?
2. **Map hard filter** (`nearby-restaurants`): **→ Keep hard, fix the data.** Once Phase 1+2 land,
   empty-cuisine restaurants are rare and a hard filter is the correct "show me Italian" semantics.
   Alternative: switch to a soft boost like the feed (larger UX change, Phase 5).
3. **Mobile dead `cuisinePreferences`**: **→ Wire it up** (small — the feed already reads
   `user_preferences.favorite_cuisines`). Alternative: delete the field. Phase 4.

---

## Phase 1 — Clean ingestion (stop the bleed) — ✅ COMPLETE (2026-05-31)

Highest leverage, no DB migration, self-contained. Every new import produces canonical cuisine.

### 1a. Shared normalizer — `packages/shared/src/constants/cuisine.ts`
- ✅ DONE: `normalizeCuisines(input)` added to `cuisine.ts` — folds (lowercase + strip diacritics)
  each input against a `Map<foldedKey, canonical>` of `ALL_CUISINES`, order-preserving, deduped,
  drops unmatched. `'cafe'`/`'CAFÉ'` → `'Café'`. Unit-tested (6 cases incl. every canonical → itself).
- ✅ DONE (2026-05-31): added `'Breakfast'`, `'Desserts'`, `'Taiwanese'` to `ALL_CUISINES` +
  matching `filters.cuisines.{breakfast,desserts,taiwanese}` labels in en/es/pl. (`'Brunch'`
  excluded — see decision 1.)

### 1b. Canonical-align Google mapping — `web-portal/lib/google-places.ts`
- ✅ DONE (2026-05-31): `GOOGLE_TYPE_TO_CUISINE` `cafe: 'Café'` (was `'Cafe'`). With 1a's additions,
  `breakfast_restaurant`→`'Breakfast'` and `ice_cream_shop`→`'Desserts'` now resolve to canonical
  values and survive validation. ⚠️ `brunch_restaurant`→`'Brunch'` still non-canonical (decision 1).
- ✅ DONE: expanded `GOOGLE_TYPE_TO_CUISINE` with ~50 keys (exact 1:1 + curated roll-ups), all
  canonical values, + an "intentionally unmapped" comment for venue/format types.
- ✅ DONE: `brunch_restaurant → 'Breakfast'` (decision 1 resolved — folded, not dropped).
- ✅ DONE: `inferCuisineFromGoogleTypes(types, primaryType?)` now considers `primaryType` first;
  `mapGooglePlaceToRestaurant` passes `place.primaryType` through.

### 1c. One validation policy — both import paths
- ✅ DONE: `web-portal/lib/import-validation.ts` now uses `normalizeCuisines(r.cuisine_types)`
  (removed the inline `.filter`/`VALID_CUISINES`). Near-misses are canonicalized, not dropped.
- ✅ DONE: `apps/admin/.../import-csv/route.ts` runs the comma-split array through
  `normalizeCuisines` before insert — the unvalidated junk-in path is closed.

### Verification (Phase 1) — ✅ all green
- `normalizeCuisines` unit spec (6 cases); `google-places` inference tests (+5 cases: new maps,
  roll-up, brunch→Breakfast, primaryType); `import-validation` canonicalization test; admin
  `csv-import` normalization test (captures the insert payload, 9/9).
- `@eatme/shared` + `admin` type-check exit 0; web-portal tsc 0 errors in changed files;
  eslint 0 errors. (Pre-existing & unrelated: 8 `v2-schemas` shared failures; 28 baseline
  web-portal tsc errors elsewhere.)

---

## Phase 2 — Backfill existing data — ✅ COMPLETE (2026-05-31)

Diagnostic dry-run revealed the real shape: of 322 restaurants, only 26 had cuisine, **296 were
empty (all Google-imported)**, and **0** carried non-canonical junk (the old validation *dropped*
bad values rather than storing them — so there was nothing to normalize).

### 2a. Normalize existing — `infra/scripts/backfill-cuisine-types.ts` — ✅ no-op
- Reads every restaurant, runs `cuisine_types` through a copied `normalizeCuisines`, writes back
  changed rows. `--dry-run` found **0 rows to change**. Kept as a repeatable guard.

### 2b. Re-infer empties from Google — `infra/scripts/backfill-cuisine-from-google.ts` — ✅ done
- For each empty-cuisine restaurant with a `google_place_id`, fetches `types` + `primaryType`,
  runs the expanded `inferCuisineFromGoogleTypes` + `normalizeCuisines`, writes the result.
  Batched (concurrency 5, 500ms delay); `--dry-run` + `--limit=N` for sampling.
- 25-row sample (56% hit, accurate, no bad assignments) → full live run: **198/296 populated,
  0 failed**. DB cuisine coverage **8% → 70%** (26 → 224 of 322).

### Residual (→ Phase 3)
- **98 restaurants stay empty** — Google only knows them as generic `restaurant`/`bar`. Menu-scan
  cuisine inference (Phase 3) is what can classify these from their actual dishes.

### Verification (Phase 2) — ✅
- Post-run DB count: 224/322 with cuisine (70%), 98 empty, 0 write failures.

---

## Phase 3 — Recovery path: cuisine inference from dishes — IN PROGRESS (2026-06-01)

### Research findings (2026-06-01)

**Two independent menu-scan engines** (each with its own prompt + save path). Phase 3
targets the **active** one only (decision: active-only).

| | Extraction | Save | Status |
|---|---|---|---|
| **Active** (`apps/admin`, :3001) | edge fn `menu-scan-worker` (`infra/supabase/functions/menu-scan-worker/index.ts`) — dish-level schema, no restaurant field | RPC `admin_confirm_menu_scan` | **← Phase 3 target** |
| Legacy (`apps/web-portal/app/admin`) | `app/api/menu-scan/route.ts` | `confirm/route.ts` | out of scope |

Neither engine touches `restaurants.cuisine_types` today. The active worker already has
`restaurant_id` + fetches the restaurant (for currency), so a cuisine write there is a single-file,
no-migration change.

**Read-only prod diagnostic** (`infra/scripts/diagnose-empty-cuisine.ts`): the 98 empty-cuisine
restaurants are two distinct populations:
- **18 already have dishes** (all ≥3) → classifiable **now** from their existing menu. Cuisine is
  obvious from dish names (Italian / Mexican / Lebanese / wine bars …).
- **80 are bare Google stubs with 0 dishes** → no menu = invisible in feed. They can only get
  cuisine *when scanned* — i.e. exactly when the worker self-heal (3b) fires. Not worth a special pass.

### Decisions (locked 2026-06-01)
- **Active engine only** — skip the legacy web-portal route/confirm.
- **Worker writes at scan time** — gated on empty, canonical-only, editable later. One edge-fn file,
  one deploy; self-heals even if the admin abandons the scan. (Alternative — carry inferred cuisine
  through the job result and write only at confirm — rejected as more plumbing for marginal gain.)
- **Do both 3a + 3b**; sequence 3a (quick coverage win) → 3b (durable forward fix).
- Added `OPENAI_API_KEY` to `infra/scripts/.env` (sourced from `apps/admin/.env.local`) for 3a.

### Live update (2026-06-01) — a Google import landed mid-implementation
Between two diagnostics ~15 min apart the table grew **322 → 455** restaurants (+133, almost all
generic Google stubs with no cuisine), and menu scans appear to be completing live (empty-with-dishes
climbing 18 → 22 → 28). Coverage now reads **224/455 (49%)** — *not a regression*: populated count is
unchanged (224); the denominator grew with empty stubs. Current split of the 231 empties: **28 with
dishes** (3a targets), **203 dishless stubs** (3b territory — self-heal when scanned). The 3a live
write is **held** until the scan/import wave settles, then one clean idempotent sweep catches all.

### Status (2026-06-01)
- **3a — DONE (live run complete 2026-06-02).** `backfill-cuisine-from-dishes.ts` +
  `diagnose-empty-cuisine.ts` (committed). Two idempotent live passes populated **28 restaurants**
  (21 + a 7-straggler sweep after more scans completed); coverage **224 → 252 / 455**. Every menu'd
  restaurant is now classified **except _Bad melody_** (a spirits-only bar with no inferable food
  cuisine — correctly left empty). The remaining 202 empties are dishless Google stubs → Phase 3b
  territory (classified if/when their menus are scanned).
- **3b — code complete + TESTED (28/28 green), pending edge-fn redeploy.** `menu-scan-worker/index.ts`:
  inlined `ALL_CUISINES`/`normalizeCuisines`, added `cuisine_types` to the extraction schema + prompt,
  cross-page union, and the gated best-effort `maybeWriteRestaurantCuisine` write. Worker tests updated
  (CANNED_RESULT field, restaurants shim, +2 self-heal tests). Verified with
  `deno test --node-modules-dir=none -A infra/supabase/functions/menu-scan-worker/test.ts` →
  **28 passed / 0 failed** (type-check ON). Pending: `supabase functions deploy menu-scan-worker` (user).
- **Pre-existing test-suite repair (bundled with 3b).** The worker suite was **red on `main`** (3/26
  passing): `fetchCanonicalSlugs` + `fetchRestaurantCurrency` (added with later features) call
  `supa.from(...)` but the mock had no `.from`, so every `processJobs` test threw. Also 5 type errors
  from `openai@4.104` drift (`new Headers()` → `{}`, `.map(makeJob)` arity). Repaired the mocks +
  type errors so the suite is green again — independent of cuisine, but required to verify 3b. Deno
  was installed locally (`~/.deno`, v2.8.1) to run it.

### 3a. Backfill the 18 from existing dishes — `infra/scripts/backfill-cuisine-from-dishes.ts`
- For each empty-cuisine restaurant **with ≥1 dish**: read up to ~40 dish names → one cheap
  `gpt-4o-mini` call (raw `fetch`, JSON mode — no SDK dep) asking for 1–3 cuisines **from the
  canonical `ALL_CUISINES` list only** → `normalizeCuisines` (safety gate) → write
  `restaurants.cuisine_types` when non-empty. Self-contained (inline `ALL_CUISINES` +
  `normalizeCuisines`), `--dry-run` + `--limit=N`, batched (concurrency 3). Never overwrites a
  non-empty cuisine. Pure-drinks bars may resolve to nothing canonical → left empty (better than wrong).
- Stage: **dry-run → sample (`--limit`) → full**. Expected coverage 70% → ~76% (224 → ~242 of 322).

### 3b. Worker self-heal (forward fix) — `infra/supabase/functions/menu-scan-worker/index.ts`
- Add top-level `cuisine_types: string[]` to the worker's local `MenuExtractionSchema`; instruct the
  model (in `buildExtractionPrompt`) to infer 1–3 cuisines for the restaurant **from the canonical
  list** (inline `ALL_CUISINES` copy, like currency/PRIMARY_PROTEINS are inlined). Inference rides
  the existing per-page vision call — no extra OpenAI cost.
- In `runExtraction`: union cuisines across pages; in `processJobs`: extend the restaurant fetch to
  also read `cuisine_types`, and **if empty**, `normalizeCuisines(...)` + `update` it after a
  successful extraction (before `complete_menu_scan_job`). Never overwrite non-empty.
- Covers the 80 stubs as they get scanned + every future generic import (which Phase 1 can't fix —
  Google has no cuisine for them). Requires an edge-fn redeploy (user action).

### Verification (Phase 3)
- 3a: dry-run shows sensible canonical cuisines for the 18; post-run DB count rises ~224 → ~242.
- 3b: `deno check` / worker test green; scan a (test) empty-cuisine restaurant → `cuisine_types`
  populated with canonical values; re-scan a populated restaurant → unchanged.

---

## Phase 4 — Mobile "favorite cuisines" (wire the dead field)

Decision 3. The feed **already** reads `user_preferences.favorite_cuisines` (`feed/index.ts:693`,
`+0.10` at `:324`) and accepts `filters.favoriteCuisines` (`:100,:780`). Minimal wiring:

- Add a cuisine multi-select section to `apps/mobile/src/components/DrawerFilters.tsx` →
  `setCuisinePreferences`.
- Map `cuisinePreferences` ⇄ `user_preferences.favorite_cuisines` in
  `permanentFiltersToDb`/`dbToPermanentFilters` (`userPreferencesService.ts`).
- (Optional) populate `filters.favoriteCuisines` in `edgeFunctionsService.buildFilters` for
  immediate effect without the DB round-trip.

If we instead choose to delete: remove `cuisinePreferences` + `setCuisinePreferences` from
`filterStore.ts`. Smaller, but discards a half-built feature.

### Verification (Phase 4)
- Set a favorite cuisine in the drawer → persists across app restart → feed boosts that cuisine.

---

## Phase 5 — Edge-function polish (optional)

- **5a.** Re-evaluate the map hard filter (decision 2) — only if we still see empty-cuisine misses
  after Phase 2. If softening: mirror `feed`'s soft-boost approach in `nearby-restaurants`.
- **5b.** Replace the hardcoded `0.5` cuisine compatibility in `group-recommendations/index.ts:125`
  with real member-cuisine overlap scoring.

---

## Out of scope
- Migrating `cuisine_types` to a normalized lookup table / FK (large schema change; exact-string +
  canonical constant is adequate once data is clean).
- Reworking the daily-filter UX beyond the cuisine wiring above.

## Suggested sequencing
Phase 1 → Phase 2 land together as the core fix (forward + backfill) and directly resolve the
"I don't see cuisine / the filter hides everything" complaint. Phases 3–5 are follow-ups.
