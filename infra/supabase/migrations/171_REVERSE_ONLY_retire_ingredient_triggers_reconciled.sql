-- 171_REVERSE_ONLY_retire_ingredient_triggers_reconciled.sql
-- Reverses 171_retire_ingredient_triggers_reconciled.sql.
--
-- IMPORTANT: this reverse is intentionally DEGENERATE / marker-only (the
-- 152_REVERSE precedent). It does NOT recreate the dropped triggers or their
-- functions, because as written they reference objects that no longer exist:
--
--   * compute_dish_dietary_tags(uuid) queries public.dietary_tags and
--     public.canonical_ingredient_dietary_tags — BOTH dropped by migration 156.
--   * refresh_dish_dietary(uuid) writes dishes.allergens / dishes.dietary_tags
--     — columns dropped by migration 156.
--   * dishes_override_refresh fires AFTER UPDATE OF allergens_override,
--     dietary_tags_override — columns migration 174 (this phase) drops.
--
-- Recreating any of those CREATE FUNCTION / CREATE TRIGGER statements verbatim
-- would FAIL to apply against the current schema. A reverse that cannot apply
-- is worse than one that documents irreversibility, so this file does the
-- latter.
--
-- To genuinely restore the triggers you would first have to:
--   1. Un-apply migration 156 and re-add the dietary_tags /
--      canonical_ingredient_dietary_tags tables and the
--      dishes.allergens / dishes.dietary_tags columns.
--   2. Re-add the dishes.allergens_override / dietary_tags_override columns
--      (un-apply migration 174).
--   3. Re-run the original function bodies from migrations 092 / 105 / 135 and
--      re-create the triggers.
--
-- That is out of scope and not desired: allergens + dietary tags are abandoned
-- (see CLAUDE.md "Allergens & Dietary Tags — Abandoned"). The forward drop in
-- 171 is a one-way move.

BEGIN;

-- No-op placeholder. See header note. Recreating these triggers/functions is
-- not possible against the post-156 schema and is not desired (allergens +
-- dietary tags are abandoned).

COMMIT;
