# "Loved it" → auto-favorite + real Favorites screen

Status: shipped (2026-06-04) — committed + pushed; favorites constraint applied to prod
Scope approved: **A + B** (+ follow-up: "You loved it" menu indicator)

## Done
- Favorites unique constraint applied to prod. Originally shipped as `151`, then
  **renumbered to `154` and made idempotent** to resolve a number collision with the
  ingredient-pipeline's `151_retire_ingredient_triggers.sql`. Pre-apply dup check:
  **0 favorites rows / 0 duplicates**.
- Plan A: `ratingService.autoFavoriteLovedDish` wired into `submitInContextRating`
  (in-context) and `saveDishOpinions` (full flow), `liked`-only, add-only.
- Plan B: `favoritesService.getFavoritesDetailed`, rebuilt `FavoritesScreen`,
  Profile entry point, en/es/pl strings.
- Follow-up: "You loved it" pill on restaurant menu rows (DishMenuItem/FoodTab).
- `tsc --noEmit` clean. Commits: 83a4708, 8b498a2, 851b866 (+ migration renumber).

## Remaining (user)
1. On-device verification (see Verification below).

## Background / findings

Today "Loved it" (the `liked` dish opinion) and "favorites" are two fully separate
systems with no link:

- **"Loved it"** writes `dish_opinions` (opinion=`liked`) + a `'liked'` row in
  `user_dish_interactions` (feeds the preference vector). Two surfaces:
  - in-context on the menu (`InContextRating` → `ratingService.submitInContextRating`)
  - the rating workflow (`RateDishScreen` → `ratingService.saveDishOpinions`)
- **Favorites** is a separate `favorites` table (`subject_type` `'dish'`/`'restaurant'`,
  `subject_id`). Written only via `favoritesService.toggleFavorite`:
  - restaurant heart (restaurant detail)
  - dish save heart (`DishPhotoModal`)

How `favorites` rows are consumed today:
- **Feed Edge Function** reads `subject_type='restaurant'` ONLY: +0.15 boost to a
  favorited restaurant's dishes, plus its cuisines merged into liked-cuisines (+0.10).
- `isFavorited` powers heart state (restaurant detail + dish modal).
- **Dish favorites are otherwise invisible**: `getUserFavorites` is unused and
  `FavoritesScreen` is a "Coming Soon" placeholder. The screen is also **unreachable** —
  `navigate('Favorites')` exists nowhere.

Integrity gap: `favorites` has **no** UNIQUE constraint on `(user_id, subject_type,
subject_id)`. `addToFavorites` already treats `23505` as "Already in favorites" but that
branch is dead code, and `isFavorited` uses `.single()` which errors on duplicate rows.

## Decisions

1. Favorites screen lists **both dishes and restaurants** (two sections).
2. Auto-favorite is **add-only**: re-rating a loved dish "okay/not for me" does NOT
   auto-remove the favorite (users remove manually).
3. Prod migration: write SQL + run a **read-only** duplicate check, show the user the
   count, then the user applies the migration.

## Plan A — auto-favorite on "Loved it" + integrity guard

### A1. Migration `154_favorites_unique_constraint.sql` (+ `154_REVERSE_ONLY_…`; shipped as 151)
- Delete duplicate `favorites` rows, keeping earliest (`created_at`, tie-break `id`).
- `ADD CONSTRAINT favorites_user_subject_unique UNIQUE (user_id, subject_type, subject_id)`.
- Drop redundant `idx_favorites_user_subject` (left-prefix of the new unique index).
- Read-only pre-check: `infra/scripts/check-favorites-duplicates.ts`.

### A2. `apps/mobile/src/services/ratingService.ts`
- Import `addToFavorites`.
- `submitInContextRating`: inside `if (opinion === 'liked')`, fire-and-forget
  `addToFavorites(userId, 'dish', dishId)` (`.then`, ignore `'Already in favorites'`).
- `saveDishOpinions`: add a `liked`-only block doing the same (existing interaction
  block also covers `okay`; favorite must be `liked` only).

## Plan B — real Favorites screen + reachable entry point

### B1. `apps/mobile/src/services/favoritesService.ts`
Add `getFavoritesDetailed(userId)` → `{ dishes: FavoriteDish[]; restaurants: FavoriteRestaurant[] }`:
- `getUserFavorites(userId)` → split ids by subject_type.
- Dishes: `dishes.select('id,name,price,image_url,display_price_prefix,restaurant_id,
  restaurant:restaurants(name,currency_code)').in('id', dishIds).eq('status','published')`.
- Restaurants: `restaurants.select('id,name,image_url,cuisine_types').in('id', restIds)`.
- Preserve favorite recency order (favorites are returned newest-first).

### B2. `apps/mobile/src/screens/FavoritesScreen.tsx`
Replace placeholder content (keep the swipe-to-close modal shell) with:
- loading / not-signed-in / empty states,
- "Saved dishes" + "Saved restaurants" sections,
- row tap → `navigation.navigate('RestaurantDetail', { restaurantId })`
  (dish row uses its `restaurantId`),
- per-row remove → `toggleFavorite(...)` + drop from local state,
- reload on focus.

### B3. `apps/mobile/src/screens/ProfileScreen.tsx`
Add a **Favorites** button next to "Viewed History" → `navigation.navigate('Favorites')`.

### B4. i18n `apps/mobile/src/locales/{en,es,pl}.json`
- `profile.favorites`
- `favorites.dishesSection`, `favorites.restaurantsSection`, `favorites.loading`,
  `favorites.signInRequired`, `favorites.remove`, `favorites.show`
  (reuse existing `favorites.title/subtitle/empty/emptyMessage`).

## Rollout / ordering
1. Apply migration 154 (after dup check) — makes `addToFavorites` idempotent.
2. Ship mobile code (A2 + B). Code is safe pre-migration but could create duplicate
   rows until the constraint exists, so prefer migration first.

## Verification
- `turbo check-types` (mobile).
- On-device (user): Loved it on a dish → appears under Profile → Favorites; restaurant
  heart → appears under saved restaurants; remove works; re-rating "okay" keeps it.
