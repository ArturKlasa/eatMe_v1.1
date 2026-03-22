-- 064_create_favorites_table.sql
-- Creates the favorites table for restaurant/dish bookmarking.
-- The table was defined in 001_initial_schema but never applied to the live DB.

-- subject_type enum (shared with reviews if it exists; create only if missing)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subject_type') THEN
    CREATE TYPE public.subject_type AS ENUM ('dish', 'restaurant');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_type public.subject_type NOT NULL,
  subject_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS favorites_user_id_idx
  ON public.favorites(user_id);

CREATE INDEX IF NOT EXISTS favorites_subject_idx
  ON public.favorites(subject_type, subject_id);

-- Each user can favourite an item only once
CREATE UNIQUE INDEX IF NOT EXISTS favorites_unique_user_subject_idx
  ON public.favorites(user_id, subject_type, subject_id);

-- RLS
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- Users can view their own favorites
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'favorites' AND policyname = 'Users can view their own favorites'
  ) THEN
    CREATE POLICY "Users can view their own favorites"
      ON public.favorites FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Users can create their own favorites
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'favorites' AND policyname = 'Users can create their own favorites'
  ) THEN
    CREATE POLICY "Users can create their own favorites"
      ON public.favorites FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Users can delete their own favorites
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'favorites' AND policyname = 'Users can delete their own favorites'
  ) THEN
    CREATE POLICY "Users can delete their own favorites"
      ON public.favorites FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;
