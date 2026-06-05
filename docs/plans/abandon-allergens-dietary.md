# Abandon dish-level allergens + dietary tags

**Status:** Proposed
**Last updated:** 2026-06-04
**Scope:** Formally retire the allergen and dietary-tag system. Drop the columns on `dishes`, `options`, and `user_preferences`. Drop the standalone `public.allergens` / `public.dietary_tags` lookup tables. Replace `generate_candidates` RPC with a version that no longer accepts allergen/dietary parameters. Strip the related UI from the mobile filter drawer, dish detail screen, admin modifier editor, and owner-facing form. Mirror the changes in `apps/web-portal-v2/` so the paused app stays revivable. `primary_protein` is the sole surviving food-classification axis — the vegan/vegetarian emoji on dish rows + the Diet Preference drawer toggle get rewired to it.
**Out of scope:** Re-introducing any allergen functionality (no AI-extraction fallback, no manual chip pickers anywhere). If allergen-safety is ever revived as a product pillar, it gets designed fresh.
**Sequencing:** Single rollout. No real users yet (per session memory), so the cutover can be tight: code commits land first, edge functions redeploy, migration applies. Detailed sequencing in §10.

---

## 1. Confirmed decisions

| # | Decision | Resolution |
|---|---|---|
| 1 | Option-level modifier fields (`options.adds_allergens`, `removes_dietary_tags`, `adds_dietary_tags`) | **Drop all three** — they're deltas on a base that no longer exists |
| 2 | Standalone lookup tables (`public.allergens`, `public.dietary_tags`) | **Drop both** — orphaned post-Phase C |
| 3 | `user_preferences.allergies` and `user_preferences.preferred_dietary_tags` | **Drop both** — no users; pure inputs to a removed system |
| 4 | `apps/web-portal-v2/` (paused) | **Mirror the v1 edits** so v2 stays revivable |
| 5 | Pescatarian filter (derivable from `primary_protein`) | **Drop** — alongside Diabetic/Keto/Paleo/Low-carb |
| 6 | Vegan/vegetarian emoji on dish rows | **Keep**, rewire to `primary_protein` enum values |

---

## 2. Background

After Ingredient Pipeline Phases A/B/C, the only data flowing into `dishes.allergens` / `dishes.dietary_tags` is the owner-facing checkbox UX in `apps/web-portal/`. The columns are empty for every dish created via menu scan, admin manual entry, or any backfill — the production data is ~100% empty arrays. The mobile filter drawer renders six sections of allergen / dietary controls that filter on those empty arrays, so the UI is visibly active but functionally inert.

The user (sole data-entry operator) cannot reliably fill the columns: they know `primary_protein` per dish but not the full allergen / dietary profile. Re-enabling AI extraction was considered and rejected — see chat transcript 2026-06-04.

The product decision is: **EatMe is a discovery + protein-based filtering app, not an allergen-safety app.** The four-way `primary_protein` family system (meat / poultry / fish / shellfish / eggs / vegetarian / vegan) covers the highest-stakes allergen subset (fish, shellfish, eggs) and the vegan/vegetarian dietary axis. Everything else (dairy, gluten, peanuts, tree nuts, soy, sesame, halal, kosher, keto, etc.) is intentionally outside scope.

---

## 3. What survives

Confirm before starting that nothing below gets touched (or only gets rewired, as noted):

- `dishes.primary_protein` (enum, NOT NULL)
- `PRIMARY_PROTEINS` constant in `@eatme/shared`
- `deriveProteinFields()` helper + `protein_families` / `protein_canonical_names` derived fields
- `options.primary_protein` (used for preferred-protein highlighting in modifier rows)
- The daily filter modal's meat-type chips (driven by `primary_protein`)
- The Diet Preference (All / Vegetarian / Vegan) **permanent** drawer section — rewired to read `primary_protein` instead of `dietary_tags`. **Hard filter** (excludes non-matching dishes from feed).
- The Diet Preference (Vegetarian / Vegan) **daily** modal section — refactored from `{ vegetarian: boolean; vegan: boolean }` to a single `DietPreference | null` shape. **Soft signal** (re-ranks matching dishes; never excludes). See §3.5.
- The vegan 🌱 / vegetarian 🥬 emoji on `DishMenuItem`, but **rewired** to `primary_protein`
- All restaurant-facility filters (independent system)

---

## 3.5. Filter semantics — hard vs soft contract

EatMe's two filter layers serve different roles. Locking this in explicitly so future work doesn't blur the boundary.

### Permanent filters — HARD

- Set in the side drawer (`DrawerFilters`). Persisted to `user_preferences` via `userPreferencesService`. Survives sessions.
- **Effect:** excludes non-matching dishes from the feed entirely. Implemented at the RPC level via `WHERE` clauses on `primary_protein` / `protein_families`.
- **Examples after this rollout:**
  - Permanent Diet Preference = "Vegetarian" → feed excludes any dish whose `primary_protein` family is `meat`, `poultry`, `fish`, `shellfish`, or `eggs`.
  - Permanent Exclude = "No fish" → feed excludes any dish whose `primary_protein` family is `fish`.

### Daily filters — SOFT

- Set in the bottom-sheet modal (`DailyFilterModal`), launched from `FilterFAB`. Session-only — resets on app restart. Not persisted.
- **Effect:** never excludes; re-ranks matching dishes to the top of the feed. Implemented at the RPC level via `ORDER BY` priority terms.
- **Examples after this rollout:**
  - Daily Diet Preference = "Vegetarian" (with permanent = "All") → feed shows all dishes, vegetarian ones ranked first.
  - Daily Protein Type = "Fish" → feed shows all dishes that pass permanent filters, fish-protein ones ranked first.

