-- 116_add_status_to_restaurants.sql
-- Created: 2026-04-23
--
-- Adds status lifecycle column to restaurants table.
-- DEFAULT 'published' preserves existing consumer behaviour: every current row
-- becomes 'published' transparently. Pre-Phase-4 mobile/Edge queries remain
-- unchanged. Phase 4 (migration 123) tightens RLS to USING (status='published').
--
-- Part of v2 migration pack Phase 1 (runbook §3.2). Apply before Step 6b (menus).
-- Reverse: 116_REVERSE_ONLY_add_status_to_restaurants.sql

BEGIN;

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS status text
    NOT NULL
    DEFAULT 'published'
    CHECK (status IN ('draft', 'published', 'archived'));

CREATE INDEX IF NOT EXISTS idx_restaurants_status
  ON public.restaurants (status);

COMMIT;
