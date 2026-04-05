# Recommendation Improvement Plan

_Created March 23, 2026. Based on [current-state-map-recommendation-system.md](current-state-map-recommendation-system.md)._

## Goal

Close the verified gaps between the mobile filter UI and the live map recommendation backend, so that every filter the user can touch on the map screen actually influences what they see.

The plan is organized into phased work items. Each phase is independently deployable and testable. Phases are ordered by user-facing impact and implementation risk.

---

## Phase 1 — Wire Protein & Meat Subtype Filters (Highest Priority)

**Problem:** The user selects meat/fish/seafood/egg in the DailyFilterModal, but those selections are silently ignored by the feed. This is the most visible current gap.

**Approach:** Soft boost in Stage 2 scoring, matching the pattern already used by `dishNames`. No SQL changes needed in Phase 1.

### Data availability

Protein information is available on dishes today through two mechanisms:

1. **`dish_ingredients` → `canonical_ingredients.ingredient_family_name`**: Every canonical ingredient has a family (`meat`, `poultry`, `fish`, `shellfish`, `eggs`, `dairy`, `plant_protein`). This is the most reliable signal.
2. **`dishes.dietary_tags`**: Contains tags like `vegetarian`, `vegan`, `pescatarian`. Useful for negative inference (a vegetarian dish has no meat/fish/seafood), but not for positive protein classification.

Phase 1 uses an ingredient-family lookup at the Edge Function level. Phase 2 adds a precomputed column for SQL-level filtering.

### Task 1.1 ✅ — Add `proteinTypes` and `meatTypes` to the feed request

Added to `FeedRequest.filters` in both `edgeFunctionsService.ts` (client type+`buildFilters()`) and `feed/index.ts` (server type). Active boolean keys from `dailyFilters.proteinTypes` and `dailyFilters.meatTypes` are collected and sent as string arrays.

### Task 1.2 ✅ — Load dish protein families in the Edge Function

Added protein annotation block in `feed/index.ts` — runs only when `proteinTypes` or `meatTypes` are active (avoids an extra DB round-trip when unused). Queries `dish_ingredients` + filters `canonical_ingredients` to the seven protein-relevant families. Attaches `protein_families` and `protein_canonical_names` arrays to each candidate.

### Task 1.3 ✅ — Add protein boost to `rankCandidates()`

Added two boost blocks after the `dishNames` boost in `rankCandidates()`:

- `+0.20` when any `protein_families` entry matches the selected protein types
- `+0.10` additional when any `protein_canonical_names` entry matches the selected meat subtypes

### Task 1.2 — Load dish protein families in the Edge Function

**Files:**

- `infra/supabase/functions/feed/index.ts`

**Changes:**

1. Add `proteinTypes` and `meatTypes` to the `FeedRequest.filters` type definition.
2. After the `generate_candidates` RPC returns the candidate pool, and after the existing ingredient-flag annotation block, add a **protein-family annotation** step:
   - Query `dish_ingredients` joined with `canonical_ingredients` for the candidate dish IDs.
   - For each dish, collect the set of `ingredient_family_name` values.
   - Attach this as a `protein_families: string[]` field on each candidate.
3. This query is similar to the existing `flagIngredients` lookup and can share the same `dish_ingredients` fetch if both are needed.

**Mapping from filter keys to ingredient families:**

| Filter key | Ingredient families   |
| ---------- | --------------------- |
| `meat`     | `'meat'`, `'poultry'` |
| `fish`     | `'fish'`              |
| `seafood`  | `'shellfish'`         |
| `egg`      | `'eggs'`              |

**Mapping from meat subtype keys to canonical names:**

| Meat type key | Canonical names (prefix match)                                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `chicken`     | `'chicken'` family=poultry                                                                                               |
| `beef`        | `'beef'`, `'oxtail'` family=meat                                                                                         |
| `pork`        | `'pork'`, `'ham'`, `'pancetta'`, `'prosciutto'`, `'pepperoni'`, `'lard'`, `'italian_sausage'`, `'pork_ribs'` family=meat |
| `lamb`        | `'lamb'` family=meat                                                                                                     |
| `duck`        | `'duck'` family=poultry                                                                                                  |

