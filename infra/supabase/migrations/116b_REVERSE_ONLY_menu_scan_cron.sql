-- 116b_REVERSE_ONLY_menu_scan_cron.sql
-- Reverse migration: removes the cron schedule.
-- Does NOT drop pg_cron / pg_net extensions (may be used by other jobs).

BEGIN;

SELECT cron.unschedule('menu-scan-worker-tick');

COMMIT;
