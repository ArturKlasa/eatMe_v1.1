-- 131_rename_duck_to_goat.sql
-- Created: 2026-05-04
--
-- Replace the 'duck' primary_protein value with 'goat' in the CHECK
-- constraints on dishes.primary_protein and user_preferences.primary_protein.
--
-- Existing 'duck' rows are reclassified to 'other_meat' (per product decision:
-- duck is rare enough to live under "other meat"; goat is more common in the
-- target cuisines we serve).
--
-- Goat is a mammal, so the derived protein_families collapses from
-- {meat, poultry} (duck) to {meat} (other_meat). protein_canonical_names
-- elements 'duck' are rewritten to 'other_meat' to keep arrays in sync with
-- the application-side deriveProteinFields() helper.

BEGIN;

-- ── 1. dishes: rewrite duck rows + swap CHECK constraint ──────────────────────

UPDATE public.dishes
SET
  primary_protein         = 'other_meat',
  protein_canonical_names = array_replace(
                              COALESCE(protein_canonical_names, '{}'),
                              'duck',
                              'other_meat'
                            ),
  protein_families        = array_remove(
                              COALESCE(protein_families, '{}'),
                              'poultry'
                            )
WHERE primary_protein = 'duck';

ALTER TABLE public.dishes
  DROP CONSTRAINT IF EXISTS dishes_primary_protein_check;

ALTER TABLE public.dishes
  ADD CONSTRAINT dishes_primary_protein_check
  CHECK (
    primary_protein IS NULL OR primary_protein IN (
      'chicken', 'beef', 'pork', 'lamb', 'goat', 'other_meat',
      'fish', 'shellfish', 'eggs',
      'vegetarian', 'vegan'
    )
  );

-- ── 2. user_preferences: rewrite duck rows + swap CHECK constraint ────────────

UPDATE public.user_preferences
SET primary_protein = 'other_meat'
WHERE primary_protein = 'duck';

ALTER TABLE public.user_preferences
  DROP CONSTRAINT IF EXISTS user_preferences_primary_protein_check;

ALTER TABLE public.user_preferences
  ADD CONSTRAINT user_preferences_primary_protein_check
  CHECK (
    primary_protein IS NULL OR primary_protein IN (
      'chicken', 'beef', 'pork', 'lamb', 'goat', 'other_meat',
      'fish', 'shellfish', 'eggs',
      'vegetarian', 'vegan'
    )
  );

COMMIT;
