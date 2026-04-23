-- 121_confirm_menu_scan.sql
-- Created: 2026-04-23
--
-- Ships:
--   (a) menu_scan_confirmations side-table  — idempotency dedup for confirm_menu_scan
--   (b) confirm_menu_scan(uuid, jsonb, text) — idempotent bulk dish insert RPC
--   (c) claim_menu_scan_job(int)             — worker: atomic FOR UPDATE SKIP LOCKED claim
--   (d) complete_menu_scan_job(uuid, jsonb)  — worker: write result + transition → needs_review
--   (e) fail_menu_scan_job(uuid, text, int)  — worker: increment attempts, transition → failed
--
-- Also adds saved_dish_ids + saved_at columns to menu_scan_jobs (written by confirm_menu_scan).
--
-- Reverse: 121_REVERSE_ONLY_confirm_menu_scan.sql

BEGIN;

-- ── (a) menu_scan_confirmations ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.menu_scan_confirmations (
  job_id          uuid         NOT NULL REFERENCES public.menu_scan_jobs(id) ON DELETE CASCADE,
  idempotency_key text         NOT NULL,
  result          jsonb        NOT NULL,
  created_at      timestamptz  NOT NULL DEFAULT now(),
  PRIMARY KEY (job_id, idempotency_key)
);

ALTER TABLE public.menu_scan_confirmations ENABLE ROW LEVEL SECURITY;

-- Owner can SELECT for debugging; SECURITY DEFINER function writes bypassing RLS.
CREATE POLICY "menu_scan_confirmations: owner or admin select"
  ON public.menu_scan_confirmations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.menu_scan_jobs mj
      WHERE mj.id = menu_scan_confirmations.job_id
        AND (mj.created_by = auth.uid() OR public.is_admin())
    )
  );

-- ── menu_scan_jobs: add saved_dish_ids + saved_at ────────────────────────────
ALTER TABLE public.menu_scan_jobs
  ADD COLUMN IF NOT EXISTS saved_dish_ids jsonb,
  ADD COLUMN IF NOT EXISTS saved_at       timestamptz;

-- ── (b) confirm_menu_scan ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.confirm_menu_scan(
  p_job_id            uuid,
  p_payload           jsonb,
  p_idempotency_key   text
)
RETURNS jsonb     -- { confirmed: boolean, inserted_dish_ids: uuid[] }
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prior        jsonb;
  v_owner_id     uuid;
  v_restaurant   uuid;
  v_inserted_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  -- Idempotency: if we already processed this (job_id, idempotency_key),
  -- return the previous result.
  SELECT result INTO v_prior
    FROM public.menu_scan_confirmations
   WHERE job_id = p_job_id AND idempotency_key = p_idempotency_key;

  IF v_prior IS NOT NULL THEN
    RETURN v_prior;
  END IF;

  -- Authorization: owner of the job or admin.
  SELECT mj.created_by, mj.restaurant_id
    INTO v_owner_id, v_restaurant
    FROM public.menu_scan_jobs mj
   WHERE mj.id = p_job_id;

  IF v_owner_id IS NULL OR
     (v_owner_id <> auth.uid() AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Bulk insert dishes. Each dish lands as status='draft' (not published until
  -- the owner explicitly calls publish_restaurant_draft). allergens/dietary_tags
  -- default to [] per design §2.7 + small-memos G2.
  WITH inserted AS (
    INSERT INTO public.dishes (
      restaurant_id, menu_category_id, name, description, price,
      dish_kind, primary_protein, is_template, status,
      allergens, dietary_tags
    )
    SELECT
      v_restaurant,
      (d->>'menu_category_id')::uuid,
      d->>'name',
      d->>'description',
      (d->>'price')::numeric,
      COALESCE(d->>'dish_kind', 'standard'),
      d->>'primary_protein',
      COALESCE((d->>'is_template')::boolean, false),
      'draft',
      ARRAY[]::text[],
      ARRAY[]::text[]
    FROM jsonb_array_elements(p_payload->'dishes') d
    RETURNING id
  )
  SELECT array_agg(id) INTO v_inserted_ids FROM inserted;

  -- Record idempotency entry.
  INSERT INTO public.menu_scan_confirmations (job_id, idempotency_key, result)
  VALUES (
    p_job_id,
    p_idempotency_key,
    jsonb_build_object('confirmed', true, 'inserted_dish_ids', v_inserted_ids)
  );

  -- Update job to completed.
  UPDATE public.menu_scan_jobs
     SET status        = 'completed',
         saved_dish_ids = to_jsonb(v_inserted_ids),
         saved_at       = now(),
         updated_at     = now()
   WHERE id = p_job_id;

  RETURN jsonb_build_object('confirmed', true, 'inserted_dish_ids', v_inserted_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_menu_scan(uuid, jsonb, text) FROM public;
GRANT EXECUTE ON FUNCTION public.confirm_menu_scan(uuid, jsonb, text) TO authenticated;

-- ── (c) claim_menu_scan_job ──────────────────────────────────────────────────
-- Worker-only: called via service role. Atomically claims the oldest pending job
-- (or a stuck processing job whose locked_until has expired).
CREATE OR REPLACE FUNCTION public.claim_menu_scan_job(p_lock_seconds int DEFAULT 180)
RETURNS public.menu_scan_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  j public.menu_scan_jobs;
BEGIN
  UPDATE public.menu_scan_jobs
     SET status       = 'processing',
         locked_until = now() + make_interval(secs => p_lock_seconds),
         attempts     = attempts + 1,
         updated_at   = now()
   WHERE id = (
     SELECT id FROM public.menu_scan_jobs
      WHERE status = 'pending'
         OR (status = 'processing' AND locked_until < now())
      ORDER BY created_at
      LIMIT 1
      FOR UPDATE SKIP LOCKED
   )
   RETURNING * INTO j;
  RETURN j;  -- NULL if no claimable job
END;
$$;

REVOKE ALL ON FUNCTION public.claim_menu_scan_job(int) FROM public;
-- Service role only — no GRANT to authenticated.

-- ── (d) complete_menu_scan_job ───────────────────────────────────────────────
-- Worker writes extraction result and transitions → needs_review.
CREATE OR REPLACE FUNCTION public.complete_menu_scan_job(p_id uuid, p_result jsonb)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.menu_scan_jobs
     SET status       = 'needs_review',
         result_json  = p_result,
         locked_until = NULL,
         updated_at   = now()
   WHERE id = p_id;
$$;

REVOKE ALL ON FUNCTION public.complete_menu_scan_job(uuid, jsonb) FROM public;
-- Service role only.

-- ── (e) fail_menu_scan_job ───────────────────────────────────────────────────
-- Worker records a failure. Re-queues as pending unless attempts >= max.
CREATE OR REPLACE FUNCTION public.fail_menu_scan_job(
  p_id           uuid,
  p_error        text,
  p_max_attempts int DEFAULT 3
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.menu_scan_jobs
     SET status       = CASE WHEN attempts >= p_max_attempts THEN 'failed' ELSE 'pending' END,
         locked_until = NULL,
         last_error   = p_error,
         updated_at   = now()
   WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fail_menu_scan_job(uuid, text, int) FROM public;
-- Service role only.

COMMIT;
