# Current State — Map View Recommendation System

_Verified against the codebase on March 22, 2026. Last updated March 22, 2026 (meal/dish filter wired)._

## Purpose

This document captures how the **current live recommendation pipeline** for the mobile app's main map view actually works today.

It is intentionally implementation-first:

- It describes the code paths that are active now.
- It distinguishes active behavior from older design notes and stale comments.
- It calls out gaps between UI/filter affordances and what the backend currently uses.

This document is the baseline for the next step: redesigning and improving recommendations.

## Scope

This covers the recommendation behavior behind:

- The recommended dish footer on the map screen
- Dish markers on the map
- Restaurant marker ranking/order returned for the map screen

Primary files reviewed:

- `apps/mobile/src/screens/BasicMapScreen.tsx`
- `apps/mobile/src/services/edgeFunctionsService.ts`
- `apps/mobile/src/stores/filterStore.ts`
- `apps/mobile/src/components/map/DailyFilterModal.tsx`
- `infra/supabase/functions/feed/index.ts`
- `infra/supabase/migrations/056_generate_candidates_rpc.sql`
- `apps/mobile/src/services/filterService.ts` for historical/legacy comparison

## Executive Summary

The current map recommendation system is a **two-stage server-side feed** with a thin client-side presentation layer:

1. `BasicMapScreen` waits for GPS.
2. It calls the Supabase Edge Function `feed` twice:
   - once in `mode: 'dishes'` for recommended dishes
   - once in `mode: 'restaurants'` for restaurant pins/list ordering
3. The Edge Function gets a candidate pool from the SQL RPC `generate_candidates()`.
4. The Edge Function ranks those candidates in JavaScript.
5. The client trims the dish feed further for footer display.

The most important finding is this:

> The live map feed currently uses cuisine, dish/meal type, veg/vegan, allergens, religious restrictions, calories, price, spice, and ingredient-avoid flags, but it does **not** use daily protein intent such as meat, fish, seafood, egg, or meat subtype filters.

The protein filter gap remains the main outstanding issue.

## High-Level Flow

```text
BasicMapScreen
  -> wait for location
  -> getFeed(location, daily, permanent, userId=undefined, radius=10)
  -> getFilteredRestaurants(location, daily, permanent, userId=undefined, radius=10)

Edge Function /functions/v1/feed
  -> optional Redis cache lookup
  -> generate_candidates() SQL RPC
  -> ingredient-flag annotation
  -> rankCandidates()
  -> diversity cap
  -> return dishes or restaurants

BasicMapScreen
  -> footer keeps max 5 dishes
  -> max 1 footer dish per restaurant
  -> drinks/desserts removed from footer by name regex only
  -> taping a dish navigates to RestaurantDetail, not a dish detail screen
```

## Active Client Entry Point

### 1. Main screen: `BasicMapScreen`

The map screen owns two recommendation-related requests:

- `getFeed(...)` for dish recommendations
- `getFilteredRestaurants(...)` for restaurant ranking on the map

Both requests are triggered when either of these change:

- current user location
- daily filters
- permanent filters

Both calls are debounced by 300 ms.

### 2. Radius is hardcoded to 10 km

`BasicMapScreen` calls both feed endpoints with a hardcoded radius of `10`.

Implication:

- The daily `maxDistance` filter in the store is not driving the live recommendation radius.

### 3. User personalization is intentionally disabled on map feed

`BasicMapScreen` passes `undefined` as `userId` to both `getFeed()` and `getFilteredRestaurants()`.

Implication:

- The feed runs in anonymous / cold-start mode on the main map screen.
- Historical likes/dislikes, preference vectors, favorite restaurants, and learned cuisine preferences are not active there.

This is a major current-state constraint.

## Which Filters Reach the Feed

The filter mapping happens in `apps/mobile/src/services/edgeFunctionsService.ts`.

### Filters that are currently sent to the backend

From daily filters:

- `priceRange`
- `preferredDiet`
  - derived from daily vegetarian/vegan toggle
  - this is a **soft preference**, not a hard exclusion
