-- 099_new_ingredients_schema.sql
-- Created: 2026-04-18
-- Phase 1 of ingredient system refactor.
--
-- Creates the new ingredient tables alongside the existing
-- canonical_ingredients / ingredient_aliases. NOTHING IS WIRED UP YET:
--   - No data migrated (Phase 2)
--   - No curated seed applied (Phase 2b)
--   - No readers or writers reference these tables (Phase 3+)
--   - dish_ingredients still FKs to canonical_ingredients — untouched
--
-- The new alias table is intentionally named `ingredient_aliases_v2` to avoid
-- colliding with the legacy `ingredient_aliases`. It will be renamed to
-- `ingredient_aliases` (and the legacy table retired) at Phase 6 cutover.

-- ============================================================================
-- SECTION 1: Extensions
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- SECTION 2: ingredient_concepts — the "thing"
-- ============================================================================

CREATE TABLE public.ingredient_concepts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  family text NOT NULL DEFAULT 'other',
  is_vegetarian boolean NOT NULL DEFAULT true,
  is_vegan boolean NOT NULL DEFAULT false,
  allergens text[] NOT NULL DEFAULT '{}',
  -- Lineage: link to old canonical_ingredients row if this concept was
  -- backfilled from there. Null for concepts created fresh in Phase 2b.
  -- Used during Phase 5 to remap dish_ingredients foreign keys.
  -- ON DELETE SET NULL because the lineage pointer is informational and
  -- must not block Phase 6 cleanup of the legacy table.
  legacy_canonical_id uuid REFERENCES public.canonical_ingredients(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ingredient_concepts_family
  ON public.ingredient_concepts(family);

CREATE INDEX idx_ingredient_concepts_legacy
  ON public.ingredient_concepts(legacy_canonical_id)
  WHERE legacy_canonical_id IS NOT NULL;

-- ============================================================================
-- SECTION 3: ingredient_variants — preparations/forms
-- ============================================================================

CREATE TABLE public.ingredient_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  concept_id uuid NOT NULL REFERENCES public.ingredient_concepts(id) ON DELETE CASCADE,
  modifier text,  -- null = bare concept / default variant
  is_default boolean NOT NULL DEFAULT false,
  needs_review boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Exactly one default variant per concept (the bare form).
-- Partial unique index allows multiple rows where is_default = false.
CREATE UNIQUE INDEX idx_ingredient_variants_one_default
  ON public.ingredient_variants(concept_id)
  WHERE is_default = true;

-- No duplicate named variants per concept ((concept, "smoked") is unique).
-- Partial because modifier is nullable for the default variant.
CREATE UNIQUE INDEX idx_ingredient_variants_modifier
  ON public.ingredient_variants(concept_id, modifier)
  WHERE modifier IS NOT NULL;

-- Review queue lookup
CREATE INDEX idx_ingredient_variants_needs_review
  ON public.ingredient_variants(needs_review)
  WHERE needs_review = true;

-- ============================================================================
-- SECTION 4: concept_translations — display name per language per concept
-- ============================================================================

CREATE TABLE public.concept_translations (
  concept_id uuid NOT NULL REFERENCES public.ingredient_concepts(id) ON DELETE CASCADE,
  language text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (concept_id, language)
);

-- ============================================================================
-- SECTION 5: variant_translations — display name per language per variant
-- ============================================================================

CREATE TABLE public.variant_translations (
  variant_id uuid NOT NULL REFERENCES public.ingredient_variants(id) ON DELETE CASCADE,
  language text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (variant_id, language)
);

-- ============================================================================
-- SECTION 6: ingredient_aliases_v2 — match-only lookup (noisy, many-to-one)
-- ============================================================================

CREATE TABLE public.ingredient_aliases_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alias_text text NOT NULL,
  language text NOT NULL,
  concept_id uuid NOT NULL REFERENCES public.ingredient_concepts(id) ON DELETE CASCADE,
  -- If set, this alias targets a specific variant (e.g. "smoked salmon").
  -- If null, the alias resolves to the concept's default variant.
  variant_id uuid REFERENCES public.ingredient_variants(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Fixes today's bug: old table had display_name globally UNIQUE, blocking
  -- the same string from appearing as an alias in two languages.
  UNIQUE (alias_text, language)
);

CREATE INDEX idx_ingredient_aliases_v2_concept
  ON public.ingredient_aliases_v2(concept_id);

CREATE INDEX idx_ingredient_aliases_v2_variant
  ON public.ingredient_aliases_v2(variant_id)
  WHERE variant_id IS NOT NULL;

-- Trigram index — powers the admin UI fuzzy typeahead ("search across all
-- aliases in all languages before creating a duplicate concept").
CREATE INDEX idx_ingredient_aliases_v2_trgm
  ON public.ingredient_aliases_v2
  USING gin (alias_text gin_trgm_ops);

-- ============================================================================
-- SECTION 7: Row-Level Security
-- ============================================================================
-- These are public reference tables: anyone authenticated (and anon) can read
-- them so the mobile app can render ingredient names. Writes go through
-- server-side API routes using the service role key, which bypasses RLS — so
-- no write policies are defined.

ALTER TABLE public.ingredient_concepts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredient_variants     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concept_translations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variant_translations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredient_aliases_v2   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read ingredient_concepts"
  ON public.ingredient_concepts FOR SELECT USING (true);

CREATE POLICY "Public read ingredient_variants"
  ON public.ingredient_variants FOR SELECT USING (true);

CREATE POLICY "Public read concept_translations"
  ON public.concept_translations FOR SELECT USING (true);

CREATE POLICY "Public read variant_translations"
  ON public.variant_translations FOR SELECT USING (true);

CREATE POLICY "Public read ingredient_aliases_v2"
  ON public.ingredient_aliases_v2 FOR SELECT USING (true);

-- ============================================================================
-- SUCCESS
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 099: new ingredient schema created';
  RAISE NOTICE '  - ingredient_concepts (with legacy_canonical_id lineage)';
  RAISE NOTICE '  - ingredient_variants (one default per concept)';
  RAISE NOTICE '  - concept_translations';
  RAISE NOTICE '  - variant_translations';
  RAISE NOTICE '  - ingredient_aliases_v2 (UNIQUE alias_text, language)';
  RAISE NOTICE '  - pg_trgm enabled + trigram index on aliases';
  RAISE NOTICE '  - RLS enabled on all new tables (public SELECT)';
  RAISE NOTICE '';
  RAISE NOTICE '  Nothing wired up yet. Phase 2 backfills existing data.';
  RAISE NOTICE '  dish_ingredients still FKs to canonical_ingredients.';
  RAISE NOTICE '========================================';
END $$;
