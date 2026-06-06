-- ============================================================================
-- Phase 6 — Dish-model rewrite — DATA CONVERSION (DRY-RUN HARNESS)
-- ============================================================================
-- Plan: docs/plans/dish-model-rewrite-phase-6-data-migration.md §3
--
-- WHAT THIS DOES
--   Converts legacy parent/variant dishes into the modifier model:
--     • re-tags 6 mis-classified `standard` parents → `configurable`
--     • configurable parents  → one option_group + options (price deltas)
--     • bundle parents        → dishes.bundled_items JSONB
--     • buffet/course_menu     → dishes.dining_format
--     • queues converted dishes for re-embedding (enrichment_status='none')
--     • deletes the now-folded variant child rows
--
-- HOW TO RUN (read-only by default)
--   Run against a STAGING SNAPSHOT or a PROD READ REPLICA, via psql:
--       psql "$DATABASE_URL" -f phase6-data-conversion.dryrun.sql
--   The script wraps everything in a transaction that ROLLS BACK. It prints
--   FK introspection + before/after counts + a per-dish CSV so you can audit.
--   NOTHING is persisted until you flip the commit flag at the very bottom.
--
-- TO APPLY FOR REAL
--   1. Audit the dry-run output on a replica (see plan §8 acceptance criteria).
--   2. Ship the price_per_person caller swap first (plan §5).
--   3. Copy this file to  infra/supabase/migrations/158_phase6_data_conversion.sql
--   4. Delete the audit SELECTs (optional), change the final `ROLLBACK;` to `COMMIT;`.
--   5. Run batch-embed.ts afterwards (plan §4). The destructive DROP is a
--      SEPARATE, later, gated migration (159) — NOT this file.
--
-- ⚠ DO NOT place this file under migrations/ until promoted — it would auto-run.
-- ============================================================================

BEGIN;

-- ── Snapshot BEFORE counts ─────────────────────────────────────────────────
CREATE TEMP TABLE _p6_before AS
SELECT
  (SELECT count(*) FROM dishes)                                   AS dishes,
  (SELECT count(*) FROM dishes WHERE is_parent)                   AS parents,
  (SELECT count(*) FROM dishes WHERE parent_dish_id IS NOT NULL)  AS variant_children,
  (SELECT count(*) FROM option_groups)                           AS option_groups,
  (SELECT count(*) FROM options)                                 AS options;

-- ── STEP 0: re-tag the 6 mis-classified configurables ──────────────────────
-- `standard` + is_parent is contradictory; inspection shows size-variant
-- containers (Calamar/Pescado/Pulpo/…). Expect exactly 6 rows.
UPDATE dishes
SET dish_kind = 'configurable'
WHERE is_parent = true
  AND dish_kind = 'standard';

-- ── STEP 1a: one option_group per configurable parent that HAS children ────
-- Name = source language (Option 2), faithful to @eatme/shared COUNTRY_TO_LANGUAGE.
-- Capture the new group ids so Step 1b joins only the groups WE created.
CREATE TEMP TABLE _p6_new_groups (group_id uuid, dish_id uuid);

WITH ins AS (
  INSERT INTO option_groups
    (id, restaurant_id, dish_id, name, selection_type,
     min_selections, max_selections, display_order, is_active, display_in_card)
  SELECT
    gen_random_uuid(),
    d.restaurant_id,
    d.id,
    CASE
      WHEN upper(coalesce(r.country_code,'')) IN
        ('ES','MX','AR','CL','CO','PE','VE','CR','EC','GT','HN','NI',
         'PA','PY','SV','UY','DO','CU','BO')                 THEN 'Elige una opción'
      WHEN upper(coalesce(r.country_code,'')) = 'PL'          THEN 'Wybierz opcję'
      ELSE 'Choose an option'
    END,
    'single', 1, 1, 0, true, false
  FROM dishes d
  JOIN restaurants r ON r.id = d.restaurant_id
  WHERE d.is_parent = true
    AND d.dish_kind = 'configurable'
    AND EXISTS (SELECT 1 FROM dishes c WHERE c.parent_dish_id = d.id)  -- no empty groups
  RETURNING id, dish_id
)
INSERT INTO _p6_new_groups (group_id, dish_id) SELECT id, dish_id FROM ins;

-- ── STEP 1b: one option per variant child (deltas vs cheapest sibling) ──────
WITH variant_min AS (
  SELECT parent_dish_id, MIN(price) AS min_price
  FROM dishes
  WHERE parent_dish_id IN (SELECT dish_id FROM _p6_new_groups)
  GROUP BY parent_dish_id
)
INSERT INTO options
  (id, option_group_id, name, price_delta, primary_protein,
   is_default, display_order, is_available)
SELECT
  gen_random_uuid(),
  g.group_id,
  v.name,
  v.price - vm.min_price,
  -- override base protein ONLY when the variant actually changes it
  -- (NULL for pure size variants — keeps the override semantics clean)
  CASE WHEN v.primary_protein IS DISTINCT FROM p.primary_protein
       THEN v.primary_protein ELSE NULL END,
  (row_number() OVER (PARTITION BY v.parent_dish_id ORDER BY v.price ASC NULLS LAST) = 1),
  (row_number() OVER (PARTITION BY v.parent_dish_id ORDER BY v.price ASC NULLS LAST) - 1)::int,
  true
FROM dishes v
JOIN _p6_new_groups g  ON g.dish_id = v.parent_dish_id
JOIN dishes p          ON p.id      = v.parent_dish_id
JOIN variant_min vm    ON vm.parent_dish_id = v.parent_dish_id;

-- ── STEP 1c: parent base price = cheapest variant, prefix 'from' ───────────
UPDATE dishes p
SET price = vm.min_price,
    display_price_prefix = 'from'
