# Plan — Restaurant-detail menu cold-open batch (§M1 + §M3 + §M4)

**Date:** 2026-06-13
**Source:** `docs/findings/mobile-performance-audit.md` Part C (M1, M3, M4)
**Scope:** Frontend only (`apps/mobile`). **No DB migration, no edge deploy.**
**Status:** Plan — awaiting go-ahead. Not implemented.

---

## Why

Tapping a restaurant today triggers, the moment the skeleton arrives, an auto-load
effect that loops over **every** category of **every** menu and fires
`loadCategoryDishes` for each. Each of those does **3 queries** (dishes + ratings +
opinions). A 6-category menu = **~18 queries in a burst** on top of the 4
skeleton/favourite queries (`useRestaurantDetail.ts:224-231`).

On top of that, the menu re-renders far more than it needs to:

- `sortedDishes(...)` runs **inline, unmemoized**, inside the category `.map`
  (`FoodTab.tsx:174`) → re-classifies + re-sorts every dish every render.
- `DishMenuItem` then calls `classifyDish` **again** for the same dish
  (`DishMenuItem.tsx:84`) → **each dish classified twice per render**.
- `DishMenuItem` / `ModifierGroupsList` / `DishRatingBadge` / `RestaurantRatingBadge`
  have **no `React.memo`**, and `DishMenuItem` receives the whole `dishRatings` **Map**
  as a prop → any one ratings/opinions Map update re-renders the entire mounted tree.

## Goal

| Item | Outcome |
|------|---------|
| **M1** | One restaurant-wide dishes query instead of one-per-category. Burst → constant. |
| **M4** | Ratings + opinions each batched **once** across all dish ids (falls out of M1). |
| **M3** | Classify each dish **once**; memoize the per-category sort; `React.memo` the rows; pass a resolved `rating` + `passesHardFilters` down so a single Map update no longer re-renders every row. |

**Net query count on cold open:** `3 + 3×C` → `3 + 3` (skeleton/fav block unchanged at ~4; dish block `3C` → `3`).

---

## Files & changes

### 1. `apps/mobile/src/stores/restaurantStore.ts` — add one store method (M1/M4 data layer)

- Add a cache field + TTL reuse:
  ```ts
  /** In-memory whole-restaurant dish cache (5-min TTL). */
  restaurantDishesCache: Map<string, CategoryDishCacheEntry>;
  ```
  (`CategoryDishCacheEntry` already exists; `CategoryDish = Dish & { option_groups? }`
  already carries `menu_category_id` via `Dish`.)
- Add `fetchAllRestaurantDishes(restaurantId)`: **one** query, per-restaurant 5-min cache,
  mirroring `fetchCategoryDishes`'s exact dish/option column list **plus `menu_category_id`**
  (needed for grouping), filtered `.eq('restaurant_id', id).eq('status','published')`,
  ordered `created_at` asc (deterministic; dishes have no `display_order` column — verified).
  Returns `{ data: CategoryDish[] | null, error }`.
