-- 120_REVERSE_ONLY_publish_restaurant_draft.sql
-- Reverse migration for 120_publish_restaurant_draft.sql
--
-- Safe to run while no v2 app has invoked publish_restaurant_draft.
-- One-way at first owner-app invocation in Step 18.

BEGIN;

DROP FUNCTION IF EXISTS public.publish_restaurant_draft(uuid);

COMMIT;
