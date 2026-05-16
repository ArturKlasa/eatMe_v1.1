-- 135_record_enrich_dish_triggers.sql
-- Created: 2026-05-15
--
-- Records the four triggers that wire _trg_notify_enrich_dish() and
-- _trg_after_dish_embedded() to the dishes / dish_ingredients /
-- option_groups tables.
--
-- Drift context (discovered 2026-05-15 during Phase 3 planning):
--   The function _trg_notify_enrich_dish() is defined in migration 132, but
--   no CREATE TRIGGER statement exists in any prior migration. The triggers
--   live in the production database (verified via pg_get_triggerdef) but a
--   fresh-environment migration apply would leave them unwired, silently
--   breaking all dish-side enrichment.
--
-- This migration is idempotent: DROP IF EXISTS + CREATE for each trigger.
-- It records the live state, so re-applying on production is a no-op.

BEGIN;

-- ── dishes ──────────────────────────────────────────────────────────────
-- Fires enrich-dish whenever a dish is inserted or its name/description
-- changes (price-only edits, availability toggles, etc. don't re-enrich).

DROP TRIGGER IF EXISTS trg_enrich_on_dish_change ON public.dishes;

CREATE TRIGGER trg_enrich_on_dish_change
  AFTER INSERT OR UPDATE OF name, description ON public.dishes
  FOR EACH ROW
  EXECUTE FUNCTION public._trg_notify_enrich_dish();

-- ── dishes (after embedded) ────────────────────────────────────────────
-- Marks the dish's restaurant dirty when the embedding column changes.

DROP TRIGGER IF EXISTS after_dish_embedded ON public.dishes;

CREATE TRIGGER after_dish_embedded
  AFTER UPDATE OF embedding ON public.dishes
  FOR EACH ROW
  EXECUTE FUNCTION public._trg_after_dish_embedded();

-- ── dish_ingredients ───────────────────────────────────────────────────
-- Re-enriches the parent dish when ingredients are added or removed.

DROP TRIGGER IF EXISTS trg_enrich_on_ingredient_change ON public.dish_ingredients;

CREATE TRIGGER trg_enrich_on_ingredient_change
  AFTER INSERT OR DELETE ON public.dish_ingredients
  FOR EACH ROW
  EXECUTE FUNCTION public._trg_notify_enrich_dish();

-- ── option_groups ──────────────────────────────────────────────────────
-- Re-enriches when an option group is added/removed/renamed.

DROP TRIGGER IF EXISTS trg_enrich_on_option_group_change ON public.option_groups;

CREATE TRIGGER trg_enrich_on_option_group_change
  AFTER INSERT OR DELETE OR UPDATE OF name ON public.option_groups
  FOR EACH ROW
  EXECUTE FUNCTION public._trg_notify_enrich_dish();

COMMIT;