- `calorieRange` when enabled
- `cuisines`
- `spiceLevel`
- `meals` (dish/meal type keywords) → sent as `dishNames`
  - added March 2026; dishes whose names contain a selected keyword receive a `+0.25` boost

From permanent filters:

- `dietPreference`
  - this is the permanent hard diet filter: `all`, `vegetarian`, `vegan`
- `allergens`
- `religiousRestrictions`
- `flagIngredients`
  - from `ingredientsToAvoid`
  - these ingredients are flagged, not excluded

For restaurant mode only:

- `sortBy`
- `openNow`

### Filters present in UI/store but not sent to the backend

These exist in the filter UI and Zustand store, but are not included in the request payload used by the live map recommendation feed:

- `daily.proteinTypes.meat`
- `daily.proteinTypes.fish`
- `daily.proteinTypes.seafood`
- `daily.proteinTypes.egg`
- `daily.meatTypes.*`
- `daily.maxDistance`
- `permanent.exclude.noMeat`
- `permanent.exclude.noFish`
- `permanent.exclude.noSeafood`
- `permanent.exclude.noEggs`
- `permanent.exclude.noDairy`
- `permanent.defaultNutrition.highProtein`
- `permanent.cuisinePreferences`

That means these controls are currently either:

- UI-only in the map flow, or
- used elsewhere, but not by the active map recommendation pipeline

## Stage 1 — SQL Candidate Generation

Candidate generation lives in:

- `infra/supabase/migrations/056_generate_candidates_rpc.sql`

The Edge Function calls:

```sql
generate_candidates(
  p_lat,
  p_lng,
  p_radius_m,
  p_preference_vector,
  p_disliked_dish_ids,
  p_allergens,
  p_diet_tag,
  p_religious_tags,
  p_limit
)
```

### What Stage 1 actually does

It applies these hard filters in SQL:

1. Restaurant must be active
2. Restaurant must be within radius via PostGIS `ST_DWithin`
3. Dish must be available
4. Previously disliked dishes are excluded
5. Dishes overlapping with user allergens are excluded
6. Permanent diet tag is enforced as a hard requirement
7. Religious tags are enforced as a hard requirement

### What Stage 1 does not do

It does **not** currently filter or score on:

- protein intent (`meat`, `fish`, `seafood`, `egg`)
- meat subtypes (`chicken`, `beef`, etc.)
- `openNow`
- country scoping
- restaurant facilities
- permanent exclude flags like `noFish` or `noDairy`
- dish kind exclusion for drinks/desserts

### Candidate ordering before Stage 2

If a preference vector exists:

- order by vector cosine distance ascending

If there is no preference vector:

- order by `popularity_score DESC`
- then distance ascending

On the map screen today, there is no `userId`, so there is no preference vector, which means the feed enters this cold-start ordering path.

## Stage 2 — JavaScript Ranking in Edge Function

Ranking lives in:

- `infra/supabase/functions/feed/index.ts`

The function `rankCandidates()` computes a weighted score per dish.

### Base weighted signals

The current base weights are:

| Signal            | Weight |
| ----------------- | -----: |
| Similarity        |   0.40 |
| Restaurant rating |   0.20 |
| Popularity        |   0.15 |
| Distance          |   0.15 |
| Quality           |   0.10 |

### Quality signal composition

Quality is built from:

- image present: `0.5`
- description longer than 20 chars: `0.3`
- enrichment complete: `0.2`

### Cold-start behavior on the map screen

Because the map screen does not send `userId`, the feed runs with `hasPreferenceVector = false`.

That changes scoring materially:

- similarity is effectively unavailable
- similarity weight is redistributed into rating and popularity
- ranking becomes more dependent on:
  - restaurant rating
  - dish popularity
  - distance
  - content quality

In practice, this means the map feed is much closer to a **high-quality nearby dish ranking** than a true personalized recommendation system.

## Soft Boosts That Are Active Today

After base scoring, the feed can add these boosts.

### Active soft boosts from the current map request

These are active in the current map flow:

