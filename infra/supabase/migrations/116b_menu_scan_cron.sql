-- 116b_menu_scan_cron.sql
-- Created: 2026-04-23
--
-- Schedules the menu-scan-worker Edge Function via pg_cron + pg_net.
-- Ticks every minute. Uses vault secrets for project URL and service-role key
-- (set via Supabase Dashboard → Settings → Vault before running this migration).
--
-- PREREQUISITE: vault secrets 'project_url' and 'service_role_key' must exist.
--   INSERT INTO vault.secrets (name, secret) VALUES ('project_url', 'https://<ref>.supabase.co');
--   INSERT INTO vault.secrets (name, secret) VALUES ('service_role_key', '<key>');
--
-- Reverse: 116b_REVERSE_ONLY_menu_scan_cron.sql
--
-- Numbered 116b: fits between 116a (storage buckets) and 116 (restaurants status).
-- Can be torn down independently without affecting storage or status columns.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'menu-scan-worker-tick',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
           || '/functions/v1/menu-scan-worker',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 145000
  );
  $$
);

COMMIT;
