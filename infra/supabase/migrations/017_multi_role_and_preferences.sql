-- Multi-Role User System + User Preferences
-- Created: 2026-01-31
-- Description: Add role system and preferences without breaking existing data

-- ============================================================================
-- STEP 1: ADD ROLE SUPPORT TO EXISTING USERS TABLE
-- ============================================================================

-- Create roles enum if it doesn't exist
DO $$ BEGIN
  CREATE TYPE user_roles AS ENUM ('consumer', 'restaurant_owner', 'admin');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add roles column to existing users table (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'roles'
  ) THEN
    ALTER TABLE public.users ADD COLUMN roles user_roles[] DEFAULT ARRAY['consumer']::user_roles[];
    RAISE NOTICE 'Added roles column to users table';
  END IF;
END $$;

-- Add profile_name column (for mobile app, 3-12 chars)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'profile_name'
  ) THEN
    ALTER TABLE public.users ADD COLUMN profile_name TEXT;
    RAISE NOTICE 'Added profile_name column to users table';
  END IF;
END $$;

-- Update existing restaurant owners to have restaurant_owner role
DO $$ 
BEGIN
  UPDATE public.users
  SET roles = ARRAY['restaurant_owner']::user_roles[]
  WHERE id IN (SELECT DISTINCT owner_id FROM public.restaurants);
  
  RAISE NOTICE 'Updated existing restaurant owners with restaurant_owner role';
END $$;

-- ============================================================================
-- STEP 2: CREATE USER PREFERENCES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Dietary preferences (permanent filters from mobile app)
  diet_preference TEXT DEFAULT 'all' CHECK (diet_preference IN ('all', 'vegetarian', 'vegan')),
  
  -- Allergies (stored as JSONB for flexibility)
  allergies JSONB DEFAULT '{
    "lactose": false,
    "gluten": false,
    "peanuts": false,
    "soy": false,
    "sesame": false,
    "shellfish": false,
    "nuts": false
  }'::jsonb,
  
  -- Exclusions
  exclude JSONB DEFAULT '{
    "noMeat": false,
    "noFish": false,
    "noSeafood": false,
    "noEggs": false,
    "noDairy": false,
    "noSpicy": false
  }'::jsonb,
  
  -- Diet types
  diet_types JSONB DEFAULT '{
    "diabetic": false,
    "keto": false,
    "paleo": false,
    "lowCarb": false,
    "pescatarian": false
  }'::jsonb,
  
  -- Religious restrictions
  religious_restrictions JSONB DEFAULT '{
    "halal": false,
    "hindu": false,
    "kosher": false,
    "jain": false,
    "buddhist": false
  }'::jsonb,
  
  -- Default settings
  default_price_range JSONB DEFAULT '{"min": 1, "max": 4}'::jsonb,
  default_max_distance INTEGER DEFAULT 5,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS user_preferences_user_id_idx ON public.user_preferences(user_id);

-- Enable RLS
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own preferences"
  ON public.user_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON public.user_preferences
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON public.user_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Auto-update timestamp trigger
DROP TRIGGER IF EXISTS set_updated_at_preferences ON public.user_preferences;
CREATE TRIGGER set_updated_at_preferences
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- STEP 3: CREATE USER DISH INTERACTIONS TABLE (for ML recommendations)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_dish_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dish_id UUID NOT NULL REFERENCES public.dishes(id) ON DELETE CASCADE,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('viewed', 'liked', 'disliked', 'ordered', 'saved')),
  session_id TEXT, -- To track swipe sessions
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS user_dish_interactions_user_id_idx ON public.user_dish_interactions(user_id);
CREATE INDEX IF NOT EXISTS user_dish_interactions_dish_id_idx ON public.user_dish_interactions(dish_id);
CREATE INDEX IF NOT EXISTS user_dish_interactions_type_idx ON public.user_dish_interactions(interaction_type);
CREATE INDEX IF NOT EXISTS user_dish_interactions_created_at_idx ON public.user_dish_interactions(created_at DESC);

-- Composite index for user + interaction type queries
CREATE INDEX IF NOT EXISTS user_dish_interactions_user_type_idx 
  ON public.user_dish_interactions(user_id, interaction_type);

-- Enable RLS
ALTER TABLE public.user_dish_interactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own interactions"
  ON public.user_dish_interactions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own interactions"
  ON public.user_dish_interactions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- No UPDATE or DELETE - interactions are immutable for analytics

-- ============================================================================
-- STEP 4: UPDATE TRIGGER TO HANDLE PROFILE_NAME
-- ============================================================================

-- Update the existing handle_new_user function to support profile_name
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, profile_name, roles)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'restaurant_name',
      NEW.email
    ),
    NEW.raw_user_meta_data->>'profile_name', -- For mobile app users
    CASE 
      WHEN NEW.raw_user_meta_data->>'restaurant_name' IS NOT NULL 
        THEN ARRAY['restaurant_owner']::user_roles[]
      ELSE ARRAY['consumer']::user_roles[]
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 5: HELPER FUNCTIONS
-- ============================================================================

-- Function to add a role to a user
CREATE OR REPLACE FUNCTION public.add_user_role(p_user_id UUID, p_role user_roles)
RETURNS VOID AS $$
BEGIN
  UPDATE public.users
  SET roles = array_append(roles, p_role)
  WHERE id = p_user_id
    AND NOT (roles @> ARRAY[p_role]); -- Only add if not already present
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has a specific role
CREATE OR REPLACE FUNCTION public.user_has_role(p_user_id UUID, p_role user_roles)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_user_id
      AND roles @> ARRAY[p_role]
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
DO $$ 
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Multi-role system created successfully!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Changes made:';
  RAISE NOTICE '  ✓ Added roles column to users table';
  RAISE NOTICE '  ✓ Added profile_name column for mobile users';
  RAISE NOTICE '  ✓ Created user_preferences table';
  RAISE NOTICE '  ✓ Created user_dish_interactions table';
  RAISE NOTICE '  ✓ Updated existing restaurant owners with role';
  RAISE NOTICE '  ✓ Added helper functions for role management';
  RAISE NOTICE '';
  RAISE NOTICE 'Now users can:';
  RAISE NOTICE '  - Be both consumer AND restaurant_owner';
  RAISE NOTICE '  - Use same email for web portal and mobile app';
  RAISE NOTICE '  - Have separate profile_name for mobile';
  RAISE NOTICE '  - Save preferences and track interactions';
  RAISE NOTICE '========================================';
END $$;
