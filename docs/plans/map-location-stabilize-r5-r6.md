# Plan — Stabilize `useUserLocation` + dedupe the feed effect (§R5 + §R6)

**Date:** 2026-06-13
**Source:** `docs/findings/mobile-performance-audit.md` Part B (R5, R6)
**Scope:** Frontend only (`apps/mobile`). **No DB/edge change, no new dependency.**
**Status:** Plan — awaiting go-ahead. Not implemented.
**Builds on:** the R1–R4 map batch (the `MapControls` `React.memo` is already shipped but currently inert — this activates it).

---

## Why

- **R6 — `useUserLocation` returns unstable identities.** Its four functions (`requestPermission`,
  `getCurrentLocation`, `getLocationWithPermission`, `clearLocation`) are recreated every render, and the
  hook returns a fresh `{...state, ...fns}` object each time. Three `BasicMapScreen` effects work around
  this by **omitting the functions from their deps** (with comments admitting the workaround), and
  `handleMyLocationPress` can't be stabilized — so the `MapControls` `React.memo` we already shipped is
  **inert** (`onLocationPress` identity churns every render). `getCurrentLocation` also reads its cache
  from a **stale closure** (`state.cachedLocation`).
- **R5 — the feed effect over-fires on object-identity churn.** Its deps are
  `[userLocation, daily, permanent]`, all of which change by *identity*: `getCurrentLocation` returns a
  new `userLocation` object even for near-identical coords, and the filter store spreads new
  `daily`/`permanent` on every interaction (14+ `set(state => ({...}))` sites). Net: more `/feed` calls
  than semantically needed. **Latent bug:** the body reads `user?.id` but it isn't a dep, so signing in
  while on the map never refetches a personalized feed.

## Scope

- `apps/mobile/src/hooks/useUserLocation.ts` — R6 core.
- `apps/mobile/src/screens/BasicMapScreen.tsx` — R6 consumer cleanups + `handleMyLocationPress`, and R5 feed effect.
- No other file. The 3 eatTogether screens that use the hook get the stability for free (API unchanged).

## R6 — `useUserLocation.ts`

- Move the location cache into a **`useRef`** (`{ location, lastUpdated }`): `getCurrentLocation` reads
  the ref (no stale closure) and writes ref + state together on a fresh fetch; `clearLocation` clears both.
- **`useCallback`** all four functions with stable deps (`requestPermission`/`getCurrentLocation`/
  `clearLocation` → `[]`; `getLocationWithPermission` → `[requestPermission, getCurrentLocation]`, both now
  stable). Result: stable identities across renders.
- Keep the `{...state, ...fns}` return shape — consumers destructure, so object identity no longer matters
  once the functions are stable (no need to `useMemo` the return).

## R6 — `BasicMapScreen.tsx`

- **`useCallback` `handleMyLocationPress`** (deps: `getLocationWithPermission` [now stable],
  `locationLoading`, `locationError`, `t`). This stabilizes `onLocationPress` → **activates the
  `MapControls` memo** (`onMenuPress`/`handleMenuPress` was already `useCallback`'d in R4b).
- Mount effect + auto-center effect: add the now-stable `getLocationWithPermission` to their deps and drop
  the "don't depend on the function" workaround comments.

## R5 — `BasicMapScreen.tsx` feed effect

- Replace deps `[userLocation, daily, permanent]` with a **primitive signature**: rounded lat/lng
  (`toFixed(3)` ≈ 110 m, matching the feed cache's geohash granularity), `JSON.stringify(daily)`,
  `JSON.stringify(permanent)`, and `user?.id`.
- Effect **body unchanged** — it reads `userLocation`/`daily`/`permanent` from the render closure, which is
  consistent with the signature (same signature ⇒ same content ⇒ the closed-over values are equivalent).
- A documented `// eslint-disable-next-line react-hooks/exhaustive-deps` on the dep array: the primitives
  *are* the semantic identity; including the objects is exactly what defeats the dedup.
- Adding `user?.id` to the key **fixes the latent sign-in-doesn't-repersonalize bug**.

## Decisions / scope cuts

- **Not** lifting location into a Zustand store (the audit's "consider") — the `useCallback` + ref fix fully
  stabilizes the hook and activates the memo; a store migration is bigger and riskier. Deferred.
- **Not** memoizing the hook's return object — unnecessary once the functions are stable (consumers
  destructure).

## Risks

- Cache-via-ref: keep the ref and `state` in sync (write both on fresh fetch, clear both in `clearLocation`)
  so cached-location behavior is unchanged.
- The `eslint-disable` on the feed effect is intentional — verify no *other* genuinely-needed dep is
  silently dropped (only `userLocation`/`daily`/`permanent` are represented by the signature; `user?.id`
  and `getCombinedFeed` are covered).
- The 3 eatTogether consumers: API is unchanged, but they now receive stable functions — verify nothing
  relied on the previous per-render identity (unlikely; they call the fns, not compare them).

## Verification

- `tsc` + `eslint` clean for the two touched files.
- **On device:** (1) the feed loads on mount; a no-op filter drag / re-selecting the same filter does **not**
  refetch, while moving >~110 m or changing a filter value **does**; signing in refetches a personalized feed.
  (2) The my-location + menu FABs no longer re-render on unrelated state (feed loading, footer-height
  measure, menu toggle) — the `MapControls` memo now bites. (3) Auto-center on launch and the my-location
  button still work.

## Commit

One docs commit + one code commit to `main`, **only on your "commit"**. Frontend-only — no deploy.
