-- 154_REVERSE_ONLY_favorites_unique_constraint.sql
-- Reverse of 154_favorites_unique_constraint.sql (originally shipped as 151).
--
-- Drops the unique constraint and restores the original non-unique lookup index.
-- NOTE: rows removed by the de-dupe step are NOT restored (intentional, irreversible).
-- Run only after the app no longer relies on the constraint for idempotent favoriting.

BEGIN;

ALTER TABLE public.favorites
  DROP CONSTRAINT IF EXISTS favorites_user_subject_unique;

CREATE INDEX IF NOT EXISTS idx_favorites_user_subject
  ON public.favorites(user_id, subject_type);

COMMIT;
