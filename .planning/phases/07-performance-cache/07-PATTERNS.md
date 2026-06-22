# Phase 7: Performance & Cache - Pattern Map

**Mapped:** 2026-06-21
**Files analyzed:** 6 (2 MODIFY edge, 4 CREATE migrations — 2 forward + 2 REVERSE)
**Analogs found:** 6 / 6 (all exact or role-match, all file:line verified this session)

> **Naming correction (verified by `ls`):** REVERSE migrations in this repo are named
> `NNN_REVERSE_ONLY_<slug>.sql`, NOT `NNN_<slug>.REVERSE.sql`. The context-prompt's
> `175_*.REVERSE.sql` / `176_*.REVERSE.sql` shorthand maps to:
> - `175_REVERSE_ONLY_generate_candidates_precap_iterative_scan.sql`
> - `176_REVERSE_ONLY_invalidate_cache_triggers.sql`
> Next free numbers confirmed: **175, 176** (highest existing = 174).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `infra/supabase/functions/feed/index.ts` (MODIFY) | edge function (RPC orchestration) | request-response | the existing `:881-903` call site itself | self / exact |
| `infra/supabase/migrations/175_*.sql` (CREATE) | migration (function tune + window pre-cap) | transform (CRUD read) | `169_generate_candidates_pushdown.sql` + `136_hnsw_dishes_embedding.sql` | exact (extends 169) |
| `infra/supabase/migrations/175_REVERSE_ONLY_*.sql` (CREATE) | migration (reverse) | transform | `169_REVERSE_ONLY_generate_candidates_pushdown.sql` + `170_REVERSE_ONLY_*.sql` (header prose) | exact |
| `infra/supabase/migrations/176_*.sql` (CREATE) | migration (trigger + trigger-fn) | event-driven (DB→edge http) | `132_vault_based_trigger_auth.sql` + `135_record_enrich_dish_triggers.sql` | exact (verbatim pattern) |
| `infra/supabase/migrations/176_REVERSE_ONLY_*.sql` (CREATE) | migration (reverse) | event-driven | `135` inverted + `170_REVERSE_ONLY_*.sql` (header prose) | exact |
| `infra/supabase/functions/invalidate-cache/index.ts` (MODIFY, minimal) | edge function (webhook handler) | event-driven | the existing body's `:54`/`:79-100` record handling | self / exact |

---

## Pattern Assignments

### `infra/supabase/functions/feed/index.ts` (edge, request-response) — D-01..D-03

**Analog:** the existing single-shot RPC block, which the loop replaces in place. Everything from `const pool = candidates ?? []` (`:903`) downstream is BYTE-IDENTICAL and untouched.

**Current call site to wrap (`:881-903`, VERIFIED):**
```typescript
const { data: candidates, error: candidateError } = (await supabase.rpc('generate_candidates', {
  p_lat: location.lat,
  p_lng: location.lng,
  p_radius_m: radius * 1000,                                   // ← ONLY this varies per tier
  p_preference_vector: preferenceVector ? JSON.stringify(preferenceVector) : null,
  p_disliked_dish_ids: userDislikes.length ? userDislikes : null,
  p_diet_tag: hardDietTag,
  p_exclude_families: filters.excludeFamilies?.length ? filters.excludeFamilies : null,
  p_exclude_spicy: filters.excludeSpicy ?? false,
  p_limit: 200,
  p_current_time: filters.currentTime ?? null,
  p_current_day: filters.currentDayOfWeek ?? null,
  p_schedule_type: filters.scheduleType ?? null,
  p_group_meals: filters.groupMeals ?? false,
})) as { data: Candidate[] | null; error: unknown };

if (candidateError) {
  console.error('[Feed] generate_candidates failed:', candidateError);
  throw candidateError;
}

const pool = candidates ?? [];                                // ← loop must produce this same Candidate[]
```

