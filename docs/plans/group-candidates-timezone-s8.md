# §S8 — Fix `get_group_candidates` UTC open-now bug (timezone-correct)

**Source:** `docs/findings/mobile-performance-audit.md` §S8
**Goal:** `get_group_candidates` (eatTogether group recommendations) filters restaurants with
`is_restaurant_open_now(r.open_hours)`, which evaluates "now" in the **DB's UTC clock** instead of
each restaurant's local timezone — the exact bug the feed already fixed in JS. Make the open-now
evaluation timezone-correct.

## The bug (verified 2026-06-14)

`is_restaurant_open_now` (defined once, migration 088 — never redefined):
```sql
day_key := lower(to_char(p_now, 'FMday'));  -- p_now is timestamptz → rendered in session tz (UTC on Supabase)
cur_t   := p_now::time;                       -- UTC time-of-day
```
`open_hours` are stored in each restaurant's **local** time, but the comparison uses **UTC**
wall-clock. For a CDMX (UTC−6) restaurant open 09:00–22:00:
- 20:00 local = 02:00 UTC *next day* → `day_key` rolls to the next weekday, `cur_t = 02:00` →
  reads **closed** every evening.
- This empties evening group searches → triggers the edge function's 2× radius retry
  (`group-recommendations/index.ts:319-341`) → still mis-evaluated → often empty recommendations.

`get_group_candidates:463` (migration 163, live) calls it with **no timezone**:
```sql
AND public.is_restaurant_open_now(r.open_hours)
```

## Current state

- Live `get_group_candidates`: migration **163** (`CREATE OR REPLACE`, lines 414-534). Joins
  `restaurants r`; `r.timezone` and `r.country_code` are already in scope.
- Live `is_restaurant_open_now`: migration **088**, signature `(jsonb, timestamptz)`. **Sole caller
  is `get_group_candidates`** (grep-confirmed across `functions/`, `apps/`, `packages/` — the only
  other hit is the generated RPC type in `packages/database/src/types.ts`, not a runtime call).
- `restaurants.timezone` is nullable but **backfilled from `country_code`** by migration 149's CASE,
  and new imports set it lat/lng-precise.

## Approach — fix in SQL (chosen)

Make `is_restaurant_open_now` evaluate "now" in the restaurant's local zone, and pass `r.timezone`
from `get_group_candidates`. **No edge-function change, no RPC return-shape change** — only a DB
migration. Lowest-risk, surgical, and strictly an improvement (restaurants with a timezone — i.e.
essentially all of them — become correct; the rare null-tz row falls back to UTC = today's
behavior, never worse).

> **Why not also pass `country_code`?** The feed's JS resolves `timezone ?? COUNTRY_TO_TZ[country] ??
> null`. But migration 149 *already applied that exact country→tz CASE to populate the `timezone`
> column*, so reading `timezone` gives the same result with **zero** extra coverage from re-checking
> `country_code` — and avoids copying the 25-row map a third time (the audit flags that lockstep
> smell). So the helper takes `timezone` only.

> **Alternative (not chosen): move open-now to JS** in `group-recommendations` to mirror the feed's
> architecture. Rejected — it changes the RPC return shape, touches the edge function + 2× retry
> path, and *duplicates* the feed's `isOpenNow`/`COUNTRY_TO_TZ` helpers into a second edge function
> (no shared module). More surface, more drift, for no correctness gain over the SQL fix.

## Changes

### `infra/supabase/migrations/168_group_candidates_timezone.sql` (new)

**(1) tz-aware `is_restaurant_open_now`** — DROP old `(jsonb, timestamptz)` + CREATE new
`(jsonb, text, timestamptz)`:
```sql
DROP FUNCTION IF EXISTS public.is_restaurant_open_now(jsonb, timestamptz);

CREATE FUNCTION public.is_restaurant_open_now(
  p_open_hours jsonb,
  p_timezone   text        DEFAULT NULL,
  p_now        timestamptz DEFAULT now()
) RETURNS boolean
LANGUAGE plpgsql STABLE AS $$
DECLARE v_local timestamp; day_key text; entry jsonb; open_t time; close_t time; cur_t time;
BEGIN
  IF p_open_hours IS NULL THEN RETURN false; END IF;

  -- Evaluate "now" in the restaurant's LOCAL zone (open_hours are stored local).
  -- timezone is backfilled from country_code (migration 149); fall back to UTC when
  -- unknown (legacy behaviour, never worse). Guard a malformed zone string.
  BEGIN
    v_local := p_now AT TIME ZONE COALESCE(NULLIF(p_timezone, ''), 'UTC');
  EXCEPTION WHEN others THEN
    v_local := p_now AT TIME ZONE 'UTC';
  END;

  day_key := lower(to_char(v_local, 'FMday'));
  entry   := p_open_hours -> day_key;
  IF entry IS NULL THEN RETURN false; END IF;

  BEGIN
    open_t  := (entry ->> 'open')::time;
    close_t := (entry ->> 'close')::time;
  EXCEPTION WHEN others THEN RETURN false; END;

  cur_t := v_local::time;
  IF close_t < open_t THEN RETURN cur_t >= open_t OR cur_t < close_t; END IF;  -- overnight
  RETURN cur_t >= open_t AND cur_t < close_t;
END; $$;

GRANT EXECUTE ON FUNCTION public.is_restaurant_open_now(jsonb, text, timestamptz)
  TO anon, authenticated, service_role;
```
Notes: marked **STABLE** (was IMMUTABLE — `AT TIME ZONE` is stable, and the old function was
already session-tz-dependent so the IMMUTABLE label was incorrect). Overnight + bad-entry handling
preserved verbatim from 088.

**(2) `get_group_candidates`** — `CREATE OR REPLACE`, body **verbatim from migration 163** with one
changed line:
```sql
-    AND public.is_restaurant_open_now(r.open_hours)
+    AND public.is_restaurant_open_now(r.open_hours, r.timezone)
```

### `infra/supabase/migrations/168_REVERSE_ONLY_group_candidates_timezone.sql` (new)

Restores migration 088's `is_restaurant_open_now(jsonb, timestamptz)` (DROP new + CREATE old +
GRANT) and `CREATE OR REPLACE get_group_candidates` verbatim from 163 (the 1-arg call site).

## Verification

- Diff forward `get_group_candidates` body vs 163 → expect **exactly 1 changed line** (the call site).
- Diff reverse `get_group_candidates` body vs 163 → expect **zero**.
- Read-review the new `is_restaurant_open_now` against 088 (no local psql; REST-only).
- No `deno check` needed — `group-recommendations` is untouched.

## Deploy (USER)

Migration only — **no edge-function deploy**.
1. Apply `168_group_candidates_timezone.sql` to prod.
2. Smoke-test (ideally evening, local): run an eatTogether group recommendation in a CDMX area and
   confirm currently-open restaurants now appear.

Rollback: run `168_REVERSE_ONLY`.

> Stale generated types: `packages/database/src/types.ts` still lists the old
> `is_restaurant_open_now(jsonb, timestamptz)` signature. Cosmetic only (nothing calls it via
> `.rpc`); refreshed on the next `supabase gen types`.

## Out of scope

- The other §S8 notes (dead `primaryProtein` scoring, `@upstash/redis` pin, payload bloat) — separate.
