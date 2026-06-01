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

## Phase 1 — Clean ingestion (stop the bleed)

Highest leverage, no DB migration, self-contained. Every new import produces canonical cuisine.

### 1a. Shared normalizer — `packages/shared/src/constants/cuisine.ts`
- Add `normalizeCuisines(input: string[]): string[]` — accent/case-insensitive match back to the
  canonical-cased value, deduped, drops unmatched. Build a `Map<foldedKey, canonical>` from
  `ALL_CUISINES` (fold = lowercase + strip diacritics). So `'cafe'`/`'CAFÉ'` → `'Café'`.
- ✅ DONE (2026-05-31): added `'Breakfast'`, `'Desserts'`, `'Taiwanese'` to `ALL_CUISINES` +
  matching `filters.cuisines.{breakfast,desserts,taiwanese}` labels in en/es/pl. (`'Brunch'`
  excluded — see decision 1.)

### 1b. Canonical-align Google mapping — `web-portal/lib/google-places.ts`
- ✅ DONE (2026-05-31): `GOOGLE_TYPE_TO_CUISINE` `cafe: 'Café'` (was `'Cafe'`). With 1a's additions,
  `breakfast_restaurant`→`'Breakfast'` and `ice_cream_shop`→`'Desserts'` now resolve to canonical
  values and survive validation. ⚠️ `brunch_restaurant`→`'Brunch'` still non-canonical (decision 1).
- `inferCuisineFromGoogleTypes(types, primaryType?)`: also consider `primaryType` (decision: include
  it first, it's the most specific). Run the result through `normalizeCuisines` before returning.
- `mapGooglePlaceToRestaurant` (`:434`): pass `place.primaryType` through.

### 1c. One validation policy — both import paths
- `web-portal/lib/import-validation.ts:88-89`: replace the inline `.filter(includes)` with
  `normalizeCuisines(r.cuisine_types)`.
- `apps/admin/src/app/api/admin/import-csv/route.ts:171-185`: run the comma-split array through
  `normalizeCuisines` before insert (currently unvalidated). This closes the junk-in path.

### Verification (Phase 1)
- Unit: `normalizeCuisines` — accent fold, case fold, dedupe, drop-unknown.
- Update `google-places` inference test (primaryType + canonical output).
- Update/add `import-csv/route.test.ts` (non-canonical + accent inputs → canonical).
- `turbo check-types`, `turbo lint`, `turbo test` green.

---

## Phase 2 — Backfill existing data

Fixes restaurants already imported with empty/non-canonical cuisine (incl. the user's test data).

### 2a. Normalize migration — `infra/supabase/migrations/`
- One-shot SQL/script: for every restaurant, rewrite `cuisine_types` via the canonical map
  (`'Cafe'`→`'Café'`, drop unknowns). Implement as a migration that updates rows, or a Node script
  that reads, runs `normalizeCuisines`, and writes back (keeps one JS policy).
- Optional: for rows with empty `cuisine_types` **and** a `google_place_id`, re-run Google inference.

### Verification (Phase 2)
- Dry-run count of affected rows before/after.
- Spot-check the previously-empty test restaurant now shows cuisine in the mobile detail view.

---

## Phase 3 — Recovery path: menu-scan cuisine inference

Ongoing backfill so a missing cuisine self-heals on the next scan. Medium effort (AI prompt + write).

### 3a. `web-portal/app/api/menu-scan/route.ts` (and admin equivalent if present)
- When the target restaurant's `cuisine_types` is empty, ask the model to infer 1–3 cuisines from
  the scanned dishes/menu, pass through `normalizeCuisines`, and write to `restaurants.cuisine_types`.
- Never overwrite a non-empty cuisine — inference is a fallback only.

### Verification (Phase 3)
- Scan a menu for an empty-cuisine restaurant → cuisine populated with canonical values.

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