**Pattern to apply (tiered loop, from RESEARCH §2 — replace, do NOT merge):**
```typescript
// Tunable named constants (Claude's Discretion, D-01/D-02).
const TIER_FRACTIONS = [0.25, 0.5, 1.0];   // 25% → 50% → 100% (final tier == requested radius, D-03)
const POOL_TARGET = 100;                    // ~half of p_limit=200 (D-02)
const requestedRadiusM = radius * 1000;

let pool: Candidate[] = [];
for (const frac of TIER_FRACTIONS) {
  const { data, error } = (await supabase.rpc('generate_candidates', {
    /* ...all params identical to above... */
    p_radius_m: Math.round(requestedRadiusM * frac),   // ONLY this changes
    /* ... */
  })) as { data: Candidate[] | null; error: unknown };
  if (error) { console.error('[Feed] generate_candidates failed:', error); throw error; }
  pool = data ?? [];                        // wider tier is a strict superset → replace
  if (pool.length >= POOL_TARGET) break;    // healthy pool → stop expanding (D-02)
}
```

**Why replace not merge:** wider `p_radius_m` with all other filters identical yields a strict superset (`ST_DWithin` monotonic in radius, same ANN order, same `p_limit=200`). Taking the widest-so-far result avoids dedup. **`error` handling pattern is the existing `console.error` + `throw`** — preserve it verbatim per tier.

**Byte-identical guarantee:** assign final result to `pool` exactly as `:903`. Do not touch `:906-915` (empty-pool early return), `:917` (`annotated`), or any response assembly. Scope the git diff to `:881-903`.

---

### `infra/supabase/migrations/175_*.sql` (migration, transform) — D-04 + D-06 (coordinated, D-11)

**Analog:** `169_generate_candidates_pushdown.sql` (current HEAD function body) + `136_hnsw_dishes_embedding.sql` (the HNSW index the GUC scans over).

**Two changes in ONE `CREATE OR REPLACE` change set** (32-column shape unchanged → no DROP, no deploy-ordering — same property 169 relies on):

**(a) iterative_scan GUC via `ALTER FUNCTION` (D-04/D-05, RESEARCH §1).** Full 13-arg signature required (taken verbatim from `169:42-54` declared types; `vector(1536)` may be written bare `vector` — `167_REVERSE` proves both resolve):
```sql
ALTER FUNCTION generate_candidates(
  FLOAT, FLOAT, FLOAT, vector, UUID[], TEXT, TEXT[], BOOLEAN, INT, TIME, TEXT, TEXT, BOOLEAN
)
  SET hnsw.iterative_scan      = 'relaxed_order',  -- D-05; order re-imposed downstream
  SET hnsw.max_scan_tuples     = 20000,            -- default; cost ceiling (tunable)
  SET hnsw.scan_mem_multiplier = 2,                -- headroom (tunable)
  SET hnsw.ef_search           = 400;              -- ≥2× p_limit=200 (tunable)
```
> **Pitfall 1 fallback:** if the comma-list `SET a, SET b` is rejected, emit one
> `ALTER FUNCTION ... SET <guc> = <val>;` per GUC (all independent/idempotent).

**(b) Per-restaurant `ROW_NUMBER()` pre-cap (D-06/D-07, RESEARCH §3 Option A).** Inject INSIDE the existing `candidates AS MATERIALIZED` CTE (`169:101-307`), wrapping its SELECT in a windowed subquery, `WHERE rn <= K` before the existing global `ORDER BY ... LIMIT p_limit`.

