# Menu-scan: reliable worker invocation + job-id surfacing

Fixes three issues found reviewing `apps/admin` menu-scan (2026-06-16):

1. **Worker POST blocks the whole scan.** `adminCreateMenuScanJob` / `replayMenuScan`
   `await` a `fetch` to `menu-scan-worker`, and the worker runs the **entire**
   extraction synchronously before responding (`handleRequest` → `await processJobs`,
   `infra/supabase/functions/menu-scan-worker/index.ts:1032`). So job creation blocks
   30–120s+, batch uploads serialize, and a serverless/platform timeout makes the form
   report **"Failed"** for a scan that actually completes.
2. **No automatic recovery.** `116b_menu_scan_cron.sql` was disabled 2026-05-03. The
   comment in `menuScan.ts:56` ("cron will pick it up if direct call fails") is now
   false — a swallowed `fetch` failure strands the job at `pending` indefinitely.
3. **Upload form mislabels restaurant id as job id.** `JobStatus.jobId` actually holds
   the *restaurant* id (`AdminBatchUploadForm.tsx:269`); the real created job id
   (`result.data.jobId`, which `adminCreateMenuScanJob` returns) is discarded, so the
   post-submit list shows a restaurant UUID and offers no click-through to the new job.

## Root cause (1 + 2 are the same)

Job creation is coupled to a blocking, best-effort, unrecoverable worker invocation
issued from a serverless server action. The fix is to **move invocation into Postgres**
— exactly what the **embed-recovery** subsystem already does for `enrich-dish`:

- `132_vault_based_trigger_auth.sql` — `AFTER` trigger → `net.http_post` with a
  service-role key read from Vault (live path).
- `133_embed_recovery_cron.sql` (widened in `164`) — a `*/5 * * * *` cron sweep that
  re-invokes the Edge Function for rows stuck `pending`/`failed` (recovery net).

We mirror that split for menu-scan: a trigger fires the worker the instant a job is
queued, and a low-frequency recovery cron re-fires it for any job that slips through.
The TS action stops POSTing the worker entirely, so it returns immediately after the
DB insert.

## Design decisions (please confirm before I execute)

- **Vault secret.** The migrations read the service-role key from Vault. Default name:
  `service_role_key` (the secret `116b` already required). **Prerequisite — confirm it
  still exists** (or tell me the name to use / create a dedicated `menu_scan_service_key`):
  ```sql
  SELECT name FROM vault.decrypted_secrets WHERE name IN ('service_role_key','menu_scan_service_key');
  ```
  Its value must equal the project's `SUPABASE_SERVICE_ROLE_KEY` (what the worker's
  `handleRequest` compares the `Authorization: Bearer …` header against).
- **Recovery cron is included** (recommended) — without it, a failed trigger delivery
  still strands a job (the trigger only fires once, on insert). Drop it if you want
  trigger-only minimalism.
- **Trigger fires on INSERT only**, not on requeue-to-`pending`. Retries (set back to
  `pending` by `fail_menu_scan_job`) are recovered by the 5-min cron, which gives them
  natural backoff instead of an immediate hammer loop.
- **Project URL is hardcoded** (`https://tqroqqvxabolydyznewa.supabase.co/functions/v1/menu-scan-worker`)
  to match the embed-recovery precedent (132/133/164), rather than the Vault `project_url`
  lookup the old 116b cron used.

## Changes

### A. New migration `170_menu_scan_worker_trigger_recovery.sql` (+ `170_REVERSE_ONLY_…`)

The worker ignores its request body (it just claims the oldest `pending` job and drains
up to `MAX_PER_TICK`), so every POST sends `'{}'::jsonb`. `claim_menu_scan_job` is atomic
(`FOR UPDATE SKIP LOCKED`), so duplicate/concurrent POSTs are harmless.

**1. Live-path trigger:**
```sql
CREATE OR REPLACE FUNCTION public._trg_invoke_menu_scan_worker()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $fn$
DECLARE
  v_url TEXT := 'https://tqroqqvxabolydyznewa.supabase.co/functions/v1/menu-scan-worker';
  v_key TEXT;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets WHERE name = 'service_role_key';

  IF v_key IS NULL THEN
    RAISE WARNING 'service_role_key not in vault; menu-scan worker not invoked for job %', NEW.id;
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := v_url,
    body    := '{}'::jsonb,
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || v_key
               )
  );
  RETURN NEW;
END;
$fn$;

CREATE TRIGGER trg_invoke_menu_scan_worker
AFTER INSERT ON public.menu_scan_jobs
FOR EACH ROW
WHEN (NEW.status = 'pending')
EXECUTE FUNCTION public._trg_invoke_menu_scan_worker();
```
`net.http_post` enqueues inside the inserting transaction, so the request is sent only
after commit (the job row is already visible to the worker) and is rolled back if the
insert is — no phantom invocations.