| Signal               | Current behavior                                                    |
| -------------------- | ------------------------------------------------------------------- |
| Daily dish/meal type | `+0.25` if dish name contains any selected meal keyword             |
| Daily cuisines       | `+0.20` if restaurant cuisine matches any selected cuisine          |
| Daily preferred diet | `+0.15` for vegetarian/vegan match                                  |
| Daily spice level    | Up to `+0.10`; hot can also be penalized for `noSpicy`              |
| Daily price range    | Up to `+0.08` if dish price fits the range, strongest near midpoint |
| Daily calorie range  | Up to `+0.05` if calories fit the selected range                    |
| Ingredients to avoid | dish is annotated with `flagged_ingredients`, not excluded          |

### Soft boosts that exist in code but are inactive on the map screen

These scoring paths exist in the Edge Function, but are effectively dormant from the current map screen because no `userId` is passed:

- historical liked cuisines: `+0.10`
- favorite restaurant boost: `+0.15`
- learned preferred cuisines: `+0.10`
- learned price range: up to `+0.06`
- spice tolerance from `user_preferences`
- vector similarity

## Diversity and Result Shaping

After ranking:

1. dishes are sorted by score descending
2. a diversity cap keeps at most `3` dishes per restaurant
3. `mode: 'dishes'` returns top `20`
4. `mode: 'restaurants'` groups by restaurant and keeps the best dish score per restaurant

For restaurant mode, the final list is sorted by:

- `closest`, or
- `highestRated`, or
- default `bestMatch` using the best dish score per restaurant

### Important caveat: `openNow` is sent but not applied

`getFilteredRestaurants()` includes `openNow` in the request.

However, the current `feed` Edge Function does not use `filters.openNow` anywhere in candidate filtering or final restaurant filtering.

So in current state:

- `openNow` appears wired at the request level
- but it is not actually enforced by the live feed logic

## Final Client-Side Presentation Rules

Once `BasicMapScreen` receives the ranked dish feed:

### Recommended footer

The footer applies extra presentation constraints:

- max `5` dishes shown
- max `1` dish per restaurant
- skips dishes whose names match local drink/dessert regexes

This filtering is entirely client-side and only affects the footer cards.

### Dish markers

Dish markers use the feed dishes and look up coordinates from the restaurant feed.

Important difference:

- the footer removes some drinks/desserts by name
- the dish-marker feed does not do that extra client-side removal

So drinks/desserts can still remain in the map's dish dataset even if they are hidden from the footer.

### Navigation behavior

Both of these navigate to `RestaurantDetail` rather than a dedicated dish-detail screen:

- tapping a footer recommendation
- tapping a dish marker

## Stale Comments and Outdated Docs

During review, several stale assumptions surfaced.

### 1. Comment says drinks/desserts are excluded server-side

`BasicMapScreen.tsx` currently contains a comment saying drinks and desserts are excluded server-side in `generate_candidates()`.

That is not true in the active SQL function reviewed in `056_generate_candidates_rpc.sql`.

Current reality:

- Stage 1 returns `dish_kind`
- but does not filter on it
- footer filtering is currently done by client regex on dish name

### 2. Older design docs overstate current implementation

The existing document `docs/todos/first-principles-review-data-model-filters-recommendations.md` describes a broader recommendation system than what is currently active.

Examples of divergence:

- it references protein preference as an active soft signal
- it describes older feed architecture details that are not what the current code path does today
- it implies more personalization than the map screen currently activates

That earlier doc is useful as design thinking, but not as the authoritative source of current production behavior.

## Why the Current Behavior Produces the Reported Issues

## Case A — Vegetarian permanent filter works

This is expected.

Reason:

- permanent diet preference is mapped to `dietPreference`
- the feed passes that into `generate_candidates()` as `p_diet_tag`
- SQL enforces it as a hard filter using `d.dietary_tags @> ARRAY[p_diet_tag]`

So vegetarian and vegan permanent filters can fully remove incompatible dishes.

## Case B — Indian cuisine feels prioritized

This is also expected.

Reason:

- daily cuisine filters are sent as `filters.cuisines`
- `rankCandidates()` gives a `+0.20` soft boost when the restaurant cuisine matches

This does not hard-filter to Indian only, but it is strong enough to make Indian dishes feel prioritized when they exist nearby.

## Case C — Meat/Fish/Seafood selection can still surface Caesar Salad