Existing CTE structure to extend — note the **`#variable_conflict use_column` directive (`169:95`)** that MUST be preserved (the new ORDER BY relies on bare `vector_distance`/`popularity_score`/`distance_m` resolving to columns):
```sql
#variable_conflict use_column                       -- 169:95 — KEEP
BEGIN
  RETURN QUERY
  WITH candidates AS MATERIALIZED (                  -- 169:101
    SELECT
      d.id, d.restaurant_id, ...,                    -- 169:102-144 existing columns
      CASE WHEN p_preference_vector IS NOT NULL AND d.embedding IS NOT NULL
           THEN (d.embedding <=> p_preference_vector) ELSE NULL END::FLOAT AS vector_distance,  -- 169:115-119 (the ANN/HNSW scan)
      ST_Distance(r.location_point, ...)::FLOAT AS distance_m,                                   -- 169:121-124
      COALESCE(da.popularity_score, 0)::FLOAT AS popularity_score,                               -- 169:132
      r.open_hours, r.timezone, r.country_code       -- 169:142-144 (migration 167 fold — DO NOT remove)
    FROM dishes d
    JOIN restaurants r ON r.id = d.restaurant_id     -- 169:146-149
    ...existing JOINs + WHERE 169:150-299...
    ORDER BY vector_distance ASC NULLS LAST,         -- 169:301-304 global sort keys
             popularity_score DESC, distance_m ASC
    LIMIT p_limit                                    -- 169:306
  )
  -- (2) LATERAL modifier-JSON build for survivors — 169:308+ UNTOUCHED (single round-trip)
  SELECT c.id, c.restaurant_id, ... ;
```

Apply Option A — window column + enclosing filter, ORDER BY mirroring `169:301-304`:
```sql
WITH candidates AS MATERIALIZED (
  SELECT * FROM (
    SELECT
      <all existing 169:102-144 columns>,
      ROW_NUMBER() OVER (
        PARTITION BY d.restaurant_id
        ORDER BY
          CASE WHEN p_preference_vector IS NOT NULL AND d.embedding IS NOT NULL
               THEN (d.embedding <=> p_preference_vector) ELSE NULL END ASC NULLS LAST,
          COALESCE(da.popularity_score, 0) DESC,
          ST_Distance(r.location_point, ST_SetSRID(ST_MakePoint(p_lng,p_lat),4326)::geography) ASC
      ) AS rn
    FROM dishes d
    JOIN restaurants r ON r.id = d.restaurant_id
    <all existing JOINs + WHERE 169:150-299>
  ) ranked
  WHERE ranked.rn <= 8                               -- per-restaurant pre-cap K (D-07; 5–10, start 8)
  ORDER BY vector_distance ASC NULLS LAST, popularity_score DESC, distance_m ASC
  LIMIT p_limit
)
```
**K = 8** (>2.5× the JS `applyDiversity(scored, 3)` cap at `feed/index.ts:951`); named/commented so the operator can tune. The LATERAL modifier-JSON block, `reachable_proteins` projection, and migration-167 `open_hours` columns are all downstream of the CTE — **untouched**.

---

### `infra/supabase/migrations/175_REVERSE_ONLY_*.sql` (migration reverse)

**Analog:** `169_REVERSE_ONLY_generate_candidates_pushdown.sql` (the `CREATE OR REPLACE` restore-prior-body pattern, no DROP — signature unchanged) + `170_REVERSE_ONLY_codify_behavioral_rls.sql` (the warning/rollback-semantics header prose model).

**169 REVERSE header pattern to mirror (`169_REVERSE_ONLY...:1-10`):**
```sql
-- ══════════════════════════════════════════════════════════════════════════════
-- REVERSE of migration 175 — restore the migration-169 generate_candidates +
-- clear the iterative_scan GUCs. Plain CREATE OR REPLACE (32-col shape unchanged,
-- no DROP). Controlled rollback only — reverts the per-restaurant pre-cap and the
-- filtered-ANN recall fix.
-- ══════════════════════════════════════════════════════════════════════════════
```

**Reverse body = `RESET` each GUC + restore 169's verbatim function body:**
```sql
ALTER FUNCTION generate_candidates(
  FLOAT, FLOAT, FLOAT, vector, UUID[], TEXT, TEXT[], BOOLEAN, INT, TIME, TEXT, TEXT, BOOLEAN
)
  RESET hnsw.iterative_scan,
  RESET hnsw.max_scan_tuples,
  RESET hnsw.scan_mem_multiplier,
  RESET hnsw.ef_search;

CREATE OR REPLACE FUNCTION generate_candidates(...)   -- VERBATIM migration 169 body (no pre-cap)
...
```
> REVERSE restores migration **169's** body (current HEAD), NOT 167's. `ALTER FUNCTION ... RESET <guc>` is the exact inverse of `SET`.

---

### `infra/supabase/migrations/176_*.sql` (migration, event-driven) — D-09 (independent)

