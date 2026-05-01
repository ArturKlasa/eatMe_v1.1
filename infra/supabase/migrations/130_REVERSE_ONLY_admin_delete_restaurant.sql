-- 130_REVERSE_ONLY_admin_delete_restaurant.sql
-- Reverse migration for 130_admin_delete_restaurant.sql

BEGIN;

DROP FUNCTION IF EXISTS public.admin_delete_restaurant(uuid);

COMMIT;
