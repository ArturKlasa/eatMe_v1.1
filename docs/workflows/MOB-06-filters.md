# MOB-06 — Filters

## Overview

The mobile app has a two-tier filter system designed to separate quick session choices (daily filters) from persistent profile-level preferences (permanent filters). Both are managed by a single Zustand store (`filterStore`) and persisted to AsyncStorage and Supabase.

---

## Key Files

| File                                                  | Role                                                                   |
| ----------------------------------------------------- | ---------------------------------------------------------------------- |
| `apps/mobile/src/stores/filterStore.ts`               | Combined store for daily + permanent filters (~1095 lines)             |
| `apps/mobile/src/screens/FiltersScreen.tsx`           | Full-screen modal for permanent filters                                |
| `apps/mobile/src/components/DrawerFilters.tsx`        | The content inside the permanent filters screen                        |
| `apps/mobile/src/components/map/DailyFilterModal.tsx` | Bottom-sheet for daily filter quick changes (within map screen)        |
| `apps/mobile/src/components/FilterComponents.tsx`     | Shared UI components (sliders, toggles, chips) used by both filter UIs |
| `apps/mobile/src/components/FilterFAB.tsx`            | Floating action button that opens the daily filter modal               |
| `apps/mobile/src/services/filterService.ts`           | Pure filtering algorithms applied client-side to restaurant data       |
| `apps/mobile/src/services/userPreferencesService.ts`  | Syncs permanent filters to/from Supabase `user_preferences` table      |

---

## Two Filter Tiers

### Daily Filters (session-based)

Quick choices the user makes for their current food discovery session. Reset on demand or when the user decides to change their mood.

| Field            | Type                                         | Default                |
| ---------------- | -------------------------------------------- | ---------------------- |
| `priceRange`     | `{ min: number, max: number }`               | `{ min: 0, max: 100 }` |
| `cuisineTypes`   | `string[]`                                   | `[]` (all cuisines)    |
| `meals`          | `string[]`                                   | `[]`                   |
| `dietPreference` | `{ vegetarian, vegan }`                      | both false             |
| `proteinTypes`   | `{ meat, fish, seafood, egg }`               | all false              |
| `meatTypes`      | `{ chicken, beef, pork, lamb, duck, other }` | all false              |
| `spiceLevel`     | `'noSpicy' \| 'eitherWay' \| 'iLikeSpicy'`   | `'eitherWay'`          |
| `hungerLevel`    | `'diet' \| 'normal' \| 'starving'`           | `'normal'`             |
| `calorieRange`   | `{ min, max, enabled }`                      | disabled               |
| `maxDistance`    | `number` (km)                                | `10`                   |
| `openNow`        | `boolean`                                    | `false`                |
| `sortBy`         | `'closest' \| 'bestMatch' \| 'highestRated'` | `'bestMatch'`          |

### Permanent Filters (profile-level hard constraints)

The user's fundamental dietary identity — things that should always apply regardless of the session. These are synced to the database.

| Field              | Type                               | Description               |
| ------------------ | ---------------------------------- | ------------------------- |
| `dietType`         | `'all' \| 'vegetarian' \| 'vegan'` | Hard dietary constraint   |
| `allergies`        | `string[]`                         | Foods to always exclude   |
| `excludedCuisines` | `string[]`                         | Cuisines to always hide   |
| `maxBudget`        | `number`                           | Maximum price hard cap    |
| `currency`         | `SupportedCurrency`                | User's preferred currency |

---

## Opening Filters

### Daily Filters

- Triggered by the `FilterFAB` floating button on the map screen
- Opens `DailyFilterModal` as a bottom sheet within `BasicMapScreen`
- Changes are immediately applied (no explicit "Apply" button — reactive)

### Permanent Filters

- Navigating to `FiltersScreen` (transparent modal, swipe-to-close)
- The `DrawerFilters` component renders the full preferences UI
- User taps "Save" → `filterStore.savePermanentFilters()` → synced to DB

---

## Applying Filters

On the map screen, filters are applied client-side:

```
filterService.applyFilters(restaurants, dailyFilters, permanentFilters)
  → applyPermanentFilters() first (hard exclusions)
  → applyDailyFilters() next (soft preferences)
  → sortRestaurants() by sortBy preference
  → Returns FilterResult: { restaurants, totalCount, appliedFilters, filterSummary }
```

On the swipe screen, filters are sent to the Edge Function as part of the `getFeed()` request (server-side filtering).

---

## Database Sync

Permanent filters are persisted to Supabase via `userPreferencesService`:

```
filterStore.savePermanentFilters()
  → permanentFiltersToDb(permanent) → transforms to DB column format
  → saveUserPreferences(userId, dbRow)
    → UPSERT into user_preferences table
```

On login, `filterStore.syncWithDatabase(userId)` loads the saved preferences:

```
loadUserPreferences(userId)
  → SELECT from user_preferences WHERE user_id = userId
  → dbToPermanentFilters(row) → transforms back to store format
  → filterStore updates permanent state
```

The `currency` field in permanent filters drives price range defaults. When the currency changes, `getPriceRangeForCurrency(currency)` returns sensible min/max defaults for that currency.

---

## Reset

```
filterStore.resetDailyFilters()
  → Resets daily state to defaults
  → Does not affect permanent filters
  → Does not touch AsyncStorage or DB
```

---

## UI — Swipe to Close

Both `FiltersScreen` and `FavoritesScreen` implement a swipe-down-to-close gesture using the same `PanResponder` + `Animated.Value` pattern. The gesture activates when the user drags downward from the top of the scroll view (only when scrolled to the top). Dragging more than 100px dismisses the screen; releasing before 100px snaps back.

> ⚠️ **Known Gap**: This logic is duplicated verbatim in both screens. Should be extracted to a `useSwipeToClose` hook or a `SwipeableModal` wrapper. See improvement item D4 in `CODEBASE_IMPROVEMENTS.md`.
