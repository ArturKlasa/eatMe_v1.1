-- 151_favorites_unique_constraint.sql
-- Created: 2026-06-04
--
-- Enforce one favorite row per (user, subject) and de-duplicate existing rows.
--
-- Why: "Loved it" on a dish now auto-saves it to favorites
-- (ratingService.submitInContextRating + saveDishOpinions) — a SECOND writer
-- alongside the existing save heart (DishPhotoModal -> toggleFavorite).
-- favoritesService.addToFavorites already treats Postgres 23505 (unique_violation)
-- as "Already in favorites" and no-ops, but there was no unique constraint, so that
-- branch was dead code and duplicate inserts could create multiple rows for the same
-- dish. Duplicates then break favoritesService.isFavorited(), which uses .single()
-- and errors when more than one row matches.
--
-- This removes existing duplicates (keeping the earliest row) and adds the constraint
-- so the 23505 path is real and isFavorited() is safe.
--
-- The old non-unique idx_favorites_user_subject(user_id, subject_type) [migration 076]
-- becomes redundant: the new UNIQUE index has (user_id, subject_type) as a left-prefix
-- and serves the same lookups, so we drop it.

BEGIN;

-- 1. Delete duplicates, keeping the earliest created_at (tie-break on id).
DELETE FROM public.favorites a
USING public.favorites b
WHERE a.user_id = b.user_id
  AND a.subject_type = b.subject_type
  AND a.subject_id = b.subject_id
  AND (a.created_at > b.created_at
       OR (a.created_at = b.created_at AND a.id > b.id));

-- 2. Enforce uniqueness (makes addToFavorites' 23505 handling reliable).
ALTER TABLE public.favorites
  ADD CONSTRAINT favorites_user_subject_unique
  UNIQUE (user_id, subject_type, subject_id);

-- 3. Drop the now-redundant non-unique index (covered by the unique index prefix).
DROP INDEX IF EXISTS idx_favorites_user_subject;

COMMIT;
