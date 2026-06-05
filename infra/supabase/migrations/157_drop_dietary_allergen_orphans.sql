-- 157_drop_dietary_allergen_orphans.sql
-- Created: 2026-06-05
--
-- Cleanup follow-up to migrations 155/156 (docs/plans/abandon-allergens-dietary.md).
-- Two orphans surfaced when the regenerated types (post-156) were swept:
--
--   1. user_behavior_profiles.preferred_dietary_tags — a dietary-tag behavioral
--      signal. Migration 156 targeted user_preferences (where this column does
--      NOT exist, so the DROP IF EXISTS there was a no-op); the real column lives
--      on user_behavior_profiles. Zero code reads/writes it (the feed,
--      group-recommendations, and update-preference-vector edge functions use
--      other columns of this table — vectors, preferred_price_range, etc. — never
--      preferred_dietary_tags). Part of the abandoned dietary-tag system.
--
--   2. validate_allergen_codes(text[]) — orphan RPC from migration 093 that
--      validated codes against the public.allergens lookup table that migration
--      156 dropped. No callers anywhere. (It was listed in migration 155's drops
--      but evidently survived a manual apply of an earlier copy; this re-drop is
--      idempotent — a no-op if 155 already removed it.)
--
-- NOTE — intentionally NOT touched: eat_together_recommendations.dietary_compatibility
-- is an ACTIVE column (written by group-recommendations, read by mobile
-- eatTogetherService). It reflects the surviving diet_preference (vegetarian/
-- vegan) matching, not the abandoned dietary_tags vocabulary. Leave it.
--
-- Pre-apply checklist:
--   1. Migrations 155 + 156 applied.
--   2. After applying, regenerate types:
--        supabase gen types typescript --linked > packages/database/src/types.ts
--      (preferred_dietary_tags + validate_allergen_codes should then be gone.)
--
-- Reverse: 157_REVERSE_ONLY_drop_dietary_allergen_orphans.sql re-adds the column.
-- validate_allergen_codes is NOT restored — its body queries the public.allergens
-- table that migration 156 dropped, so it can no longer be recreated.

BEGIN;

ALTER TABLE public.user_behavior_profiles
  DROP COLUMN IF EXISTS preferred_dietary_tags;

DROP FUNCTION IF EXISTS public.validate_allergen_codes(text[]) CASCADE;

COMMIT;
