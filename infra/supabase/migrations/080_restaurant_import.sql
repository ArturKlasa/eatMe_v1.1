-- Migration 080: Restaurant Import System
-- Created: 2026-04-10
-- Description:
--   1. Add google_place_id column to restaurants table
--   2. Create restaurant_import_jobs table
--   3. Create google_api_usage table

-- ============================================================================
-- SECTION 1: Add google_place_id to restaurants
-- ============================================================================

ALTER TABLE public.restaurants
  ADD COLUMN google_place_id text;

ALTER TABLE public.restaurants
  ADD CONSTRAINT restaurants_google_place_id_key UNIQUE (google_place_id);

CREATE INDEX idx_restaurants_google_place_id
  ON public.restaurants (google_place_id)
  WHERE google_place_id IS NOT NULL;

-- ============================================================================
-- SECTION 2: Restaurant import jobs table
-- ============================================================================

CREATE TABLE public.restaurant_import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES auth.users(id),
  admin_email text NOT NULL,
  source text NOT NULL CHECK (source IN ('google_places', 'csv')),
  status text NOT NULL DEFAULT 'completed'
    CHECK (status IN ('processing', 'completed', 'failed')),
  search_params jsonb,              -- { lat, lng, radius, maxPages } or { filename }
  total_fetched integer DEFAULT 0,
  total_inserted integer DEFAULT 0,
  total_skipped integer DEFAULT 0,
  total_flagged integer DEFAULT 0,
  errors jsonb DEFAULT '[]'::jsonb, -- [{ index, field, message }]
  restaurant_ids uuid[] DEFAULT '{}', -- IDs of inserted restaurants
  api_calls_used integer DEFAULT 0,
  estimated_cost_usd numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- RLS: only admins can read/write import jobs (accessed via service role in API routes)
ALTER TABLE public.restaurant_import_jobs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SECTION 3: Google API usage tracking
-- ============================================================================

CREATE TABLE public.google_api_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month text NOT NULL,              -- "2026-04" format
  api_calls integer DEFAULT 0,
  estimated_cost_usd numeric DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (month)
);

-- RLS: admin-only access (accessed via service role in API routes)
ALTER TABLE public.google_api_usage ENABLE ROW LEVEL SECURITY;

-- Note: Both tables are accessed exclusively through server-side API routes
-- using the service role key (supabase-server.ts), so no per-user RLS policies
-- are needed. RLS is enabled to prevent accidental anonymous/authenticated access.

-- ============================================================================
-- SUCCESS
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 080: Restaurant Import System applied';
  RAISE NOTICE '  - google_place_id column added to restaurants';
  RAISE NOTICE '  - UNIQUE constraint on google_place_id';
  RAISE NOTICE '  - Partial index idx_restaurants_google_place_id created';
  RAISE NOTICE '  - restaurant_import_jobs table created';
  RAISE NOTICE '  - google_api_usage table created';
  RAISE NOTICE '  - RLS enabled on both new tables';
  RAISE NOTICE '========================================';
END $$;
