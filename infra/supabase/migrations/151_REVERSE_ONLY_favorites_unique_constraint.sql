-- 151_REVERSE_ONLY_favorites_unique_constraint.sql
-- Reverse of 151_favorites_unique_constraint.sql.
--
-- Drops the unique constraint and restores the original non-unique lookup index.
-- NOTE: rows removed by the de-dupe step are NOT restored (that data loss is
-- intentional and irreversible). Run only after the app no longer relies on the
-- constraint for idempotent favoriting (i.e. ratingService no longer auto-adds and
-- addToFavorites is not depended on to no-op on duplicates).

BEGIN;

ALTER TABLE public.favorites
  DROP CONSTRAINT IF EXISTS favorites_user_subject_unique;

CREATE INDEX IF NOT EXISTS idx_favorites_user_subject
  ON public.favorites(user_id, subject_type);

COMMIT;
