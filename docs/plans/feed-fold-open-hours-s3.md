# §S3 — Fold open-hours into `generate_candidates` (drop the serial second query)

**Source:** `docs/findings/mobile-performance-audit.md` §S3
**Goal:** Remove the second, serial DB round-trip the `feed` edge function makes to fetch
`open_hours / timezone / country_code` after `generate_candidates` returns. The data already
lives on the `restaurants` row the RPC joins — return it from the RPC and build the open-now map
in memory.

## Current state (verified 2026-06-14)

- Live `generate_candidates` definition: **migration 163** (`163_phase7_coordinated_drop.sql`,
  lines 76–407). DROP+CREATE form, 13 args, 28-column `RETURNS TABLE`.
- The RPC already `JOIN restaurants r ON r.id = d.restaurant_id` (line 268) and projects
  `r.name / r.cuisine_types / r.rating / r.location / r.currency_code`. Adding three more
  `r.*` columns is a trivial extension of an existing join.
- Consumer: `feed/index.ts:885–906` runs a **second query** after `applyDiversity`:
  ```ts
  const { data: hourRows } = await supabase
    .from('restaurants')
    .select('id, open_hours, timezone, country_code')
    .eq('status', 'published')
    .in('id', allRids);
  ```
  → builds `openInfoMap` (keyed by restaurant_id), consumed in exactly two places:
  - `:913–916` dish open-now filter (`isOpenNow`)
  - `:971` restaurant `is_open` flag
- Column types (from `database_schema.sql`): `open_hours jsonb`, `timezone text`, `country_code text`.
- **Only runtime caller of the RPC is `feed/index.ts`.** No SQL function calls it internally
  (grep clean). Adding columns to `RETURNS TABLE` cannot break any other consumer.
- Next free migration number: **167** (164–166 are embed-recovery, untouched here).

## Changes

### 1. `infra/supabase/migrations/167_generate_candidates_open_hours.sql` (new)

DROP + CREATE `generate_candidates` (return-type change → can't `CREATE OR REPLACE`). Body is
**verbatim from migration 163** with exactly two edits:

- `RETURNS TABLE (…)` — append three columns after `modifier_groups`:
  ```sql
  modifier_groups             JSONB,
  open_hours                  JSONB,
  timezone                    TEXT,
  country_code                TEXT
  ```
- `SELECT …` projection — append after `dm.modifier_groups` (line 265):
  ```sql
  dm.modifier_groups,
  r.open_hours,
  r.timezone,
  r.country_code
  ```

Everything else (args, WHERE, ORDER BY, `dish_modifiers` CTE, GRANT) is copied unchanged. The
`DROP FUNCTION IF EXISTS generate_candidates(FLOAT, FLOAT, FLOAT, vector, UUID[], TEXT, TEXT[],
BOOLEAN, INT, TIME, TEXT, TEXT, BOOLEAN)` line is identical to 163's (arg signature is unchanged).

### 2. `infra/supabase/migrations/167_REVERSE_ONLY_generate_candidates_open_hours.sql` (new)

Restores the 163 version (DROP + CREATE the 28-column form) so the migration is reversible.

### 3. `infra/supabase/functions/feed/index.ts` (edit)

- **`Candidate` interface** (~:203) — add:
  ```ts
  open_hours?: Record<string, { open: string; close: string }> | null;
  timezone?: string | null;
  country_code?: string | null;
  ```
- **Replace the second query** (`:885–906`) — build `openInfoMap` from the candidate rows that
  are already in memory (`diversified`), no network call:
  ```ts
  const openInfoMap = new Map<string, { openHours: …; tz: string | null }>();
  for (const d of diversified) {
    if (openInfoMap.has(d.restaurant_id)) continue;
    openInfoMap.set(d.restaurant_id, {
      openHours: d.open_hours ?? null,
      tz: resolveTimezone(d.timezone, d.country_code),
    });
  }
  ```
  `resolveTimezone` / `isOpenNow` and both consumer sites (`:913`, `:971`) are unchanged.

Net effect: **one fewer serial round-trip per feed request** (the heaviest was 3 serial awaits;
4 logged-in). Also removes a latent failure mode — the old query was wrapped in a non-fatal
try/catch, so if it ever errored the map was empty and *every* dish read as closed → empty feed.
In-memory build can't fail that way.

## Verification

- `deno check` the feed function (deno at `~/.deno`):
  `~/.deno/bin/deno check infra/supabase/functions/feed/index.ts`
- Migration SQL is verify-by-read (no local psql; REST-only). Diff the new file against 163's
  function body to confirm the only deltas are the 6 added lines.

## Deploy (USER — order matters)

> **Critical ordering:** apply the migration **before** deploying the function. The new function
> reads `open_hours` from candidate rows; if the RPC hasn't been updated yet those are `undefined`
> → every restaurant reads as closed → empty feed until the migration lands. Migration-first is
> safe (the old live function ignores the extra RPC columns).

1. Apply migration `167_generate_candidates_open_hours.sql` to prod.
2. Deploy the feed function: `supabase functions deploy feed` (from `infra/supabase/`).
3. Smoke-test: open the app, confirm the map feed still returns dishes and open/closed is correct.

Rollback: deploy the prior function build, then run `167_REVERSE_ONLY`.

## Out of scope (noted, not done)

- §S5 double cosine-distance cleanup (could fold into this RPC edit later; left alone to keep the
  diff a pure verbatim-plus-6-lines copy).
- `view_count` payload bloat (§S8).