### Task 1.3 — Add protein boost to `rankCandidates()`

**Files:**

- `infra/supabase/functions/feed/index.ts`

**Changes in `rankCandidates()`:**

Add after the existing `dishNames` boost block:

```typescript
// Soft daily protein type boost (+0.20)
if (filters.proteinTypes?.length && d.protein_families?.length) {
  const familyMap: Record<string, string[]> = {
    meat: ['meat', 'poultry'],
    fish: ['fish'],
    seafood: ['shellfish'],
    egg: ['eggs'],
  };
  const wantedFamilies = new Set(filters.proteinTypes.flatMap(p => familyMap[p] ?? []));
  const hasMatch = d.protein_families.some(f => wantedFamilies.has(f));
  if (hasMatch) score += 0.2;
}

// Soft daily meat subtype boost (+0.10 additional)
if (filters.meatTypes?.length && d.protein_canonical_names?.length) {
  const meatNameMap: Record<string, string[]> = {
    chicken: ['chicken', 'chicken_livers', 'chicken_fat'],
    beef: ['beef', 'beef_liver', 'beef_tongue', 'beef_fat', 'beef_jerky', 'oxtail'],
    pork: [
      'pork',
      'ham',
      'pancetta',
      'prosciutto',
      'pepperoni',
      'lard',
      'italian_sausage',
      'pork_ribs',
    ],
    lamb: ['lamb'],
    duck: ['duck', 'duck_fat'],
  };
  const wantedNames = new Set(filters.meatTypes.flatMap(m => meatNameMap[m] ?? []));
  const hasMatch = d.protein_canonical_names.some(n => wantedNames.has(n));
  if (hasMatch) score += 0.1;
}
```

**Boost budget reasoning:**

- `+0.20` for protein match is on par with cuisine boost (`+0.20`), making protein a meaningful signal.
- `+0.10` for meat subtype is additive: a dish matching both protein family and meat subtype gets `+0.30` total, making it strongly preferred over non-matching dishes.
- The `dishNames` boost (`+0.25`) remains the strongest single daily signal, which is correct since it's the most explicit user intent.

### Task 1.4 — Deploy and verify

1. Deploy the updated Edge Function.
2. Test with protein filters active: confirm matching dishes rank higher.
3. Test with protein + cuisine: confirm both boosts stack.
4. Test with no protein filters: confirm no regression.

---

## Phase 2 — Precompute Protein Families on Dishes (Performance)

**Problem:** Phase 1 queries `dish_ingredients` + `canonical_ingredients` on every feed request for the full candidate pool (~200 dishes). This adds latency to the hot path.

**Approach:** Add a precomputed `protein_families TEXT[]` column on `dishes` and populate it via a trigger or batch job.

### Task 2.1 ✅ — Add columns and backfill

Migration [070_add_protein_families_column.sql](../infra/supabase/migrations/070_add_protein_families_column.sql) adds two columns to `dishes`:

- `protein_families TEXT[]` — family names (e.g. `{meat,poultry}`)
- `protein_canonical_names TEXT[]` — ingredient canonical names (e.g. `{chicken,butter}`)

Both are backfilled via a single `UPDATE ... FROM (SELECT ...)` for all existing dishes. GIN indexes added on both columns.

### Task 2.2 ✅ — Trigger to keep columns current

`update_dish_protein_families()` trigger function fires `AFTER INSERT OR UPDATE OR DELETE` on `dish_ingredients` FOR EACH ROW, recalculating both columns for the affected dish. Trigger named `dish_ingredients_update_protein`.

A standalone `compute_dish_protein_families(UUID)` helper function is also exposed for manual recalculation if needed.

### Task 2.3 ✅ — Added to `generate_candidates()` return columns

`generate_candidates()` (migration 070, replaces 065 version) now returns `protein_families` and `protein_canonical_names` directly from `d.protein_families` / `d.protein_canonical_names`.

### Task 2.4 ✅ — Simplified Edge Function

