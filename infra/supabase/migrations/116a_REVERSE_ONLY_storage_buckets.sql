-- 116a_REVERSE_ONLY_storage_buckets.sql
-- Reverse migration for 116a_storage_buckets.sql
--
-- WARNING: Only run this if you are rolling back the v2 migration pack entirely.
-- Once the owner app or admin app has uploaded files to these buckets, reverting
-- drops the policies and removes the bucket rows — existing files in Storage
-- become inaccessible (policies gone) but are NOT deleted from object storage.
-- Inspect bucket contents before running: supabase storage ls <bucket>

BEGIN;

-- Drop policies (order does not matter; names are unique per table).
DROP POLICY IF EXISTS "menu-scan-uploads: owner insert"          ON storage.objects;
DROP POLICY IF EXISTS "menu-scan-uploads: owner or admin select" ON storage.objects;
DROP POLICY IF EXISTS "restaurant-photos: owner insert"          ON storage.objects;
DROP POLICY IF EXISTS "restaurant-photos: public select"         ON storage.objects;
DROP POLICY IF EXISTS "dish-photos: owner insert"                ON storage.objects;
DROP POLICY IF EXISTS "dish-photos: public select"               ON storage.objects;

-- Remove bucket rows only if empty (safe guard; fails loudly if files exist).
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id FROM storage.buckets
     WHERE id IN ('menu-scan-uploads', 'restaurant-photos', 'dish-photos')
  LOOP
    IF EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = r.id LIMIT 1) THEN
      RAISE EXCEPTION 'Bucket % is not empty — remove files before rolling back', r.id;
    END IF;
  END LOOP;
END$$;

DELETE FROM storage.buckets
WHERE id IN ('menu-scan-uploads', 'restaurant-photos', 'dish-photos');

COMMIT;
