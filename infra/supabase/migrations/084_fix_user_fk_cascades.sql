-- Migration 084: Add ON DELETE CASCADE to user-owned tables
--
-- Problem: Deleting a user from auth.users fails with FK constraint violation
-- because multiple tables have FK references to auth.users without ON DELETE
-- CASCADE. Discovered via user_streaks_user_id_fkey violation.
--
-- Fix: Re-create all user-data FKs with ON DELETE CASCADE so that deleting
-- a user automatically cleans up their rows.
--
-- Tables intentionally excluded (data should be preserved / handled separately):
--   admin_audit_log   — audit trail, keep for compliance
--   restaurants       — owner_id / suspended_by, handle via soft-delete
--   menu_scan_jobs    — created_by, audit trail

-- user_streaks (migration 079)
ALTER TABLE public.user_streaks
  DROP CONSTRAINT IF EXISTS user_streaks_user_id_fkey,
  ADD CONSTRAINT user_streaks_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- user_preferences (migration 081)
ALTER TABLE public.user_preferences
  DROP CONSTRAINT IF EXISTS user_preferences_user_id_fkey,
  ADD CONSTRAINT user_preferences_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- users (public profile table mirroring auth.users)
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_id_fkey,
  ADD CONSTRAINT users_id_fkey
    FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- dish_opinions
ALTER TABLE public.dish_opinions
  DROP CONSTRAINT IF EXISTS dish_opinions_user_id_fkey,
  ADD CONSTRAINT dish_opinions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- dish_photos
ALTER TABLE public.dish_photos
  DROP CONSTRAINT IF EXISTS dish_photos_user_id_fkey,
  ADD CONSTRAINT dish_photos_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- favorites
ALTER TABLE public.favorites
  DROP CONSTRAINT IF EXISTS favorites_user_id_fkey,
  ADD CONSTRAINT favorites_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- user_behavior_profiles
ALTER TABLE public.user_behavior_profiles
  DROP CONSTRAINT IF EXISTS user_behavior_profiles_user_id_fkey,
  ADD CONSTRAINT user_behavior_profiles_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- user_dish_interactions
ALTER TABLE public.user_dish_interactions
  DROP CONSTRAINT IF EXISTS user_dish_interactions_user_id_fkey,
  ADD CONSTRAINT user_dish_interactions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- user_points
ALTER TABLE public.user_points
  DROP CONSTRAINT IF EXISTS user_points_user_id_fkey,
  ADD CONSTRAINT user_points_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- user_sessions
ALTER TABLE public.user_sessions
  DROP CONSTRAINT IF EXISTS user_sessions_user_id_fkey,
  ADD CONSTRAINT user_sessions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- user_visits
ALTER TABLE public.user_visits
  DROP CONSTRAINT IF EXISTS user_visits_user_id_fkey,
  ADD CONSTRAINT user_visits_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- eat_together_members
ALTER TABLE public.eat_together_members
  DROP CONSTRAINT IF EXISTS eat_together_members_user_id_fkey,
  ADD CONSTRAINT eat_together_members_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- eat_together_sessions (host_id)
ALTER TABLE public.eat_together_sessions
  DROP CONSTRAINT IF EXISTS eat_together_sessions_host_id_fkey,
  ADD CONSTRAINT eat_together_sessions_host_id_fkey
    FOREIGN KEY (host_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- eat_together_votes
ALTER TABLE public.eat_together_votes
  DROP CONSTRAINT IF EXISTS eat_together_votes_user_id_fkey,
  ADD CONSTRAINT eat_together_votes_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- session_views
ALTER TABLE public.session_views
  DROP CONSTRAINT IF EXISTS session_views_user_id_fkey,
  ADD CONSTRAINT session_views_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- restaurant_experience_responses
ALTER TABLE public.restaurant_experience_responses
  DROP CONSTRAINT IF EXISTS restaurant_experience_responses_user_id_fkey,
  ADD CONSTRAINT restaurant_experience_responses_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
