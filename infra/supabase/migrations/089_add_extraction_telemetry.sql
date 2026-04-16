-- 089_add_extraction_telemetry.sql
-- Created: 2026-04-13
--
-- Adds extraction telemetry columns to menu_scan_jobs so the menu-scan API
-- can persist OpenAI model + token usage already returned by the extraction
-- step. Required by CP-07 (see .agents/research/ai-ingestion-2026-04-12/
-- 07-confidence-provenance.md) to enable end-to-end cost tracking across the
-- extraction + enrichment pipeline.
--
-- Without these columns the final UPDATE in apps/web-portal/app/api/menu-scan/
-- route.ts fails with PGRST204 and the job stays stuck in 'processing'.

ALTER TABLE public.menu_scan_jobs
  ADD COLUMN IF NOT EXISTS extraction_model             text,
  ADD COLUMN IF NOT EXISTS extraction_prompt_tokens     integer,
  ADD COLUMN IF NOT EXISTS extraction_completion_tokens integer;
