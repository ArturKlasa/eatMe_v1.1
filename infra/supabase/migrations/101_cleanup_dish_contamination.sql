-- 101_cleanup_dish_contamination.sql
-- Created: 2026-04-18
-- Phase 2b cleanup substep of ingredient system refactor.
--
-- The legacy canonical_ingredients table contained ~53 entries with
-- family='other' that were either (a) composed dishes/sweets mistakenly
-- seeded as ingredients, (b) real ingredients with the wrong family, or
-- (c) Polish fish names duplicating existing English concepts.
--
-- These were backfilled into ingredient_concepts by migration 100 with
-- family='other' preserved. This migration removes the dishes and
-- reclassifies the rest so family='other' contains only genuine edge
-- cases going forward.
--
-- Safety:
--   - All 53 entries were verified to have zero dish_ingredients refs.
--   - CASCADE handles ingredient_variants, concept_translations,
--     variant_translations, and ingredient_aliases_v2 rows for deletes.
--   - legacy_canonical_id FK has ON DELETE SET NULL on the concept side,
--     so we are NOT touching canonical_ingredients — that table retires
--     at Phase 6 cutover.

BEGIN;

-- ============================================================================
-- SECTION 1: Delete composed dishes/sweets that are not ingredients
-- ============================================================================
-- CASCADE drops variants, translations, and aliases_v2 rows.

DELETE FROM public.ingredient_concepts
WHERE slug IN (
  'acai_bowl',
  'acaraje',
  'aji_de_gallina',
  'alegria',
  'alfajor',
  'anticucho',
  'ate',
  'bandeja_paisa',
  'bocadillo_col',
  'brigadeiro',
  'canjica',
  'cau_cau',
  'causa',
  'ceviche',
  'changua',
  'chupe_de_camarones',
  'cocada',
  'consome',
  'coxinha',
  'curau',
  'empanada_de_carne',
  'empanada_de_jamon',
  'feijoada',
  'locro',
  'lomo_saltado',
  'mazamorra_morada',
  'mazapan',
  'moqueca',
  'natilla_col',
  'obleas',
  'papa_a_la_huancaina',
  'pudim_de_leite',
  'quindim',
  'rocoto_relleno',
  'sancocho',
  'suspiro_limeño',
  'tamarindo_candy',
  'tiradito',
  'vatapa'
);

-- ============================================================================
-- SECTION 2: Reclassify real ingredients to their proper family
-- ============================================================================

UPDATE public.ingredient_concepts SET family = 'baking'    WHERE slug = 'almond_flour';
UPDATE public.ingredient_concepts SET family = 'nut_seed'  WHERE slug = 'basil_seeds';
UPDATE public.ingredient_concepts SET family = 'grain'     WHERE slug = 'blue_cornmeal';
UPDATE public.ingredient_concepts SET family = 'condiment' WHERE slug = 'bone_broth';
UPDATE public.ingredient_concepts SET family = 'protein'   WHERE slug = 'chapulines';
UPDATE public.ingredient_concepts SET family = 'nut_seed'  WHERE slug = 'coconut_flakes';
UPDATE public.ingredient_concepts SET family = 'fruit'     WHERE slug = 'strawberries';

-- salsa_fresca has a space in its slug — fix that and reclassify.
UPDATE public.ingredient_concepts
SET slug = 'salsa_fresca', family = 'condiment'
WHERE slug = 'salsa fresca';

-- ============================================================================
-- SECTION 3: Reclassify Polish fish names to family='fish'
-- ============================================================================
-- karp / sledz / weggorz duplicate existing carp / herring / eel concepts.
-- Full cross-language merge is deferred to Phase 4 admin dedup tooling.
-- okon / szczupak / szprot have no existing English concept and remain
-- as standalone fish ingredients.

UPDATE public.ingredient_concepts
SET family = 'fish'
WHERE slug IN ('karp', 'sledz', 'weggorz', 'okon', 'szczupak', 'szprot');

COMMIT;
