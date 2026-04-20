-- 107_enforce_alias_variant_concept_match.sql
-- Created: 2026-04-20
-- Integrity fix surfaced during code review of migration 099.
--
-- Problem: ingredient_aliases_v2 has two independent foreign keys —
--   concept_id → ingredient_concepts(id)
--   variant_id → ingredient_variants(id)
-- but nothing enforces that the referenced variant actually belongs to the
-- referenced concept. Without this guard an alias could link, say, the
-- "olive" concept to a "smoked" variant of "salmon" — silently corrupt and
-- impossible to detect during resolver lookups.
--
-- PostgreSQL CHECK constraints can't reference other tables, so the correct
-- fix is a composite foreign key (concept_id, variant_id) →
-- ingredient_variants(concept_id, id). That requires a UNIQUE constraint on
-- exactly (concept_id, id) in the parent table. `id` is already unique on
-- its own, so the composite unique is redundant for uniqueness but required
-- by PostgreSQL as an FK target.
--
-- Semantics:
--   - When variant_id IS NULL, MATCH SIMPLE (the default) skips the
--     composite FK entirely. Concept-only aliases keep working untouched.
--   - When variant_id IS NOT NULL, inserting a row whose (concept_id,
--     variant_id) pair doesn't match a real variant under that concept
--     fails with a clear FK violation.
--   - ON DELETE CASCADE: if the variant row is deleted from
--     ingredient_variants, any alias that referenced that (concept, variant)
--     pair is dropped too. Same behaviour as the existing variant_id FK.
--
-- The existing single-column FKs are kept for cleaner cascade semantics on
-- concept deletes — concept_id → ingredient_concepts(id) already cascades.

BEGIN;

-- ============================================================================
-- SECTION 1: FK target on ingredient_variants
-- ============================================================================
-- Required so the composite FK below can reference (concept_id, id).

ALTER TABLE public.ingredient_variants
  ADD CONSTRAINT ingredient_variants_concept_id_id_key
  UNIQUE (concept_id, id);

-- ============================================================================
-- SECTION 2: Enforce alias (concept_id, variant_id) consistency
-- ============================================================================
-- Fails if any existing row has a mismatched (concept_id, variant_id)
-- pair. The default MATCH SIMPLE means rows with variant_id = NULL are
-- exempt, which is exactly the behaviour we want for concept-only aliases.

ALTER TABLE public.ingredient_aliases_v2
  ADD CONSTRAINT ingredient_aliases_v2_variant_matches_concept
  FOREIGN KEY (concept_id, variant_id)
  REFERENCES public.ingredient_variants(concept_id, id)
  ON DELETE CASCADE;

COMMIT;
