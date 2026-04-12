-- Migration 082: Wire signup trigger for user_preferences
-- The function create_user_preferences_on_signup() was defined in 081 but
-- never bound to a trigger in migrations (it was set up via the dashboard).
-- This migration makes the binding explicit and reproducible.

-- Drop and recreate to ensure correct function is bound
DROP TRIGGER IF EXISTS on_auth_user_created_preferences ON auth.users;

CREATE TRIGGER on_auth_user_created_preferences
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_preferences_on_signup();
