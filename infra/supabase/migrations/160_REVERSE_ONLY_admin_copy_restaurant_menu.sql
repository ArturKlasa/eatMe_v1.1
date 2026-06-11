-- 160_REVERSE_ONLY_admin_copy_restaurant_menu.sql
-- Reverse of 160_admin_copy_restaurant_menu.sql. Apply ONLY to roll 160 back.
--
-- Drops the copy function (it did not exist before 160). Data copied by the
-- function is NOT reversed — copied menus/dishes are normal rows owned by the
-- target restaurant; remove them via the standard admin delete flows if a
-- copy needs undoing.

BEGIN;

DROP FUNCTION IF EXISTS public.admin_copy_restaurant_menu(uuid, uuid);

COMMIT;
