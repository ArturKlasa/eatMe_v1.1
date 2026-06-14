# Plan — Restaurant-detail cleanups (§M7)

**Date:** 2026-06-14
**Source:** `docs/findings/mobile-performance-audit.md` Part C (M7)
**Scope:** Frontend only (`apps/mobile`). **No DB/edge change, no new dependency, no deploy.**
**Status:** Plan — awaiting go-ahead. Not implemented.

A grab-bag of small, surgical fixes. Almost everything here is type-only / dead-code / config —
**one** item (`toggleFavorite`) is a behaviour change, flagged below. Chosen deliberately as a
low-risk batch that doesn't add to the unverified-on-device surface.

---

## Items

### A. `dish_photos.select('*')` → explicit columns + clear the type error — `useRestaurantDetail.ts`
The hot dish-tap path (`handleDishPress`) selects `*` and maps the rows without coalescing
`user_id`, which is `string | null` in the generated types but `string` in the local `dishPhotos`
type → the **type error that's trailed every commit this session**. Fix: select the five columns the
type needs and map them explicitly (coalescing `user_id` like `created_at` already is):
```ts
.select('id, photo_url, user_id, created_at, dish_id')
// map → { id, photo_url, user_id: row.user_id ?? '', created_at: row.created_at ?? '', dish_id }
```
Clears the over-fetch **and** the `useRestaurantDetail(…)` tsc error in one go.

### B. `getDishPhotos` returns nullable `user_id` → coalesce — `dishPhotoService.ts`
Same root cause, second tsc error (`dishPhotoService:127`): `return data || []` assigns rows with
`user_id: string | null` to `DishPhoto[]` (whose `user_id` is `string`). Fix: `return (data ?? []).map(r => ({ ...r, user_id: r.user_id ?? '' }))`.

> After A + B, tsc drops from **5 → 3** errors. The remaining 3 (`gamificationService`, a `string`
> vs `string[]` drift) are an unrelated root cause in a file we don't touch — out of scope here,
> offered as a separate follow-up.

### C. `toggleFavorite` read-then-write → delete-first — `favoritesService.ts` *(the one behaviour change)*
Today every toggle is **2 round-trips**: `isFavorited` (select) then `delete` or `insert`. Rewrite to
delete-first: `delete(...).select('id')` — if it returned a row it was favourited → now removed (**1
round-trip**); if it returned nothing → `addToFavorites` (2 round-trips, unchanged). Semantics
preserved (returns the new boolean; still records the `'saved'` interaction on add; still treats a
`23505` race as success). No signature change → callers untouched.

### D. Lower the detail-load timeout 12s → 6s — `useRestaurantDetail.ts`
The `Promise.race` fallback waits **12s** before surfacing "not found" on a stalled query. Drop to
6s so a hung request fails fast.

### E. Delete dead `useDish` hook — `hooks/useDish.ts` + `hooks/index.ts`
`useDish` is referenced only by its own barrel export (verified: no consumer anywhere). It also does a
`select('*')`. Remove the file and its `export { useDish }` line.

### F. Remove the unused `basePrice` prop — `ModifierGroupsList.tsx` + `FoodTab.tsx`
`ModifierGroupsList` already destructures it as `_basePrice` (dead). Remove it from the `Props`
interface + the destructure, and drop `basePrice={dish.price ?? 0}` from the two FoodTab call sites
(featured block + category rows).

## Deferred / skipped (called out, not done)

- **`handleFavoriteToggle`** (dead hook method) — removing it cascades into `favoriteLoading` /
  `setFavoriteLoading`, which `HoursMoreTab` still reads (the favourite button's spinner state, already
  effectively always-false). Untangling that is more churn than the LOW value warrants. **Deferred.**
- **`ModifierGroupsList.describeSelection` hardcoded English** — a translation task, not perf. **Skipped**
  (belongs in an i18n pass).
- **`get_group_candidates` UTC open-now bug, `nearby-restaurants` decommission** — those are §S7/§S8
  (backend), not §M7.
- **The `loadCategoryDishes` user?.id dep churn** the audit flagged is **already moot** — M1 moved the
  auto-load onto `fetchAllRestaurantDishes`; `loadCategoryDishes` now only runs on a manual header tap.

## Files

| File | Items |
|------|-------|
| `useRestaurantDetail.ts` | A (photo query), D (timeout) |
| `dishPhotoService.ts` | B (getDishPhotos coalesce) |
| `favoritesService.ts` | C (toggleFavorite delete-first) |
| `hooks/useDish.ts` (delete) + `hooks/index.ts` | E |
| `ModifierGroupsList.tsx` + `FoodTab.tsx` | F (basePrice) |

## Risk

- **C is the only behaviour change** — verify by favouriting + un-favouriting a dish *and* a restaurant
  (heart fills/empties, persists on reopen). Everything else is type-only / dead-code / a constant.
- E deletes a whole file — safe (no importers; grep-verified), but it's the one "destructive" action; the
  plan surfaces it for your sign-off.

## Verification

- `tsc` → expect **3** remaining errors (gamification), down from 5; the two dish-photo errors gone.
- `eslint` clean for touched files.
- **On device (light):** dish photos still open/scroll; favouriting a dish + a restaurant works and
  persists; a normal restaurant still loads (timeout change is invisible unless a query hangs).

## Commit

One docs commit + one code commit to `main`, **only on your "commit"**. Frontend-only — no deploy.