**Analog (verbatim pattern, VERIFIED):** `132_vault_based_trigger_auth.sql:36-95` (trigger function: Vault lookup → NULL-guard → `net.http_post`) + `135_record_enrich_dish_triggers.sql:24-59` (idempotent `DROP IF EXISTS` + `CREATE TRIGGER`).

> **CRITICAL (RESEARCH §4):** use `net.http_post` + `vault.decrypted_secrets`, NOT
> `supabase_functions.http_request`. `grep -rl "http_request|supabase_functions"
> infra/supabase/migrations/` returns NOTHING — the dashboard helper is not the in-repo
> precedent. The codify-drift pattern is migration 132/135.

**Migration 132 trigger-fn skeleton to copy (`132:34-95`, VERIFIED):**
```sql
BEGIN;
CREATE OR REPLACE FUNCTION public._trg_notify_enrich_dish()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_url TEXT := 'https://tqroqqvxabolydyznewa.supabase.co/functions/v1/enrich-dish';  -- 132:43 project-ref literal
  v_key TEXT;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'enrich_dish_service_key';            -- 132:46-48

  IF v_key IS NULL THEN
    RAISE WARNING 'enrich_dish_service_key not in vault';   -- 132:50-53 fail-soft, never blocks write
    RETURN COALESCE(NEW, OLD);
  END IF;
  ...
  PERFORM net.http_post(                              -- 132:84-91
    url     := v_url,
    body    := jsonb_build_object('dish_id', v_dish_id),
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_key)
  );
  RETURN NEW;
END;
$function$;
COMMIT;
```

**Migration 135 CREATE TRIGGER pattern to copy (`135:24-29`, VERIFIED — idempotent DROP+CREATE):**
```sql
DROP TRIGGER IF EXISTS trg_enrich_on_dish_change ON public.dishes;
CREATE TRIGGER trg_enrich_on_dish_change
  AFTER INSERT OR UPDATE OF name, description ON public.dishes
  FOR EACH ROW
  EXECUTE FUNCTION public._trg_notify_enrich_dish();
```

**New 176 (per RESEARCH §4) — new fn `public._trg_invalidate_feed_cache()`:**
- Vault secret name: **`invalidate_cache_service_key`** (new; operator runs `vault.create_secret(...)` before apply — copy the `132:21-32` prerequisite prose into the 176 header).
- URL literal: `https://tqroqqvxabolydyznewa.supabase.co/functions/v1/invalidate-cache` (same project ref as `132:43`).
- Body: `jsonb_build_object('type', TG_OP, 'table', TG_TABLE_NAME, 'schema', TG_TABLE_SCHEMA, 'record', CASE WHEN TG_OP='DELETE' THEN NULL ELSE to_jsonb(NEW) END, 'old_record', CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(OLD) END)` — matches the Supabase DB-webhook shape `invalidate-cache` already parses.
- 3 triggers × `AFTER INSERT OR UPDATE OR DELETE` on `public.restaurants` / `public.menus` / `public.dishes` (full-row, no column scoping — feed depends on more than name/description). Each: `DROP TRIGGER IF EXISTS ... ; CREATE TRIGGER trg_invalidate_cache_on_<table>_change AFTER INSERT OR UPDATE OR DELETE ON public.<table> FOR EACH ROW EXECUTE FUNCTION public._trg_invalidate_feed_cache();`

**Header MUST flag (Pitfalls 2/3, RESEARCH §4):** operator disables/deletes the existing untracked dashboard Database Webhook at apply time (else double-flush, harmless); Vault secret prerequisite or trigger logs WARNING + skips.

---

### `infra/supabase/migrations/176_REVERSE_ONLY_*.sql` (migration reverse)

**Analog:** `135` structure inverted + `170_REVERSE_ONLY_*.sql:1-22` header warning prose.

