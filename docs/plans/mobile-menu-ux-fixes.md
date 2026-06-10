# Mobile Menu UX Fixes

**Date:** 2026-06-09
**Scope:** `apps/mobile/` only. Four approved fixes from a five-issue review of the
restaurant-menu / dish-view flow. Issue 2 (cuisine line in the detail header) was
explicitly deferred — no change.

## 1. Dish sheet: empty gap at the bottom when a dish has no modifiers

`src/components/DishPhotoModal.tsx` hard-codes the bottom sheet to `height: '75%'`.
Dishes without option groups (and with short/no description) leave a large empty
area under the content.

**Fix:** content-adaptive sheet height.
- `sheet`: `height: '75%'` → `maxHeight: '75%'`
- `body` ScrollView: `flex: 1` → `flexGrow: 0, flexShrink: 1`
  (short content shrinks the sheet; long content caps at 75% and scrolls as before)
- Slim the "no photos yet" placeholder (fixed 0.6×screen-width tall) to a compact
  height when `photos.length === 0`.

## 2. Favorited dishes visible at menu level

Dish favorite status was only fetched per-dish when the dish sheet opened
(`isFavorited`). Menu rows showed only the opinion-driven "You loved it" pill —
favorites (saved dishes) were invisible in the menu list.

**Fix:**
- `useRestaurantDetail.ts`: fetch `getUserFavorites(user.id, 'dish')` once alongside
  the existing restaurant-favorite check → `favoriteDishIds: Set<string>` +
  `setDishFavorite(dishId, saved)` updater.
- `FoodTab.tsx` → `DishMenuItem.tsx`: render a small ❤️ after the dish name when the
  dish is in the set.
- `DishPhotoModal.tsx`: new `initialSaved` + `onFavoriteChange` props — the sheet's
  heart now initializes from the set (no per-open query at this call site) and
  reports toggles back so the menu row stays in sync.

## 3. Dish tapped on the map appears featured in the restaurant menu

Both map entry points (dish markers + footer dish cards in `BasicMapScreen.tsx`)
navigated with only `{ restaurantId }`, dropping the dish identity.

**Fix:**
- `types/navigation.ts`: `RestaurantDetail: { restaurantId; featuredDishId? }`.
- `BasicMapScreen.tsx`: both dish handlers pass `featuredDishId: dish.id`.
- `FavoritesScreen.tsx`: dish rows pass `featuredDishId` too.
- `FoodTab.tsx`: when the featured dish is found in the loaded category data
  (variant children resolve to their folded parent row), render a pinned
  accent-bordered "From your search" block above the menu list containing the
  standard dish row + modifiers. The dish still appears in its category below.
- New i18n key `restaurant.featuredFromSearch` (en/es/pl); new styles
  `featuredSection` / `featuredLabel` in `src/styles/restaurantDetail.ts`.

## 4. "Loved it" → auto-favorite (verified already implemented; sync fix only)

Server-side behavior already existed in both rating paths
(`ratingService.ts`: `submitInContextRating` + `saveDishOpinions` →
`autoFavoriteLovedDish`, add-only, idempotent via UNIQUE constraint, migration 151).

**Fix (cosmetic):** rating "Loved it" inside the dish sheet now also flips the
sheet's ❤️ immediately and updates `favoriteDishIds`, mirroring the server-side
auto-favorite instead of waiting for a reopen.