### Concrete user scenarios

| User stance | Permanent | Daily | Feed result |
|---|---|---|---|
| Strict vegetarian | Vegetarian | (anything) | Only vegetarian dishes shown |
| Strict vegetarian, wants vegan today | Vegetarian | Vegan | Only vegetarian dishes; vegan ones ranked first |
| Flexitarian, normally meat-eater | All | (null — no daily) | All dishes shown, default ranking |
| Flexitarian, wants vegetarian today | All | Vegetarian | All dishes shown, vegetarian ones ranked first |
| Curious about fish today | All | (proteinType: Fish) | All dishes shown, fish dishes ranked first |

### Implementation contract

The feed RPC takes **two distinct sets of dietary parameters**:

- `p_excluded_protein_families text[]` — HARD; populated from `permanent.exclude` + `permanent.dietPreference`. Used in `WHERE` to exclude.
- `p_preferred_protein_families text[]` — SOFT; populated from `daily.proteinTypes`. Used in `ORDER BY` to rank.
- `p_diet_preference_hard text` (nullable) — HARD; the literal value of `permanent.dietPreference` if non-`'all'`. Used in `WHERE`.
- `p_diet_preference_soft text` (nullable) — SOFT; the literal value of `daily.dietPreference` if non-null. Used in `ORDER BY`.

Mobile clients map permanent + daily state to these four params in `edgeFunctionsService.ts`. The edge function passes them through to `generate_candidates`. See §10 for the SQL sketch.

---

## 4. Phase 1 — Shared package (`packages/shared/`)

Land first; everything else type-checks against this.

### Files

- **Delete** `packages/shared/src/constants/dietary.ts` — `DIETARY_TAGS`, `ALLERGENS`, `RELIGIOUS_REQUIREMENTS` constants, `DietaryTagCode`, `AllergenCode` types
- `packages/shared/src/constants/index.ts` — remove the `export * from './dietary'` line
- `packages/shared/src/types/restaurant.ts`
  - `Option` interface: remove `adds_dietary_tags`, `removes_dietary_tags`, `adds_allergens` (lines ~70–74)
  - `Dish` interface: remove `dietary_tags`, `allergens` (lines ~138–139)
- `packages/shared/src/validation/dish.ts`
  - `dishSchemaV2`: remove `dietary_tags: z.array(z.string()).default([])` and `allergens: z.array(z.string()).default([])` (lines ~35–36)
- `packages/shared/src/validation/menuScan.ts`
  - `modifierOptionSchema`: remove `removes_dietary_tags` and `adds_allergens` (lines ~60–61)
  - Update or remove the comment block at lines 82–86 referencing the AI exclusion
- `packages/shared/src/validation/restaurant.ts`
  - `dishSchema`: remove `dietary_tags` and `allergens` array fields (lines 60–61)
- Drop stale comments referencing "auto-populated by Postgres trigger" wherever they appear in the validation files

### Verification

```bash
cd packages/shared && pnpm build
pnpm turbo check-types --filter=@eatme/shared
```

Expected: clean build, all consumers (mobile, web-portal, admin) will type-fail until their phases land.

---

## 5. Phase 2 — Edge functions (`infra/supabase/functions/`)

Critical for cutover ordering — must redeploy before the DB migration runs (§10).

### `feed/index.ts`

- `Candidate` interface (line ~95): remove `allergens`, `dietary_tags`, option `removes_dietary_tags`, `adds_allergens` (lines 139–140, 174–175)
- Request body schema: **drop allergen fields entirely; keep dietary preference fields but rewire them to the new four-param model (§3.5).** Specifically: drop `allergens`, `effective_allergens`, anything tied to `removes_dietary_tags` / `adds_allergens`. Add or rename: `excluded_protein_families`, `preferred_protein_families`, `diet_preference_hard`, `diet_preference_soft`.
- Comments around line 441 ("User hard constraints (allergens, dietPreference) filter…"): rewrite to describe the hard/soft contract — hard params are excluding filters, soft params are ranking signals.
- Filtering pass at lines 476–521: remove the `adds_allergens && p_allergens` check, the `removes_dietary_tags` conflict check, and the effective-tag computation (lines 555–558). The function no longer post-filters candidates on dietary fields — the RPC's `WHERE` handles hard exclusion and `ORDER BY` handles soft rank.
- Response shape: remove `effective_dietary_tags` and `effective_allergens` from per-dish output (lines 574–575)
- `generate_candidates` RPC call at line 863+: drop the `p_allergens` argument; pass the four new dietary params (see §3.5 + §10) instead.
- Drop `allergens` and `dietary_tags` from the response transformer (lines 970–971, 982–983)

### `nearby-restaurants/index.ts`

- `Dish` type (lines 60–61): remove `allergens?`, `dietary_tags?`
- Filtering block (lines 110–127): remove dish-level filtering on these arrays
- Lines 196–197: drop fields from response shape

### `enrich-dish/index.ts`

- Line 51: remove `allergens: string[] | null` from local types
- Comments at line 85–89 + 215–223: remove union-of-base-and-options allergen logic entirely
- `baseAllergens` block (line 214–223): delete; replace embedding-text builder with one that uses only protein + descriptive fields
- Line 171: remove `allergens` from select column list
- Line 200: drop `options.adds_allergens` from nested select
- Decide: does enrich-dish still have a job after this? If embedding text was mostly allergen-driven, the function may collapse to near-no-op — flag for follow-up but **do not delete the function** in this rollout.

### `group-recommendations/index.ts`

- Lines 95–108: remove user-allergen aggregation
- Lines 184–185, 310, 320: drop `allergens` from RPC call args + response

