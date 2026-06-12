-- 161_backfill_zero_price_override.sql
-- Created: 2026-06-12
--
-- One-time backfill for the zero price_override bug (operator issue, fixed in
-- the menu-scan worker + scan-extras action on 2026-06-12, commit 57f6fad):
-- the extraction model emitted 0 instead of null for options with no own
-- replacing price, and confirmed scans stored it. Mobile renders any non-null
-- price_override as the option's ABSOLUTE price, so these options display as
-- "MX$0" — including options that carry a real positive price_delta the
-- override hides.
--
-- A zero override is never a real menu intent (it would mean picking the
-- option makes the dish free; "no extra charge" is price_delta=0 +
-- price_override=null), so collapsing all of them is safe. All 128 affected
-- rows were reviewed on 2026-06-12: protein/sauce/topping/brand choices only.
--
-- Idempotent: re-running matches 0 rows.

UPDATE options
SET price_override = NULL
WHERE price_override = 0;
