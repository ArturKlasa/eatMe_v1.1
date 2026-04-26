-- 123_admin_storage_insert_bypass.sql
-- Created: 2026-04-24
--
-- Problem: 116a's INSERT policies on storage.objects only allow the restaurant
-- owner to upload. The admin app (apps/admin) uploads menu-scan pages for
-- restaurants the admin does not own — the existing policy denies this with
-- "new row violates row-level security policy".
--
-- Fix: add a second INSERT policy per v2 bucket that allows is_admin().
-- Postgres ORs permissive policies, so the existing owner-insert keeps working
-- for the owner app while admins gain parallel access. No DROP of the existing
-- policies — they remain the source of truth for owner-side uploads.
--
-- Select side is already admin-aware on menu-scan-uploads (116a includes
-- public.is_admin() in that policy). restaurant-photos / dish-photos are public
-- for SELECT, so read access needs no change.
--
-- Reverse: 123_REVERSE_ONLY_admin_storage_insert_bypass.sql

BEGIN;

CREATE POLICY "menu-scan-uploads: admin insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'menu-scan-uploads'
    AND public.is_admin()
  );

CREATE POLICY "restaurant-photos: admin insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'restaurant-photos'
    AND public.is_admin()
  );

CREATE POLICY "dish-photos: admin insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'dish-photos'
    AND public.is_admin()
  );

COMMIT;
