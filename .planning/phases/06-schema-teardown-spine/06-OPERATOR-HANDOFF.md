# Phase 6 — Operator Apply-and-Verify Runbook (Schema Teardown Spine)

**Audience:** the operator (you) — the sole apply path to prod Postgres.
**Why this exists:** there is no Supabase CLI in this environment (REST-only). The
standard GSD "schema-push" gate is replaced by this manual, dashboard-driven
apply-and-verify runbook. The agent has **authored + dry-run** the teardown
migrations but has applied **nothing** to prod (stage-don't-apply).

> **The phase is NOT complete until you paste back a clean post-apply probe +
> verify-script output (everything GONE / empty).** This handoff is the
> load-bearing, real-world gate — build and `turbo check-types` pass *without*
> applying the drops (types come from the already-slimmed `types.ts`, not the
> live DB), so only your paste-back proves the teardown is live.

All SQL below is read-only in sections (1) and (4); only sections (2) Step A–D
are DDL that mutate prod. Run each block in the **Supabase dashboard SQL editor**.

---

## (1) PRE-FLIGHT — run BEFORE any drop (paste-back required)

Run **both** queries below in the dashboard SQL editor and paste the JSON results
back. Each returns a single JSON object so one paste captures everything.

### 1a. LIVE-STATE PROBE

```sql
-- PHASE 6 LIVE-STATE PROBE — read-only. Paste into Supabase dashboard SQL editor.
-- Returns one JSON object reporting exactly what the teardown must still drop.
SELECT jsonb_build_object(
  'ingredient_tables_present', (
    SELECT coalesce(jsonb_agg(table_name ORDER BY table_name), '[]'::jsonb)
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (
        'dish_ingredients','canonical_ingredients','canonical_ingredient_allergens',
        'canonical_ingredient_dietary_tags','ingredient_aliases','ingredient_aliases_v2',
        'ingredient_concepts','ingredient_variants','concept_translations','variant_translations'
      )
  ),
  'ingredient_triggers_present', (
    SELECT coalesce(jsonb_agg(tgname ORDER BY tgname), '[]'::jsonb)
    FROM pg_trigger
    WHERE NOT tgisinternal
      AND tgname IN ('dish_ingredients_refresh','dishes_override_refresh','trg_enrich_on_ingredient_change')
  ),
  'ingredient_functions_present', (
    SELECT coalesce(jsonb_agg(proname ORDER BY proname), '[]'::jsonb)
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND proname IN ('trg_dish_ingredients_refresh','trg_dishes_override_refresh',
                      'refresh_dish_dietary','compute_dish_allergens','compute_dish_dietary_tags')
  ),
  'dead_columns_present', (
    SELECT coalesce(jsonb_object_agg(table_name || '.' || column_name, true), '{}'::jsonb)
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND ( (table_name = 'dishes'  AND column_name IN ('allergens_override','dietary_tags_override'))
         OR (table_name = 'options' AND column_name = 'canonical_ingredient_id') )
  ),
  'archive_row_counts', (
    -- Wrap each in to_regclass so the probe never errors if a table is already gone.
    SELECT jsonb_build_object(
      'canonical_ingredients',          (SELECT CASE WHEN to_regclass('public.canonical_ingredients')          IS NULL THEN -1 ELSE (SELECT count(*) FROM public.canonical_ingredients)          END),
      'ingredient_aliases',             (SELECT CASE WHEN to_regclass('public.ingredient_aliases')             IS NULL THEN -1 ELSE (SELECT count(*) FROM public.ingredient_aliases)             END),
      'ingredient_aliases_v2',          (SELECT CASE WHEN to_regclass('public.ingredient_aliases_v2')          IS NULL THEN -1 ELSE (SELECT count(*) FROM public.ingredient_aliases_v2)          END),
      'ingredient_concepts',            (SELECT CASE WHEN to_regclass('public.ingredient_concepts')            IS NULL THEN -1 ELSE (SELECT count(*) FROM public.ingredient_concepts)            END),
      'ingredient_variants',            (SELECT CASE WHEN to_regclass('public.ingredient_variants')            IS NULL THEN -1 ELSE (SELECT count(*) FROM public.ingredient_variants)            END),
      'concept_translations',           (SELECT CASE WHEN to_regclass('public.concept_translations')           IS NULL THEN -1 ELSE (SELECT count(*) FROM public.concept_translations)           END),
      'variant_translations',           (SELECT CASE WHEN to_regclass('public.variant_translations')           IS NULL THEN -1 ELSE (SELECT count(*) FROM public.variant_translations)           END),
      'canonical_ingredient_allergens', (SELECT CASE WHEN to_regclass('public.canonical_ingredient_allergens') IS NULL THEN -1 ELSE (SELECT count(*) FROM public.canonical_ingredient_allergens) END),
      'dish_ingredients',               (SELECT CASE WHEN to_regclass('public.dish_ingredients')               IS NULL THEN -1 ELSE (SELECT count(*) FROM public.dish_ingredients)               END)
    )
  )
) AS phase6_probe;
```

**Reading the result:**
- `ingredient_tables_present` / `ingredient_triggers_present` / `ingredient_functions_present` / `dead_columns_present` list exactly what the teardown must still remove. Empty already = those drops are no-ops.
- `archive_row_counts`: `-1` means the table is **already absent** (its drop and its 172 snapshot are silent no-ops). `>= 0` means it has that many rows worth archiving in 172 before the 173 drop.

### 1b. pg_depend DEPENDENCY AUDIT (SC2)

```sql
-- PHASE 6 DEPENDENCY AUDIT — read-only. Finds anything OUTSIDE the ingredient set
-- that depends on an ingredient table/column, which a RESTRICT drop would reject.
SELECT jsonb_build_object(
  -- (A) FKs pointing INTO the ingredient set from a non-ingredient table.
  'external_fks_into_set', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'from_table', conrelid::regclass::text,
      'to_table',   confrelid::regclass::text,
      'constraint', conname)), '[]'::jsonb)
    FROM pg_constraint
    WHERE contype = 'f'
      AND confrelid::regclass::text LIKE 'public.%'
      AND confrelid::regclass::text ~ '(canonical_ingredient|ingredient_|dish_ingredients|concept_translations|variant_translations)'
      AND conrelid::regclass::text !~ '(canonical_ingredient|ingredient_|dish_ingredients|concept_translations|variant_translations)'
  ),
  -- (B) Views / matviews / functions referencing any ingredient object (pg_depend rewrite deps).
  'dependent_objects', (
    SELECT coalesce(jsonb_agg(DISTINCT jsonb_build_object(
      'dependent', dependent.relname,
      'kind',      dependent.relkind,
      'depends_on', src.relname)), '[]'::jsonb)
    FROM pg_depend d
    JOIN pg_rewrite r   ON r.oid = d.objid
    JOIN pg_class dependent ON dependent.oid = r.ev_class
    JOIN pg_class src   ON src.oid = d.refobjid
    JOIN pg_namespace n ON n.oid = src.relnamespace
    WHERE n.nspname = 'public'
      AND src.relname ~ '(canonical_ingredient|ingredient_|dish_ingredients|concept_translations|variant_translations)'
      AND dependent.relname !~ '(canonical_ingredient|ingredient_|dish_ingredients|concept_translations|variant_translations)'
  )
) AS phase6_depaudit;
```

### STOP CONDITIONS (do NOT apply any drop if either is true)

- `external_fks_into_set` is **non-empty** → an unknown non-ingredient table has an FK into the set.
- `dependent_objects` is **non-empty** → an unknown view / matview / function depends on an ingredient object.

Either is a **hard blocker**: an unexpected dependent exists that a RESTRICT drop
would (correctly) reject. **STOP, paste the result back, and bring it to planning**
— do not attempt to apply anything.

Expected clean result: both arrays empty (`[]`).

---

## (2) APPLY ORDER — exact, one migration at a time

Apply each file's contents in the dashboard SQL editor, in this order. All drops
are `IF EXISTS`-guarded (idempotent — correct whether or not the superseded
151/152/153 ever ran).

### Step A — `171_retire_ingredient_triggers_reconciled.sql`
Drops the ingredient triggers + functions (reconciled Phase B; supersedes 151).
Idempotent `DROP ... IF EXISTS`. Apply it.

### Step B — `172_snapshot_ingredient_archive.sql`  (+ LANDING CHECK)
Creates the `ingredient_archive` schema and presence-guarded `CREATE TABLE AS
SELECT` copies of every surviving ingredient table (any table the probe reported
absent is a silent no-op). Apply it, then run the **LANDING CHECK**:

```sql
-- 172 LANDING CHECK — confirm the archive tables landed BEFORE proceeding to 173 (D-02).
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'ingredient_archive'
ORDER BY table_name;
```

Confirm the archive contains a table for **every** ingredient table the section-(1)
probe reported present (with `archive_row_counts >= 0`). **Do NOT proceed to 173
until the archive is confirmed** — 173 is one-way and the archive is the only
recovery path for the curated ingredient data.

### Step C — `173_drop_ingredient_tables_restrict.sql`
First severs `options.canonical_ingredient_id` (the FK into `canonical_ingredients`),
then RESTRICT-drops the ingredient tables child→parent inside one transaction.
Apply it.

> If a RESTRICT drop **ERRORS with a dependency**, **STOP** — that is the loud
> failure SC2 wants: an unexpected dependent exists. Do not switch to CASCADE.
> Paste the error back and bring it to planning.

### Step D — `174_drop_ingredient_columns_restrict.sql`
Drops the dead dish columns `dishes.allergens_override` and
`dishes.dietary_tags_override`. Apply it.

> **Rollback note:** each forward migration with a destructive effect has a paired
> `*_REVERSE_ONLY_*.sql` (`171_REVERSE_ONLY_retire_ingredient_triggers_reconciled.sql`,
> `173_REVERSE_ONLY_drop_ingredient_tables_restrict.sql`,
> `174_REVERSE_ONLY_drop_ingredient_columns_restrict.sql`). These are **schema-only**
> recreations — they restore structure, not data. Data is restored manually from
> the `ingredient_archive` schema created in Step B. Migration 172 has **no**
> reverse (it only creates; nothing to undo at apply time — rolling the archive
> back is a future `DROP SCHEMA ingredient_archive CASCADE;` cleanup, deferred).

---

## (3) SUPERSEDED MIGRATIONS — MUST NOT be applied

The following older migrations are **superseded** by 171/173/174 and are kept in
the repo only as historical-but-unapplied artifacts. **Do NOT apply any of them:**

- `151_retire_ingredient_triggers.sql` — superseded by **171**. Its REVERSE is
  broken post-156 (it recreates functions that reference the 156-dropped
  `dietary_tags` table and `dishes.allergens` column and would fail).
- `152_drop_ingredient_pipeline.sql` — superseded by **173**. It uses **CASCADE**,
  which violates SC2 (RESTRICT must fail loudly on unknown dependents). Applying it
  would silently cascade into any unexpected dependent.
- `153_drop_ingredient_columns.sql` — superseded by **174**. Also CASCADE-flavored
  / pre-reconciliation. Use 174 instead.

If you see 151/152/153 in the migrations folder, ignore them — apply only
**171 → 172 → 173 → 174**.

---

## (4) POST-APPLY VERIFICATION (paste-back required)

After applying 171–174, run **both** of the following and paste the results back.

### 4a. Read-only verify script

```bash
cd infra/scripts && pnpm exec ts-node verify-phase6-teardown.ts
```

Expect **every** line to read `GONE ✓`:
- `dishes.allergens_override` → `GONE ✓`
- `dishes.dietary_tags_override` → `GONE ✓`
- `options.canonical_ingredient_id` → `GONE ✓`
- all 10 ingredient tables (`dish_ingredients`, `canonical_ingredients`,
  `canonical_ingredient_allergens`, `canonical_ingredient_dietary_tags`,
  `ingredient_aliases`, `ingredient_aliases_v2`, `ingredient_concepts`,
  `ingredient_variants`, `concept_translations`, `variant_translations`) → `GONE ✓`

Any `STILL EXISTS ✗` = the corresponding drop did not take — STOP and report.

### 4b. Re-run the LIVE-STATE PROBE

Re-run the **same** LIVE-STATE PROBE from section (1a). Expect a fully-empty
post-teardown result:
- `ingredient_tables_present` = `[]`
- `ingredient_triggers_present` = `[]`
- `ingredient_functions_present` = `[]`
- `dead_columns_present` = `{}`
- `archive_row_counts` = every entry `-1` (all tables now absent from `public`)

**Paste back both the verify-script output and the re-run probe JSON.** The phase
is **NOT complete** until this paste-back is clean (all `GONE ✓` / all empty).

---

## Quick checklist

- [ ] (1a) LIVE-STATE PROBE run → pasted back
- [ ] (1b) DEPENDENCY AUDIT run → both arrays empty (else STOP)
- [ ] (2A) Applied `171_retire_ingredient_triggers_reconciled.sql`
- [ ] (2B) Applied `172_snapshot_ingredient_archive.sql` → LANDING CHECK confirms `ingredient_archive` tables landed
- [ ] (2C) Applied `173_drop_ingredient_tables_restrict.sql` (no RESTRICT error)
- [ ] (2D) Applied `174_drop_ingredient_columns_restrict.sql`
- [ ] (3) Confirmed 151 / 152 / 153 were NOT applied
- [ ] (4a) `verify-phase6-teardown.ts` → all `GONE ✓`
- [ ] (4b) Re-run LIVE-STATE PROBE → all empty / `{}` / `-1`
- [ ] Pasted back the clean post-apply probe + verify-script output
