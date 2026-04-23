-- 116a_storage_buckets.sql
-- Created: 2026-04-23
--
-- Closes the gap where storage buckets were dashboard-toggled, not migration-tracked.
-- Adds three buckets required by v2 plus owner-scoped RLS policies on storage.objects.
--
-- Buckets:
--   menu-scan-uploads  (private=false) — worker reads, owner writes; scan images stay private
--   restaurant-photos  (public=true)   — mobile app renders via next/image + remotePatterns
--   dish-photos        (public=true)   — same
--
-- Path convention: <restaurant_id>/<anything>
--   The first path segment must be the uuid of a restaurant owned by the caller.
--   E.g.  menu-scan-uploads/a1b2c3d4-.../scan-page-1.jpg

BEGIN;

-- ── Buckets ───────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('menu-scan-uploads', 'menu-scan-uploads', false),
  ('restaurant-photos',  'restaurant-photos',  true),
  ('dish-photos',        'dish-photos',        true)
ON CONFLICT (id) DO NOTHING;

-- ── RLS policies on storage.objects ──────────────────────────────────────────
--
-- Owner-path check pattern used throughout:
--   EXISTS (SELECT 1 FROM public.restaurants
--           WHERE id::text = split_part(name, '/', 1)
--             AND owner_id = auth.uid())
--
-- Using id::text = split_part(...) avoids a failed ::uuid cast when the first
-- segment is not a valid UUID (which would raise an error; denying is safer but
-- an error is worse). The text equality is safe — Postgres casts id to text for
-- the comparison without attempting a reverse parse.

-- ── menu-scan-uploads ────────────────────────────────────────────────────────

CREATE POLICY "menu-scan-uploads: owner insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'menu-scan-uploads'
    AND EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE id::text = split_part(name, '/', 1)
        AND owner_id = auth.uid()
    )
  );

CREATE POLICY "menu-scan-uploads: owner or admin select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'menu-scan-uploads'
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.restaurants
        WHERE id::text = split_part(name, '/', 1)
          AND owner_id = auth.uid()
      )
    )
  );

-- ── restaurant-photos ─────────────────────────────────────────────────────────

CREATE POLICY "restaurant-photos: owner insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'restaurant-photos'
    AND EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE id::text = split_part(name, '/', 1)
        AND owner_id = auth.uid()
    )
  );

-- Public bucket: anon + authenticated can read (powers mobile next/image display).
CREATE POLICY "restaurant-photos: public select"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'restaurant-photos');

-- ── dish-photos ───────────────────────────────────────────────────────────────

CREATE POLICY "dish-photos: owner insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'dish-photos'
    AND EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE id::text = split_part(name, '/', 1)
        AND owner_id = auth.uid()
    )
  );

-- Public bucket: anon + authenticated can read.
CREATE POLICY "dish-photos: public select"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'dish-photos');

COMMIT;
