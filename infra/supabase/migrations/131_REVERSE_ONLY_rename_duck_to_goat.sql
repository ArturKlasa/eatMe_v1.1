-- 131_REVERSE_ONLY_rename_duck_to_goat.sql
-- Reverses 131_rename_duck_to_goat.sql at the schema level only.
--
-- IMPORTANT: rows that originally held primary_protein='duck' were rewritten
-- to 'other_meat' on forward migration. That mapping is lossy — running this
-- reverse will NOT restore those rows to 'duck'. Restore from a pre-migration
-- backup if the original duck classification matters.

BEGIN;

ALTER TABLE public.dishes
  DROP CONSTRAINT IF EXISTS dishes_primary_protein_check;

ALTER TABLE public.dishes
  ADD CONSTRAINT dishes_primary_protein_check
  CHECK (
    primary_protein IS NULL OR primary_protein IN (
      'chicken', 'beef', 'pork', 'lamb', 'duck', 'other_meat',
      'fish', 'shellfish', 'eggs',
      'vegetarian', 'vegan'
    )
  );

ALTER TABLE public.user_preferences
  DROP CONSTRAINT IF EXISTS user_preferences_primary_protein_check;

ALTER TABLE public.user_preferences
  ADD CONSTRAINT user_preferences_primary_protein_check
  CHECK (
    primary_protein IS NULL OR primary_protein IN (
      'chicken', 'beef', 'pork', 'lamb', 'duck', 'other_meat',
      'fish', 'shellfish', 'eggs',
      'vegetarian', 'vegan'
    )
  );

COMMIT;
