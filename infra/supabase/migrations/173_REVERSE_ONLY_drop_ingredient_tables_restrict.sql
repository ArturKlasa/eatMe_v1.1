-- 173_REVERSE_ONLY_drop_ingredient_tables_restrict.sql
-- Reverses 173_drop_ingredient_tables_restrict.sql.
--
-- IMPORTANT: this reverse is STRUCTURAL ONLY (D-05), and intentionally degenerate
-- (the 152_REVERSE precedent). The exact CREATE TABLE statements for the dropped
-- ingredient tables span migrations 099-106 plus various ALTERs across the 100s
-- range — ~600 lines of inter-migration DDL. Rather than copy that inline (which
-- would drift from the source migrations), recreate the schema by re-running those
-- source migrations in order if a true rollback is ever needed.
--
-- To genuinely reverse:
--   1. Re-apply migrations 099, 100, 101, 102, 103, 104, 105, 106 in order, plus
--      any subsequent ALTERs that touched these tables.
--   2. Re-add the severed FK column:
--        ALTER TABLE public.options ADD COLUMN canonical_ingredient_id <type>
--          REFERENCES public.canonical_ingredients(id);
--   3. Restore data MANUALLY from the in-DB archive (never baked into this reverse):
--        INSERT INTO public.<t> SELECT * FROM ingredient_archive.<t>;
--      for each table 172 snapshotted.
--
-- The expectation is that Phase C is a one-way move; this file exists so the
-- forward migration has a paired reverse, not as a turnkey restore.

BEGIN;

-- No-op placeholder. See header note. Structural restore = re-run migrations
-- 099-106 + re-add options.canonical_ingredient_id + FK; data restore is a
-- manual INSERT ... SELECT FROM ingredient_archive.<t>.

COMMIT;
