# Phase 7 — Operator Apply-and-Verify Runbook (Performance & Cache)

**Audience:** the operator (you) — the sole apply path to prod Postgres.
**Why this exists:** there is no Supabase CLI / local psql in this environment
(REST-only). The standard GSD "schema-push" gate is replaced by this manual,
dashboard-driven apply-and-verify runbook.

> **STAGE-DON'T-APPLY:** the agent has **authored + dry-run** migrations 175 + 176
> (and their REVERSE pairs) and the edge-function changes, but has applied
> **NOTHING** to prod. `PERF-01 SC#2` (iterative_scan recall/latency) and
> `PERF-03 SC#4` (9-row trigger-catalog coverage) are **CONFIRMED only after your
> clean paste-back** — they are operator-gated by design (D-04), because both are
> only measurable against live prod data. Until then the phase is **GATED, not
> complete.**

**What was authored (NOT applied):**
- `infra/supabase/migrations/175_generate_candidates_precap_iterative_scan.sql`
  — (a) `hnsw.iterative_scan` GUCs scoped to `generate_candidates` via
  `ALTER FUNCTION` (D-04/D-05); (b) per-restaurant `ROW_NUMBER()` pre-cap K=8
  (D-06/D-07). One coordinated change set (D-11). REVERSE:
  `175_REVERSE_ONLY_generate_candidates_precap_iterative_scan.sql`.
- `infra/supabase/migrations/176_invalidate_cache_triggers.sql`
  — cache-invalidation `net.http_post` + Vault triggers on
  `restaurants`/`menus`/`dishes` for INSERT/UPDATE/DELETE (D-09). REVERSE:
  `176_REVERSE_ONLY_invalidate_cache_triggers.sql`.
- `infra/supabase/functions/feed/index.ts` — tiered-radius loop (D-01..D-03,
  edge-only, no migration).
- `infra/supabase/functions/invalidate-cache/index.ts` — DELETE-path `old_record`
  fallback (flush-all unchanged, D-08).

All Deno harnesses + SQL-structure gates are green. Apply discipline below is
**dry-run → sample → full**, on a prod **BRANCH/CLONE first** — never straight to
prod, never `supabase db push`.

Run each SQL block in the **Supabase dashboard SQL editor**.

> **SQL-editor caveat (MEMORY):** the dashboard SQL editor returns **only the last
> statement's result**. Where a step asks you to paste back a result, run that
> assertion as a **single `SELECT`** (the catalog assertion in step 3 already is one
> statement; bundle into one `jsonb_build_object` SELECT if you add probes around it).

---

## (0) PREREQUISITE — create the Vault secret BEFORE applying 176

Migration 176's trigger reads a service-role JWT from Vault under the name
`invalidate_cache_service_key`. Without it, the trigger logs a `WARNING` and skips
the `net.http_post` on every write (fail-soft — never blocks the write, but the
cache is never busted and falls back to TTL-only 5-min staleness).

Create the secret on the branch/clone **before** applying migration 176:

```sql
SELECT vault.create_secret(
  '<service-role JWT for this project>',
  'invalidate_cache_service_key',
  'Service-role JWT used by _trg_invalidate_feed_cache'
);
```

- [ ] **(0)** Vault secret `invalidate_cache_service_key` created on the branch/clone.

> This is the exact mechanism already used for `enrich_dish_service_key`
> (migration 132). The migration body contains only the secret *name*, never the
> JWT itself.

---

## (1) APPLY — migration 175 then 176, on a prod BRANCH/CLONE first

Apply discipline: **dry-run → sample → full**, on a branch/clone, never straight
to prod. Apply in order (175 before 176 — they are independent, but 175 is the
function change and 176 is the trigger change; keep the numeric order).

### Step A — `infra/supabase/migrations/175_generate_candidates_precap_iterative_scan.sql`
A single `CREATE OR REPLACE FUNCTION generate_candidates(...)` that (a) sets the
four `hnsw.*` GUCs at runtime inside the body via
`PERFORM set_config('hnsw.<guc>', '<val>', true)` (`is_local => true` = `SET LOCAL`,
function-scoped, auto-reverts at exit) and (b) adds the per-restaurant
`ROW_NUMBER()` pre-cap (K=8). 13-arg signature + 32-column shape unchanged → no
deploy-ordering constraint, backward/forward compatible with either feed build.

