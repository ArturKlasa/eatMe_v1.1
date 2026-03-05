# MOB-05 — Restaurant Detail Screen

## Overview

The restaurant detail screen is a modal-style screen that slides over the map when a user taps a restaurant marker. It shows the restaurant's full menu organised by categories, operating hours, contact info, and user-generated ratings.

---

## Key Files

| File                                                   | Role                                                             |
| ------------------------------------------------------ | ---------------------------------------------------------------- |
| `apps/mobile/src/screens/RestaurantDetailScreen.tsx`   | Full screen component (~616 lines)                               |
| `apps/mobile/src/components/DishPhotoModal.tsx`        | Full-screen photo viewer for dish images                         |
| `apps/mobile/src/components/DishRatingBadge.tsx`       | Small badge showing average rating for a dish                    |
| `apps/mobile/src/components/RestaurantRatingBadge.tsx` | Badge showing overall restaurant rating                          |
| `apps/mobile/src/services/dishRatingService.ts`        | `getDishRatingsBatch()` — fetches ratings for a list of dish IDs |
| `apps/mobile/src/services/restaurantRatingService.ts`  | `getRestaurantRating()` — fetches overall restaurant rating      |
| `apps/mobile/src/services/favoritesService.ts`         | `toggleFavorite()`, `isFavorited()`                              |
| `apps/mobile/src/stores/sessionStore.ts`               | `trackRestaurantView()`, `trackDishView()`                       |

---

## Screen Entry

The screen is navigated to from `BasicMapScreen` (and potentially from `SwipeScreen`) passing `restaurantId`:

```typescript
rootNavigation.navigate('RestaurantDetail', { restaurantId: 'uuid-...' });
```

---

## Data Loading on Mount

Three parallel data fetches happen when the screen opens:

### 1. Restaurant + menu data

```
supabase.from('restaurants')
  .select('*, menus(*, menu_categories(*, dishes(*)))')
  .eq('id', restaurantId)
  .single()
```

The query returns the restaurant with its full menu tree:
`Restaurant → Menus → Menu Categories → Dishes`

After loading, `trackRestaurantView()` is called to record the view in the session store.

### 2. Dish ratings (batch)

```
getDishRatingsBatch(allDishIds)
  → Queries user_dish_opinions for average ratings per dish
  → Returns Map<dishId, DishRating>
```

All dish IDs are extracted from the menu tree first, then fetched in one call.

### 3. Restaurant rating

```
getRestaurantRating(restaurantId)
  → Returns { averageRating, totalRatings, breakdown }
```

### 4. Favorites status

```
isFavorited(userId, 'restaurant', restaurantId)
  → Returns boolean
```

---

## Screen Structure

The screen has two tabs:

- **Food** (default): Shows menu categories and dishes
- **Hours**: Shows operating hours

### Food Tab

Menu categories are shown as sections. Each dish card shows:

- Name and description
- Price
- Dietary tags (vegetarian, vegan, etc.)
- Allergens
- `DishRatingBadge` (if rating data loaded)
- Photo thumbnail (tappable → opens `DishPhotoModal`)

Tapping a dish:

```
User taps dish
  → setSelectedDish(dish)
  → Fetch dish photos: dishPhotoService.getDishPhotos(dish.id)
  → Fetch dish ingredient names from dish_ingredients JOIN canonical_ingredients
  → DishPhotoModal opens with photos + ingredient list
  → trackDishView({ restaurantId, dish }) recorded in sessionStore
```

### Hours Tab

Operating hours are displayed per day of week. The current day is highlighted. Format is localised via `formatOpeningHours()` and `formatTime()` from `utils/i18nUtils.ts`.

---

## Favorites

The heart icon in the header toggles the restaurant in/out of the user's favorites:

```
User taps heart icon
  → favoriteLoading = true
  → toggleFavorite(userId, 'restaurant', restaurantId)
    → If currently favorited: removeFromFavorites(...)
    → If not favorited: addToFavorites(...)
  → isFavorite state toggled
  → favoriteLoading = false
```

Favorites are stored in the `favorites` table (`subject_type = 'restaurant'`).

---

## Address Modal

Tapping the address opens a small modal with:

- Full formatted address
- A "Get Directions" button that calls `Linking.openURL(mapsUrl)` to open Apple Maps or Google Maps

---

## Contact Information

If the restaurant has a phone number, a "Call" button is shown that uses `Linking.openURL('tel:...')`.

---

## Session Tracking

Every restaurant view is tracked via `sessionStore.trackRestaurantView()`. This builds up the `recentRestaurants` list used to prompt for ratings when the user returns to the map. See [MOB-09-rating-system.md](MOB-09-rating-system.md).

---

## Known Gaps

- `restaurant` state is typed as `any`. Should use a proper typed interface.
- `dishPhotos` and `dishIngredientNames` are fetched per dish on tap — they could be pre-fetched when the dish list loads to improve perceived performance.
- The description visibility setting (`description_visibility`) stored on each dish is not yet respected in the UI — all descriptions are shown.