### `menu-scan-worker/index.ts`

- `ConfirmedOption` zod schema (lines 57–59): remove `removes_dietary_tags`, `adds_allergens` (and `adds_dietary_tags` if present)
- AI prompt:
  - Remove the "Do NOT include allergens, dietary tags…" sentence (line 439) — no longer applicable since we're not extracting them either
  - Remove the example block (lines 397–399) describing `removes_dietary_tags` / `adds_allergens`
- Response parser: simplify accordingly

### `menu-scan-worker/test.ts`

- Lines 642–643, 822–823, 832–833, 863, 885–886, 895–896, 913, 1000+: remove `removes_dietary_tags` / `adds_allergens` from all fixtures + assertions

### Verification

```bash
deno test --node-modules-dir=none -A infra/supabase/functions/menu-scan-worker/test.ts
deno check infra/supabase/functions/feed/index.ts
deno check infra/supabase/functions/nearby-restaurants/index.ts
deno check infra/supabase/functions/enrich-dish/index.ts
deno check infra/supabase/functions/group-recommendations/index.ts
```

Do **not** deploy yet — deploy comes in §10.

---

## 6. Phase 3 — Mobile app (`apps/mobile/`)

> ⚠️ **Before starting:** locales `en.json`, `es.json`, `pl.json` show as modified in your working tree from parallel cuisine/favorites work. Commit or stash that first to avoid stomping. Verify with `git status apps/mobile/src/locales/`.

### State management

- `apps/mobile/src/stores/filterStore.ts`
  - Remove `permanent.allergies` state shape (line 107) + toggler `toggleAllergy` (lines 192, 615–622)
  - Remove `permanent.dietTypes` state shape + toggler `toggleDietType` (drops Diabetic/Keto/Paleo/Low-carb/Pescatarian)
  - Remove `permanent.religiousRestrictions` state shape (line 127) + toggler `toggleReligiousRestriction` (lines 195, 641–648)
  - Trim `permanent.exclude` shape: remove `noDairy`; keep `noMeat`, `noFish`, `noSeafood`, `noEggs`
  - Rewire `setPermanentDietPreference` (All/Vegetarian/Vegan) to operate as a `primary_protein` filter, not a `dietary_tags` membership check
  - **Refactor (do NOT remove) `daily.dietPreference`** from `{ vegetarian: boolean; vegan: boolean }` (lines 41–44, 250–251) to `DietPreference | null` (where `DietPreference = 'all' | 'vegetarian' | 'vegan'`, and `null` means "no daily boost — defer to permanent"). Update `setDietPreference` toggler to take a single value or null. **This is a SOFT signal — see §3.5; the daily layer never excludes.**
  - Strip stale checks in compute-filter-count helpers (lines 1037–1050 reference `permanent.allergies` and `permanent.religiousRestrictions`)
  - Update active-filter counters so daily Diet Preference contributes to the count only when set (i.e., non-null)
  - **No Zustand persist migrator needed.** This store isn't persisted via Zustand middleware; permanent filters are server-synced through `userPreferencesService` (see lines 837, 918). The sync payload drops automatically when the user_preferences columns go away in §10.
- `apps/mobile/src/stores/restaurantStore.ts` — line 336: drop `adds_dietary_tags, removes_dietary_tags, adds_allergens` from the options SELECT column list

### Filter UI

- `apps/mobile/src/components/DrawerFilters.tsx`
  - File-level docstring (lines 1–11): rewrite to describe 3 sections (Diet Preference, Exclude, Facilities)
  - Delete sections 3 (Allergies, lines 136–162), 4 (Diet Preferences, lines 164–190), 5 (Religious Restrictions, lines 192–222)
  - Trim section 2 Exclude options to four (`noMeat`/`noFish`/`noSeafood`/`noEggs`)
  - Keep section 1 (Diet Preference); the store change above means it now filters on protein
  - `isExcludeDisabled()`: drop the dairy-related branch; vegetarian/vegan disabling logic for noMeat/noFish/noSeafood stays
- `apps/mobile/src/components/FilterComponents.tsx`
  - Refactor the **Diet Options** block (~lines 255–320) to render the new single-value `daily.dietPreference` shape. Replace the `dietPreferenceOptions` boolean toggle list with a single-select chip group (All / Vegetarian / Vegan) where the active selection is `daily.dietPreference` and null/no-selection is also rendered (e.g., highlighted "All" when null, or a dedicated "Use default" affordance).
  - Update the `setDietPreference` call sites to pass a single value or null, not toggle a boolean field.
  - Keep the protein-type sub-block (meat/fish/seafood, lines 268–270) — already protein-based; no change
  - Audit and remove any other sub-renderers exclusively used by deleted sections (allergy/religious/diet-type — separate from this block)
- `apps/mobile/src/components/map/DailyFilterModal.tsx`
  - Refactor the `🥗 {t('filters.dietPreferences')}` section (around line 158) to render the new single-value shape. Replace the dual-boolean toggle logic (lines 198–231) with a single-value setter. Visually: 3 chips (All / Vegetarian / Vegan) with single-select behavior, optionally a 4th "no preference / use default" chip.
  - Keep the protein-type chips block (lines 190–193) — already protein-based; no change
- `apps/mobile/src/components/FilterFAB.tsx` — update active-filter-count calculation to handle the new daily shape (non-null Diet Preference counts as one active filter) and to drop removed categories (allergies, dietTypes, religiousRestrictions)

### Filter classification