> **Why not `ALTER FUNCTION ... SET hnsw.*`:** that catalog-persisted form fails on
> Supabase with `ERROR: 42501: permission denied to set parameter
> "hnsw.iterative_scan"` — the `postgres` role is not a superuser. The runtime
> `set_config(..., true)` form gives the identical per-function scoping via the
> USERSET privilege path (`SET hnsw.iterative_scan = 'relaxed_order'` is verified to
> succeed for this role). This is baked into the migration — nothing for you to do.

- [ ] **(1A)** Applied `175_...precap_iterative_scan.sql` — parses + applies clean.

### Step B — `infra/supabase/migrations/176_invalidate_cache_triggers.sql`
`CREATE OR REPLACE FUNCTION public._trg_invalidate_feed_cache()` + three
idempotent `DROP IF EXISTS` / `CREATE TRIGGER` statements (AFTER INSERT OR UPDATE
OR DELETE, FOR EACH ROW) on `restaurants`/`menus`/`dishes`.

- [ ] **(1B)** Applied `176_invalidate_cache_triggers.sql` — parses + applies clean.

> **Rollback path:** both forward migrations ship a paired REVERSE
> (`175_REVERSE_ONLY_...sql` = `RESET` the four GUCs + `CREATE OR REPLACE` restore
> the migration-169 body; `176_REVERSE_ONLY_...sql` = DROP the three triggers then
> the function). Apply the matching REVERSE on the branch to back out.

---

## (2) TRIGGER-CATALOG ASSERTION (PERF-03 SC#4) — run after applying 176

On the branch, after applying migration 176, run this **single statement** and
paste the result back. EXPECT **9 rows** — 3 tables (`restaurants`, `menus`,
`dishes`) × 3 events (INSERT, UPDATE, DELETE), all `action_timing = AFTER`:

```sql
SELECT event_object_table, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_name LIKE 'trg_invalidate_cache%'
ORDER BY 1, 3;
```

Expected (9 rows, all `AFTER`):

| event_object_table | action_timing | event_manipulation |
|--------------------|---------------|--------------------|
| dishes             | AFTER         | DELETE             |
| dishes             | AFTER         | INSERT             |
| dishes             | AFTER         | UPDATE             |
| menus              | AFTER         | DELETE             |
| menus              | AFTER         | INSERT             |
| menus              | AFTER         | UPDATE             |
| restaurants        | AFTER         | DELETE             |
| restaurants        | AFTER         | INSERT             |
| restaurants        | AFTER         | UPDATE             |

> **Paste-back-friendly variant** (the editor returns only the last statement, so
> if you want the row count in one paste, wrap the assertion in a count):
>
> ```sql
> SELECT jsonb_build_object(
>   'row_count', count(*),
>   'rows', jsonb_agg(jsonb_build_object(
>             'table', event_object_table,
>             'timing', action_timing,
>             'event', event_manipulation) ORDER BY event_object_table, event_manipulation)
> ) AS trigger_catalog
> FROM information_schema.triggers
> WHERE trigger_name LIKE 'trg_invalidate_cache%';
> ```
> EXPECT `row_count = 9`.

- [ ] **(2)** Trigger-catalog assertion run → **9 rows** (all AFTER) → pasted back.

---

## (3) ITERATIVE_SCAN RECALL + LATENCY VALIDATION (PERF-01 SC#2, D-04)

The `hnsw.iterative_scan` GUCs in migration 175 only help when a **preference
vector is present** (`p_preference_vector IS NOT NULL`) — anon/cold-start requests
fall through to `popularity_score`/`distance_m` and never run the HNSW scan (§1
caveat). So validate on **representative PERSONALIZED requests**.

Compare feed **recall** + **p95 latency** before vs after migration 175 on those
personalized requests:

- **Recall:** does the personalized feed return a fuller candidate pool (fewer
  under-returns) after the GUC? Heavy hard filters (radius + diet +
  exclude-families + time/day) are applied *after* the ANN scan, so the default
  `ef_search=40` can under-return; iterative_scan auto-expands until LIMIT is met.