```sql
-- 176_REVERSE_ONLY_invalidate_cache_triggers.sql
-- WARNING: after this, no migration-tracked feed-cache invalidation fires. If the
-- dashboard webhook was deleted at apply-time, re-create it or feed staleness
-- returns to TTL-only (5 min). Controlled rollback only.
DROP TRIGGER IF EXISTS trg_invalidate_cache_on_dish_change ON public.dishes;
DROP TRIGGER IF EXISTS trg_invalidate_cache_on_menu_change ON public.menus;
DROP TRIGGER IF EXISTS trg_invalidate_cache_on_restaurant_change ON public.restaurants;
DROP FUNCTION IF EXISTS public._trg_invalidate_feed_cache();
```

---

### `infra/supabase/functions/invalidate-cache/index.ts` (edge, event-driven, MINIMAL) — D-08 note

**Analog:** the existing body's own record handling. Flush-all logic (`deleteByPattern('feed:v2:*')`, `:76`) is UNCHANGED (D-08).

**One change — DELETE path reads `old_record` (RESEARCH §4):** the per-restaurant best-effort lookup (`:79-100`) gets a null id on DELETE because the trigger sends `record: null`. Change `:54`:
```typescript
const record: Record<string, any> = body.record ?? {};               // current :54
// →
const record: Record<string, any> = body.record ?? body.old_record ?? {};   // prefer record, fall back to old_record
```
**Correctness does NOT depend on this** — the unconditional flush-all (`:76`) already clears the feed cache on every event regardless of type. This only makes the best-effort legacy `restaurant:*` keys (`:98-100`) resolvable on DELETE. Do NOT add complexity to recover the dishes-DELETE `restaurant_id` (the live `:90-95` lookup finds a gone row — acceptable, flush-all is the guarantee). Update the file-header comment `:1-13` ("on UPDATE events" → INSERT/UPDATE/DELETE).

---

## Shared Patterns

### Vault-authed backend→edge HTTP from a trigger
**Source:** `132_vault_based_trigger_auth.sql:43-91`
**Apply to:** migration 176 trigger function.
Secret name in body (never the JWT literal); NULL-key → `RAISE WARNING` + `RETURN COALESCE(NEW,OLD)` (fail-soft); `net.http_post(url, jsonb_build_object body, Bearer headers)`; `SECURITY DEFINER`. Per-environment `vault.create_secret(...)` prerequisite in the migration header (`132:21-32`).

### Idempotent trigger recording
**Source:** `135_record_enrich_dish_triggers.sql:24-59`
**Apply to:** migration 176 + its REVERSE.
`DROP TRIGGER IF EXISTS ... ON public.<t>;` then `CREATE TRIGGER ... AFTER <events> ON public.<t> FOR EACH ROW EXECUTE FUNCTION ...;` — re-appliable as a no-op against prod.

### REVERSE-pair discipline
**Source:** `169_REVERSE_ONLY_*.sql` (CREATE OR REPLACE restore, no DROP for unchanged-signature functions) + `170_REVERSE_ONLY_*.sql:1-22` (security/rollback-warning header prose)
**Apply to:** both 175 and 176 REVERSE files. Naming: `NNN_REVERSE_ONLY_<slug>.sql`.

### `#variable_conflict use_column` directive
**Source:** `169:95`
**Apply to:** migration 175 — must survive the CTE edit; the new `ROW_NUMBER()` ORDER BY relies on bare `vector_distance`/`popularity_score`/`distance_m` resolving to columns, not OUT params.

### Migration body wrapping
**Source:** `132` / `135` wrap DDL in `BEGIN; ... COMMIT;`
**Apply to:** 175, 176, and their REVERSE files.

---

## No Analog Found

None. Every file maps to an exact in-repo precedent (verified file:line this session). The only net-new identifiers — Vault secret `invalidate_cache_service_key` and the `_trg_invalidate_feed_cache` function — are direct renames of the `132/135` shapes.

## Metadata

**Analog search scope:** `infra/supabase/migrations/` (132, 135, 136, 167, 169, 170 + REVERSE pairs), `infra/supabase/functions/feed/index.ts`, `infra/supabase/functions/invalidate-cache/index.ts`
**Files scanned:** 8 (all RESEARCH file:line citations spot-verified — accurate)
**Pattern extraction date:** 2026-06-21
