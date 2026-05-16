-- 138_record_webhook_trigger_drop.sql
-- Created: 2026-05-16
--
-- Records the live drop of the WEBHOOK_SECRET trigger from public.dishes
-- that was executed on 2026-05-15 during Phase 1 of the IOPS rework.
--
-- Context (2026-05-15 incident):
--   The WEBHOOK_SECRET trigger (auto-created by Supabase Dashboard's
--   "Database Webhooks" UI at some prior point) fired enrich-dish on
--   every INSERT or UPDATE of dishes — including the writes that
--   enrich-dish itself made back to the dish row. This caused 3-5
--   recursive enrich-dish invocations per dish change and was the root
--   cause of the IOPS budget exhaustion.
--
--   The trigger was dropped live via SQL editor:
--     DROP TRIGGER "WEBHOOK_SECRET" ON public.dishes;
--
--   This migration records that drop idempotently so fresh-environment
--   applies don't recreate the trigger (which Supabase's webhook UI
--   doesn't auto-recreate anyway, but better safe than sorry).
--
-- The legitimate enrichment path remains intact:
--   trg_enrich_on_dish_change (recorded in migration 135) handles
--   INSERT and UPDATE OF name, description on dishes via
--   _trg_notify_enrich_dish().

BEGIN;

DROP TRIGGER IF EXISTS "WEBHOOK_SECRET" ON public.dishes;

COMMIT;
