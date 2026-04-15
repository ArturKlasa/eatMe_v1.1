-- 094_dish_scoped_option_groups.sql
-- Locks option_groups to a dish-only scope, matching actual code behaviour.
--
-- Current state: the table has nullable `dish_id` and `menu_category_id`
-- supporting three scopes (dish / category / restaurant-wide) but only
-- dish-scoped rows are ever written or read. See
-- .agents/research/shared-option-groups-analysis.md — per-dish duplication
-- with an admin "copy to other dishes" tool is the accepted model.
--
-- This migration:
--   1. Drops any option_groups row that would fail the new NOT NULL
--      on dish_id (moves them aside first into an _orphan_option_groups table
--      for safety rather than losing data outright).
--   2. Drops the menu_category_id column and its FK.
--   3. Makes dish_id NOT NULL with a CHECK constraint for belt-and-braces.

-- ---------------------------------------------------------------------------
-- 1. Quarantine any orphan rows (dish_id IS NULL) for operator review.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public._orphan_option_groups_094 AS
  SELECT *, now() AS quarantined_at
  FROM public.option_groups
  WHERE dish_id IS NULL;

COMMENT ON TABLE public._orphan_option_groups_094 IS
  'Snapshot of option_groups rows with NULL dish_id taken by migration 094. '
  'Review and manually re-attach to specific dishes if needed; safe to drop once audited.';

DELETE FROM public.option_groups WHERE dish_id IS NULL;

-- ---------------------------------------------------------------------------
-- 2. Drop menu_category_id column (and implicit FK).
-- ---------------------------------------------------------------------------
ALTER TABLE public.option_groups
  DROP COLUMN IF EXISTS menu_category_id;

-- ---------------------------------------------------------------------------
-- 3. Enforce dish-scoped invariant.
-- ---------------------------------------------------------------------------
ALTER TABLE public.option_groups
  ALTER COLUMN dish_id SET NOT NULL;

-- Restaurant_id is already NOT NULL; assert dish→restaurant consistency so
-- the RLS policy in migration 091 keyed on restaurant_id stays accurate even
-- if a buggy caller ever inserts mismatched rows.
ALTER TABLE public.option_groups
  DROP CONSTRAINT IF EXISTS option_groups_dish_restaurant_match;

ALTER TABLE public.option_groups
  ADD CONSTRAINT option_groups_dish_restaurant_match
  CHECK (
    restaurant_id IS NOT NULL AND dish_id IS NOT NULL
  ) NOT VALID;

-- Run validation separately so an existing row that happens to violate the
-- NOT NULL assertion fails loudly rather than blocking the migration.
ALTER TABLE public.option_groups
  VALIDATE CONSTRAINT option_groups_dish_restaurant_match;
