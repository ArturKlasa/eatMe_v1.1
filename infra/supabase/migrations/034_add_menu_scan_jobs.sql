-- Add Menu Scan Jobs table for AI-powered menu image extraction
-- Created: 2026-03-01
-- Description: Tracks AI menu scan jobs for audit trail and review workflow.
--              Images are stored in Supabase Storage bucket 'menu-scans'.

-- ============================================================================
-- TABLE: menu_scan_jobs
-- ============================================================================

CREATE TABLE IF NOT EXISTS menu_scan_jobs (
  id                    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id         UUID        NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  created_by            UUID        REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Source image metadata
  image_count           SMALLINT    NOT NULL DEFAULT 1,
  image_filenames       TEXT[]      DEFAULT ARRAY[]::TEXT[],     -- original filenames
  image_storage_paths   TEXT[]      DEFAULT ARRAY[]::TEXT[],     -- Supabase Storage paths

  -- Processing state machine
  status                TEXT        NOT NULL DEFAULT 'processing'
                        CHECK (status IN ('processing', 'needs_review', 'completed', 'failed')),

  -- AI output (merged + enriched JSON from all pages)
  result_json           JSONB,

  -- Error info (set when status = 'failed')
  error_message         TEXT,

  -- Stats
  dishes_found          INTEGER     DEFAULT 0,   -- extracted by AI
  dishes_saved          INTEGER     DEFAULT 0,   -- confirmed by admin
  processing_ms         INTEGER,                 -- end-to-end AI processing time

  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE menu_scan_jobs IS
  'AI menu scan jobs. Each job represents one or more photos of a restaurant menu '
  'that are processed by GPT-4o Vision to extract dish data for admin review.';

COMMENT ON COLUMN menu_scan_jobs.image_storage_paths IS
  'Paths in the menu-scans Supabase Storage bucket, format: {restaurant_id}/{job_id}/{n}_{filename}';

COMMENT ON COLUMN menu_scan_jobs.result_json IS
  'Merged, enriched extraction result. Schema: { currency, menus: [{ name, menu_type, '
  'categories: [{ name, dishes: [{ name, price, description, confidence, '
  'matched_ingredients, mapped_dietary_tags, ... }] }] }] }';

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS menu_scan_jobs_restaurant_idx  ON menu_scan_jobs(restaurant_id);
CREATE INDEX IF NOT EXISTS menu_scan_jobs_status_idx      ON menu_scan_jobs(status);
CREATE INDEX IF NOT EXISTS menu_scan_jobs_created_by_idx  ON menu_scan_jobs(created_by);
CREATE INDEX IF NOT EXISTS menu_scan_jobs_created_at_idx  ON menu_scan_jobs(created_at DESC);

-- ============================================================================
-- AUTO-UPDATE updated_at TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION update_menu_scan_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS menu_scan_jobs_updated_at ON menu_scan_jobs;

CREATE TRIGGER menu_scan_jobs_updated_at
  BEFORE UPDATE ON menu_scan_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_menu_scan_jobs_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE menu_scan_jobs ENABLE ROW LEVEL SECURITY;

-- Only admins (role = 'admin' in user_metadata) can access scan jobs.
-- The actual DB writes from the API route use the service role key (bypasses RLS),
-- but this policy protects any direct client access.
CREATE POLICY "Admins can manage menu scan jobs"
  ON menu_scan_jobs
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- ============================================================================
-- STORAGE BUCKET SETUP NOTE
-- ============================================================================
-- Run this in the Supabase Dashboard > Storage, OR via the Supabase CLI:
--
--   supabase storage buckets create menu-scans --private
--
-- Or via SQL (requires storage schema access):
--   INSERT INTO storage.buckets (id, name, public)
--   VALUES ('menu-scans', 'menu-scans', false)
--   ON CONFLICT (id) DO NOTHING;
--
-- The bucket should be private (non-public).
-- The API route uploads using the service role key, bypassing RLS.
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Created menu_scan_jobs table';
  RAISE NOTICE 'Next step: Create menu-scans Storage bucket';
  RAISE NOTICE 'See comment at bottom of this migration for instructions';
  RAISE NOTICE '========================================';
END $$;
