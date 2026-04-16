-- 096_drop_orphan_option_groups.sql
-- Drops the _orphan_option_groups_094 quarantine table.
--
-- Migration 094 moved any option_groups rows with NULL dish_id into this
-- snapshot table so they could be audited before permanent deletion.
-- Audit confirmed the table was empty — no orphans existed — so it's
-- safe to remove.

DROP TABLE IF EXISTS public._orphan_option_groups_094;
