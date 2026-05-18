-- 140_extend_option_groups_and_options.sql
-- Created: 2026-05-17
--
-- Phase 1 of the dish-model rewrite (docs/plans/dish-model-rewrite-phase-1-database.md §1).
-- Pure-additive extensions to option_groups + options for the new modifier model,
-- plus a CHECK-constraint tightening that drops the unused 'quantity' selection_type.
--
-- option_groups:
--   - ADD display_in_card boolean DEFAULT false
--     Controls whether selected options from this group surface in the
--     feed-card dish-name suffix ("Pad Thai with chicken"). Defaults to
--     false because the hybrid display rule falls back to "options with
--     primary_protein set" (see docs/plans/dish-model-rewrite-phase-5-mobile.md §4).
--   - TIGHTEN selection_type CHECK from ('single','multiple','quantity')
--     to ('single','multiple'). Verified 2026-05-17: zero prod rows have
--     selection_type='quantity'; no rendering branches anywhere in admin /
--     mobile / edge code (the value was declared in Zod enums + TS types only).
--
-- options:
--   - ADD price_override numeric(10,2) NULL — absolute price for non-linear
--     pricing (e.g. "12 wings for $45"). When set, effective_price =
--     price_override; ignores base + delta.
--   - ADD primary_protein text NULL — when set, replaces the base dish
--     primary_protein. Used by feed scoring + variant selection.
--   - ADD adds_dietary_tags text[] DEFAULT '{}' — tags this option adds.
--   - ADD removes_dietary_tags text[] DEFAULT '{}' — tags this option
--     strips (e.g. chicken on a veg salad removes 'vegetarian','vegan').
--   - ADD adds_allergens text[] DEFAULT '{}' — allergens introduced by
--     this option (supplements canonical_ingredient_allergens lookup).
--   - ADD serves_delta int DEFAULT 0 — adjusts dish.serves when applied.
--   - ADD is_default boolean DEFAULT false — marks the standard option
--     in a required group.
--
-- All defaults are safe for existing rows: empty arrays / 0 / false /
-- NULL mean "no modifier behaviour", which matches pre-Phase-1 semantics.
--
-- Pre-apply checklist:
--   1. Existing feed RPC + mobile code reads option_groups and options
--      without the new columns. Adding columns is transparent to them.
--   2. After applying, regenerate types:
--        supabase gen types typescript --linked > packages/database/src/types.ts
--   3. Phase 3 (docs/plans/dish-model-rewrite-phase-3-shared.md) drops
--      'quantity' from the Zod enum + TS union type. Run this migration
--      before Phase 3 so the runtime CHECK rejects 'quantity' first.

BEGIN;

-- option_groups: display_in_card flag
ALTER TABLE public.option_groups
  ADD COLUMN IF NOT EXISTS display_in_card boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.option_groups.display_in_card IS
  'When true, applied options from this group surface in the feed-card dish-name suffix '
  '("Pad Thai with chicken"). When false, the group exists for menu-view rendering but '
  'does not contribute to the card descriptor. Worker / admin sets this; defaults to false '
  'because the hybrid display rule falls back to "options with primary_protein set" '
  '(see docs/plans/dish-model-rewrite-phase-5-mobile.md §4).';

-- option_groups: tighten selection_type CHECK to drop unused 'quantity'
ALTER TABLE public.option_groups
  DROP CONSTRAINT IF EXISTS option_groups_selection_type_check;

ALTER TABLE public.option_groups
  ADD CONSTRAINT option_groups_selection_type_check
  CHECK (selection_type IN ('single', 'multiple'));

-- options: new columns for modifier semantics
ALTER TABLE public.options
  ADD COLUMN IF NOT EXISTS price_override       numeric(10,2) NULL,
  ADD COLUMN IF NOT EXISTS primary_protein      text          NULL,
  ADD COLUMN IF NOT EXISTS adds_dietary_tags    text[]        NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS removes_dietary_tags text[]        NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS adds_allergens       text[]        NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS serves_delta         int           NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_default           boolean       NOT NULL DEFAULT false;

COMMENT ON COLUMN public.options.price_override IS
  'Absolute price for non-linear pricing (e.g. "12 wings for $45"). When set, effective_price = price_override; ignores base + delta.';
COMMENT ON COLUMN public.options.primary_protein IS
  'When set, applying this option replaces the base dish primary_protein. Used by feed scoring + variant selection.';
COMMENT ON COLUMN public.options.adds_dietary_tags IS
  'Dietary tags this option contributes to the dish when applied.';
COMMENT ON COLUMN public.options.removes_dietary_tags IS
  'Tags this option strips from the dish (e.g. chicken on a veg salad removes ["vegetarian","vegan"]).';
COMMENT ON COLUMN public.options.adds_allergens IS
  'Allergens introduced by this option (supplements canonical_ingredient_allergens lookup).';
COMMENT ON COLUMN public.options.serves_delta IS
  'Adjusts dish.serves when this option is applied (e.g. "family size" option +2).';
COMMENT ON COLUMN public.options.is_default IS
  'Marks the standard/cheapest option in a required group; used as the pre-selected baseline.';

COMMIT;
