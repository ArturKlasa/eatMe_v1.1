-- assess-live-state.sql
-- Created: 2026-06-18
--
-- READ ONLY. Run once in the Supabase SQL editor. Paste the FULL output of all blocks back.
-- No writes. No DDL. (Phase 1 live-state probe — gates Phases 3/6/7 per FINDINGS.md.)
--
-- ONE consolidated read-only prod-state probe (D-08), sibling to the .ts operator
-- scripts in this directory. The three live-state unknowns (RLS status -> Phase 3,
-- pgvector version -> Phase 7, deployed webhook/trigger coverage -> Phase 7) live
-- only in the prod catalog, not in git. This is the sole sanctioned path to read
-- them (no local psql; stage-don't-apply). It selects only catalog metadata
-- (table names, RLS flags, policy expressions, trigger DDL, extension versions,
-- column names) -- never row data from user tables, so no PII can be pasted back.

BEGIN;
SET TRANSACTION READ ONLY;   -- hard guard: any accidental write aborts

-- [BLOCK 1] RLS + policies for behavioral tables
SELECT t.tablename,
       t.rowsecurity                       AS rls_enabled,
       COALESCE(p.policyname, '(none)')    AS policy,
       p.cmd, p.permissive, p.roles, p.qual, p.with_check
FROM   pg_tables t
LEFT   JOIN pg_policies p
       ON p.schemaname = t.schemaname AND p.tablename = t.tablename
WHERE  t.schemaname = 'public'
  AND  t.tablename IN (
        'favorites','dish_opinions','user_dish_interactions',
        'user_behavior_profiles','dish_analytics','user_points',
        'user_sessions','user_visits','session_views','dish_photos',
        'restaurant_experience_responses'
        -- add eat_together_* tables verified to exist
       )
ORDER BY t.tablename, policy;

-- [BLOCK 1b] Catch-all: any public table with RLS disabled (so no unprotected table is missed)
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public' AND rowsecurity=false ORDER BY tablename;

-- [BLOCK 2] pgvector version (gates hnsw.iterative_scan in Phase 7)
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';
SELECT name, default_version, installed_version
FROM   pg_available_extensions WHERE name = 'vector';

-- [BLOCK 3] Deployed triggers on feed-affecting tables (webhook coverage, code-first confirm)
-- event_manipulation reports the wired event per trigger (the three DML events).
SELECT event_object_table AS table_name,
       trigger_name, event_manipulation AS event,
       action_timing, action_statement
FROM   information_schema.triggers
WHERE  event_object_schema = 'public'
  AND  event_object_table IN ('restaurants','menus','dishes')
ORDER BY table_name, trigger_name, event;

-- The dish-keyed aggregate table (PK dish_id, no user_id column) is deliberately
-- EXCLUDED from the owner-column IN-list below -- it is a public aggregate, not
-- user-owned; Phase 3 must NOT add an owner policy to it (service-role-only /
-- public-read instead). See FINDINGS.md SEC-02 scope-impact note.
-- [BLOCK 4] Owner-column sanity (confirm user_id exists where Phase 3 will add policies)
SELECT table_name, column_name, data_type
FROM   information_schema.columns
WHERE  table_schema = 'public'
  AND  column_name IN ('user_id','owner_id')
  AND  table_name IN (
        'favorites','dish_opinions','user_dish_interactions',
        'user_behavior_profiles','user_visits','session_views',
        'user_points','user_sessions','dish_photos',
        'restaurant_experience_responses')
ORDER BY table_name;

ROLLBACK;  -- read-only; nothing to write back
