-- 133_REVERSE_ONLY_embed_recovery_cron.sql
-- Reverses 133_embed_recovery_cron.sql.
--
-- Unscheduling the cron and dropping the function removes the safety net for
-- stuck-pending dishes. Without this cron, transient failures in the live
-- trigger path will leave dishes silently broken until manually re-enriched.
-- Only roll back if Phase 2 is being abandoned entirely.

BEGIN;

SELECT cron.unschedule('embed-recovery-tick');

DROP FUNCTION IF EXISTS public._cron_embed_recovery_tick();

DROP INDEX IF EXISTS public.dishes_pending_embed_idx;

COMMIT;
