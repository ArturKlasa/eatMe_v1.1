# MOB-03 — Map & Restaurant Discovery

## Overview

The map screen is the primary entry point of the mobile app. It shows a Mapbox map centred on the user's location, with markers for nearby restaurants and dishes. Users can switch between "Restaurant view" and "Dish view", apply filters, and tap markers to view details.

This is the most complex screen in the app (~872 lines) and serves as the hub for navigation to most other features.

---

## Key Files

| File                                                   | Role                                                        |
| ------------------------------------------------------ | ----------------------------------------------------------- |
| `apps/mobile/src/screens/BasicMapScreen.tsx`           | The main map screen component                               |
| `apps/mobile/src/components/map/RestaurantMarkers.tsx` | Renders restaurant pin markers on the map                   |
| `apps/mobile/src/components/map/DishMarkers.tsx`       | Renders dish pin markers on the map                         |
| `apps/mobile/src/components/map/DailyFilterModal.tsx`  | Bottom-sheet modal for quick daily filter changes           |
| `apps/mobile/src/components/map/MapControls.tsx`       | Zoom, locate-me, and view-mode toggle buttons               |
| `apps/mobile/src/components/map/MapFooter.tsx`         | Bottom bar with navigation icons                            |
| `apps/mobile/src/stores/restaurantStore.ts`            | Zustand store for nearby restaurants (geospatial queries)   |
| `apps/mobile/src/stores/viewModeStore.ts`              | Tracks current view mode: 'restaurants' or 'dishes'         |
| `apps/mobile/src/stores/filterStore.ts`                | Daily and permanent filter state                            |
| `apps/mobile/src/hooks/useRestaurants.ts`              | Hook that fetches restaurants from Supabase                 |
| `apps/mobile/src/hooks/useAllDishes.ts`                | Hook that fetches all dishes from Supabase                  |
| `apps/mobile/src/hooks/useUserLocation.ts`             | Hook that retrieves the device's GPS location               |
| `apps/mobile/src/services/filterService.ts`            | Pure filtering algorithms (client-side)                     |
| `apps/mobile/src/services/geoService.ts`               | Distance calculation helpers                                |
| `apps/mobile/src/services/edgeFunctionsService.ts`     | `getFeed()` — server-side dish filtering via Edge Functions |

---

## Screen Initialisation

```
BasicMapScreen mounts
  → Request location permission (via useUserLocation)
  → If granted: get GPS coordinates
  → restaurantStore.loadNearbyRestaurantsFromCurrentLocation(lat, lng, radiusKm)
    → Calls Supabase geospatial RPC function → returns nearby restaurants
  → filterStore provides active daily + permanent filters
  → Render map centred on user coordinates
```

---

## Data Sources

The map currently has **two parallel data loading paths** (a known architectural gap — see improvement D6 / A3 in `CODEBASE_IMPROVEMENTS.md`):

| Source   | Hook / Store                             | Used when                                            |
| -------- | ---------------------------------------- | ---------------------------------------------------- |
| Primary  | `restaurantStore` (`useRestaurantStore`) | Geospatial nearby-restaurants query via Supabase RPC |
| Fallback | `useRestaurants()` hook                  | Direct table query, used if geo store has no data    |
| Dishes   | `useAllDishes()` hook                    | Dish markers (dish view mode)                        |

The screen renders `nearbyRestaurants` from the geo store when available, falling back to `dbRestaurants` from the hook.

---

## View Modes

Controlled by `viewModeStore`:

| Mode            | What is shown                                                         |
| --------------- | --------------------------------------------------------------------- |
| `'restaurants'` | Restaurant markers (one pin per restaurant)                           |
| `'dishes'`      | Dish markers (one pin per dish, positioned at restaurant coordinates) |

The user toggles between modes via `MapControls`. Switching mode triggers a re-render of markers without a new data fetch.

---

## Restaurant Markers → Restaurant Detail

```
User taps a restaurant marker (RestaurantMarkers)
  → rootNavigation.navigate('RestaurantDetail', { restaurantId })
  → RestaurantDetailScreen opens as a stack screen
```

See [MOB-05-restaurant-detail.md](MOB-05-restaurant-detail.md) for the detail screen flow.

---

## Filters

Two types of filters coexist (see [MOB-06-filters.md](MOB-06-filters.md) for full detail):

- **Daily Filters** (quick session choices): Opened via the filter FAB or `DailyFilterModal` — a bottom-sheet on the map screen itself.
- **Permanent Filters** (profile-level hard constraints): Opened via the `FiltersScreen` (full-screen transparent modal).

After filter changes, the screen re-applies `filterService.applyFilters()` to the restaurant list client-side. The swipe screen re-fetches from the Edge Function.

---

## Daily Filter Modal

The `DailyFilterModal` is a bottom-sheet that slides up from within the map screen. It provides quick toggles for common filters (cuisine, price range, dietary). Changes take effect immediately and persist for the session.

---

## Floating Menu

The `FloatingMenu` component renders overlaid action buttons:

- **Swipe** → navigate to `SwipeScreen`
- **Filters** → navigate to `FiltersScreen`
- **Favorites** → navigate to `FavoritesScreen`
- **Profile** → navigate to `ProfileScreen`
- **EatTogether** → navigate to `EatTogetherScreen`

---

## Rating Flow

After viewing a restaurant, the app can prompt the user to rate it. The `RatingFlowModal` component handles this:

```
User returns to map after viewing a restaurant
  → sessionStore.getRecentRestaurantsForRating() checked
  → If restaurant visited AND rating not given AND first visit:
    → isFirstVisitToRestaurant() checked via ratingService
    → RatingFlowModal shown
    → User rates dishes and/or the restaurant
    → submitRating() → writes to user_dish_opinions / user_restaurant_feedback
```

See [MOB-09-rating-system.md](MOB-09-rating-system.md) for full rating details.

---

## Profile Completion Banner

`ProfileCompletionBanner` appears at the top of the map screen when the user's onboarding is incomplete. Tapping it navigates to the onboarding flow. See [MOB-02-user-onboarding.md](MOB-02-user-onboarding.md).

---

## Location Handling

`useUserLocation()` wraps the device location API:

- Requests `foregroundService` location permission on mount
- Returns `{ location: { latitude, longitude }, isLoading, error }`
- Location is used to: centre the map camera, calculate distances, filter by `maxDistance`, and seed the geospatial query

If location permission is denied, the map defaults to the coordinates set in `EXPO_PUBLIC_DEFAULT_LAT` / `EXPO_PUBLIC_DEFAULT_LNG` environment variables (default: Mexico City).