Removed the runtime `dish_ingredients` + `canonical_ingredients` double-query from `feed/index.ts`. The protein annotation block is now a comment explaining the values come from the SQL result. `rankCandidates()` uses `d.protein_families` and `d.protein_canonical_names` as-is.

---

## Phase 3 — Wire `openNow` Filter

**Problem:** The DailyFilterModal has an "Open Now" toggle. The `getFilteredRestaurants()` call sends `openNow: true`, but the feed Edge Function ignores it.

**Approach:** Filter in the restaurant-mode response shaping, not in `generate_candidates()` (because opening hours are complex per-restaurant logic, not dish-level).

### Task 3.1 ✅ — Add `openNow` filtering in restaurant mode

Added `isOpenNow()` helper to `feed/index.ts` (ported from the mobile `i18nUtils` utility, handles overnight spans). After the `restaurantMap` is built:

1. All result restaurant IDs are looked up in `restaurants.open_hours` in a single query.
2. Each restaurant in the map gets an `is_open` flag.
3. If `filters.openNow` is true the list is filtered to open restaurants only before sorting and slicing.

### Task 3.2 ✅ — `is_open` exposed on every restaurant result

Since open_hours are fetched regardless of the `openNow` flag, `is_open` is now always populated in the restaurant-mode response. The mobile client already has the `is_open?: boolean` field on `ServerRestaurant` and can use it for UI indicators.

---

## Phase 4 — Wire `maxDistance` to Feed Radius

**Problem:** The daily filter store has `maxDistance` (default 5 km), but `BasicMapScreen` passes a hardcoded `10` km as the radius to both feed calls.

**Approach:** Pass `daily.maxDistance` as the radius parameter.

### Task 4.1 ✅ — Use `maxDistance` from filter store

Both `getFeed()` and `getFilteredRestaurants()` now pass `Math.max(2, daily.maxDistance)` as the radius. The 2 km floor prevents empty results when a user sets a very tight distance preference.

### Task 4.2 — Add `maxDistance` to the useEffect dependency

Currently the feed-fetch effects depend on `[userLocation, daily, permanent]`. Since `maxDistance` lives inside `daily`, this already triggers a re-fetch when the user changes it. No additional dependency change needed.

**Risk:** If the user sets maxDistance to 1 km and there are very few restaurants nearby, the feed could return 0 or very few results. Consider a minimum floor (e.g., 2 km) or a "expand search" UX hint.

---

## Phase 5 — Wire Permanent Exclude Flags

**Problem:** The permanent filters screen has toggles for `noMeat`, `noFish`, `noSeafood`, `noEggs`, `noDairy`, `noSpicy`. These are stored and synced to the database, but not sent to or used by the feed.

**Approach:** Map these exclusions to ingredient families and apply as hard filters in `generate_candidates()`.

### Task 5.1 — Send exclude flags in the feed request

**Files:**

- `apps/mobile/src/services/edgeFunctionsService.ts`

### Task 5.1 ✅ — Send exclude flags in the feed request

`buildFilters()` in `edgeFunctionsService.ts` now maps `permanentFilters.exclude` boolean flags to `excludeFamilies` (ingredient family names array) and `excludeSpicy` (boolean). Both fields added to `FeedRequest.filters` in the client and server types.

### Task 5.2 ✅ — Hard filter in `generate_candidates()` (migration 071)

Migration [071_generate_candidates_exclude_params.sql](../infra/supabase/migrations/071_generate_candidates_exclude_params.sql) adds `p_exclude_families TEXT[] DEFAULT '{}'` and `p_exclude_spicy BOOLEAN DEFAULT false` parameters and the corresponding WHERE clauses:

```sql
-- Protein family exclusions
AND (
  array_length(p_exclude_families, 1) IS NULL
  OR NOT (COALESCE(d.protein_families, '{}') && p_exclude_families)
)
-- Spicy exclusion
AND (
  NOT p_exclude_spicy
  OR COALESCE(d.spice_level, 'none') <> 'hot'
)
```

Because only new parameters with defaults were added (no return type change), `CREATE OR REPLACE` worked without a DROP.

### Task 5.3 ✅ — `noSpicy` handled via `p_exclude_spicy`

