-- Migration: Add dish_photos table for user-submitted dish photos
-- Created: 2026-02-02

-- Create dish_photos table
CREATE TABLE IF NOT EXISTS public.dish_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dish_id UUID NOT NULL REFERENCES public.dishes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_dish_photos_dish_id ON public.dish_photos(dish_id);
CREATE INDEX IF NOT EXISTS idx_dish_photos_user_id ON public.dish_photos(user_id);
CREATE INDEX IF NOT EXISTS idx_dish_photos_created_at ON public.dish_photos(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.dish_photos ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Anyone can view dish photos
CREATE POLICY "Anyone can view dish photos"
  ON public.dish_photos
  FOR SELECT
  USING (true);

-- Authenticated users can insert their own photos
CREATE POLICY "Users can insert their own dish photos"
  ON public.dish_photos
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own photos
CREATE POLICY "Users can update their own dish photos"
  ON public.dish_photos
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own photos
CREATE POLICY "Users can delete their own dish photos"
  ON public.dish_photos
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_dish_photos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_dish_photos_updated_at
  BEFORE UPDATE ON public.dish_photos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_dish_photos_updated_at();

-- Add comment
COMMENT ON TABLE public.dish_photos IS 'User-submitted photos of dishes from restaurants';
