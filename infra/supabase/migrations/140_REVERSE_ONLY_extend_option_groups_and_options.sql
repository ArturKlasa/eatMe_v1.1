-- 140_REVERSE_ONLY_extend_option_groups_and_options.sql
-- Reverses 140_extend_option_groups_and_options.sql.
--
-- WARNING: this reverse drops the seven new options columns and the
-- option_groups.display_in_card column. ALL DATA IN THESE COLUMNS IS LOST.
-- The CHECK-constraint reversal restores the 'quantity' selection_type value;
-- this is safe because no prod rows used it (verified 2026-05-17).
--
-- Only roll back if Phase 1 is being abandoned entirely. The columns dropped
-- here are pure-additive — nothing pre-existing depends on them.

BEGIN;

-- options: drop the seven new columns
ALTER TABLE public.options
  DROP COLUMN IF EXISTS is_default,
  DROP COLUMN IF EXISTS serves_delta,
  DROP COLUMN IF EXISTS adds_allergens,
  DROP COLUMN IF EXISTS removes_dietary_tags,
  DROP COLUMN IF EXISTS adds_dietary_tags,
  DROP COLUMN IF EXISTS primary_protein,
  DROP COLUMN IF EXISTS price_override;

-- option_groups: restore the original three-value selection_type CHECK
ALTER TABLE public.option_groups
  DROP CONSTRAINT IF EXISTS option_groups_selection_type_check;

ALTER TABLE public.option_groups
  ADD CONSTRAINT option_groups_selection_type_check
  CHECK (selection_type = ANY (ARRAY['single'::text, 'multiple'::text, 'quantity'::text]));

-- option_groups: drop display_in_card
ALTER TABLE public.option_groups
  DROP COLUMN IF EXISTS display_in_card;

COMMIT;
