-- 144_REVERSE_ONLY_admin_menu_scan_and_modifier_rpcs.sql
-- Reverses 144_admin_menu_scan_and_modifier_rpcs.sql by dropping both RPCs.
--
-- WARNING: rolling back requires switching the admin app back to its prior
-- inline multi-pass insert flow (commit immediately prior to Phase 4.2).
-- Otherwise the admin confirm action will fail with "function does not exist".

BEGIN;

DROP FUNCTION IF EXISTS public.admin_replace_dish_modifiers(uuid, jsonb);
DROP FUNCTION IF EXISTS public.admin_confirm_menu_scan(uuid, uuid, text, jsonb);

COMMIT;