**2. Recovery cron (one POST per tick when work is stuck; worker drains the rest):**
```sql
CREATE OR REPLACE FUNCTION public._cron_menu_scan_recovery_tick()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $fn$
DECLARE
  v_url   TEXT := 'https://tqroqqvxabolydyznewa.supabase.co/functions/v1/menu-scan-worker';
  v_key   TEXT;
  v_stuck INT;
BEGIN
  SELECT count(*) INTO v_stuck
  FROM public.menu_scan_jobs
  WHERE (status = 'pending'
         OR (status = 'processing' AND locked_until < now()))
    AND created_at < now() - interval '1 minute';   -- don't race the live trigger

  IF v_stuck = 0 THEN RETURN; END IF;

  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets WHERE name = 'service_role_key';
  IF v_key IS NULL THEN
    RAISE WARNING 'service_role_key not in vault; menu-scan recovery skipped';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := v_url,
    body    := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type','application/json',
                                  'Authorization','Bearer ' || v_key)
  );
  RAISE NOTICE 'menu-scan-recovery-tick: % stuck job(s); worker invoked', v_stuck;
END;
$fn$;

SELECT cron.schedule('menu-scan-recovery-tick', '*/5 * * * *',
                     $$SELECT public._cron_menu_scan_recovery_tick();$$);
```
Reverse migration: `cron.unschedule('menu-scan-recovery-tick')`, `DROP TRIGGER`,
`DROP FUNCTION` both.

### B. `apps/admin/src/app/(admin)/menu-scan/actions/menuScan.ts`

Remove the worker-POST block from **both** `adminCreateMenuScanJob` and `replayMenuScan`
(the DB trigger now owns invocation). Delete the env-var `fetch` and the stale
"cron will pick it up" / "fire worker best-effort" comments; replace with a one-line note
that the `AFTER INSERT` trigger (migration 170) invokes the worker. Everything else
(insert, audit log, `revalidatePath`, return shape) is unchanged — the action now returns
as soon as the row is inserted.

### C. `apps/admin/src/app/(admin)/menu-scan/AdminBatchUploadForm.tsx` (issue 3)

- `JobStatus` → `{ restaurantId: string; restaurantName: string; jobId: string | null;
  status: 'pending' | 'done' | 'error'; error?: string }`.
- `UPDATE_JOB_STATUS` action carries `restaurantId` (correlation key) + optional `jobId`;
  reducer matches on `restaurantId` and sets `jobId`/`status`/`error`.
- `handleSubmit`: build `initialStatuses` with `restaurantId` + looked-up
  `restaurantName` (from `state.options`); on success capture `result.data.jobId`.
- Status list renders the **restaurant name** plus a `View job →` link to
  `/menu-scan/{jobId}` when `jobId` is set, instead of the raw `s.jobId` UUID.

Client-only; no server contract change.

### D. Tests — `apps/admin/src/__tests__/menu-scan/replay-menu-scan.test.ts`

Removing the fetch breaks two assertions:
- happy-path `expect(mockFetch).toHaveBeenCalledOnce()` — drop it (and the "fires the
  worker" wording); keep the `newJobId` + audit-log assertions.
- `'still returns ok=true when worker fetch fails (best-effort)'` — delete (no longer a
  code path). The `vi.stubGlobal('fetch', …)` setup can stay harmlessly or be removed.

`adminCreateMenuScanJob` has no dedicated worker-fetch test to update. No new unit test
for the trigger/cron (SQL); covered by the manual smoke test below.

## Rollout order

1. Confirm/create the `service_role_key` Vault secret (prerequisite query above).
2. Apply migration **170** from `infra/supabase/` (trigger + cron live immediately;
   the still-awaited TS fetch is now redundant but harmless — safe overlap).
3. Deploy the admin app (B + C + D) — drops the redundant fetch.
   Order is flexible: 170-before-app means brief double-invocation (idempotent);
   app-before-170 would briefly leave creation with no invoker, so prefer **170 first**.

## Verification

- **Smoke:** upload a menu → the row appears `pending` and flips to `processing`
  within ~1–2s with no app-side POST; confirm `adminCreateMenuScanJob` returns
  immediately (no multi-second hang).
- **Recovery:** insert a `pending` job directly (bypass the trigger) → it gets picked up
  within 5 min; check `RAISE NOTICE` in Postgres logs.
- **Issue 3:** batch-upload 2 restaurants → each row shows the restaurant name and a
  working `View job →` link to the correct `/menu-scan/{jobId}`.
- `cd apps/admin && npx vitest run src/__tests__/menu-scan` is green.

## Risks / notes

- **Vault secret missing** → trigger & cron `RAISE WARNING` and skip (no invocation);
  jobs sit `pending`. Mitigated by the prerequisite check. This is the single most
  important thing to confirm before applying 170.
- `net.http_post` is fire-and-forget with no built-in retry; the 5-min cron is the retry
  mechanism, matching embed-recovery's proven behavior.
- No change to the worker, `result_json` shape, the review UI, or
  `admin_confirm_menu_scan`.
</content>
</invoke>