`noSpicy` from `permanentFilters.exclude` is sent as `excludeSpicy: true` when active, translated to `p_exclude_spicy: true` in the RPC call.

### Task 5.4 ✅ — Wired through the Edge Function

`feed/index.ts` now passes `p_exclude_families` and `p_exclude_spicy` to the `generate_candidates` RPC call.

---

## Phase 6 — Enable User Personalization on Map Feed ⚡ High Priority

**Problem:** `BasicMapScreen` passes `userId` as `undefined`, so all personalization is dormant on the map screen despite the full infrastructure being built and operational. This is a **one-line fix with the largest single user-visible impact** of any phase in this plan.

**The full personalization chain is already in place and running — it just isn't connected to the map:**

| Component                                                                            | Status                             |
| ------------------------------------------------------------------------------------ | ---------------------------------- |
| `recordInteraction()` writes liked/disliked/saved/viewed to `user_dish_interactions` | ✅ Active                          |
| `triggerVectorUpdate(userId)` called after every interaction                         | ✅ Active                          |
| `update-preference-vector` rebuilds unit vector from weighted swipes + ratings       | ✅ Active                          |
| Daily `batch-update-preference-vectors` cron refreshes stale vectors                 | ✅ Active                          |
| `user_preferences` stores spice_tolerance, favorite_cuisines from profile            | ✅ Active                          |
| Feed Edge Function loads all of this when `userId` is provided                       | ✅ Active                          |
| `BasicMapScreen` passes `userId` to the feed                                         | ❌ **Broken — passes `undefined`** |

Interactions that currently feed the learning pipeline (and therefore are already building preference vectors silently):

- User hearts a dish in `DishPhotoModal` → `recordInteraction('liked')`
- User saves a dish to favorites → `recordInteraction('saved')`
- User views dish detail for 3+ seconds in `RestaurantDetailScreen` → `recordInteraction('viewed')`
- User rates a dish as liked/okay in the post-visit rating modal → `recordInteraction('liked')`

### Task 6.1 ✅ — Pass `userId` to both feed calls

**File:** `apps/mobile/src/screens/BasicMapScreen.tsx`

The `user` object is already available via `useAuthStore` at line ~112. Changed both `getFeed()` and `getFilteredRestaurants()` calls:

```typescript
// Before:
undefined, // userId intentionally omitted — swipe-based personalisation not active yet

// After:
user?.id,
```

### What activates immediately on deploy

**Tier 1 — activates for every authenticated user, even new ones:**

These load from `user_preferences` and `favorites`, which are populated during onboarding and general app use:

- Static `spice_tolerance` from `user_preferences` — applies DB-stored spice tolerance to scoring
- Static `favorite_cuisines` from `user_preferences` — boosts matching restaurant cuisines (+0.10)
- Favorited restaurants from `favorites` table — dishes from those restaurants get +0.15 boost
- Religions restrictions from `user_preferences` — already sent from the client, but now also deduped with DB values

**Tier 2 — activates for users who have rated/liked/saved at least one dish:**

These load from `user_dish_interactions` and `user_behavior_profiles`:

- Disliked dishes excluded from candidate pool entirely (hard filter in `generate_candidates` SQL)
- Liked cuisine inference — cuisines extracted from liked/saved dishes, boosted +0.10
- ANN vector search in `generate_candidates` SQL — orders the 200-candidate pool by cosine distance to the user's preference vector before Stage 2 scoring
- `similarity` signal gets its full 40% weight in base scoring instead of being redistributed

**Tier 3 — activates as more interactions accumulate:**

- `preferred_cuisines` from `user_behavior_profiles` (aggregated by the vector update function) — +0.10 boost
- `preferred_price_range` from `user_behavior_profiles` — up to +0.06 learned price proximity boost
- Preference vector quality improves: more interactions → more accurate weighted centroid → better ANN ordering

### Task 6.2 — Verify interaction recording reaches `user_dish_interactions`

Before deploying, confirm the following existing paths are confirmed live:

