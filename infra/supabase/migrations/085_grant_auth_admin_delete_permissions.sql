-- Migration 085: Grant table permissions to supabase_auth_admin for user deletion
--
-- When Supabase deletes a user via the Auth API, it runs as supabase_auth_admin.
-- Postgres FK actions require specific permissions on child tables:
--   ON DELETE CASCADE  → needs DELETE on the child table
--   ON DELETE SET NULL → needs UPDATE on the child table
--   FK constraint check (reference validation) → needs SELECT on the referenced table

-- ── Reference tables: SELECT needed for FK constraint validation ────────────
GRANT SELECT ON public.dishes                        TO supabase_auth_admin;
GRANT SELECT ON public.restaurants                   TO supabase_auth_admin;
GRANT SELECT ON public.menu_categories               TO supabase_auth_admin;
GRANT SELECT ON public.dish_categories               TO supabase_auth_admin;
GRANT SELECT ON public.user_sessions                 TO supabase_auth_admin;
GRANT SELECT ON public.user_visits                   TO supabase_auth_admin;

-- ── SET NULL tables (migration 086): need UPDATE to null the user_id column ─
GRANT SELECT, UPDATE ON public.dish_opinions         TO supabase_auth_admin;
GRANT SELECT, UPDATE ON public.dish_photos           TO supabase_auth_admin;
GRANT SELECT, UPDATE ON public.restaurant_experience_responses TO supabase_auth_admin;

-- ── CASCADE DELETE tables: need DELETE ─────────────────────────────────────
GRANT SELECT, DELETE ON public.user_visits           TO supabase_auth_admin;
GRANT SELECT, DELETE ON public.user_dish_interactions TO supabase_auth_admin;
GRANT SELECT, DELETE ON public.user_behavior_profiles TO supabase_auth_admin;
GRANT SELECT, DELETE ON public.user_points           TO supabase_auth_admin;
GRANT SELECT, DELETE ON public.user_sessions         TO supabase_auth_admin;
GRANT SELECT, DELETE ON public.user_streaks          TO supabase_auth_admin;
GRANT SELECT, DELETE ON public.user_preferences      TO supabase_auth_admin;
GRANT SELECT, DELETE ON public.user_badges           TO supabase_auth_admin;
GRANT SELECT, DELETE ON public.favorites             TO supabase_auth_admin;
GRANT SELECT, DELETE ON public.eat_together_members  TO supabase_auth_admin;
GRANT SELECT, DELETE ON public.eat_together_sessions TO supabase_auth_admin;
GRANT SELECT, DELETE ON public.eat_together_votes    TO supabase_auth_admin;
GRANT SELECT, DELETE ON public.session_views         TO supabase_auth_admin;
GRANT SELECT, DELETE ON public.users                 TO supabase_auth_admin;
