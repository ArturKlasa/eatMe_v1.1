-- 152_REVERSE_ONLY_drop_ingredient_pipeline.sql
-- Reverses 152_drop_ingredient_pipeline.sql.
--
-- IMPORTANT: this reverse is structural only. Phase C chose not to snapshot
-- the dropped data (no production users, replaceable via re-scan / re-curate).
-- Re-running the original table-creation migrations (099-106 and their
-- successors) would recreate the schema but with EMPTY tables.
--
-- To actually restore the legacy data:
--   1. Apply this reverse (recreates schema as empty tables).
--   2. Replay any backfill from a cold-storage snapshot if you took one.
--   3. Otherwise, re-curate from scratch — the data lived through years of
--      manual editing in the legacy admin and is not derivable from current
--      state.
--
-- This reverse intentionally does NOT recreate every table verbatim — the
-- exact CREATE TABLE statements span migrations 099-106 plus various ALTERs
-- across the 100s range. Rather than copying ~600 lines of DDL inline,
-- recreate by re-running those source migrations in order if a true rollback
-- is needed. The expectation is that Phase C is a one-way move.

BEGIN;

-- No-op placeholder. See header note. To genuinely reverse, re-apply
-- migrations 099, 100, 101, 102, 103, 104, 105, 106 in order, plus any
-- subsequent ALTERs that touched these tables.

COMMIT;