1. Open `RestaurantDetailScreen`, tap a dish, confirm a `'viewed'` row appears in `user_dish_interactions` after 3 seconds.
2. Heart a dish in DishPhotoModal, confirm a `'liked'` row appears.
3. Save a dish to favorites, confirm a `'saved'` row appears.
4. Rate a dish as liked/okay via the post-visit modal, confirm a `'liked'` row appears in `user_dish_interactions` (separate from `user_dish_opinions`).
5. Query `user_behavior_profiles` for the test user and confirm `preference_vector` is non-null and `preference_vector_updated_at` is recent.

### Task 6.3 — Confirm `user_preferences` is populated during onboarding

The feed reads `spice_tolerance`, `favorite_cuisines`, and `religious_restrictions` from `user_preferences`. Verify that the user onboarding flow (MOB-02) inserts or upserts a row in `user_preferences`. If it does not, Tier 1 personalization will be silent for users who skipped or never re-opened onboarding.

**Action: check `apps/mobile/src/screens/` onboarding screens and `userPreferencesService.ts` `savePreferences()` to confirm the upsert runs on completion.**

### Task 6.4 ✅ — Log and monitor the personalization tier

Replaced the minimal `[Feed] User context:` log with a structured object:

```typescript
console.log('[Feed] User context:', {
  userId,
  hasPrefVector: preferenceVector !== null,
  dislikeCount: userDislikes.length,
  likedCuisineCount: userLikedCuisines.length,
  favRestaurantCount: favoritedRestaurantIds.size,
  hasFavCuisines: dbFavoriteCuisines.length > 0,
  hasSpiceTolerance: dbSpiceTolerance !== null,
  hasPriceRange: dbPreferredPriceRange !== null,
});
```

### Cold-start behavior (new users)

New users with zero interactions will still get a good feed. `userId` being provided does not degrade cold-start results — it simply means `preferenceVector = null`, and the scoring formula falls back to the existing cold-start redistribution:

```
score = (0.4 + 0.1) × rating + (0.2 + 0.15) × popularity + 0.15 × distance + 0.1 × quality
```

Plus all daily soft boosts (cuisine, meal type, spice, price, calorie) remain active. The map is not worse for new users; it is better for users with any history, which is the right trade-off.

### Risk

If a user has a very sparse preference vector (e.g., only 1 ingredient-less dish has been liked, and that dish has no embedding), `update-preference-vector` will skip the build and return `{ skipped: true, reason: 'no_embeddings' }`. The user remains in cold-start mode on the map until enough embedded dishes are liked. This is safe and handles itself over time.

---

## Phase 7 — Fix Stale Comments and Client-Side Inconsistencies

**Problem:** Several comments in the codebase describe behavior that doesn't match reality. The dish marker feed doesn't apply the drink/dessert exclusion that the footer does.

### Task 7.1 — Fix stale comment in BasicMapScreen

**Files:**

- `apps/mobile/src/screens/BasicMapScreen.tsx`

Update the comment near the `recommendedDishes` memo:

```typescript
// Before:
// Drinks and desserts are excluded server-side (generate_candidates) but we
// also apply a lightweight client-side check as a safety net for uncategorised items.

// After:
// Drinks/desserts are excluded server-side via dish_categories.is_drink and
// dish_categories.name = 'dessert' in generate_candidates (migration 063/065).
// This client-side regex is a safety net for uncategorised items that lack
// a dish_category_id link.
```

### Task 7.2 — Apply drink/dessert filter to dish markers too

Currently the footer excludes drinks/desserts by name regex but the dish marker dataset does not. Apply the same regex filter to `mapPinDishes` for consistency, or (better) rely on the server-side exclusion being comprehensive enough.

### Task 7.3 — Update current-state doc

After each phase is implemented, update [current-state-map-recommendation-system.md](current-state-map-recommendation-system.md) to reflect what is now active.

---

## Phase Summary & Dependencies

