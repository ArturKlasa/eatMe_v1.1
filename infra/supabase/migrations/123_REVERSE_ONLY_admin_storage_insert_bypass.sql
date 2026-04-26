-- 123_REVERSE_ONLY_admin_storage_insert_bypass.sql
-- Reverse migration for 123_admin_storage_insert_bypass.sql
--
-- WARNING: After running this, the admin app can no longer upload to the v2
-- storage buckets. Only run if you are rolling back the admin-bypass policies.

BEGIN;

DROP POLICY IF EXISTS "menu-scan-uploads: admin insert"  ON storage.objects;
DROP POLICY IF EXISTS "restaurant-photos: admin insert"  ON storage.objects;
DROP POLICY IF EXISTS "dish-photos: admin insert"        ON storage.objects;

COMMIT;
