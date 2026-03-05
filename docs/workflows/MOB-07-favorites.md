# MOB-07 — Favorites

## Overview

Users can save restaurants and dishes to their favourites list. Favourites are persisted to Supabase and associated with the logged-in user. The `FavoritesScreen` is currently a **placeholder** — it shows a "coming soon" UI and does not yet display the actual saved favourites.

---

## Key Files

| File                                           | Role                                                  |
| ---------------------------------------------- | ----------------------------------------------------- |
| `apps/mobile/src/screens/FavoritesScreen.tsx`  | Placeholder screen (swipe-to-close, coming soon list) |
| `apps/mobile/src/services/favoritesService.ts` | All Supabase operations: add, remove, check, list     |

---

## Database Schema

Favourites are stored in the `favorites` table:

```
favorites
  id          UUID (PK)
  user_id     UUID FK → auth.users
  subject_type  'restaurant' | 'dish'
  subject_id  UUID FK → restaurants.id or dishes.id
  created_at  TIMESTAMP
```

RLS ensures users can only read/write their own favourites.

---

## Service API

```typescript
// Add to favourites
addToFavorites(userId, 'restaurant' | 'dish', subjectId)
  → INSERT INTO favorites
  → Returns { data: Favorite | null, error: Error | null }
  → Handles duplicate (error code 23505) gracefully

// Remove from favourites
removeFromFavorites(userId, 'restaurant' | 'dish', subjectId)
  → DELETE FROM favorites WHERE user_id AND subject_type AND subject_id

// Check if favourited
isFavorited(userId, 'restaurant' | 'dish', subjectId)
  → SELECT COUNT(*) → returns boolean

// List all favourites (for FavoritesScreen — not yet wired to UI)
getUserFavorites(userId, 'restaurant' | 'dish')
  → SELECT * FROM favorites WHERE user_id AND subject_type
```

---

## Where Favouriting is Triggered

| Location                                        | What is favourited |
| ----------------------------------------------- | ------------------ |
| `RestaurantDetailScreen` — heart icon in header | Restaurant         |
| (Planned) Swipe screen — super-swipe            | Dish               |
| (Planned) Dish card in restaurant detail        | Dish               |

In `RestaurantDetailScreen`, the favorites state is initialised by calling `isFavorited()` on mount. The heart icon reflects this state and calls `toggleFavorite()` on tap.

---

## FavoritesScreen — Current State

The `FavoritesScreen` shows:

- A swipe-down-to-close gesture handler (same pattern as FiltersScreen)
- A "Coming soon" message with a list of planned features:
  - Saved restaurants
  - Liked dishes
  - Visit history
  - Personalised recommendations based on favourites
  - Export favourites list

The screen **does not yet** query the `favorites` table or display any real data.

---

## Known Gaps

- `FavoritesScreen` is a placeholder — the actual favourites list UI needs to be built.
- `getUserFavorites()` exists in the service but is not called anywhere.
- No offline caching of favourite IDs — every detail screen open requires a DB round-trip to check favourite status.
- No ability to bulk-remove favourites.
