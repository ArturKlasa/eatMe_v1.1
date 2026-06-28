# Small Memos — Web Portal v2 Research

Four tactical memos. Each is self-contained.

- **B1** — Supabase Edge Function + pg_cron mechanics for the menu-scan worker.
- **C1** — OpenAI Structured Outputs + Vision confirmation memo (inherit 2026-04-06 pattern).
- **G1** — Image upload pipeline: browser-side resize vs server-side Sharp.
- **G2** — Ingredient-gap column defaults (`null` vs `[]`).

---

## Memo B1 — Supabase Edge Function + pg_cron mechanics

### Runtime limits (confirmed against Supabase docs)

| Limit | Value | Source |
|---|---|---|
| Max CPU time per invocation | **2 seconds** (actual on-CPU time; excludes async I/O) | [Limits](https://supabase.com/docs/guides/functions/limits) |
| Max wall time (free) | **150 s** | Limits |
| Max wall time (paid) | **400 s** | Limits |
| Request idle timeout | **150 s** (returns 504 if no response) | Limits |
| Max memory | **256 MB** (Supabase cap; Deno Deploy engine itself allows 512 MB) | Limits + runtime discussion |
| Bundled function size | **20 MB** after CLI bundling | [Bundle size troubleshooting](https://supabase.com/docs/guides/troubleshooting/edge-function-bundle-size-issues) |
| Max request body | **10 MB** (confirmed by Supabase team) | [discussion 20864](https://github.com/orgs/supabase/discussions/20864) |
| Deno version | Not publicly pinned; uses Supabase's Edge Runtime (fork of Deno Deploy). Assume modern Deno (≥ 1.45). | — |

**Implication for menu-scan:** the GPT call itself can easily exceed 2 s of CPU and 150 s of wall time on large multi-page menus. Strategy:
- One cron tick = one job claim = one GPT call for one image/page.
- Multi-page menus are N queued jobs, not one fat job.
- Keep wall time per invocation well under 150 s; paid tier gives 400 s headroom for stubborn pages but don't rely on it.
- The 10 MB request-body limit is a hard wall for "POST image to the Edge Function." Browser-side resize before upload (see Memo G1) is mandatory, OR the payload is a URL to Supabase Storage (recommended).

### pg_cron in Supabase

- `pg_cron` is a first-party Supabase extension, exposed as **Supabase Cron** (dashboard UI + SQL). On hosted Supabase it is available; enable via SQL Editor if not already: `CREATE EXTENSION IF NOT EXISTS pg_cron;` plus `CREATE EXTENSION IF NOT EXISTS pg_net;`. Source: [Cron guide](https://supabase.com/docs/guides/cron) + [pg_net docs](https://supabase.com/docs/guides/database/extensions/pg_net).
- Scheduling API: `cron.schedule(job_name text, cron_expression text, sql_statement text)`. Smallest granularity in `pg_cron` is **1 minute** via standard cron syntax (`* * * * *`). Sub-minute needs `*/30 * * * *` pattern over seconds which `pg_cron` does **not** natively support — to go faster than 1 min you'd schedule multiple staggered jobs, not worth the complexity at v2 scale.
- To call an Edge Function from cron, use `pg_net`'s `net.http_post(url, body, params, headers, timeout_milliseconds)` returning a `bigint` request id. Default timeout is 2000 ms — **override this** for jobs that invoke Edge Functions that block on GPT.

Source for all SQL below: [Scheduling Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions).

### Proposed architecture — two-part

#### 1) Claim table (in a new migration)

```sql
-- menu_scan_jobs exists (see supabase/migrations/database_schema.sql:253).
-- v2 adds locked_until + attempts to support the claim pattern:
ALTER TABLE public.menu_scan_jobs
  ADD COLUMN IF NOT EXISTS locked_until timestamptz,
  ADD COLUMN IF NOT EXISTS attempts int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error text;

CREATE INDEX IF NOT EXISTS menu_scan_jobs_claim_idx
  ON public.menu_scan_jobs (status, locked_until)
  WHERE status IN ('pending', 'processing');
```

#### 2) Claim function (atomic pick-one-job)

```sql
CREATE OR REPLACE FUNCTION public.claim_menu_scan_job(p_lock_seconds int DEFAULT 180)
RETURNS public.menu_scan_jobs
LANGUAGE plpgsql
SECURITY DEFINER
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
         OR (status = 'processing' AND locked_until < now())   -- retry stuck
      ORDER BY created_at
      LIMIT 1
      FOR UPDATE SKIP LOCKED
   )
   RETURNING * INTO j;
  RETURN j;  -- NULL if no job
END;
$$;
```

`FOR UPDATE SKIP LOCKED` is the correct concurrency primitive — multiple concurrent workers never claim the same row. Sketch lifted from standard Postgres worker-queue patterns.

#### 3) Completion / failure helpers

```sql
CREATE OR REPLACE FUNCTION public.complete_menu_scan_job(p_id uuid, p_result jsonb)
RETURNS void LANGUAGE sql AS $$
  UPDATE public.menu_scan_jobs
     SET status='completed', result=p_result, locked_until=NULL, updated_at=now()
   WHERE id=p_id;
$$;

CREATE OR REPLACE FUNCTION public.fail_menu_scan_job(
  p_id uuid, p_error text, p_max_attempts int DEFAULT 3
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.menu_scan_jobs
     SET status = CASE WHEN attempts >= p_max_attempts THEN 'failed' ELSE 'pending' END,
         locked_until = NULL,
         last_error = p_error,
         updated_at = now()
   WHERE id = p_id;
END; $$;
```

#### 4) Cron schedule (every 1 minute)

```sql
SELECT cron.schedule(
  'menu-scan-worker-tick',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='project_url')
           || '/functions/v1/menu-scan-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='service_role_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 145000   -- just under 150s idle cap
  );
  $$
);
```

Why service-role: the worker needs to read owner-bound job rows regardless of RLS.

#### 5) Edge Function handler skeleton (`supabase/functions/menu-scan-worker/index.ts`)

```ts
import { createClient } from 'jsr:@supabase/supabase-js@2';
import OpenAI from 'npm:openai@4';

const supa = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);
const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY')! });

Deno.serve(async (_req) => {
  // Process up to N jobs per tick (bounded to stay under the 150s idle cap).
  const MAX_PER_TICK = 3;
  const processed: string[] = [];

  for (let i = 0; i < MAX_PER_TICK; i++) {
    const { data: job } = await supa.rpc('claim_menu_scan_job', { p_lock_seconds: 180 });
    if (!job) break;

    try {
      const result = await runGptExtraction(job.input);                 // see Memo C1
      await supa.rpc('complete_menu_scan_job', { p_id: job.id, p_result: result });
      processed.push(job.id);
    } catch (e) {
      await supa.rpc('fail_menu_scan_job', {
        p_id: job.id, p_error: String(e), p_max_attempts: 3,
      });
    }
  }

  return new Response(JSON.stringify({ processed }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

### Scheduling cadence — trade-off

| Cadence | Owner-visible latency | DB/Edge load |
|---|---|---|
| 1 min (`* * * * *`) | p50 ~30 s, p95 ~60 s | 1 invocation/min always-on |
| 15 s (impossible with single cron job alone) | ~10 s | 4×/min always-on |
| 10 min | bad UX | minimal |

**Recommendation:** 1-minute cron. The worker itself loops up to `MAX_PER_TICK=3` claims per tick, giving bursty throughput without burning cron slots. For the owner-perceived "I just clicked Scan and I'm staring at a spinner" moment, combine cron with a one-shot direct Edge Function invocation on job insert (client fires-and-forgets `POST /functions/v1/menu-scan-worker`) — cron is the safety net, not the hot path.

### Retries

`pg_cron` does **not** retry a failed SQL statement; if `net.http_post` returns non-2xx the tick is simply lost. The table-based claim pattern above handles this: stuck `processing` rows whose `locked_until` has passed are picked up on the next tick. After `MAX_ATTEMPTS=3` a job is marked `failed` and surfaces in an admin view.

### Observability

- **Edge Function logs**: Supabase Dashboard → Edge Functions → Logs (structured JSON log lines, retained 7 d on free tier, 30 d on paid).
- **Cron run history**: `SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 50;` — includes success/error, duration, stdout.
- **pg_net request status**: `SELECT * FROM net._http_response WHERE id = <request_id>;` — useful when diagnosing "why didn't the function fire?"
- **Stuck job alert**: an admin dashboard query `SELECT count(*) FROM menu_scan_jobs WHERE status='processing' AND locked_until < now() - interval '10 minutes'` — render a red pill if > 0. For real-time alerting, a separate `pg_cron` job on a 5-minute schedule can `net.http_post` to a Slack webhook URL stored in `vault.secrets` when the query returns a non-zero count.

### Cold start

Supabase Edge Runtime cold starts are typically **50–300 ms** for small bundles (well under the > 1 s cold-start seen on AWS Lambda). The GPT SDK + supabase-js bundle pushes that toward 500–800 ms on first invocation after idle. With a 1-minute cron this is effectively always-warm — the cron itself serves as the keep-alive ping. **No separate warm ping needed.**

---

## Memo C1 — OpenAI Structured Outputs + Vision (inherit + verify)

### Inherited pattern from `2026-04-06-menu-ingestion-enrichment`

Skim of `detailed-design.md` and confirmation against live code at `apps/web-portal/app/api/menu-scan/route.ts:253-274`:

| Element | Prior plan specified | Live v1 code |
|---|---|---|
| Model | `gpt-4o` for extraction, `gpt-4o-mini` for enrichment | `gpt-4o` (route.ts:254), `gpt-4o-mini` (suggest-ingredients/route.ts:92) |
| Response format | Structured Outputs (`json_schema`, `strict: true`) via `zodResponseFormat` | `zodResponseFormat(MenuExtractionSchema, 'menu_extraction')` (route.ts:271) |
| Input | Base64 `image_url` content block with `detail: 'high'` | exact match (route.ts:261-263) |
| Temperature | 0.1 | 0.1 (route.ts:273) |
| Max tokens | 16384 | 16384 (route.ts:272) |

The v1 implementation already follows this integration shape; v2 **inherits the pattern**
(model, `zodResponseFormat`, `strict: true`, temperature, image-block format, multi-page
merge) but **rewrites the prompt text and the response schema** for v2's data model. The
schema drift is material — v2 drops allergen / dietary / ingredient extraction (UI hides
them; writes `[]`), pins `dish_kind` to the 5-value post-migration-115 enum (v1's prompt
predates the rename), pins `primary_protein` to the 11-value list in
`packages/shared/src/logic/protein.ts`, adds per-dish **category-name suggestions** so the
review UI can offer one-click "create category + assign" actions instead of per-dish
manual assignment, and keeps `source_image_index` + per-field confidence unchanged.
Concrete deltas live in `design §4.4` and the plan's Step 19.

### API surface — confirmed current (April 2026)

**Structured Outputs request shape** — unchanged since 2024-08 launch, idiomatic in 2026 ([docs](https://platform.openai.com/docs/guides/structured-outputs)):

```ts
await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [...],
  response_format: {
    type: 'json_schema',
    json_schema: {
      name: 'menu_extraction',
      strict: true,
      schema: { type: 'object', properties: {...}, required: [...], additionalProperties: false },
    },
  },
});
```

Or via the typed helper that v1 uses: `response_format: zodResponseFormat(zSchema, 'menu_extraction')`.

**Vision + Structured Outputs in one call** — explicitly supported. `messages[].content` is an array of blocks mixing `{type:'text'}` and `{type:'image_url', image_url:{url, detail}}`. The `response_format` applies regardless. Confirmed by v1 working code and by [introducing-structured-outputs](https://openai.com/index/introducing-structured-outputs-in-the-api/).

### Model comparison (menu-scan, April 2026 pricing)

| Model | Input $/M tok | Output $/M tok | Vision | Structured Outputs | Recommendation |
|---|---|---|---|---|---|
| `gpt-4o` | 2.50 | 10.00 | yes | yes | **Default for extraction** — highest vision accuracy |
| `gpt-4o-mini` | 0.15 | 0.60 | yes | yes | **Default for enrichment + fallback** — ~17× cheaper, weaker at dense menu layouts |
| `gpt-4o-2024-11-20` | 2.50 | 10.00 | yes | yes | Pin this specific snapshot if you want reproducible extraction behavior |
| `gpt-4.1` | 2.00 | 8.00 | yes | yes | Newer, cheaper-than-4o, strong at long context — worth a v2 spike; default to 4o until benchmarked |

Sources: [OpenAI API Pricing](https://openai.com/api/pricing/), [pricepertoken 4o](https://pricepertoken.com/pricing-page/model/openai-gpt-4o), [pricepertoken 4.1](https://pricepertoken.com/pricing-page/model/openai-gpt-4.1).

**Concrete picks for v2:**
- **Default extraction:** `gpt-4o` (or pin `gpt-4o-2024-11-20`).
- **Fallback on rate-limit / retry #2:** `gpt-4o-mini`.
- **Enrichment (text-only, post-extraction):** `gpt-4o-mini`.

### JSON-schema gotchas (still current)

- `additionalProperties: false` is **required** at every object level when `strict: true`. [community thread](https://community.openai.com/t/schema-additionalproperties-must-be-false-when-strict-is-true/929996).
- `required` must list **every** property name — "optional" fields must be modeled as `{type: ['string', 'null']}` instead.
- `enum` supported; `oneOf` / `anyOf` supported but discouraged for `strict`.
- Arrays supported with a fixed `items` schema. Nested objects fine.
- `zodResponseFormat` handles all of this automatically — prefer it over hand-rolled schemas.

### Retry / rate-limit behavior

| Error | SDK surface | Retry strategy |
|---|---|---|
| 429 rate limit | `RateLimitError` | Respect `Retry-After` header; exponential backoff 1s, 2s, 4s |
| 500 / 502 / 503 | `APIError` | Linear retry ×2 |
| 400 schema violation | `BadRequestError` | Do **not** retry; surface to admin |
| Context length exceeded | `BadRequestError` | Split menu image / reduce `detail` to `low` |
| Network timeout | `APIConnectionError` | Up to 2 retries |

The v2 job system's `attempts` column (Memo B1) handles persistence across retries. The SDK itself has `maxRetries: 2` by default — keep that **plus** the table-level retry, don't disable it.

### "Inherit + verify" checklist

- [x] Keep `gpt-4o` as default extraction model.
- [x] Keep `zodResponseFormat` with `strict: true`.
- [x] Keep `detail: 'high'` on image content blocks.
- [x] Keep `temperature: 0.1`, `max_tokens: 16384`.
- [ ] **Move the OpenAI call out of the Next.js API route and into the Edge Function worker** (Memo B1). No more `maxDuration` concerns.
- [ ] **Pin the model snapshot** (e.g. `gpt-4o-2024-11-20`) to insulate against silent behavior drift — rough-idea calls this out as a v1 pain point.
- [ ] **Add `gpt-4o-mini` as an explicit fallback tier** triggered by 429 or `attempts >= 2`.

Nothing in the Structured Outputs / Vision API has changed in a way that breaks the 2026-04-06 plan. Proceed to v2 reusing it.

---

## Memo G1 — Browser-side resize vs server-side Sharp

### Context

Menu-scan uploads are the **primary image ingress**. Source files are phone-camera JPEGs, typically 3–12 MB per page. The 10 MB Edge Function request-body cap ([Supabase discussion 20864](https://github.com/orgs/supabase/discussions/20864)) is the single hardest constraint.

### Options compared

| Option | Owner bandwidth | Server cost | Quality control | Fits 10 MB cap? |
|---|---|---|---|---|
| Raw upload → Edge Fn Sharp | full-res (~12 MB) | high (Sharp in WASM or route) | consistent | **No** — fails on many phones |
| Raw upload → Next.js route + Sharp | full-res | moderate (Vercel fn time) | consistent | Vercel route has its own 4.5 MB body cap on Hobby, 50 MB on Pro — Pro only |
| Browser resize → Edge Fn / direct storage | ~500 KB–1.5 MB | near-zero | varies by browser, tuned via lib | **Yes** easily |
| **Hybrid** (recommended) | ~500 KB–1.5 MB | optional re-encode at render time | tight | **Yes** |

### Browser-side resize library pick

**Recommendation: `browser-image-compression`** over a hand-rolled Canvas utility.

| Criterion | `browser-image-compression` | Hand-rolled Canvas |
|---|---|---|
| Bundle size | ~12 KB gzipped + `uzip` (2 KB) on WebP path | ~1–3 KB |
| Web Worker off-main-thread | Yes (`useWebWorker: true` default) | Manual |
| EXIF rotation | Handled | Manual |
| JPEG / PNG / WebP / HEIC conversion | Handled (HEIC requires canvas path) | Manual per format |
| API | 1-liner `imageCompression(file, opts)` | ~30 lines for a correct impl |
| Maintenance | Active, widely-used | Your problem |

Source: [browser-image-compression npm](https://www.npmjs.com/package/browser-image-compression). 10 MB phone photo → ~700 KB compressed in ~1 s on mid-range laptop; UI stays responsive due to Web Worker.

The +14 KB bundle weight is trivial against the time saved on EXIF + HEIC handling. Only rebuild on raw Canvas if bundle budget is already red-lined.

### Upload target

**Recommendation: direct browser → Supabase Storage**, not through the Edge Function.

- Supabase Storage supports direct `multipart/form-data` upload from the browser via `supabase.storage.from(bucket).upload(path, file)` — "standard method ideal for files not larger than 6 MB, up to 5 GB technically supported." ([Storage uploads](https://supabase.com/docs/guides/storage/uploads/standard-uploads)).
- RLS on the bucket (`menu-scan-uploads`, owner-scoped `(owner_id = auth.uid())`) gives the same security guarantees as a server-mediated upload.
- `menu_scan_jobs.input` stays as JSONB `{ images: [{ storage_path, bucket }] }` — the Edge Function worker fetches the image from Storage using the service-role client. No 10 MB cap on the worker side because the image never traverses the Edge Function request body.
- Prior planning already established Storage as the source (`apps/web-portal/app/api/menu-scan/route.ts:262` reads `base64Data` — v2 replaces that with a Storage-URL fetch inside the Edge Function).

### Recommended recipe

```ts
// Client (apps/web-portal-v2/src/lib/upload.ts)
import imageCompression from 'browser-image-compression';
import { createBrowserClient } from '@supabase/ssr';

export async function uploadMenuPage(file: File, restaurantId: string) {
  const compressed = await imageCompression(file, {
    maxSizeMB: 2,
    maxWidthOrHeight: 2048,
    useWebWorker: true,
    fileType: 'image/jpeg',
    initialQuality: 0.85,
  });

  const supa = createBrowserClient(...);
  const path = `${restaurantId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supa.storage
    .from('menu-scan-uploads')
    .upload(path, compressed, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return { bucket: 'menu-scan-uploads', path };
}
```

The `menu_scan_jobs` row is then inserted with `input: { images: [{ bucket, path, pageNumber: 1 }, ...] }`. The Edge Function worker does `supa.storage.from(bucket).download(path)` and base64-encodes for the OpenAI `image_url` block (or uses a signed URL — both are valid inputs).

### When server-side Sharp pays for itself

Only if quality complaints arise:
- Older Android Chrome emitting soft JPEGs
- Need WebP/AVIF delivery variants (CDN optimization)
- Need consistent ICC-profile normalization

In that case, add a post-ingest pipeline: browser still compresses for upload bandwidth, a separate Edge Function (or Next.js route with Sharp) rewrites stored images to optimized delivery variants. Out of scope for v2 primary path.

### Decision

- Browser-side: **`browser-image-compression`**, max 2048 px longest side, JPEG quality 0.85, ~2 MB cap.
- Upload target: **Supabase Storage directly** via `supabase-js` client; RLS scoped by `owner_id`.
- Edge Function worker reads Storage; never accepts the image as request body.
- Sharp: **not needed for v2**; re-evaluate only on quality complaints.

---

## Memo G2 — Ingredient-gap column defaults

### Evidence

**DB column nullability** — `packages/database/src/types.ts:428,434` show `dishes.allergens` and `dishes.dietary_tags` typed as `string[] | null` in both `Row` and `Insert`. The column is nullable in live Postgres; the generated types confirm.

**Mobile render code** — the two call sites are tolerant of both `null` and `[]`:

- `apps/mobile/src/screens/restaurant-detail/DishMenuItem.tsx:73-76` uses optional chaining: `item.dietary_tags?.includes('vegan')`. If the field is `null` or `undefined`, `?.` short-circuits and the emoji simply doesn't render. No conditional branch.
- `apps/mobile/src/utils/menuFilterUtils.ts:56-64`:
  ```ts
  allergens?: string[] | null;
  dietary_tags?: string[] | null;
  ...
  const allergens: string[] = dish.allergens ?? [];
  const dietaryTags: string[] = dish.dietary_tags ?? [];
  ```
  Explicit `?? []` coalesce — either default produces the same filter result (`[].includes(x) === false`, so a dish with `null`/`[]` allergens passes allergen exclusion).

**Shared types** — `packages/shared/src/types/restaurant.ts:116-117` declares `dietary_tags: string[]` and `allergens: string[]` as **non-nullable** on the interface. This is an aspirational shape that does not match the DB (the mobile filter util re-declares them nullable, line 56-57, to reflect reality).

### Answer

**Use `[]` (empty array) for new v2 dishes**, not `null`. Rationale:

1. Mobile code already coalesces `null → []`, so both are behaviorally equivalent today.
2. `@eatme/shared` `Dish` interface types the fields as non-nullable `string[]` — `[]` is the value that matches the documented type contract. `null` silently violates it.
3. `[]` narrows no intent: "we know this dish has no allergens we tracked" vs "we don't know" is a distinction v2 explicitly chooses **not** to surface (rough-idea "Known accepted gap" section). Since v2 is not tracking, the gap should not leak into the data as three-valued logic.
4. The rough-idea itself ("Out of scope … the `dishes.allergens` / `dishes.dietary_tags` columns stay. Existing data and triggers continue to work") implies existing rows — some populated, some `null` — are left alone. New v2 writes should be clean `[]`.

### Supplementary

- **Legacy v1 rows with `null`** will continue to render correctly (mobile's `?? []` handles them). No backfill required.
- The `@eatme/shared` non-nullable declaration is **already drifting** from reality — if v2 wants to stay honest, a follow-up minor-change is to widen it to `string[] | null` in the interface. Not urgent.
- Zod schema at `packages/shared/src/validation/restaurant.ts:59-60` enforces `z.array(z.string())` (non-nullable, comment notes auto-populated by trigger). Aligned with the `[]` default; a `null` insert from v2 would fail this validator if the v2 write path uses it.

### Verdict (one line)

Write `allergens: []` and `dietary_tags: []` on v2 dish inserts — matches the shared type, matches the Zod validator, renders identically to `null` on mobile, and keeps the data model 2-valued instead of 3-valued.
