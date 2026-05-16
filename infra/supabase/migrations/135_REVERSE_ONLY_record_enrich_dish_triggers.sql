-- 135_REVERSE_ONLY_record_enrich_dish_triggers.sql
-- Reverses 135_record_enrich_dish_triggers.sql by dropping all four triggers.
--
-- WARNING: rolling back this migration means dishes will NOT trigger
-- enrichment on INSERT/UPDATE. Existing dishes keep their embeddings,
-- but new ones will be inserted unenriched. Only roll back if Phase 1-3
-- is being fully reverted.

BEGIN;

DROP TRIGGER IF EXISTS trg_enrich_on_dish_change ON public.dishes;
DROP TRIGGER IF EXISTS after_dish_embedded ON public.dishes;
DROP TRIGGER IF EXISTS trg_enrich_on_ingredient_change ON public.dish_ingredients;
DROP TRIGGER IF EXISTS trg_enrich_on_option_group_change ON public.option_groups;

COMMIT;
