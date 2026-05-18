-- 141a_REVERSE_ONLY_app_config.sql
-- Reverses 141a_app_config.sql.
--
-- WARNING: drops the app_config table and its seed row. The seed values are
-- placeholders ('0.0.0', TBD URLs), so no production data is at risk before
-- the first real release. Only roll back if Phase 1 is being abandoned.
--
-- Roll-forward path: if the table is needed again, re-run 141a_app_config.sql.

BEGIN;

DROP POLICY IF EXISTS app_config_read_all ON public.app_config;
DROP TABLE IF EXISTS public.app_config;

COMMIT;
