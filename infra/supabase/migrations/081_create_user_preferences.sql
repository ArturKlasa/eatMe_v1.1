-- Migration 081: Create user_preferences table
-- Created: 2026-04-11
-- Description:
--   The user_preferences table was defined in the original schema but never
--   applied to the live database. This causes a 500 "Database error saving
--   new user" on signup because the auth trigger inserts into user_preferences.

CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id uuid NOT NULL,
  diet_preference text DEFAULT 'all' CHECK (diet_preference = ANY (ARRAY['all', 'vegetarian', 'vegan'])),
  default_max_distance integer DEFAULT 5,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  protein_preferences jsonb DEFAULT '[]',
  favorite_cuisines jsonb DEFAULT '[]',
  favorite_dishes jsonb DEFAULT '[]',
  spice_tolerance text DEFAULT 'none' CHECK (spice_tolerance = ANY (ARRAY['none', 'mild', 'hot'])),
  service_preferences jsonb DEFAULT '{"dine_in": true, "takeout": true, "delivery": true}',
  meal_times jsonb DEFAULT '[]',
  onboarding_completed boolean DEFAULT false,
  onboarding_completed_at timestamptz,
  ingredients_to_avoid jsonb NOT NULL DEFAULT '[]',
  allergies text[] DEFAULT '{}',
  exclude text[] DEFAULT '{}',
  diet_types text[] DEFAULT '{}',
  religious_restrictions text[] DEFAULT '{}',
  CONSTRAINT user_preferences_pkey PRIMARY KEY (user_id),
  CONSTRAINT user_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own preferences" ON public.user_preferences;
CREATE POLICY "Users can read own preferences"
  ON public.user_preferences FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own preferences" ON public.user_preferences;
CREATE POLICY "Users can insert own preferences"
  ON public.user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own preferences" ON public.user_preferences;
CREATE POLICY "Users can update own preferences"
  ON public.user_preferences FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role (used by the auth trigger) bypasses RLS automatically.

-- Fix the signup trigger: it referenced "user_preferences" without the
-- public schema prefix, so PostgreSQL couldn't find it from auth context.
CREATE OR REPLACE FUNCTION create_user_preferences_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'create_user_preferences_on_signup error: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 081: user_preferences table created';
  RAISE NOTICE '  - Fixes 500 on new user signup';
  RAISE NOTICE '  - RLS enabled with per-user policies';
  RAISE NOTICE '  - Fixed schema prefix in signup trigger';
  RAISE NOTICE '========================================';
END $$;