- `fetchCategoryDishes` stays (manual header-tap fallback still works; it'll cache-hit).

### 2. `apps/mobile/src/screens/restaurant-detail/useRestaurantDetail.ts` — single bulk load (M1/M4) + stable handler (M3)

- Subscribe to the new `fetchAllRestaurantDishes`.
- **Replace** the per-category auto-load effect (`:224-231`) with a single-shot loader:
  1. mark all category ids `'loading'`,
  2. `await fetchAllRestaurantDishes(restaurant.id)`,
  3. on error → set all category ids `'error'` (parity with old per-category error),
  4. on success → group dishes by `menu_category_id`, set each category's array in one
     `setCategoryDishes` (categories with no dishes → `[]`),
  5. **one** `getDishRatingsBatch(allIds)` + **one** `getUserDishOpinions(user.id, allIds)`,
     merged into the existing `dishRatings` / `userDishOpinions` state.
  Effect carries a `cancelled` guard + the existing `mountedRef` checks.
  Deps: `[restaurant?.id, fetchAllRestaurantDishes, user?.id]`.
- `loadCategoryDishes` is **kept** unchanged (used by the category-header tap; now a
  cheap cache-hit/early-return since categories arrive pre-populated).
- Wrap `handleDishPress` in `useCallback` (deps `[restaurantId, trackDishView]`) so the
  `React.memo` on `DishMenuItem` actually bites (its `onPress` becomes stable).

### 3. `apps/mobile/src/screens/restaurant-detail/FoodTab.tsx` — memoize sort, resolve props, hoist styles (M3)

- Replace the inline `sortedDishes(...)` call with a memoized `Map<categoryId, (DishWithGroups & {passesHardFilters})[]>` computed once per `[categoryDishes, permanentFilters]`; look up `sortedByCategory.get(category.id) ?? []` in render. Delete the `sortedDishes` helper (logic moves into the memo).
- At each `DishMenuItem` call site (the featured block **and** the category map), pass
  resolved props instead of the whole Map:
  `rating={dishRatings.get(dish.id) ?? null}`, `passesHardFilters={dish.passesHardFilters}`
  (featured dish: `classifyDish(featuredDish, permanentFilters).passesHardFilters` — one dish, cheap). Drop the `dishRatings`/`permanentFilters` props.
- Hoist the inline dish-row wrapper style (`:218-223`) and the `{paddingHorizontal: spacing.md}` wrappers into a local `StyleSheet.create`.

### 4. `apps/mobile/src/screens/restaurant-detail/DishMenuItem.tsx` — memo + de-dup classify (M3)

- `export const DishMenuItem = React.memo(function DishMenuItem({...}) {...})`.
- Props: **drop** `permanentFilters` + `dishRatings: Map`; **add** `rating?: DishRating | null`
  and `passesHardFilters: boolean`.
- Use the `rating` prop (was `dishRatings.get(item.id)`) and the `passesHardFilters` prop
  (was `classifyDish(item, permanentFilters)`). Remove the `classifyDish` import.

### 5. `apps/mobile/src/screens/restaurant-detail/ModifierGroupsList.tsx` — memo + memoized sort (M3)

- `export const ModifierGroupsList = React.memo(function ModifierGroupsList({...}) {...})`.
- `useMemo` the top-level `visible` (active-groups filter+sort) on `[groups]`, and the
  per-group `opts` (available-options filter+sort) on `[group.options]` inside `GroupSection`.

### 6. `DishRatingBadge.tsx` + `RestaurantRatingBadge.tsx` — `React.memo` (M3)

- Wrap each export in `React.memo` (props are primitives / small) — stops one ratings
  Map update from re-rendering every badge in the tree.

---

## Explicitly NOT in this batch (deferred)

- **§M2** — virtualize the `ScrollView` → `FlashList`/`SectionList`. Bigger structural
  change; controls what's *mounted* (this batch fixes what's *fetched* + *re-rendered*).
  Composes cleanly on top later.
- **§M5 / §M6** — cache ratings/opinions/photos + pull-to-refresh; switch dish photos to
  `expo-image`. Separate polish.
- **Dead per-category UI** (`'loading'`/`'error'`/"Load dishes" branches in `FoodTab`):
  **kept**. The bulk loader drives the same Map states, so they still render correctly;
  removing them is cosmetic and widens blast radius.

## Behavior changes to be aware of

- Dish order within a category becomes `created_at`-ascending (was unspecified PostgREST
  default). Deterministic; `sortDishesByFilter` still floats hard-filter passes to the top.
- A whole-restaurant dish query loads all dish *rows* up front (one query). This is the
  point — the felt cost was the query *burst*, not the payload. (Per-row *mount* cost is
  M2's job.)
- If the single dishes query fails, **all** categories show the existing `'error'` state
  at once (vs. per-category before). Acceptable; same UI.

## Verification

- `tsc` (web-portal/shared types) + `eslint` clean for the 6 touched files.
- **User, on device:** cold-open a restaurant → confirm the dish-query burst is gone
  (network/log: 1 dishes + 1 ratings + 1 opinions, not 3×categories); menu scroll +
  filter toggles feel smoother; hard-filter dimming, ratings badges, "You loved it",
  favourite hearts, modifier groups, and the featured-dish block all still render.

## Commit

- One commit (docs) + one commit (code) to `main`, **only on your "commit"**. Frontend-only — no deploy.