- **Latency:** confirm p95 stays within `statement_timeout` (the GUC bounds
  worst-case cost via `max_scan_tuples=20000`).

The GUC starting values are **tunable** (`ef_search=400`, `max_scan_tuples=20000`,
`scan_mem_multiplier=2`, `iterative_scan='relaxed_order'`):

- If recall improves without blowing latency → **KEEP** (no action — the GUCs are
  already live in the function body).
- If it regresses latency / does not help recall → **RESET** by applying
  `175_REVERSE_ONLY_...sql`, which restores the verbatim migration-169 body (this
  drops BOTH the GUCs and the pre-cap, since both live inside the 175 body). There
  is no standalone GUC-only reset anymore — the GUCs are no longer catalog-persisted.
- If recall is close but tunable → edit the four `set_config('hnsw.*', ...)` starting
  values (`ef_search=400`, `max_scan_tuples=20000`) near the top of the function body
  in migration 175, re-apply (it's an idempotent `CREATE OR REPLACE`), and re-measure.
  **Record the chosen values.**

- [ ] **(3)** iterative_scan recall + latency validated on personalized requests →
  decision recorded: **KEEP** (with `ef_search=___`, `max_scan_tuples=___`) **or**
  **RESET** (ran the 175 REVERSE RESET block).

---

## (4) DISABLE THE OLD DASHBOARD WEBHOOK (avoid double-flush)

The `invalidate-cache` Edge Function was previously wired via a **dashboard
Database Webhook** — under the hood a `supabase_functions.http_request` trigger in
the `supabase_functions` schema, **invisible to a `public`-schema trigger dump**
and documented as UPDATE-only. Migration 176 replaces it with a tracked
`public`-schema `net.http_post` trigger and widens coverage to INSERT/UPDATE/DELETE.

If you leave the old dashboard webhook active, **both** fire on every write — a
harmless but wasteful double cache flush.

- [ ] **(4)** Disabled/deleted the existing untracked dashboard Database Webhook
  for `invalidate-cache` when applying migration 176.

---

## (5) POST-APPLY SMOKE — one real menu write → confirm cache flush

After applying 175 + 176 (and creating the Vault secret), do one real write and
confirm the feed cache busts:

1. `UPDATE` a dish (e.g. tweak a `name` or `price` on one published dish).
2. Confirm a `feed:v2:*` cache flush occurred — the
   `_trg_invalidate_feed_cache` trigger fires → `net.http_post` →
   `invalidate-cache` runs `deleteByPattern('feed:v2:*')` (flush-all, D-08
   unchanged). The next feed request recomputes (cache miss → fresh pool).

- [ ] **(5)** One real dish `UPDATE` → confirmed a `feed:v2:*` flush (feed
  recomputes on the next request).

---

## (6) PASTE BACK + PHASE-COMPLETION GATE

The phase is **NOT complete** until you paste back:

1. The **trigger-catalog assertion result** from step (2) — must be **9 rows**
   (all AFTER).
2. The **iterative_scan keep/reset decision** from step (3) — KEEP (with the
   chosen `ef_search`/`max_scan_tuples`) or RESET.

Only after a clean paste-back are `PERF-01 SC#2` and `PERF-03 SC#4` CONFIRMED and
the phase marked complete. The agent applied nothing — your paste-back is the
load-bearing, real-world gate.

---

## Quick checklist

- [ ] (0) Vault secret `invalidate_cache_service_key` created on branch/clone
- [ ] (1A) Applied `175_generate_candidates_precap_iterative_scan.sql`
- [ ] (1B) Applied `176_invalidate_cache_triggers.sql`
- [ ] (2) Trigger-catalog assertion → 9 rows (all AFTER) → pasted back
- [ ] (3) iterative_scan recall/latency validated → KEEP-or-RESET decision recorded
- [ ] (4) Old dashboard Database Webhook disabled/deleted (no double-flush)
- [ ] (5) Post-apply smoke: real dish UPDATE → `feed:v2:*` flush confirmed
- [ ] (6) Pasted back the 9-row catalog result + iterative_scan keep/reset decision
