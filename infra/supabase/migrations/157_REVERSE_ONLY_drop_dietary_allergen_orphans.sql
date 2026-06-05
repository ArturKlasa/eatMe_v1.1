-- 157_REVERSE_ONLY_drop_dietary_allergen_orphans.sql
-- Reverse of 157_drop_dietary_allergen_orphans.sql.
--
-- Restores user_behavior_profiles.preferred_dietary_tags (schema only; the
-- dropped data — empty/default arrays in practice — is not recoverable).
--
-- validate_allergen_codes is intentionally NOT recreated: its body queried the
-- public.allergens lookup table dropped by migration 156, so it cannot be
-- restored without first reversing 156.

BEGIN;

ALTER TABLE public.user_behavior_profiles
  ADD COLUMN IF NOT EXISTS preferred_dietary_tags text[] DEFAULT ARRAY[]::text[];

COMMIT;
