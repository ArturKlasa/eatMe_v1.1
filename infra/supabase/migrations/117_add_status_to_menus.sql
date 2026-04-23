-- 117_add_status_to_menus.sql
-- Created: 2026-04-23
--
-- Adds status lifecycle column to menus table.
-- DEFAULT 'published' keeps existing consumer behaviour intact.
-- Mirrors 116_add_status_to_restaurants.sql on the child table.
--
-- Part of v2 migration pack Phase 1 (runbook §3.2).
-- Reverse: 117_REVERSE_ONLY_add_status_to_menus.sql

BEGIN;

ALTER TABLE public.menus
  ADD COLUMN IF NOT EXISTS status text
    NOT NULL
    DEFAULT 'published'
    CHECK (status IN ('draft', 'published', 'archived'));

CREATE INDEX IF NOT EXISTS idx_menus_status
  ON public.menus (status);

COMMIT;