```text
Phase 6 — userId personalization  ← DO FIRST: 1-line fix, highest leverage
  ↓ no dependencies
Phase 4 — maxDistance → radius
  ↓ no dependencies (parallel with 6)
Phase 3 — openNow enforcement
  ↓ no dependencies (parallel with 6, 4)
Phase 1 — Protein boost (soft, JS-only)
  ↓ no dependencies (parallel with 6, 3, 4)
Phase 2 — Precomputed protein_families column
  ↓ depends on Phase 1 being validated
Phase 5 — Permanent exclude flags
  ↓ depends on Phase 2 (protein_families column)
Phase 7 — Comment/doc cleanup
  ↓ do after each phase
```

**Start with Phase 6.** It is a one-line fix that activates an already-built personalization system.
Phases 4, 3, and 1 have no dependencies and can run in parallel after Phase 6.
Phase 2 should follow Phase 1 being validated in production.
Phase 5 depends on Phase 2.
Phase 7 is ongoing.

---

## Boost Budget Reference

After all phases are implemented, the maximum theoretical scoring boosts would be:

| Signal                  | Boost | Type         | Phase       |
| ----------------------- | ----: | ------------ | ----------- |
| Dish/meal name match    | +0.25 | Daily soft   | Existing    |
| Cuisine match           | +0.20 | Daily soft   | Existing    |
| Protein family match    | +0.20 | Daily soft   | Phase 1     |
| Preferred diet match    | +0.15 | Daily soft   | Existing    |
| Favourite restaurant    | +0.15 | Personalized | **Phase 6** |
| Spice level match       | +0.10 | Daily soft   | Existing    |
| Meat subtype match      | +0.10 | Daily soft   | Phase 1     |
| Liked cuisines          | +0.10 | Personalized | **Phase 6** |
| Preferred cuisines      | +0.10 | Personalized | **Phase 6** |
| Price range proximity   | +0.08 | Daily soft   | Existing    |
| Spice tolerance         | +0.08 | Personalized | **Phase 6** |
| Learned price range     | +0.06 | Personalized | **Phase 6** |
| Calorie range proximity | +0.05 | Daily soft   | Existing    |

Base score range is 0.0–1.0. Maximum cumulative boost from daily signals is ~0.91. Maximum from personalized signals is ~0.49. Both combined can reach ~1.40 above base.

This is acceptable because the boosts are additive preferences, not multipliers. A dish with no boosts can still score ~0.8 from base signals alone if it has strong rating + popularity + proximity + quality.

---

## Files Changed Per Phase

| Phase | Mobile client                 | Edge Function              | SQL Migration | Effort |
| ----- | ----------------------------- | -------------------------- | ------------- | ------ |
| **6** | `BasicMapScreen.tsx` (1 line) | `feed/index.ts` (logging)  | —             | Tiny   |
| 4     | `BasicMapScreen.tsx` (1 line) | —                          | —             | Tiny   |
| 3     | —                             | `feed/index.ts`            | —             | Small  |
| 1     | `edgeFunctionsService.ts`     | `feed/index.ts`            | —             | Medium |
| 2     | —                             | `feed/index.ts` (simplify) | New migration | Small  |
| 5     | `edgeFunctionsService.ts`     | `feed/index.ts`            | New migration | Medium |
| 7     | `BasicMapScreen.tsx`          | —                          | —             | Tiny   |

---

## Out of Scope for This Plan

These are known improvement areas that are intentionally not addressed here:

1. **Dish detail screen navigation** — footer and markers navigate to RestaurantDetail, not a dedicated dish screen. This is a UX decision, not a recommendation system gap.
2. **Permanent `cuisinePreferences`** — stored in profile but not sent as `favoriteCuisines` to the feed. Will be activated as part of Phase 6 when `userId` is passed (it's already read from `user_preferences` in the Edge Function).
3. **Restaurant facilities filters** — `familyFriendly`, `wheelchairAccessible`, etc. These require restaurant-level data that isn't in the current candidate pipeline. Separate work.
4. **Swipe-based learning** — the swipe feature is shelved. Preference vectors are updated via the separate `update-preference-vector` Edge Function. This plan doesn't change that pipeline.
5. **Option-group-aware protein classification** — template dishes with protein option groups (e.g., "Choose: Chicken / Beef / Tofu") can't be classified by a single protein family. Future work for the option system.
