# Plan — Instant restaurant reopen + cached dish photos (§M5 + §M6)

**Date:** 2026-06-13
**Source:** `docs/findings/mobile-performance-audit.md` Part C (M5, M6)
**Scope:** Frontend only (`apps/mobile`). **No DB/edge change, no new dependency** (`expo-image` already installed).
**Status:** Plan — awaiting go-ahead. Not implemented.
**Builds on:** the M1/M3/M4 + M2 batches (the bulk dish load + the FoodTab FlatList).

---

## Why

- **M5 — reopening a restaurant isn't instant.** `fetchRestaurantDetail` / `fetchAllRestaurantDishes`
  cache the menu *text* (5-min TTL), so it shows instantly on reopen. But the **restaurant rating,
  dish rating badges, "You loved it", and favourite hearts** are re-fetched every open and *flash in*
  a network round-trip later. There's also no way to force a refresh without leaving the screen.
- **M6 — dish photos re-download every time.** `DishPhotoModal` uses RN's `<Image>` (no cache):
  reopening a dish re-downloads every photo, and the 60×60 thumbnails each download the **full-res**
  image.

## M5 — stale-while-revalidate aux cache + pull-to-refresh

### A. Aux cache (`restaurantStore.ts`)

A non-reactive `Map<restaurantId, AuxEntry>` (read via `getState`, written via a plain method — **not**
subscribed, so no re-render churn), 5-min TTL:

```ts
type AuxEntry = {
  userId: string | null;            // guards against showing a prior user's favourites
  restaurantRating: RestaurantRating | null;
  dishRatings: Map<string, DishRating>;
  userDishOpinions: Map<string, DishOpinion>;
  favoriteDishIds: Set<string>;
  isFavorite: boolean;
  fetchedAt: number;
};
```

Methods: `getRestaurantAux(id)`, `setRestaurantAux(id, entry)`, and `clearRestaurantCaches(id)`
(clears detail + dishes + aux for that restaurant — used by pull-to-refresh).

### B. Hook wiring (`useRestaurantDetail.ts`) — **stale-while-revalidate**

1. **Seed effect** (declared *before* the fetch effects, so its body runs first): on mount, read the
   aux cache; if the entry is fresh **and** `userId` matches → seed `restaurantRating`, `dishRatings`,
   `userDishOpinions`, `favoriteDishIds`, `isFavorite`, and set `favoritesInitialized`. The badges/hearts
   now render **instantly** from cache.
2. **Existing fetches stay** (metadata: rating + favourites; bulk: dish ratings + opinions). They
   **revalidate** — the cached value is already on screen, the fetch refreshes it (almost always to the
   same value → no visible flash). This is the key choice: *always revalidate*, never skip — it removes
   the flash with **zero staleness risk** and no empty-cache edge cases.
3. **Write-back effect** (declared last): once `favoritesInitialized`, mirror the five slices into the
   aux cache on every change → the cache is always a coherent, latest snapshot (covers in-session rating
   / favourite toggles too).

### C. Pull-to-refresh

`refresh()` = `clearRestaurantCaches(id)` → `setRefreshing(true)` → `setLoadAttempt(n+1)` (re-runs the
effects, which now miss the cache → full refetch). It does **not** set the screen-level `loading`
(that would blank the screen) — it shows a `RefreshControl` spinner instead; `refreshing` clears when
the metadata reload completes. Threaded hook → `RestaurantDetailScreen` → `FoodTab` → the `FlatList`'s
`refreshControl`. (`FoodTab` became a `FlatList` in M2, so this slots in cleanly — but note there's **no
existing `RefreshControl` precedent** in the app.)

### M5 scope decisions

- **SWR, not skip-fetch** — eliminates the flash without the "cached empty snapshot → no badges" failure
  mode a skip-fetch design risks.
- **Favourites/opinions** are user-mutable but only mutate *via this screen*; the write-back keeps the
  cache coherent, and the 5-min TTL bounds any cross-screen staleness.
- **Photo-row query not separately cached** — M6 removes the felt cost (the re-download); the small
  `dish_photos` row fetch isn't worth a cache + its add-invalidation tangle.

## M6 — `expo-image` with `memory-disk` cache (`DishPhotoModal.tsx`)

- Swap both `Image` (from `react-native`) → `Image` from `expo-image` (already a dependency, used in 6
  other screens).
  - Main photo: `contentFit="cover"` (was `resizeMode="cover"`), `cachePolicy="memory-disk"`, a short
    `transition` for a fade-in.
  - Thumbnails: `cachePolicy="memory-disk"` (default `contentFit` is cover).
- **Not** adding server-resized thumbnail URLs — Supabase image transformation is a Pro add-on and isn't
  confirmed enabled here; assuming it risks broken URLs. Noted as a follow-up. The memory-disk cache is
  the primary win (no re-download on reopen or thumbnail scroll).

## Risks

- `RefreshControl` has no precedent — RN core, low risk; verify the spinner shows and doesn't fight the
  FlatList scroll.
- Aux-cache user-keying — seed only when cached `userId` === current, so a sign-out/in never shows the
  prior user's hearts.
- `expo-image` mapping — `resizeMode="cover"` → `contentFit="cover"`; verify no thumbnail/main-photo
  layout shift vs RN `<Image>`.

## Verification

- `tsc` + `eslint` clean for touched files.
- **On device:** (1) open a restaurant, leave, reopen within 5 min → rating badge, dish badges, hearts
  appear **instantly**, no flash. (2) Pull down on the menu → spinner shows, data refreshes. (3) Open a
  dish's photos, close, reopen → photos appear instantly (cached, no re-download); thumbnails load fast.

## Commit

One docs commit + one code commit to `main`, **only on your "commit"**. Frontend-only — no deploy.
