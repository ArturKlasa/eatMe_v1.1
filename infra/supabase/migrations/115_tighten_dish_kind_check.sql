-- 115_tighten_dish_kind_check.sql
-- Created: 2026-04-22
--
-- Tightens the dish_kind CHECK constraint to the 5 canonical values once triage
-- has completed in production.
--
-- Requires all legacy `dish_kind` values to be triaged. Do NOT run before that is complete.
--
-- Operational sequence:
--   1. Deploy migrations 114 + Steps 1-17 to production.
--   2. Admin runs /admin/dishes/experience-triage to classify all 'experience' rows.
--   3. Once zero legacy rows remain, run this migration (manual supabase db push).
--   4. Step 18's narrow DishKind type is safe to ship after this migration runs.
--
-- Legacy values removed by this migration: template, experience, combo
-- Canonical values after this migration: standard, bundle, configurable, course_menu, buffet
--
-- NOTE: This migration is NOT idempotent if legacy rows still exist — the guard
-- will refuse to run and the transaction will roll back automatically.

BEGIN;

-- Guard: refuse to run if any dish rows still carry legacy kind values.
-- This prevents data corruption if the admin triage page has not been completed.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM dishes
    WHERE dish_kind NOT IN ('standard','bundle','configurable','course_menu','buffet');
  IF n > 0 THEN RAISE EXCEPTION 'Refusing to tighten CHECK: % rows still in legacy kinds', n;
  END IF;
END$$;

-- Replace the relaxed 8-value CHECK (migration 114) with the tightened 5-value CHECK.
ALTER TABLE public.dishes DROP CONSTRAINT IF EXISTS dishes_dish_kind_check;
ALTER TABLE public.dishes ADD CONSTRAINT dishes_dish_kind_check
  CHECK (dish_kind IN ('standard', 'bundle', 'configurable', 'course_menu', 'buffet'));

COMMIT;
