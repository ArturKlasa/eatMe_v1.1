# Hygiene batch — redis pin (§S8) + gamification tsc errors

**Source:** `docs/findings/mobile-performance-audit.md` §S8 + 3 pre-existing tsc errors.

## §S7 (delete `nearby-restaurants`) — NOT DONE, audit premise was wrong

The audit claimed "the geoService nearby path is dead → confirm zero traffic and delete." **It is
not dead.** Verified 2026-06-14:
- `apps/mobile/src/services/geoService.ts:107` — live `supabase.functions.invoke('nearby-restaurants')`.
- `restaurantStore.loadNearbyRestaurantsFromCurrentLocation` calls it; **`BasicMapScreen.tsx:468`
  still calls that store method.**
- `nearbyRestaurants` state is still read in `BasicMapScreen` at `:488 / :507 / :595` to gate the
  **loading screen, error screen, and refresh indicator** (`isLoading && nearbyRestaurants.length …`).

§R2 (this session) removed only the dead `restaurants`/`dishes` pin memos that mapped over
`nearbyRestaurants`; the data layer itself still drives map loading/error UX. Deleting the function
would break the map. Removing the dual data layer (migrate loading/error gating to feed state) is a
real refactor, not hygiene — deferred.

## Done in this batch

### 1. §S8 — pin `@upstash/redis` (`feed/index.ts:14`)

`import { Redis } from 'https://esm.sh/@upstash/redis@latest'` → non-deterministic cold-start
dependency. Pin to **1.38.0** — the exact version currently resolved (per `deno.lock`), so **zero
functional change**, just deterministic. Requires a feed redeploy.

### 2. Three `gamificationService.ts` tsc errors (no runtime change, no deploy)

- `:113`, `:127` — `.neq('tags', '{}')`: `tags` is `text[]`, so the generated filter type expects
  `string[]`; `'{}'` is the Postgres empty-array literal (string). Cast `'{}' as unknown as string[]`
  to keep the exact runtime filter while satisfying the type.
- `:132` — `new Date(earliestRating.created_at)`: `created_at` is `string | null`. Guard with
  `!earliestRating?.created_at || …` — null now → not eligible (`earned: false`), the safe outcome,
  and TS narrows `created_at` to `string`.

## Verification

- `npx tsc --noEmit` in `apps/mobile` → expect **0 errors** (was 3).
- `npx eslint` the changed gamification file → no new warnings.
- `deno check` the feed function → still passes (version pin doesn't change the API surface).

## Deploy (USER)

- Feed redeploy for the redis pin: `supabase functions deploy feed` (from `infra/supabase/`).
- Gamification fix ships in the next mobile build — no deploy.

## Deferred (not in this batch)

- §S7 dual data-layer removal (above) — real refactor.
- §S8 dead `primaryProtein` feed scoring (wire-or-remove — behavior-adjacent, deserves its own look).
- §S8 Stage-1 payload trim (`view_count`) — would mean re-touching `generate_candidates`; low value.
- §S5 double cosine-distance; §R7/§R8 — low value.