FROM (
  SELECT parent_dish_id, MIN(price) AS min_price
  FROM dishes
  WHERE parent_dish_id IN (SELECT dish_id FROM _p6_new_groups)
  GROUP BY parent_dish_id
) vm
WHERE p.id = vm.parent_dish_id;

-- ── STEP 2: bundle parents → bundled_items JSONB ───────────────────────────
UPDATE dishes p
SET bundled_items = (
  SELECT jsonb_agg(jsonb_build_object('name', v.name, 'note', NULL)
                   ORDER BY v.created_at)
  FROM dishes v
  WHERE v.parent_dish_id = p.id
)
WHERE p.is_parent = true AND p.dish_kind = 'bundle';

-- ── STEP 3: dining_format hints (defensive — catches any stray tagged rows) ─
UPDATE dishes SET dining_format = 'buffet'      WHERE dish_kind = 'buffet'      AND dining_format IS NULL;
UPDATE dishes SET dining_format = 'course_menu' WHERE dish_kind = 'course_menu' AND dining_format IS NULL;

-- ── STEP 4: queue converted parents for re-embed (batch-embed targets 'none')
UPDATE dishes
SET enrichment_status = 'none'
WHERE is_parent = true
  AND dish_kind IN ('configurable','bundle');

-- ===========================================================================
-- AUDIT  (printed BEFORE the deletes, so it shows even if a delete hits an FK)
-- ===========================================================================

-- A) FK constraints referencing dishes — what deleting children could touch.
SELECT 'fk_refs_to_dishes' AS audit,
       conrelid::regclass::text AS referencing_table,
       pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE confrelid = 'dishes'::regclass AND contype = 'f'
ORDER BY 2;

-- B) Per-dish CSV: base price, options, deltas (the core sanity check).
SELECT 'converted_dish' AS audit,
       d.name, d.price AS base_price, d.display_price_prefix,
       count(o.id) AS n_options,
       jsonb_agg(jsonb_build_object(
         'opt', o.name, 'delta', o.price_delta,
         'default', o.is_default, 'protein_override', o.primary_protein)
         ORDER BY o.display_order) AS options
FROM dishes d
JOIN _p6_new_groups g ON g.dish_id = d.id
JOIN options o        ON o.option_group_id = g.group_id
GROUP BY d.id, d.name, d.price, d.display_price_prefix
ORDER BY d.name;

-- C) Data-quality flags (should all be 0 / consciously accepted).
SELECT 'flags' AS audit,
  (SELECT count(*) FROM dishes d
     WHERE d.is_parent AND d.dish_kind='configurable'
       AND NOT EXISTS (SELECT 1 FROM dishes c WHERE c.parent_dish_id=d.id))
                                                    AS configurable_parents_with_no_children,
  (SELECT count(*) FROM dishes
     WHERE parent_dish_id IN (SELECT dish_id FROM _p6_new_groups)
       AND price IS NULL)                            AS variant_children_with_null_price,
  (SELECT count(*) FROM dishes d
     WHERE d.is_parent AND d.dish_kind='configurable'
       AND (SELECT count(*) FROM option_groups g WHERE g.dish_id=d.id) > 1)
                                                    AS configurable_parents_with_extra_groups,
  (SELECT count(*) FROM dishes
     WHERE is_parent AND dish_kind NOT IN ('configurable','bundle'))
                                                    AS unexpected_parent_kinds;

-- ── STEP 5: delete folded children, then surface the converted parents ─────
-- Capture the converted parents first: bundle parents + configurable parents
-- that actually got a group. Childless-configurable parents are NOT here — they
-- stay is_parent=true (flagged for the operator), correctly kept out of the feed.
CREATE TEMP TABLE _p6_converted AS
SELECT id FROM dishes
WHERE is_parent
  AND (dish_kind = 'bundle' OR id IN (SELECT dish_id FROM _p6_new_groups));

-- Delete children FIRST (while parents are still is_parent=true — the flip below
-- would otherwise empty this set and strand the children).
DELETE FROM dishes
WHERE parent_dish_id IN (SELECT id FROM _p6_converted);

-- Flip the converted parents to normal dishes so generate_candidates (which
-- excludes is_parent=true) surfaces them immediately — no feed blackout in the
-- window between this conversion (158) and the column drop (159).
UPDATE dishes SET is_parent = false
WHERE id IN (SELECT id FROM _p6_converted);

-- D) Before vs after summary.
SELECT 'summary' AS audit, k AS metric, b.val AS before, a.val AS after
FROM (
  SELECT 'dishes' k, dishes val FROM _p6_before
  UNION ALL SELECT 'parents', parents FROM _p6_before
  UNION ALL SELECT 'variant_children', variant_children FROM _p6_before
  UNION ALL SELECT 'option_groups', option_groups FROM _p6_before
  UNION ALL SELECT 'options', options FROM _p6_before
) b
JOIN (
  SELECT 'dishes' k, (SELECT count(*) FROM dishes) val
  UNION ALL SELECT 'parents', (SELECT count(*) FROM dishes WHERE is_parent)
  UNION ALL SELECT 'variant_children', (SELECT count(*) FROM dishes WHERE parent_dish_id IS NOT NULL)
  UNION ALL SELECT 'option_groups', (SELECT count(*) FROM option_groups)
  UNION ALL SELECT 'options', (SELECT count(*) FROM options)
) a USING (k);

-- ===========================================================================
-- COMMIT FLAG  —  dry-run rolls back by default.
-- To APPLY: comment the ROLLBACK and uncomment the COMMIT (after promoting
-- this file to migrations/158_*.sql and auditing the output above).
-- ===========================================================================
ROLLBACK;
-- COMMIT;