This is expected under the current implementation, even if it is undesirable.

Reason:

- daily protein selections are not sent in the feed request
- Stage 1 does not filter on protein
- Stage 2 does not boost or penalize based on protein intent

So a dish like Caesar Salad can still rank highly if it wins on:

- rating
- popularity
- distance
- image/description/enrichment quality

In other words, the system currently reads `meat/fish/seafood` as **no signal at all** in the live map feed.

## Case D — Fish/Seafood + Chinese does not prioritize seafood dishes when no Chinese restaurants exist

This is also consistent with current code.

Reason:

- `Chinese` is only a soft cuisine boost, not a hard requirement
- `fish/seafood` is currently ignored by the feed

Therefore, when there are no Chinese restaurants nearby:

- no candidate gets the Chinese `+0.20` boost
- seafood dishes do not get a protein boost either
- ranking falls back to generic cold-start signals such as popularity, rating, distance, and content quality

This is why fish/seafood dishes in non-Chinese restaurants are not being explicitly elevated.

## Current System Characteristics

In plain terms, the live map recommendation system today behaves like this:

- Hard safety filters work reasonably well for vegetarian/vegan, allergens, and religious restrictions.
- Cuisine works as a soft ranking preference (+0.20).
- Dish/meal type works as a strong ranking preference (+0.25, case-insensitive name match).
- Daily veg/vegan works as a soft ranking preference (+0.15).
- Price, calories, and spice are lightweight ranking modifiers.
- Ingredient avoidance is a warning system, not an exclusion system.
- Personalized learning is largely dormant on the map screen.
- Protein intent (meat/fish/seafood/egg) is still not implemented in the live map recommendation path.
- Some UI filter controls (protein types, maxDistance, openNow) are ahead of the backend and create an expectation the system does not yet fulfill.

## Confirmed Current-State Gaps

These are the main implementation gaps verified during this review:

1. Daily protein filters (meat/fish/seafood/egg) are not wired into feed generation or ranking.
2. Meat subtype filters are not wired into feed generation or ranking.
3. Map feed personalization is disabled by omission of `userId`.
4. `maxDistance` is not driving the live feed radius.
5. `openNow` is sent for restaurant mode but not enforced.
6. Permanent exclude flags (`noFish`, `noDairy`, etc.) are not used by the live feed.
7. Drinks/desserts are not excluded server-side despite a client comment claiming they are.
8. Some older docs no longer match the active implementation.

### Resolved since initial review

- ✅ **Daily dish/meal type filter** (`meals` → `dishNames`, +0.25 boost) — wired end-to-end March 2026.

### Next: wire protein and meat subtype filters

Gaps 1 and 2 above (protein types and meat subtypes) are the highest-priority remaining recommendation work.

**What needs to happen:**

1. **`edgeFunctionsService.ts` — `buildFilters()`**: map `daily.proteinTypes` and `daily.meatTypes` into a new `proteinTypes` / `meatTypes` payload field and send it to the feed.
2. **`infra/supabase/functions/feed/index.ts` — `FeedRequest` type**: add `proteinTypes` and `meatTypes` fields.
3. **`infra/supabase/functions/feed/index.ts` — `rankCandidates()`**: add a soft boost (suggested `+0.20`) when a dish's `dietary_tags` or `name` matches the selected proteins; add a further boost for matching meat subtypes. Consider whether "I selected Fish only" should also softly penalise pure-meat dishes.
4. **`generate_candidates()` SQL RPC** (optional, stronger enforcement): if the user has selected protein types with no vegetarian/vegan override, filter `dish_ingredients` or `dietary_tags` at the SQL stage to reduce irrelevant candidates entering Stage 2.
5. **Deploy** the updated Edge Function after steps 1–3 are complete.

## Recommended Use of This Document

Use this file as the current-state baseline for improvement work.

Specifically, it should guide the next tasks:

1. Define desired recommendation semantics for protein intent.
2. Decide which filters are hard constraints vs soft ranking signals.
3. Close the gap between visible filter UI and actual feed inputs.
4. Re-activate real personalization on the map feed only when the behavior is intentionally designed.
5. Move dish classification away from name regexes toward structured dish attributes.
