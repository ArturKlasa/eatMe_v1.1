-- Fix handle_new_user trigger for signup issues
-- Created: 2026-02-01
-- Description: Ensure trigger can bypass RLS and handle edge cases

-- ============================================================================
-- DROP AND RECREATE TRIGGER FUNCTION
-- ============================================================================

DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER -- Run with definer's privileges, bypassing RLS
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Insert into public.users table
  INSERT INTO public.users (
    id,
    email,
    full_name,
    profile_name,
    roles,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'profile_name', ''),
    CASE 
      WHEN NEW.raw_user_meta_data->>'restaurant_name' IS NOT NULL THEN ARRAY['restaurant_owner']::user_roles[]
      ELSE ARRAY['consumer']::user_roles[]
    END,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = NOW();

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail signup
    RAISE WARNING 'handle_new_user error: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- GRANT NECESSARY PERMISSIONS
-- ============================================================================

-- Ensure function can execute
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, authenticated, anon;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
DO $$ 
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Fixed handle_new_user trigger';
  RAISE NOTICE 'Added SECURITY DEFINER to bypass RLS';
  RAISE NOTICE 'Added error handling to prevent signup failures';
  RAISE NOTICE '========================================';
END $$;
