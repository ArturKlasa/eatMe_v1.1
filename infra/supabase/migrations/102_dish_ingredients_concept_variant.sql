-- 102_dish_ingredients_concept_variant.sql
-- Created: 2026-04-18
-- Phase 3 of ingredient system refactor.
--
-- Adds concept_id + variant_id (both nullable) to dish_ingredients so that
-- menu-scan ingestion can record resolution against ingredient_concepts /
-- ingredient_variants while still feeding the legacy ingredient_id FK that
-- enrich-dish and the allergen trigger depend on.
--
-- The primary key stays (dish_id, ingredient_id) for now — it becomes
-- (dish_id, concept_id, variant_id) at Phase 6 cutover when the legacy
-- column is retired. variant tracking is informational in this phase;
-- dishes that happen to receive multiple variants of the same concept
-- are deduplicated on the write path to one row per concept.

BEGIN;

ALTER TABLE public.dish_ingredients
  ADD COLUMN concept_id uuid REFERENCES public.ingredient_concepts(id) ON DELETE SET NULL,
  ADD COLUMN variant_id uuid REFERENCES public.ingredient_variants(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.dish_ingredients.concept_id IS
  'New canonical reference (ingredient_concepts). Nullable during Phase 3 transition; required after Phase 6 cutover when ingredient_id is retired.';
COMMENT ON COLUMN public.dish_ingredients.variant_id IS
  'Optional variant specialization (ingredient_variants). Null means default variant / no modifier.';

CREATE INDEX dish_ingredients_concept_id_idx
  ON public.dish_ingredients(concept_id)
  WHERE concept_id IS NOT NULL;

CREATE INDEX dish_ingredients_variant_id_idx
  ON public.dish_ingredients(variant_id)
  WHERE variant_id IS NOT NULL;

COMMIT;
