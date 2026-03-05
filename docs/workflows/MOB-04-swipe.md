# MOB-04 — Swipe Screen (Dish Discovery)

## Overview

The swipe screen presents users with a personalised feed of dishes one at a time. Users swipe right to like, left to dislike, or super-swipe to save. Every interaction is sent to the backend, which uses it to improve future recommendations.

> ⚠️ **Important Note**: The current `SwipeScreen.tsx` is described in its file header as a **"Demonstration of Edge Functions Integration"**. It is registered in the navigator as "Swipe Demo". Verify with the team whether this is the final production swipe screen or a placeholder that needs to be replaced before launch.

---

## Key Files

| File                                               | Role                                                     |
| -------------------------------------------------- | -------------------------------------------------------- |
| `apps/mobile/src/screens/SwipeScreen.tsx`          | The swipe screen component                               |
| `apps/mobile/src/services/edgeFunctionsService.ts` | `getFeed()` and `trackSwipe()` — Edge Function API calls |
| `apps/mobile/src/stores/filterStore.ts`            | Provides active filters passed to `getFeed()`            |
| `apps/mobile/src/hooks/useUserLocation.ts`         | Provides user coordinates for location-based feed        |
| `apps/mobile/src/stores/authStore.ts`              | Provides `user.id` for personalised feed                 |

---

## Feed Loading

```
SwipeScreen mounts
  → Wait for useUserLocation to return coordinates (locationLoading)
  → Once location available (hasLoadedRef.current = false):
    → loadDishes() called
    → getFeed(location, dailyFilters, permanentFilters, userId, radiusKm=10)
      → POST to Supabase Edge Function: /functions/v1/get-feed
      → Returns { dishes: ServerDish[], metadata: { totalAvailable, cached, personalized, ... } }
    → dishes state populated
    → currentIndex = 0
```

### `getFeed()` request payload

```json
{
  "location": { "lat": 19.43, "lng": -99.13 },
  "radius": 10,
  "filters": {
    "priceRange": [10, 50],
    "dietPreference": "vegetarian",
    "allergens": ["nuts"],
    "cuisines": ["Italian"]
  },
  "userId": "uuid-...",
  "limit": 20
}
```

The Edge Function combines user location, active filters, and (if authenticated) the user's interaction history to return a ranked list of dishes.

---

## Filter Reactivity

The feed reloads when filters change — but only **after the initial load** has completed:

```typescript
// Reload on filter change (after initial load)
useEffect(() => {
  if (hasLoadedRef.current && location) {
    loadDishes();
  }
}, [daily, permanent]);
```

`hasLoadedRef` prevents the effect from firing during mount. `sessionIdRef` ensures the session ID remains stable across filter-triggered reloads.

---

## Swipe Interaction

```
User swipes right (like) / left (dislike) / super-swipe
  → handleSwipe(action: 'left' | 'right' | 'super')
  → If authenticated:
    → trackSwipe(userId, dishId, action, sessionId, viewDuration, position)
      → POST to Supabase Edge Function: /functions/v1/track-swipe
      → Records in user_swipes table
      → Feeds into recommendation engine
  → swipeStats updated ({ right++, left++ })
  → currentIndex incremented
```

### Swipe stats

Swipe counts (`swipeStats.right`, `swipeStats.left`) are tracked in component state for display purposes. They are not persisted beyond the session.

---

## Session ID

`sessionIdRef.current = generateSessionId()` creates a UUID once when the component mounts. This ID groups swipes within a single usage session, enabling the recommendation engine to understand session-level behaviour (e.g., the user rejected 5 Italian dishes then accepted a Japanese dish).

---

## End of Feed

When `currentIndex >= dishes.length`, the screen shows an empty state. Users can:

- Refresh to load a new feed
- Adjust filters to broaden the results

---

## Edge Function Architecture

The Edge Functions live in `infra/supabase/functions/`:

- `get-feed` — Returns ranked dish list based on location + filters + user history
- `track-swipe` — Records a swipe event

See `docs/EDGE_FUNCTIONS_ARCHITECTURE.md` for the full backend design.

---

## Dish Card UI

Each dish card shows:

- Dish name and description
- Price
- Restaurant name
- Dietary tags and allergens (from the DB row)
- Distance from user (computed server-side as `distance_km`)
- `score` from the recommendation engine (not shown to user, used for ordering)

---

## Known Gaps

- No actual swipe gesture animation is implemented in the current demo screen — swipe is triggered by tapping buttons. A real swipe gesture (using `react-native-gesture-handler` and `react-native-reanimated`) needs to be built.
- No "undo last swipe" capability.
- No image display on dish cards (placeholder only).