- `apps/mobile/src/utils/menuFilterUtils.ts`
  - `Dish` local interface: remove `allergens`, `dietary_tags`
  - `Option` local interface: remove `adds_allergens`, `removes_dietary_tags`
  - `classifyDish()`: replace dish-level allergen + dietary_tag membership checks with `primary_protein` checks against **permanent.dietPreference + permanent.exclude only** (HARD filter). The returned `passesHardFilters` boolean stays — its trigger set narrows. **Do NOT consult `daily.dietPreference` here** — daily is a soft-rank signal, applied at the RPC level via `ORDER BY`, not client-side filtering.
  - `classifyOption()`: remove `triggersAllergy` and `stripsDietaryTags` from the return type; keep `matchesDailyMeatType` (it's protein-based). Update the consuming component (next).

### Restaurant detail screen

- `apps/mobile/src/screens/restaurant-detail/useRestaurantDetail.ts`
  - Drop the `optionAllergenMap` derivation (lines 261–268) — no allergen state to track per option anymore
  - Remove the `setOptionAllergens` call and any state holding it; remove the prop from `useRestaurantDetail` return shape if it was exposed
- `apps/mobile/src/screens/restaurant-detail/ModifierGroupsList.tsx`
  - Drop the two `Option` import fields `adds_allergens` and `removes_dietary_tags` from the destructured input to `classifyOption` (lines 160–161)
  - Delete the `hasAllergyConflict` red chip (lines 168, 181–182)
  - Delete the `hasDietConflict` yellow chip (lines 169, 184–185)
  - Keep the preferred-protein highlight + the price chip
  - Remove the `Chip` helper component + chip styles if no longer used (styles around lines 260–283 — check if anything else references `chipError`/`chipWarning` first)
- `apps/mobile/src/screens/restaurant-detail/DishMenuItem.tsx`
  - Lines 93–96: replace `item.dietary_tags?.includes('vegan')` / `'vegetarian'` checks with `item.primary_protein === 'vegan'` / `=== 'vegetarian'`
- `apps/mobile/src/screens/restaurant-detail/RestaurantDetailScreen.tsx`, `FoodTab.tsx` — audit for any remaining reads of dish-level allergens; remove

### Services

- `apps/mobile/src/services/edgeFunctionsService.ts`
  - `Candidate` / response types (lines 27–28, 35–36): remove `allergens`, `dietary_tags`, `effective_allergens`, `effective_dietary_tags`
  - Line 87 comments + line 216: drop the `permanentFilters.allergies` → array mapping for the feed request body
  - **Add the four new dietary params** to the feed request body construction (per §3.5):
    - `excluded_protein_families` (hard) — derived from `permanent.exclude` + `permanent.dietPreference`
    - `preferred_protein_families` (soft) — derived from `daily.proteinTypes`
    - `diet_preference_hard` (string|null) — `permanent.dietPreference` if non-`'all'`, else null
    - `diet_preference_soft` (string|null) — `daily.dietPreference` if non-null, else null
- `apps/mobile/src/services/userPreferencesService.ts`
  - Lines 33, 156: remove the read / write of `user_preferences.allergies` and `preferred_dietary_tags`
- `apps/mobile/src/services/geoService.ts` — `Dish` type (lines 54–55): remove `dietary_tags?`, `allergens?`
- `apps/mobile/src/services/eatTogetherService.ts` — audit for allergen aggregation; remove if present

### Types

- `apps/mobile/src/lib/supabase.ts`
  - Comment block (line 49): drop allergen/dietary mentions
  - Lines 63: remove `adds_dietary_tags?: string[] | null` from `Option`
  - Lines 27–28, 35–36: remove `allergens?`, `dietary_tags?` from Candidate / Dish

### Entry-point screens

- `apps/mobile/src/screens/BasicMapScreen.tsx`
  - Lines 77–78, 181–182, 243–244: remove `effective_dietary_tags`, `effective_allergens`, `allergens`, `dietary_tags` from local dish shape + `buildDish`
- `apps/mobile/src/screens/ProfileScreen.tsx` / `SettingsScreen.tsx` — audit any "X allergies" / "Y dietary restrictions" summary lines; remove

### Onboarding flow

The onboarding wizard's Step 1 ("Your Dietary Preferences") collects allergies into `user_preferences.allergies`. With that column gone, the allergen portion of the step disappears entirely; the diet-preference portion gets a routing decision (see open question below).

- `apps/mobile/src/screens/onboarding/OnboardingStep1Screen.tsx`
  - Delete the `ALLERGY_OPTIONS` array (lines 29–34: nuts, dairy, gluten, shellfish, eggs, soy)
  - Delete the `toggleAllergy()` handler (lines 77–82)
  - Delete the allergy-question section title + chip-render block (around line 170 and surrounding UI)
  - Delete the debug log lines referencing `formData.allergies` (lines 51–56)
  - **Open: Diet-preference selection (vegetarian/vegan, lines 17–18).** Two options: (a) delete this step entirely — users set Diet Preference in the main filter drawer post-onboarding; (b) keep it and rewire to write to a primary-protein-aware field. Recommend (a) — fewer surfaces, no duplication with the drawer, and Step 1 collapses into the next non-dietary step.
- `apps/mobile/src/stores/onboardingStore.ts`
  - Remove `allergies: string[]` from the form-data shape (line 17), default value (line 77), sanitizer block (lines 117–119), persistence calls (lines 175, 331), rehydration (line 264), and gamification scoring (lines 389, 399)
- `apps/mobile/src/screens/onboarding/` — audit other step screens for related references; renumber/relink Step 1 if it collapses to nothing

### Constants + icons

- `apps/mobile/src/constants/icons.ts` — remove icon entries used only by removed UI

### i18n

After committing your parallel locale work, edit each of `en.json`, `es.json`, `pl.json`. Apply the same key set across all three locales.

**Delete (filters namespace):**
- `filters.allergiesTitle` (line 253) — permanent drawer allergies section removed
- `filters.allergy.*` — all children (block starting line 280)
- `filters.dietPreferencesTitle` — only the permanent drawer's diet-preferences (Diabetic/Keto/Paleo/Low-carb/Pescatarian) title; verify this is distinct from `filters.dietPreferences` (which the daily modal uses and stays)
- `filters.dietType.*` — all children (Diabetic/Keto/Paleo/Low-carb/Pescatarian permanent toggles)
- `filters.religiousRestrictionsTitle` (line 255)
- `filters.religious.*` — all children (block starting line 296)
- `filters.exclude.noDairy`

**Keep (filters namespace — daily layer uses these):**
- `filters.dietPreferences` (DailyFilterModal section title, line 158)
- `filters.dietOption.vegetarian` / `dietOption.vegan` (FilterComponents chip labels)
- `filters.dietOptions` (FilterComponents section title)
- `filters.dietPreferenceSubtitle` (FilterComponents subtitle)
- `filters.proteinTypes.vegetarian` / `proteinTypes.vegan` (DailyFilterModal chip labels)

> Note: the daily-layer keys carry through because we're *refactoring* the daily Diet Preference shape, not removing it (per §3.5). If any of these strings need a wording tweak to reflect single-select semantics, do it during the FilterComponents/DailyFilterModal edits.

**Delete (onboarding namespace):**
- `onboarding.allergiesQuestion` (line 895)
- `onboarding.allergiesHint` (line 896)
- `onboarding.allergyNuts`, `allergyDairy`, `allergyGluten`, `allergyShellfish`, `allergySoy`, `allergyEggs` (lines 897–902)
- `onboarding.dietVegetarian`, `dietVegan` (lines 887–888) — if Step 1 diet portion is removed (per the onboarding open question above)
- `onboarding.step1Title` ("Your Dietary Preferences", line 881) — if the step collapses

**Audit and rephrase (orphan dietary references in en.json — apply to all three locales):**
- L670 `dietaryPreferences` → check if still rendered anywhere; remove if orphan
- L674 `noDietRestrictions` → orphan, remove
- L704 `dietPreferencesInfo` ("Set permanent filters for diet type, allergies, and restrictions") → rephrase to mention only protein-based preferences, OR remove if no longer surfaced
- L754 onboarding step text ("Everyone shares their location and dietary preferences") → rephrase to just "location"
- L762 group-recommendations feature pitch ("🍽️ Respects all dietary needs") → rephrase or remove
- L832 eatTogether "no restaurants matching dietary requirements" → rephrase to "matching preferences" or similar

**Keep:**
- `filters.personalPreferences` (line 68 of DrawerFilters.tsx)
- `filters.excludeTitle` and `filters.exclude.noMeat` / `noFish` / `noSeafood` / `noEggs`
- `filters.proteinTypes.meat` / `fish` / `seafood` / `egg` (DailyFilterModal lines 190–193) — protein-based
- `filters.proteinLabel.*` and `filters.proteinTypesSubtitle` (FilterComponents) — protein-based

**Verification:**
```bash
# After all edits, grep should return only matches against kept keys
grep -rE "t\(['\"](filters|onboarding)\.(allerg|dietary|dietType|dietOption|dietPref|religious)" apps/mobile/src
```
Expected: zero matches (the surfaces that called them have been removed in this phase).

### Verification

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: baseline 5 pre-existing errors only (useRestaurantDetail, dishPhotoService, gamificationService — per session memory).

---

## 7. Phase 4 — Admin app (`apps/admin/`)

### Modifier editor

- `apps/admin/src/components/modifiers/ModifierGroupsEditor.tsx`
  - Drop imports (lines 5–6): `ALLERGENS`, `DIETARY_TAGS`
  - Drop the "options has data" check (lines 307–308) referencing `removes_dietary_tags` / `adds_allergens`
  - Delete the entire "Removes dietary tags" render section (lines 463–492) and "Adds allergens" render section (lines 494–520)

### Modifier types

- `apps/admin/src/components/modifiers/editableTypes.ts`
  - `EditableOption`: remove `removes_dietary_tags: string[]`, `adds_allergens: string[]`, `adds_dietary_tags: string[]` (lines 11–12, 60–61)
- `apps/admin/src/components/modifiers/adapters.ts`
  - Lines 23–24, 54–55, 95–96: drop the three field mappings on serialize + deserialize
- `apps/admin/src/lib/modifiers/schemas.ts`
  - Zod option schema (lines 15–16): remove the three array fields

### Menu-scan confirm flow

- `apps/admin/src/app/(admin)/menu-scan/actions/confirmSchema.ts`
  - Lines 32–33: remove `removes_dietary_tags` and `adds_allergens` (also `adds_dietary_tags` if present)
- `apps/admin/src/app/(admin)/menu-scan/[jobId]/ReviewDishEditor.tsx`
  - Lines 114–115, 506–507: drop the field mapping in both option→form and form→submit directions

### Dish actions

- `apps/admin/src/app/(admin)/restaurants/[id]/actions/dish.ts`
  - Line 45 comment: drop the "allergens / dietary_tags default to []" comment
  - Lines 105–106: remove the hardcoded `allergens: []`, `dietary_tags: []` fields from the insert payload
- `apps/admin/src/app/api/admin/import-csv/route.ts`
  - Lines 183–184: remove the hardcoded defaults from the CSV insert payload
- `apps/admin/src/app/(admin)/imports/actions/places.ts`
  - Line 144: drop the comment referencing allergens/dietary_tags

### Data access layer

- `apps/admin/src/lib/auth/dal.ts`
  - Lines 512–513: drop `removes_dietary_tags, adds_allergens, adds_dietary_tags` from the OptionGroup SELECT column list
  - Lines 671, 690–691: drop the corresponding type fields

### Tests

- `apps/admin/src/__tests__/components/modifiers/adapters.test.ts`
  - Lines 27–28, 38–39, 65–66, 135–136: remove field expectations from fixtures + assertions
- `apps/admin/src/__tests__/integration/admin-confirm-rpc.test.ts`
  - 9 occurrences of `adds_dietary_tags`, plus matching `removes_dietary_tags` / `adds_allergens` — remove from all test payloads and assertions
- `apps/admin/src/__tests__/integration/setup.ts`
  - Line 76: drop `adds_allergens` from the test query

### Verification

```bash
cd apps/admin && pnpm test
pnpm turbo check-types --filter=admin
```

---

## 8. Phase 5 — Web-portal v1 (`apps/web-portal/`)

### Delete files

- `apps/web-portal/components/AllergenWarnings.tsx`
- `apps/web-portal/components/forms/dish/DishDietarySection.tsx`

### Modify files

- `apps/web-portal/components/forms/DishFormDialog.tsx`
  - Drop `DishDietarySection` import
  - Drop the `<DishDietarySection />` render + the `<Separator />` immediately above/below it (lines 143–145)
  - `defaultValues` (lines 58–59): remove `dietary_tags: [] as string[]`, `allergens: [] as string[]`
- `apps/web-portal/components/forms/DishCard.tsx`
  - Lines 142–153: delete the dietary_tags + allergens badge loops
- `apps/web-portal/lib/hooks/useDishFormData.ts`
  - Lines 31–32, 76–77, 169–170, 208–209: remove all reads/writes of `dietary_tags` / `allergens`
- `apps/web-portal/lib/restaurantService.ts`
  - Lines 43–44: drop fields from local `Dish` type
  - Lines 447–448: drop fields from POST body
- `apps/web-portal/app/onboard/review/page.tsx`
  - Lines 316–317, 328, 336: delete the dish dietary_tags + allergens rendering blocks
- `apps/web-portal/lib/icons.ts`
  - Drop allergen + dietary-tag icon maps (file comment line 2 hints at content)
- `apps/web-portal/lib/export.ts`
  - Lines 42–43, 83–84: remove fields from JSON + CSV export

### Verification

```bash
cd apps/web-portal && npx vitest run
```

---

## 9. Phase 6 — Web-portal v2 (`apps/web-portal-v2/`)

Mirror Phase 5. v2 is paused per session memory but must stay revivable.

- `apps/web-portal-v2/src/app/(app)/restaurant/[id]/actions/dish.ts`
  - Lines 52–53: drop `removes_dietary_tags`, `adds_allergens` from option mapping
  - Lines 96–97: drop hardcoded `dietary_tags: []`, `allergens: []` from dish insert
- `apps/web-portal-v2/src/components/menu/DishForm.tsx`
  - Lines 81–82: drop `dietary_tags: []`, `allergens: []` from `defaultValues`
- `apps/web-portal-v2/src/__tests__/restaurant/dish-actions.test.ts`
  - Lines 96–105: remove or rewrite the assertion that empty arrays are written
- `apps/web-portal-v2/tests/e2e/fixtures/index.ts`
  - Lines 73–74: drop from fixture
- `apps/web-portal-v2/tests/integration/consumer-endpoints-hide-drafts.test.ts`
  - Lines 91–92: drop from test data

If v2 has any dedicated allergen / dietary form section components, delete them. Run a final grep:

```bash
grep -rn "dietary_tags\|allergens" apps/web-portal-v2/src
```

### Verification

```bash
cd apps/web-portal-v2 && pnpm test  # if a test script exists
pnpm turbo check-types --filter=web-portal-v2
```

---

## 10. Phase 7 — Database migration

Two migrations, applied in sequence. Both must run **after** edge functions are redeployed.

### Migration N — Replace `generate_candidates` RPC

File: `infra/supabase/migrations/154_generate_candidates_no_allergens.sql`

```sql
-- Replace generate_candidates. Drops the p_allergens parameter and the
-- allergens / dietary_tags columns from RETURNS TABLE. Implements the §3.5
-- hard/soft contract: hard params drive WHERE; soft params drive ORDER BY.

DROP FUNCTION IF EXISTS public.generate_candidates(
  uuid, uuid, double precision, double precision, integer, integer, integer,
  text[], text[], text[], text[], text[], text[], text[]
);

CREATE OR REPLACE FUNCTION public.generate_candidates(
  p_user_id                    uuid,
  p_session_id                 uuid,
  p_lat                        double precision,
  p_lng                        double precision,
  p_radius_meters              integer DEFAULT 5000,
  p_limit                      integer DEFAULT 50,
  p_offset                     integer DEFAULT 0,
  -- HARD filters — exclude non-matching dishes
  p_excluded_protein_families  text[]  DEFAULT '{}',
  p_diet_preference_hard       text    DEFAULT NULL,   -- 'vegetarian' | 'vegan' | NULL
  -- SOFT signals — re-rank matching dishes first; never exclude
  p_preferred_protein_families text[]  DEFAULT '{}',
  p_diet_preference_soft       text    DEFAULT NULL    -- 'vegetarian' | 'vegan' | NULL
)
RETURNS TABLE (
  -- ... full column list minus dietary_tags and allergens ...
  restaurant_currency_code text,
  primary_protein           text,
  ...
)
LANGUAGE sql STABLE AS $$
  WITH base AS (
    SELECT d.*, r.currency_code AS restaurant_currency_code, ...
    FROM dishes d
    JOIN restaurants r ON r.id = d.restaurant_id
    WHERE
      -- ... existing geo + status + visibility checks ...
      -- HARD: protein family exclusions
      AND (array_length(p_excluded_protein_families, 1) IS NULL
           OR NOT (d.protein_families && p_excluded_protein_families))
      -- HARD: diet preference (vegetarian → must not have meat/poultry/fish/shellfish/eggs families)
      AND (
        p_diet_preference_hard IS NULL
        OR (p_diet_preference_hard = 'vegetarian'
            AND NOT (d.protein_families && ARRAY['meat','poultry','fish','shellfish','eggs']::text[]))
        OR (p_diet_preference_hard = 'vegan'
            AND d.primary_protein = 'vegan')
      )
  )
  SELECT * FROM base
  ORDER BY
    -- SOFT: daily diet preference boost (highest priority)
    CASE
      WHEN p_diet_preference_soft IS NULL THEN 0
      WHEN p_diet_preference_soft = 'vegan' AND primary_protein = 'vegan' THEN 2
      WHEN p_diet_preference_soft = 'vegetarian'
           AND NOT (protein_families && ARRAY['meat','poultry','fish','shellfish','eggs']::text[]) THEN 2
      ELSE 0
    END DESC,
    -- SOFT: daily preferred-protein boost
    CASE
      WHEN array_length(p_preferred_protein_families, 1) IS NULL THEN 0
      WHEN protein_families && p_preferred_protein_families THEN 1
      ELSE 0
    END DESC,
    -- ... existing relevance / distance / freshness ordering ...
  LIMIT p_limit OFFSET p_offset;
$$;
```

Note: this sketch is illustrative — the actual `RETURNS TABLE` column list, existing `WHERE` predicates, and trailing `ORDER BY` terms come from the current migration 150 implementation. The structural change is: **four dietary params instead of one `p_allergens`**, and **two `ORDER BY` priority terms** for the soft signals.

Also drop dead RPCs:
- `calculate_dish_allergens` (if it survived Phase B)
- `calculate_dish_dietary_tags` (if it survived Phase B)

Reverse migration: copy the body of `150_generate_candidates_currency_code.sql` exactly to restore the prior signature.

### Migration N+1 — Drop columns + lookup tables

File: `infra/supabase/migrations/155_drop_allergens_dietary_schema.sql`

```sql
-- Drop allergen + dietary-tag columns now that no code or RPC references them.

ALTER TABLE public.dishes DROP COLUMN IF EXISTS allergens;
ALTER TABLE public.dishes DROP COLUMN IF EXISTS dietary_tags;

ALTER TABLE public.options DROP COLUMN IF EXISTS adds_allergens;
ALTER TABLE public.options DROP COLUMN IF EXISTS removes_dietary_tags;
ALTER TABLE public.options DROP COLUMN IF EXISTS adds_dietary_tags;

ALTER TABLE public.user_preferences DROP COLUMN IF EXISTS allergies;
ALTER TABLE public.user_preferences DROP COLUMN IF EXISTS preferred_dietary_tags;

-- Drop standalone lookup tables.
DROP TABLE IF EXISTS public.allergens CASCADE;
DROP TABLE IF EXISTS public.dietary_tags CASCADE;
```

Reverse migration: re-create the columns as nullable text[] DEFAULT '{}'; re-create the lookup tables with the original schemas (id uuid PK, code text UNIQUE, name text, etc. — copy from `database_schema.sql` lines 19–61). **No data restoration** — same posture as the Phase C reverse.

### Regenerate types

After both migrations apply:

```bash
cd /home/art/Documents/eatMe_v1
supabase gen types typescript --linked > packages/database/src/types.ts
```

This regenerates `packages/database/src/types.ts` without the four removed columns and the two removed tables. Verify by diffing.

---

## 11. Phase 8 — Cutover sequence

**Step-by-step, single afternoon:**

1. **Push code commits to `main`** (Phases 1–6). The mobile app + web-portal v1 + admin all stop reading/writing the fields. Old edge functions still accept the legacy request shape (extra fields ignored), so production keeps working.

2. **Deploy edge functions** from `infra/supabase/`:

   ```bash
   cd infra/supabase
   supabase functions deploy feed
   supabase functions deploy nearby-restaurants
   supabase functions deploy enrich-dish
   supabase functions deploy group-recommendations
   supabase functions deploy menu-scan-worker
   ```

   New edge functions don't pass `p_allergens` to the (still-old) RPC. Default `'{}'` argument keeps the old RPC working.

3. **Apply migrations**:

   ```bash
   supabase db push   # or: supabase migration up --linked
   ```

   Migration 154 replaces the RPC. Migration 155 drops the columns + lookup tables.

4. **Regenerate database types** and commit.

5. **Mobile rebuild on phone** — per memory, mobile visual verification is on-device:
   - Open the personal filters drawer → confirm 3 sections (Diet Preference, Exclude, Facilities)
   - Toggle Diet Preference → Vegetarian → confirm dish rows containing non-vegetarian primary_protein get the dimmed "Not For You" pill
   - Open a restaurant with modifier groups → confirm no red allergy chips, no yellow diet chips on options; preferred-protein highlight still works
   - Swipe feed loads with normal latency, no errors

6. **Roll back plan**: if anything breaks, reverse migrations 155 → 154, redeploy old edge functions from `git checkout HEAD~ infra/supabase/functions`. Code commits stay (apps don't need the columns to run; columns just won't be written).

---

## 12. Phase 9 — Documentation + memory

- `agent_docs/database.md` — strike line 11 (`dishes — Individual dishes with allergens, dietary tags…`) and line 51 (`Postgres triggers auto-calculate dishes.allergens…`). Note that primary_protein is the surviving food-classification column.
- `agent_docs/terminology.md` — remove "Allergens" and "Ingredients Master" definitions (lines 19–20)
- `CLAUDE.md` — no current references to `dietary_tags` / `allergens`; add a short note under "Dish Classification — Primary Protein" stating that allergen / dietary-tag filtering was removed in this rollout
- `docs/project/06-database-schema.md` — audit, update
- This plan document — flip Status to "Shipped" after cutover

### Memory updates

After cutover:

- Update `two_admin_codepaths.md` (already noted as outdated; both admin codepaths are unaffected by this rollout but the active codepath gets simpler)
- Write a new memory: "EatMe is discovery + protein-based filtering, not allergen-safe" — feedback/project type, captures the product-positioning decision so future suggestions don't reflexively propose allergen features

---

## 13. Verification checklist

After Phase 8, before declaring done:

- [ ] `pnpm turbo check-types` — green across web-portal-v2, admin (mobile + web-portal don't have a check-types script)
- [ ] `pnpm turbo lint` — green
- [ ] `pnpm turbo test` — green (web-portal vitest, admin vitest)
- [ ] `cd apps/mobile && npx tsc --noEmit` — baseline 5 pre-existing errors only
- [ ] Deno checks for all edited edge functions pass
- [ ] Migrations 154 + 155 applied to live DB
- [ ] All 5 edge functions redeployed
- [ ] Regenerated `packages/database/src/types.ts` committed
- [ ] Mobile filter drawer renders 3 sections only
- [ ] Modifier panel on restaurant detail shows no allergy / diet chips
- [ ] Vegan/vegetarian emoji renders correctly on dish rows
- [ ] Swipe feed loads dishes; no console errors

---

## 14. Risk + rollback notes

| Risk | Likelihood | Mitigation |
|---|---|---|
| Edge function redeploys break old mobile client by removing `effective_*` fields from response | Low — sole user is the developer's own phone, will rebuild | Rebuild mobile after redeploy |
| Migration 155 drops columns referenced by a forgotten consumer | Low — inventory was thorough, but possible | Reverse migration recreates columns; data is empty anyway |
| Replacement `generate_candidates` RPC has a SQL bug | Medium | Reverse migration 154 first (restores prior signature); old edge functions still work against it |
| User's parallel locale work clashes with Phase 6 locale edits | Medium | **Commit or stash locale changes before starting Phase 3** |
| `apps/web-portal-v2/` paused state contradicts touching it | Low | Memory note allows mirror edits; v2 build doesn't deploy anywhere |

---

## 15. Commit strategy

Per memory: commit straight to `main`, no feature branches.

Suggested split (each pushed independently for reviewability):

1. **`refactor(shared): drop dietary_tags + allergens constants and types`** — Phase 1
2. **`refactor(edge): drop allergen + dietary-tag handling from all edge fns`** — Phase 2 (do not deploy yet)
3. **`refactor(mobile): retire allergen + dietary filter sections, rewire emoji to primary_protein`** — Phase 3
4. **`refactor(admin): drop allergen + dietary chip pickers from modifier editor`** — Phase 4
5. **`refactor(web-portal): drop allergen + dietary form section and badges`** — Phases 5 + 6
6. **`feat(db): drop allergens + dietary_tags schema, replace generate_candidates RPC`** — Phase 7 migrations + regenerated types
7. **`docs: remove allergen + dietary references; record product positioning`** — Phase 9

Total: 7 commits, single rollout. Or bundle 1–5 into one mega-commit if you prefer atomic.

---

## 16. Open questions (defer to execution time)

- **Onboarding Step 1 fate.** Verified during plan review: the wizard's Step 1 is dedicated to dietary + allergy collection. With allergies removed, the diet portion (vegetarian/vegan chips) is the only thing left. Recommendation: delete the whole step, let users set Diet Preference in the main filter drawer post-onboarding. Confirm during Phase 3 execution after seeing what the rest of the onboarding flow looks like.
- The "No eggs" exclude toggle filters on `primary_protein = 'eggs'` only — that catches dishes where eggs are the protein, but not dishes containing eggs as an ingredient (e.g., carbonara, mayonnaise). UX-wise: keep with current semantics or rename to "No egg-centered dishes"? Defer to mobile-rebuild moment; visible-on-phone decision.

## 17. Confirmed during plan review (2026-06-04)

- **Filter semantics — hard vs soft.** Permanent filters are HARD (exclude); daily filters are SOFT (re-rank). The plan was initially missing this contract; §3.5 now documents it explicitly, the RPC in §10 implements two distinct param sets, and the mobile/edge changes in §5–§6 route accordingly. This means `daily.dietPreference` is **kept and refactored**, not removed — preserves the "I normally eat meat, want vegetarian today" use case without forcing a permanent-setting flip.
- `enrich-dish` survives the cut: embedding input was `name + description + primary_protein + allergens` (lines 116, 229–236). Dropping allergens leaves three useful signals; function continues to embed dishes. No follow-up needed beyond §5 edits.
- Migration numbers 154 and 155 are unused. (Duplicate 151s and 152s exist for unrelated migrations, but 153 is the highest "real" entry; 154/155 are free.)
- Permanent filters are server-synced via `userPreferencesService` to the `user_preferences` table, **not** via Zustand persist middleware. The DB column drops in §10 handle persistence cleanup; no client-side migrator needed.
- `apps/web-portal-v2/` still exists in the working tree; the mirror edits in Phase 6 still apply.
