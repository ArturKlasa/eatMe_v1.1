-- Migration 083: Auto-create public.users and user_behavior_profiles on signup

-- ── public.users trigger function ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION create_user_profile_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'create_user_profile_on_signup error: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_profile_on_signup();

-- ── user_behavior_profiles trigger function ─────────────────────────────────
CREATE OR REPLACE FUNCTION create_behavior_profile_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_behavior_profiles (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'create_behavior_profile_on_signup error: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_behavior ON auth.users;
CREATE TRIGGER on_auth_user_created_behavior
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_behavior_profile_on_signup();

-- ── Backfill for existing users missing their rows ──────────────────────────
INSERT INTO public.users (id, email)
SELECT id, email FROM auth.users
WHERE id NOT IN (SELECT id FROM public.users)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_behavior_profiles (user_id)
SELECT id FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.user_behavior_profiles)
ON CONFLICT (user_id) DO NOTHING;
