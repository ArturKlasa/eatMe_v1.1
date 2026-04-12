-- Migration 086: Preserve UGC on user deletion (opinions, photos, experience responses)
--
-- Migration 084 set ON DELETE CASCADE on dish_opinions.user_id,
-- dish_photos.user_id, and restaurant_experience_responses.user_id.
-- Deleting these rows is wrong for a food platform:
--
--   dish_opinions              → feeds dish_ratings_summary (like %, tags, notes)
--   dish_photos                → public content visible to all users
--   restaurant_experience_responses → feeds restaurant_ratings_summary
--                                     (service, cleanliness, value, wait-time %)
--
-- Fix: Change to ON DELETE SET NULL (anonymise, don't delete).
-- Requires making user_id nullable first on all three tables.
-- Rows with user_id = NULL are treated as anonymous contributions.

-- ── dish_opinions ──────────────────────────────────────────────────────────

ALTER TABLE public.dish_opinions
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.dish_opinions
  DROP CONSTRAINT IF EXISTS dish_opinions_user_id_fkey,
  ADD CONSTRAINT dish_opinions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ── dish_photos ────────────────────────────────────────────────────────────

ALTER TABLE public.dish_photos
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.dish_photos
  DROP CONSTRAINT IF EXISTS dish_photos_user_id_fkey,
  ADD CONSTRAINT dish_photos_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ── restaurant_experience_responses ────────────────────────────────────────

ALTER TABLE public.restaurant_experience_responses
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.restaurant_experience_responses
  DROP CONSTRAINT IF EXISTS restaurant_experience_responses_user_id_fkey,
  ADD CONSTRAINT restaurant_experience_responses_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
