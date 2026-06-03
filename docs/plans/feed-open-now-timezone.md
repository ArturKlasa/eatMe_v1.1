# Feed open-now timezone fix

**Status:** Implemented (2026-06-03). Migration 149 applied to prod by the user. Feed + import
(lat/lng-precise `tz-lookup`) done and type-clean. **Pending: `supabase functions deploy feed`**
(activates the fix) + the next `apps/admin` deploy (carries `places.ts`).
**Owner:** solo (commit straight to `main`)

## Problem

The mobile **map shows no dishes in the evening**. Dishes are hard-filtered to restaurants
"open now" (`feed/index.ts:879`, `dishPool = diversified.filter(isOpenNow)`), but `isOpenNow`
(`:604-621`) reads the clock with bare `new Date()` — which on a Supabase Edge Function is **UTC**,
while `open_hours` are stored in the restaurant's **local** time (CDMX = UTC−6).

Evidence: at the time of diagnosis it was `02:45 UTC` / `20:45 CDMX`. `isOpenNow` looked up the wrong
day (Wednesday vs Tuesday) and wrong time (02:45 vs 20:45) → every restaurant read as **closed** →
`dishPool` emptied → zero dish pins. (Restaurant pins survive — they're built from the unfiltered
`diversified` pool at `:928` — which matches the symptom: restaurants but no dishes.) The check only
"works" while UTC overlaps local hours (~CDMX 03:00–16:00) and breaks every evening.

Unrelated to the cuisine work or the recent import (imported rows are `status:'draft'`, never in the feed).

## Solution — store each restaurant's IANA timezone; evaluate open-now in *that* zone

Open/closed is a property of the **restaurant's** location, not the viewer's. So we store the
restaurant's IANA timezone and compute "now" in it via `Intl.DateTimeFormat`. Layered population:

- **Existing rows:** backfilled in the migration from `country_code` (SQL CASE map) — *exact* for
  single-timezone countries and for all current data (CDMX → `America/Mexico_City`).
- **New imports:** `places.ts` derives the **lat/lng-precise** IANA zone (`tz-lookup`) — correct even
  in multi-zone countries (US, MX border, BR, AU…).
- **Runtime fallback:** the feed resolves `timezone ?? countryToTz(country_code)`, so a row that
  somehow lacks a stored zone still evaluates correctly.

This is the "best long-term" option: correct regardless of where the user is, multi-timezone-country
safe, and DST-proof (IANA zones + `Intl` apply DST automatically — a stored raw offset would rot).

## Changes (server + DB only — no mobile rebuild)

1. **Migration `149_restaurants_timezone.sql`** (+ `149_REVERSE_ONLY_…`): add `timezone text` (nullable),
   backfill from `country_code` via a SQL CASE → IANA map (mirrors migration 147's country list), COMMENT.
2. **`apps/admin/src/lib/timezone.ts`** — `deriveTimezone(lat, lng): string | null` via `tz-lookup`
   (try/catch → null). Add `tz-lookup` to `apps/admin` deps (+ ambient type decl).
3. **`apps/admin/.../imports/actions/places.ts`** — add `timezone: deriveTimezone(lat, lng)` to the
   restaurant insert payload (right beside `location`/`open_hours`).
4. **`infra/supabase/functions/feed/index.ts`**:
   - `isOpenNow(openHours, tz)` computes weekday + minutes in `tz` via `Intl.DateTimeFormat`.
   - Inline `COUNTRY_TO_TZ` map (mirrors the migration; like currency is inlined).
   - The open-hours fetch also selects `timezone, country_code`; resolve `tz = timezone ?? COUNTRY_TO_TZ[country_code]`.
   - **Preserve** existing semantics: empty/absent `open_hours` → closed (intentional, per `places.ts`
     comment). New: `open_hours` present but **no resolvable tz** → treat as open (don't hide on
     missing-zone data instead of the old UTC mis-evaluation).

## Decisions
- **No-hours → hidden**: unchanged (documented-intentional in `places.ts`).
- **Has-hours, no tz**: show (safer than guessing). Rare after the migration backfill + country fallback.
- **Multi-zone existing rows**: none today (all CDMX); the migration's country map is already exact.
  A lat/lng-precise backfill (`infra/scripts`) is the documented step *if* multi-zone data is bulk-imported.

## Verification
- `deno test --node-modules-dir=none -A …/feed/test.ts` if present; otherwise `deno check`.
- Trace with current clock: CDMX restaurant open 09:00–22:00 → at 20:45 local → `isOpenNow` true → dishes appear.
- `apps/admin` type-check passes (tz-lookup typed).
- Apply migration → confirm `select count(*) where timezone is null` ≈ 0 for rows with a country_code.

## Deploy order (user)
apply migration → `supabase functions deploy feed` → next `apps/admin` deploy carries `places.ts`.
