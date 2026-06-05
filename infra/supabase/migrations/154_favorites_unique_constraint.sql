-- 154_favorites_unique_constraint.sql
-- Created: 2026-06-04
--
-- Renumbered from 151 -> 154: the original 151_favorites_unique_constraint.sql
-- collided with the ingredient-pipeline's 151_retire_ingredient_triggers.sql
-- (151/152/153 all belong to that pipeline). This migration is favorites-only and
-- sequences after it. Made IDEMPOTENT because the original 151 file was already
-- applied to prod by hand — re-running this renamed copy must be a safe no-op.
--
-- Enforce one favorite row per (user, subject) and de-duplicate existing rows.
--
-- Why: "Loved it" on a dish auto-saves it to favorites (ratingService) — a SECOND
-- writer alongside the save heart (DishPhotoModal -> toggleFavorite).
-- favoritesService.addToFavorites treats Postgres 23505 (unique_violation) as
-- "Already in favorites" and no-ops, but without a unique constraint that branch
-- was dead code and duplicate inserts could create multiple rows for the same
-- dish, which breaks favoritesService.isFavorited() (.single() errors on >1 row).

BEGIN;

-- 1. Delete duplicates, keeping the earliest created_at (tie-break on id).
DELETE FROM public.favorites a
USING public.favorites b
WHERE a.user_id = b.user_id
  AND a.subject_type = b.subject_type
  AND a.subject_id = b.subject_id
  AND (a.created_at > b.created_at
       OR (a.created_at = b.created_at AND a.id > b.id));

-- 2. Enforce uniqueness. Idempotent: skip if the constraint already exists
--    (it does on prod, applied via the original 151 file).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'favorites_user_subject_unique'
  ) THEN
    ALTER TABLE public.favorites
      ADD CONSTRAINT favorites_user_subject_unique
      UNIQUE (user_id, subject_type, subject_id);
  END IF;
END $$;

-- 3. Drop the now-redundant non-unique index (covered by the unique index prefix).
DROP INDEX IF EXISTS idx_favorites_user_subject;

COMMIT;
