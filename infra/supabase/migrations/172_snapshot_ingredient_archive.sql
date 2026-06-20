-- 172_snapshot_ingredient_archive.sql
-- Created: 2026-06-20
--
-- Pre-drop data snapshot for the Phase C ingredient-pipeline teardown (DEBT-02).
-- This is a SEPARATE migration the operator applies AND verifies lands BEFORE
-- migration 173 (the RESTRICT table drop). The drop is one-way; the only recovery
-- path for the curated ingredient data is this in-DB archive (D-01/D-02).
--
-- The archive lives in the non-`public` `ingredient_archive` schema (D-03):
-- PostgREST only exposes `public` by default, so the copies are NOT an API
-- surface and need no RLS. Retained indefinitely (D-04).
--
-- Each table is archived via a presence-guarded `CREATE TABLE AS SELECT`, so any
-- table the LIVE-STATE PROBE reported absent is a silent no-op (the live prod
-- membership of the 9-table snapshot list is UNKNOWN until the probe runs; the
-- guards make this migration correct regardless of live state).
--
-- Reverse: NONE authored. This migration only creates; it never drops anything,
-- so there is nothing to undo at apply time. Rolling the archive back is a future
-- cleanup (`DROP SCHEMA ingredient_archive CASCADE;`), deferred per D-04.

BEGIN;

CREATE SCHEMA IF NOT EXISTS ingredient_archive;

-- Operator: the presence guards make any table the LIVE-STATE PROBE reported absent a silent no-op.

-- ── Snapshot-then-drop tables (D-01 archive — these may hold curated data) ───
DO $$ BEGIN IF to_regclass('public.canonical_ingredients') IS NOT NULL THEN EXECUTE 'CREATE TABLE IF NOT EXISTS ingredient_archive.canonical_ingredients AS SELECT * FROM public.canonical_ingredients'; END IF; END $$;
DO $$ BEGIN IF to_regclass('public.ingredient_aliases') IS NOT NULL THEN EXECUTE 'CREATE TABLE IF NOT EXISTS ingredient_archive.ingredient_aliases AS SELECT * FROM public.ingredient_aliases'; END IF; END $$;
DO $$ BEGIN IF to_regclass('public.ingredient_aliases_v2') IS NOT NULL THEN EXECUTE 'CREATE TABLE IF NOT EXISTS ingredient_archive.ingredient_aliases_v2 AS SELECT * FROM public.ingredient_aliases_v2'; END IF; END $$;
DO $$ BEGIN IF to_regclass('public.ingredient_concepts') IS NOT NULL THEN EXECUTE 'CREATE TABLE IF NOT EXISTS ingredient_archive.ingredient_concepts AS SELECT * FROM public.ingredient_concepts'; END IF; END $$;
DO $$ BEGIN IF to_regclass('public.ingredient_variants') IS NOT NULL THEN EXECUTE 'CREATE TABLE IF NOT EXISTS ingredient_archive.ingredient_variants AS SELECT * FROM public.ingredient_variants'; END IF; END $$;
DO $$ BEGIN IF to_regclass('public.concept_translations') IS NOT NULL THEN EXECUTE 'CREATE TABLE IF NOT EXISTS ingredient_archive.concept_translations AS SELECT * FROM public.concept_translations'; END IF; END $$;
DO $$ BEGIN IF to_regclass('public.variant_translations') IS NOT NULL THEN EXECUTE 'CREATE TABLE IF NOT EXISTS ingredient_archive.variant_translations AS SELECT * FROM public.variant_translations'; END IF; END $$;
DO $$ BEGIN IF to_regclass('public.canonical_ingredient_allergens') IS NOT NULL THEN EXECUTE 'CREATE TABLE IF NOT EXISTS ingredient_archive.canonical_ingredient_allergens AS SELECT * FROM public.canonical_ingredient_allergens'; END IF; END $$;
DO $$ BEGIN IF to_regclass('public.dish_ingredients') IS NOT NULL THEN EXECUTE 'CREATE TABLE IF NOT EXISTS ingredient_archive.dish_ingredients AS SELECT * FROM public.dish_ingredients'; END IF; END $$;

COMMIT;

-- Landing check (run before applying 173): SELECT table_name FROM information_schema.tables WHERE table_schema = 'ingredient_archive';
