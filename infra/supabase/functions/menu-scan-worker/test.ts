// test.ts — Deno integration tests for menu-scan-worker
// Run with (from repo root):
//   deno test --node-modules-dir=none -A infra/supabase/functions/menu-scan-worker/test.ts
//   • --node-modules-dir=none → resolve npm deps from Deno's global cache; without it Deno 2
//     finds the monorepo node_modules, switches to "manual" mode, and fails to resolve npm:openai.
//   • -A → index.ts top-level Deno.serve needs --allow-net (more than the old --allow-env).
//
// Tests mock Supabase + OpenAI deps so no live DB or API key is needed.

import {
  assertEquals,
  assertArrayIncludes,
} from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import OpenAI from 'npm:openai@4';
import {
  processJobs,
  handleRequest,
  NoImagesError,
  WorkerDeps,
  ProcessResult,
  MAX_PER_TICK,
  PRIMARY_PROTEINS,
} from './index.ts';
import { PRIMARY_PROTEINS as CANONICAL_PRIMARY_PROTEINS } from '../../../../packages/shared/src/logic/protein.ts';

// ── Fixtures ──────────────────────────────────────────────────────────────────

// 1×1 pixel transparent PNG, base64 — tiny but valid binary fixture.
const FIXTURE_IMAGE_BYTES = new Uint8Array([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0,
  0, 144, 119, 83, 222, 0, 0, 0, 12, 73, 68, 65, 84, 8, 215, 99, 248, 207, 192, 0, 0, 0, 2, 0, 1,
  226, 33, 188, 51, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
]);

const CANNED_RESULT = {
  dishes: [
    {
      name: 'Grilled Salmon',
      description: 'Fresh Atlantic salmon',
      price: 24.5,
      // Portion fields are required (nullable) in the Zod schema, so real model
      // output always carries them — and runExtraction re-emits them on every
      // dish. Without them here assertEquals trips on undefined-vs-missing.
      portion_amount: null,
      portion_unit: null,
      portion_source_text: null,
      dish_kind: 'standard',
      dining_format: null,
      bundled_items: [],
      modifier_groups: [],
      primary_protein: 'fish',
      suggested_category_name: 'Mains',
      canonical_category_slug: null,
      suggested_category_description: null,
      suggested_dish_category: 'Salmon',
      source_image_index: 0,
      confidence: 0.95,
    },
  ],
  // runExtraction merges per-page results into a single shape that always
  // includes detected_language (the Zod schema requires the field — null is
  // the canonical "uncertain" value). Keeping it here avoids assertEquals
  // tripping on the missing-vs-null difference.
  detected_language: null,
  // Phase 3b: runExtraction unions + normalizes per-page cuisine guesses onto
  // the merged result. Single page → this value passes through normalizeCuisines.
  cuisine_types: ['Seafood'],
};

function makeJob(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    attempts: 1,
    status: 'processing',
    input: {
      images: [{ bucket: 'menu-scan-uploads', path: `owner/${id}.jpg`, page: 1 }],
    },
    ...overrides,
  };
}

// ── Mock builders ─────────────────────────────────────────────────────────────

type MockRpc = (
  fn: string,
  args: Record<string, unknown>
) => Promise<{ data: unknown; error: null | { message: string } }>;

function makeSupaMock(options: {
  jobs?: ReturnType<typeof makeJob>[];
  onComplete?: (id: string, result: unknown) => void;
  onFail?: (id: string, error: string, maxAttempts: number) => void;
  // Phase 3b: existing cuisine the restaurants shim returns. Defaults non-empty
  // so existing tests skip the self-heal write; set to [] to exercise it.
  restaurantCuisine?: string[] | null;
  onCuisineUpdate?: (id: string, cuisines: string[]) => void;
}) {
  const {
    jobs = [],
    onComplete,
    onFail,
    restaurantCuisine = ['Italian'],
    onCuisineUpdate,
  } = options;
  let claimIndex = 0;

  return {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      if (fn === 'claim_menu_scan_job') {
        const job = jobs[claimIndex++] ?? null;
        return { data: job, error: null };
      }
      if (fn === 'complete_menu_scan_job') {
        onComplete?.(args.p_id as string, args.p_result);
        return { data: null, error: null };
      }
      if (fn === 'fail_menu_scan_job') {
        onFail?.(args.p_id as string, args.p_error as string, args.p_max_attempts as number);
        return { data: null, error: null };
      }
      return { data: null, error: null };
    },
    // Phase 3b: minimal restaurants table shim for the cuisine self-heal.
    from: (table: string) => {
      if (table === 'restaurants') {
        return {
          select: (_cols: string) => ({
            eq: (_col: string, _val: unknown) => ({
              single: async () => ({ data: { cuisine_types: restaurantCuisine }, error: null }),
            }),
          }),
          update: (patch: { cuisine_types: string[] }) => ({
            eq: async (_col: string, id: string) => {
              onCuisineUpdate?.(id, patch.cuisine_types);
              return { error: null };
            },
          }),
        };
      }
      // canonical_menu_categories (fetchCanonicalSlugs) + any other table:
      // support .select().eq().order() resolving to an empty set.
      return {
        select: (_cols: string) => ({
          eq: (_col: string, _val: unknown) => ({
            order: async (_c: string, _o: unknown) => ({ data: [], error: null }),
          }),
        }),
      };
    },
    storage: {
      from: (_bucket: string) => ({
        download: async (_path: string) => ({
          data: new Blob([FIXTURE_IMAGE_BYTES]),
          error: null,
        }),
      }),
    },
  };
}

function makeOpenAIMock(
  options: {
    result?: unknown;
    rateLimitOnCall?: number; // throw RateLimitError on this call number (1-based)
    badRequest?: boolean;
  } = {}
) {
  const { result = CANNED_RESULT, rateLimitOnCall, badRequest = false } = options;
  let callCount = 0;

  return {
    beta: {
      chat: {
        completions: {
          parse: async () => {
            callCount++;
            if (badRequest) {
              throw new OpenAI.BadRequestError(
                400,
                { message: 'schema violation' },
                'Bad Request',
                {}
              );
            }
            if (rateLimitOnCall !== undefined && callCount === rateLimitOnCall) {
              throw new OpenAI.RateLimitError(429, { message: 'rate limit' }, 'Rate Limit', {});
            }
            return { choices: [{ message: { parsed: result } }] };
          },
        },
      },
    },
  } as unknown as OpenAI;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

Deno.test('pending → processing → needs_review: job transitions correctly', async () => {
  const job = makeJob('job-001');
  const completed: string[] = [];
  const failed: string[] = [];
  let capturedResult: unknown;

  const supa = makeSupaMock({
    jobs: [job],
    onComplete: (id, result) => {
      completed.push(id);
      capturedResult = result;
    },
    onFail: id => failed.push(id),
  });

  const result: ProcessResult = await processJobs({
    supa,
    openai: makeOpenAIMock(),
  });

  assertEquals(result.processed, ['job-001']);
  assertEquals(result.errors.length, 0);
  assertArrayIncludes(completed, ['job-001']);
  assertEquals(failed.length, 0);
  // The stored result is the canned extraction plus the per-page health arrays
  // runExtraction appends (clean single-page scan → both empty).
  assertEquals(capturedResult, { ...CANNED_RESULT, failed_pages: [], truncated_pages: [] });
});

Deno.test(
  'concurrency: 5 pending jobs processed with no double-claims (MAX_PER_TICK cap)',
  async () => {
    const jobs = ['job-001', 'job-002', 'job-003', 'job-004', 'job-005'].map(id => makeJob(id));
    const claimed = new Set<string>();
    let claimIndex = 0;

    // Custom supa that tracks claim order (simulating two parallel workers by running processJobs twice).
    function makeCountingSupa() {
      return {
        rpc: async (fn: string, args: Record<string, unknown>) => {
          if (fn === 'claim_menu_scan_job') {
            // Each call to claim returns the next job atomically (SKIP LOCKED simulated by index).
            const job = jobs[claimIndex++] ?? null;
            if (job && claimed.has(job.id)) return { data: null, error: null }; // already claimed
            if (job) claimed.add(job.id);
            return { data: job, error: null };
          }
          if (fn === 'complete_menu_scan_job') return { data: null, error: null };
          if (fn === 'fail_menu_scan_job') return { data: null, error: null };
          return { data: null, error: null };
        },
        from: (table: string) => {
          if (table === 'restaurants') {
            return {
              select: () => ({
                eq: () => ({
                  single: async () => ({ data: { cuisine_types: ['x'] }, error: null }),
                }),
              }),
            };
          }
          return {
            select: () => ({ eq: () => ({ order: async () => ({ data: [], error: null }) }) }),
          };
        },
        storage: {
          from: (_b: string) => ({
            download: async () => ({ data: new Blob([FIXTURE_IMAGE_BYTES]), error: null }),
          }),
        },
      };
    }

    // Run two invocations in parallel (each claims up to MAX_PER_TICK = 3).
    const [r1, r2] = await Promise.all([
      processJobs({ supa: makeCountingSupa(), openai: makeOpenAIMock() }),
      processJobs({ supa: makeCountingSupa(), openai: makeOpenAIMock() }),
    ]);

    // Total processed = first invocation gets up to MAX_PER_TICK; second gets remainder.
    const totalProcessed = r1.processed.length + r2.processed.length;
    assertEquals(totalProcessed, 5);
    // No job processed twice.
    assertEquals(new Set([...r1.processed, ...r2.processed]).size, 5);
  }
);

Deno.test(
  'retry: RateLimitError on primary → immediately falls back to the cheaper model',
  async () => {
    const job = makeJob('job-retry');
    const completed: string[] = [];

    const supa = makeSupaMock({
      jobs: [job],
      onComplete: id => completed.push(id),
    });

    // First call (primary model) → 429; second call (fallback) → success
    const openai = makeOpenAIMock({ rateLimitOnCall: 1 });

    const result = await processJobs({ supa, openai });

    assertEquals(result.processed, ['job-retry']);
    assertEquals(result.errors.length, 0);
    assertArrayIncludes(completed, ['job-retry']);
  }
);

Deno.test('retry: RateLimitError exhausted → job ends in failed after max attempts', async () => {
  // Simulate a job that is on its 3rd attempt (attempts=3) with all models failing.
  const job = makeJob('job-fail', { attempts: 3 });
  const failed: string[] = [];

  const supa = makeSupaMock({
    jobs: [job],
    onFail: id => failed.push(id),
  });

  // Persistent rate limits: the primary 429s and the rate-limit fallback 429s too,
  // on every call → the page fails on every attempt regardless of attempts count.
  const openai = {
    beta: {
      chat: {
        completions: {
          parse: async () => {
            throw new OpenAI.RateLimitError(429, { message: 'rate limit' }, 'Rate Limit', {});
          },
        },
      },
    },
  } as unknown as OpenAI;

  const result = await processJobs({ supa, openai });

  assertEquals(result.processed, []);
  assertEquals(result.errors.length, 1);
  assertEquals(result.errors[0].id, 'job-fail');
  assertArrayIncludes(failed, ['job-fail']);
});

Deno.test('bad request: BadRequestError → immediate fail (p_max_attempts=1)', async () => {
  const job = makeJob('job-bad');
  const failedIds: string[] = [];
  const failedMaxAttempts: number[] = [];

  const supa = makeSupaMock({
    jobs: [job],
    onFail: (id, _err, maxAttempts) => {
      failedIds.push(id);
      failedMaxAttempts.push(maxAttempts);
    },
  });

  const openai = makeOpenAIMock({ badRequest: true });

  const result = await processJobs({ supa, openai });

  assertEquals(result.processed, []);
  assertEquals(result.errors.length, 1);
  assertArrayIncludes(failedIds, ['job-bad']);
  // p_max_attempts=1 ensures immediate terminal failure regardless of attempts count.
  assertEquals(failedMaxAttempts[0], 1);
});

Deno.test('no jobs: returns empty result without error', async () => {
  const supa = makeSupaMock({ jobs: [] });
  const result = await processJobs({ supa, openai: makeOpenAIMock() });
  assertEquals(result.processed, []);
  assertEquals(result.errors, []);
});

Deno.test('PRIMARY_PROTEINS in index.ts is in sync with canonical protein.ts', () => {
  // Guards against a new protein added to protein.ts silently breaking the worker schema.
  assertEquals([...PRIMARY_PROTEINS].sort(), [...CANONICAL_PRIMARY_PROTEINS].sort());
});

// ── handleRequest auth guard tests ────────────────────────────────────────────

Deno.test('handleRequest: missing Authorization header → 401', async () => {
  const req = new Request('http://localhost/menu-scan-worker', { method: 'POST' });
  const supa = makeSupaMock({ jobs: [] });
  const res = await handleRequest(req, 'service-role-secret', { supa, openai: makeOpenAIMock() });
  assertEquals(res.status, 401);
});

Deno.test('handleRequest: wrong Authorization token → 401', async () => {
  const req = new Request('http://localhost/menu-scan-worker', {
    method: 'POST',
    headers: { Authorization: 'Bearer anon-public-key' },
  });
  const supa = makeSupaMock({ jobs: [] });
  const res = await handleRequest(req, 'service-role-secret', { supa, openai: makeOpenAIMock() });
  assertEquals(res.status, 401);
});

Deno.test('handleRequest: correct service-role token → 200 and runs processJobs', async () => {
  const req = new Request('http://localhost/menu-scan-worker', {
    method: 'POST',
    headers: { Authorization: 'Bearer service-role-secret' },
  });
  const supa = makeSupaMock({ jobs: [] });
  const res = await handleRequest(req, 'service-role-secret', { supa, openai: makeOpenAIMock() });
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.processed, []);
  assertEquals(body.errors, []);
});

// ── Empty-images fast-fail tests ──────────────────────────────────────────────

Deno.test('empty-images job: fast-fail with p_max_attempts=1 (not retried)', async () => {
  const job = makeJob('job-empty-images', { input: { images: [] } });
  const failedMaxAttempts: number[] = [];
  const failedIds: string[] = [];

  const supa = makeSupaMock({
    jobs: [job],
    onFail: (id, _err, maxAttempts) => {
      failedIds.push(id);
      failedMaxAttempts.push(maxAttempts);
    },
  });

  const result = await processJobs({ supa, openai: makeOpenAIMock() });

  assertEquals(result.errors.length, 1);
  assertEquals(result.errors[0].id, 'job-empty-images');
  assertArrayIncludes(failedIds, ['job-empty-images']);
  assertEquals(failedMaxAttempts[0], 1);
});

Deno.test('null-input job: fast-fail with p_max_attempts=1 (not retried)', async () => {
  const job = makeJob('job-null-input', { input: null });
  const failedMaxAttempts: number[] = [];

  const supa = makeSupaMock({
    jobs: [job],
    onFail: (_id, _err, maxAttempts) => failedMaxAttempts.push(maxAttempts),
  });

  const result = await processJobs({ supa, openai: makeOpenAIMock() });

  assertEquals(result.errors.length, 1);
  assertEquals(failedMaxAttempts[0], 1);
});

// ── Multi-image extraction tests ──────────────────────────────────────────────
//
// The worker runs one OpenAI call per image in parallel (Promise.allSettled),
// then merges the results with source_image_index forced to the loop index.
// These tests cover the merge logic + per-page failure isolation that the
// single-image fixtures above don't exercise.

function makeMultiImageJob(
  id: string,
  imageCount: number,
  overrides: Record<string, unknown> = {}
) {
  return {
    id,
    attempts: 1,
    status: 'processing',
    input: {
      images: Array.from({ length: imageCount }, (_, i) => ({
        bucket: 'menu-scan-uploads',
        path: `owner/${id}-page-${i + 1}.jpg`,
        page: i + 1,
      })),
    },
    ...overrides,
  };
}

function makeOpenAIMockSequence(results: Array<unknown | Error>): OpenAI {
  let callIdx = 0;
  return {
    beta: {
      chat: {
        completions: {
          parse: async () => {
            const r = results[callIdx++];
            if (r instanceof Error) throw r;
            return { choices: [{ message: { parsed: r }, finish_reason: 'stop' }] };
          },
        },
      },
    },
  } as unknown as OpenAI;
}

function makeCannedDishes(count: number, sourceImageIndex: number) {
  return Array.from({ length: count }, (_, i) => ({
    name: `Dish ${i + 1}`,
    description: null,
    price: 10,
    dish_kind: 'standard',
    dining_format: null,
    bundled_items: [],
    modifier_groups: [],
    primary_protein: 'chicken',
    suggested_category_name: null,
    canonical_category_slug: null,
    suggested_category_description: null,
    suggested_dish_category: null,
    // Deliberately may be wrong — runExtraction overrides from the loop index.
    source_image_index: sourceImageIndex,
    confidence: 0.9,
  }));
}

Deno.test(
  'multi-image: 3 pages all succeed, dishes tagged with correct source_image_index',
  async () => {
    const job = makeMultiImageJob('multi-001', 3);
    // deno-lint-ignore no-explicit-any
    let captured: any;

    const supa = makeSupaMock({
      jobs: [job],
      onComplete: (_id, result) => {
        captured = result;
      },
    });

    const openai = makeOpenAIMockSequence([
      { dishes: makeCannedDishes(2, 99), detected_language: 'en' },
      { dishes: makeCannedDishes(2, 99), detected_language: null },
      { dishes: makeCannedDishes(2, 99), detected_language: 'es' },
    ]);

    const result = await processJobs({ supa, openai });

    assertEquals(result.processed, ['multi-001']);
    assertEquals(result.errors.length, 0);
    assertEquals(captured.dishes.length, 6);
    // Loop index overrides the AI's deliberately-wrong 99
    // deno-lint-ignore no-explicit-any
    const indices = captured.dishes.map((d: any) => d.source_image_index).sort();
    assertEquals(indices, [0, 0, 1, 1, 2, 2]);
    // detected_language picks first non-null in encounter order
    assertEquals(captured.detected_language, 'en');
  }
);

Deno.test('multi-image: page 2 fails, pages 1 and 3 still complete', async () => {
  const job = makeMultiImageJob('multi-partial', 3);
  // deno-lint-ignore no-explicit-any
  let captured: any;
  const failed: string[] = [];

  const supa = makeSupaMock({
    jobs: [job],
    onComplete: (_id, result) => {
      captured = result;
    },
    onFail: id => failed.push(id),
  });

  const openai = makeOpenAIMockSequence([
    { dishes: makeCannedDishes(2, 0), detected_language: 'en' },
    new Error('simulated transient page-2 failure'),
    { dishes: makeCannedDishes(3, 0), detected_language: null },
  ]);

  const result = await processJobs({ supa, openai });

  // Job is reported processed (not error) — partial extraction is still useful.
  assertEquals(result.processed, ['multi-partial']);
  assertEquals(failed.length, 0);
  // 5 dishes total — 2 from page 1 (idx 0), 3 from page 3 (idx 2). None from page 2.
  assertEquals(captured.dishes.length, 5);
  // deno-lint-ignore no-explicit-any
  const indices = captured.dishes.map((d: any) => d.source_image_index).sort();
  assertEquals(indices, [0, 0, 2, 2, 2]);
  // The failed page is recorded in result_json (1-based) so the review UI can
  // warn that its dishes are missing — previously this was console.warn-only.
  assertEquals(captured.failed_pages, [2]);
  assertEquals(captured.truncated_pages, []);
});

Deno.test('multi-image: token-truncated page is recorded in truncated_pages', async () => {
  const job = makeMultiImageJob('multi-trunc', 2);
  // deno-lint-ignore no-explicit-any
  let captured: any;

  const supa = makeSupaMock({
    jobs: [job],
    onComplete: (_id, result) => {
      captured = result;
    },
  });

  // Page 1 hits max_completion_tokens (finish_reason 'length'); page 2 is clean.
  const pages = [
    { dishes: makeCannedDishes(2, 0), detected_language: 'en' },
    { dishes: makeCannedDishes(1, 0), detected_language: null },
  ];
  let callIdx = 0;
  const openai = {
    beta: {
      chat: {
        completions: {
          parse: async () => {
            const idx = callIdx++;
            return {
              choices: [
                {
                  message: { parsed: pages[idx] },
                  finish_reason: idx === 0 ? 'length' : 'stop',
                },
              ],
            };
          },
        },
      },
    },
  } as unknown as OpenAI;

  const result = await processJobs({ supa, openai });

  // Truncation is not an error — partial dishes still complete the job.
  assertEquals(result.processed, ['multi-trunc']);
  assertEquals(captured.dishes.length, 3);
  assertEquals(captured.failed_pages, []);
  assertEquals(captured.truncated_pages, [1]);
});

Deno.test('multi-image: all 3 pages fail with RateLimitError → job ends in error', async () => {
  // Every page 429s on the primary, falls back, and 429s again → all 3 pages
  // reject. 3 pages × (primary + fallback) = 6 rate-limited calls.
  const job = makeMultiImageJob('multi-totalfail', 3, { attempts: 3 });
  const failed: string[] = [];
  const failedMaxAttempts: number[] = [];

  const supa = makeSupaMock({
    jobs: [job],
    onFail: (id, _err, maxAttempts) => {
      failed.push(id);
      failedMaxAttempts.push(maxAttempts);
    },
  });

  const rateLimitErr = new OpenAI.RateLimitError(429, { message: 'rate limit' }, 'Rate Limit', {});
  // 6 = one per (page × {primary, rate-limit fallback}); both attempts 429 on every page.
  const openai = makeOpenAIMockSequence([
    rateLimitErr,
    rateLimitErr,
    rateLimitErr,
    rateLimitErr,
    rateLimitErr,
    rateLimitErr,
  ]);

  const result = await processJobs({ supa, openai });

  assertEquals(result.processed, []);
  assertEquals(result.errors.length, 1);
  assertEquals(result.errors[0].id, 'multi-totalfail');
  assertArrayIncludes(failed, ['multi-totalfail']);
  // RateLimitError is not BadRequest — keeps the standard 3-attempts retry budget.
  assertEquals(failedMaxAttempts[0], 3);
});

Deno.test('multi-image: source_image_index override is authoritative', async () => {
  const job = makeMultiImageJob('multi-override', 2);
  // deno-lint-ignore no-explicit-any
  let captured: any;

  const supa = makeSupaMock({
    jobs: [job],
    onComplete: (_id, result) => {
      captured = result;
    },
  });

  // Both pages claim source_image_index=99; runExtraction must override per-loop.
  const openai = makeOpenAIMockSequence([
    { dishes: makeCannedDishes(1, 99), detected_language: 'en' },
    { dishes: makeCannedDishes(1, 99), detected_language: 'en' },
  ]);

  await processJobs({ supa, openai });

  assertEquals(captured.dishes.length, 2);
  assertEquals(captured.dishes[0].source_image_index, 0);
  assertEquals(captured.dishes[1].source_image_index, 1);
});

// ── Category-slug collision backstop (operator issue #1) ─────────────────────
//
// Two DIFFERENT printed headers must never share a canonical slug — the review
// UI groups dishes by slug, so a shared slug silently merges two menu sections
// ("Tostadas" swallowed by "Entradas"). The prompt forbids it per page;
// resolveCategorySlugCollisions enforces it across the whole menu.

function makeCategorizedDish(name: string, header: string | null, slug: string | null) {
  return {
    name,
    description: null,
    price: 10,
    dish_kind: 'standard',
    dining_format: null,
    bundled_items: [],
    modifier_groups: [],
    primary_protein: 'chicken',
    portion_amount: null,
    portion_unit: null,
    portion_source_text: null,
    suggested_category_name: header,
    canonical_category_slug: slug,
    suggested_category_description: null,
    suggested_dish_category: null,
    source_image_index: 0,
    confidence: 0.9,
  };
}

Deno.test('category backstop: second header sharing a slug falls back to custom', async () => {
  const job = makeJob('cat-collide');
  // deno-lint-ignore no-explicit-any
  let captured: any;
  const supa = makeSupaMock({
    jobs: [job],
    onComplete: (_id, result) => {
      captured = result;
    },
  });
  const openai = makeOpenAIMockSequence([
    {
      dishes: [
        makeCategorizedDish('Ceviche Clásico', 'Entradas', 'appetizers'),
        makeCategorizedDish('Tostada de Atún', 'Tostadas', 'appetizers'),
        makeCategorizedDish('Queso Fundido', 'Entradas', 'appetizers'),
      ],
      detected_language: 'es',
    },
  ]);

  const result = await processJobs({ supa, openai });

  assertEquals(result.processed, ['cat-collide']);
  // First printed section keeps the slug — including its dishes listed AFTER
  // the colliding section. The collider loses only the slug; its verbatim
  // header survives, so the review UI creates a custom "Tostadas" category
  // instead of merging it into "Entradas".
  assertEquals(
    // deno-lint-ignore no-explicit-any
    captured.dishes.map((d: any) => [d.name, d.canonical_category_slug]),
    [
      ['Ceviche Clásico', 'appetizers'],
      ['Tostada de Atún', null],
      ['Queso Fundido', 'appetizers'],
    ]
  );
  assertEquals(captured.dishes[1].suggested_category_name, 'Tostadas');
});

Deno.test('category backstop: cross-page collision is caught too', async () => {
  // Each model call sees one page, so the prompt rule cannot prevent
  // "Entradas" (page 1) and "Botanas" (page 2) both mapping to appetizers —
  // only the worker-side backstop can.
  const job = makeMultiImageJob('cat-crosspage', 2);
  // deno-lint-ignore no-explicit-any
  let captured: any;
  const supa = makeSupaMock({
    jobs: [job],
    onComplete: (_id, result) => {
      captured = result;
    },
  });
  const openai = makeOpenAIMockSequence([
    {
      dishes: [makeCategorizedDish('Guacamole', 'Entradas', 'appetizers')],
      detected_language: 'es',
    },
    { dishes: [makeCategorizedDish('Nachos', 'Botanas', 'appetizers')], detected_language: null },
  ]);

  await processJobs({ supa, openai });

  // deno-lint-ignore no-explicit-any
  assertEquals(
    captured.dishes.map((d: any) => d.canonical_category_slug),
    ['appetizers', null]
  );
});

Deno.test('category backstop: same header restated across pages keeps its slug', async () => {
  // A section header re-printed on a later page (with case/accent drift) is
  // the SAME section, not a collision — the slug must survive on both pages.
  const job = makeMultiImageJob('cat-restate', 2);
  // deno-lint-ignore no-explicit-any
  let captured: any;
  const supa = makeSupaMock({
    jobs: [job],
    onComplete: (_id, result) => {
      captured = result;
    },
  });
  const openai = makeOpenAIMockSequence([
    { dishes: [makeCategorizedDish('Espresso', 'CAFÉS', 'coffee')], detected_language: 'es' },
    { dishes: [makeCategorizedDish('Latte', 'Cafes', 'coffee')], detected_language: null },
  ]);

  await processJobs({ supa, openai });

  // deno-lint-ignore no-explicit-any
  assertEquals(
    captured.dishes.map((d: any) => d.canonical_category_slug),
    ['coffee', 'coffee']
  );
});

Deno.test('category backstop: headerless dishes neither claim nor lose a slug', async () => {
  // A dish with a slug but no printed header has no section identity to
  // protect — nulling its slug would dump it in "uncategorized", which is
  // worse than a merge. It also must not "claim" the slug away from a real
  // printed section.
  const job = makeJob('cat-headerless');
  // deno-lint-ignore no-explicit-any
  let captured: any;
  const supa = makeSupaMock({
    jobs: [job],
    onComplete: (_id, result) => {
      captured = result;
    },
  });
  const openai = makeOpenAIMockSequence([
    {
      dishes: [
        makeCategorizedDish('Agua de Jamaica', null, 'drinks'),
        makeCategorizedDish('Cerveza Artesanal', 'Cervezas', 'drinks'),
      ],
      detected_language: 'es',
    },
  ]);

  await processJobs({ supa, openai });

  // deno-lint-ignore no-explicit-any
  assertEquals(
    captured.dishes.map((d: any) => d.canonical_category_slug),
    ['drinks', 'drinks']
  );
});

// ── v2 modifier-aware fixtures ────────────────────────────────────────────────
//
// These fixtures exercise the worker's pass-through behaviour for the new
// schema fields (dining_format, bundled_items, modifier_groups). They simulate
// the LLM emitting each documented pattern from the prompt block and verify
// the shape lands intact in the captured result_json. Schema validation lives
// at the OpenAI parse boundary (zodResponseFormat); these tests verify worker
// plumbing, not the schema itself.

interface ModOption {
  name: string;
  price_delta: number;
  price_override: number | null;
  primary_protein: string | null;
  serves_delta: number;
  is_default: boolean;
}
interface ModGroup {
  name: string;
  selection_type: 'single' | 'multiple';
  min_selections: number;
  max_selections: number;
  display_in_card: boolean;
  options: ModOption[];
}

function makeFixtureDish(overrides: {
  name: string;
  price: number | null;
  dish_kind: string;
  dining_format?: string | null;
  bundled_items?: Array<{ name: string; note: string | null }>;
  modifier_groups?: ModGroup[];
  primary_protein?: string;
  description?: string | null;
  portion_amount?: number | null;
  portion_unit?: string | null;
  portion_source_text?: string | null;
}) {
  return {
    name: overrides.name,
    description: overrides.description ?? null,
    price: overrides.price,
    dish_kind: overrides.dish_kind,
    dining_format: overrides.dining_format ?? null,
    bundled_items: overrides.bundled_items ?? [],
    modifier_groups: overrides.modifier_groups ?? [],
    primary_protein: overrides.primary_protein ?? 'chicken',
    portion_amount: overrides.portion_amount ?? null,
    portion_unit: overrides.portion_unit ?? null,
    portion_source_text: overrides.portion_source_text ?? null,
    suggested_category_name: null,
    canonical_category_slug: null,
    suggested_category_description: null,
    suggested_dish_category: null,
    source_image_index: 0,
    confidence: 0.95,
  };
}

async function runFixture(fixtureDish: ReturnType<typeof makeFixtureDish>) {
  const job = makeJob('fixture-job');
  // deno-lint-ignore no-explicit-any
  let captured: any;
  const supa = makeSupaMock({
    jobs: [job],
    onComplete: (_id, result) => {
      captured = result;
    },
  });
  const openai = makeOpenAIMockSequence([{ dishes: [fixtureDish], detected_language: 'en' }]);
  const result = await processJobs({ supa, openai });
  assertEquals(result.processed, ['fixture-job']);
  assertEquals(result.errors.length, 0);
  return captured.dishes[0];
}

Deno.test('normalize: placeholder "." description collapses to null', async () => {
  const dish = makeFixtureDish({
    name: '  Ribeye Steak  ',
    price: 24.0,
    dish_kind: 'standard',
    description: '.',
  });
  const captured = await runFixture(dish);
  assertEquals(captured.description, null); // "." is not a real description
  assertEquals(captured.name, 'Ribeye Steak'); // names are trimmed, never null
});

Deno.test('normalize: placeholder ":" description collapses to null', async () => {
  // The model shifted its no-value placeholder from "." to ":" once the
  // prompt forbade "."; the normalizer must catch ANY punctuation-only value.
  const dish = makeFixtureDish({
    name: 'Caesar Salad',
    price: 12.0,
    dish_kind: 'standard',
    description: ':',
  });
  const captured = await runFixture(dish);
  assertEquals(captured.description, null);
});

Deno.test('normalize: arbitrary punctuation-only description collapses to null', async () => {
  const dish = makeFixtureDish({
    name: 'House Burger',
    price: 15.0,
    dish_kind: 'standard',
    description: ' :: -- ',
  });
  const captured = await runFixture(dish);
  assertEquals(captured.description, null);
});

Deno.test('normalize: leading stray punctuation is stripped from description', async () => {
  const dish = makeFixtureDish({
    name: 'Tomato Soup',
    price: 8.0,
    dish_kind: 'standard',
    description: '- Creamy roasted tomato',
  });
  const captured = await runFixture(dish);
  assertEquals(captured.description, 'Creamy roasted tomato');
});

Deno.test('portion strip: trailing base-unit size removed via verbatim source text', async () => {
  const dish = makeFixtureDish({
    name: 'Ribeye Steak 250g',
    price: 24.0,
    dish_kind: 'standard',
    portion_amount: 250,
    portion_unit: 'g',
    portion_source_text: '250g',
  });
  const captured = await runFixture(dish);
  assertEquals(captured.name, 'Ribeye Steak');
  assertEquals(captured.portion_amount, 250); // portion itself is untouched
});

Deno.test('portion strip: kg original is removed even though unit normalized to g', async () => {
  // The case the verbatim source-text approach exists for: portion_amount is
  // 1500 g, but the printed "1.5kg" can only be stripped by matching the
  // ORIGINAL text, not a reconstructed "1500 g" token.
  const dish = makeFixtureDish({
    name: 'Sharing Platter 1.5kg',
    price: 60.0,
    dish_kind: 'standard',
    portion_amount: 1500,
    portion_unit: 'g',
    portion_source_text: '1.5kg',
  });
  const captured = await runFixture(dish);
  assertEquals(captured.name, 'Sharing Platter');
});

Deno.test('portion strip: parenthesized litre size removed', async () => {
  const dish = makeFixtureDish({
    name: 'House Lager (0.5L)',
    price: 6.0,
    dish_kind: 'standard',
    portion_amount: 500,
    portion_unit: 'ml',
    portion_source_text: '0.5L',
  });
  const captured = await runFixture(dish);
  assertEquals(captured.name, 'House Lager');
});

Deno.test('portion strip: identity size is preserved when no portion was extracted', async () => {
  // "Quarter" reads like a size but is part of the dish identity. With no
  // portion_source_text the name must come back untouched.
  const dish = makeFixtureDish({
    name: 'Quarter Chicken',
    price: 9.0,
    dish_kind: 'standard',
    portion_amount: null,
    portion_unit: null,
    portion_source_text: null,
  });
  const captured = await runFixture(dish);
  assertEquals(captured.name, 'Quarter Chicken');
});

Deno.test('portion strip: trailing size also removed from the description', async () => {
  // Operator-reported doubling (2026-06-09): the size stayed in the description
  // while the app rendered the portion chip too. Trailing description sizes get
  // the same conservative strip the name does; portion fields survive.
  const dish = makeFixtureDish({
    name: 'Arrachera 250g',
    price: 32.0,
    dish_kind: 'standard',
    description: 'Corte de res a la parrilla 250g',
    portion_amount: 250,
    portion_unit: 'g',
    portion_source_text: '250g',
  });
  const captured = await runFixture(dish);
  assertEquals(captured.name, 'Arrachera');
  assertEquals(captured.description, 'Corte de res a la parrilla');
  assertEquals(captured.portion_amount, 250);
  assertEquals(captured.portion_unit, 'g');
});

Deno.test('portion strip: description that is only the size collapses to null', async () => {
  const dish = makeFixtureDish({
    name: 'Sharing Platter 1.5kg',
    price: 60.0,
    dish_kind: 'standard',
    description: '1.5kg',
    portion_amount: 1500,
    portion_unit: 'g',
    portion_source_text: '1.5kg',
  });
  const captured = await runFixture(dish);
  assertEquals(captured.name, 'Sharing Platter');
  assertEquals(captured.description, null);
  assertEquals(captured.portion_amount, 1500);
});

Deno.test('portion strip: mid-sentence size keeps text, drops portion fields', async () => {
  // "250g de arrachera con…" can't be stripped without mangling the sentence,
  // so the text wins and the structured portion is dropped — the chip must
  // never duplicate a size the customer already reads in the description.
  const dish = makeFixtureDish({
    name: 'Tacos de Arrachera',
    price: 28.0,
    dish_kind: 'standard',
    description: '250g de arrachera con guarnición',
    portion_amount: 250,
    portion_unit: 'g',
    portion_source_text: '250g',
  });
  const captured = await runFixture(dish);
  assertEquals(captured.description, '250g de arrachera con guarnición');
  assertEquals(captured.portion_amount, null);
  assertEquals(captured.portion_unit, null);
  assertEquals(captured.portion_source_text, null);
});

Deno.test('portion strip: mid-NAME size keeps text, drops portion fields', async () => {
  const dish = makeFixtureDish({
    name: '250g Burger con Papas',
    price: 18.0,
    dish_kind: 'standard',
    portion_amount: 250,
    portion_unit: 'g',
    portion_source_text: '250g',
  });
  const captured = await runFixture(dish);
  assertEquals(captured.name, '250g Burger con Papas');
  assertEquals(captured.portion_amount, null);
  assertEquals(captured.portion_unit, null);
});

Deno.test('portion strip: pint stays in the name (unit not stored, source text null)', async () => {
  // Pints/fl-oz aren't in the g/ml/pcs/oz taxonomy, so the model returns null
  // portion + null source text and the size stays in the name verbatim.
  const dish = makeFixtureDish({
    name: 'Guinness Pint',
    price: 7.0,
    dish_kind: 'standard',
    portion_amount: null,
    portion_unit: null,
    portion_source_text: null,
  });
  const captured = await runFixture(dish);
  assertEquals(captured.name, 'Guinness Pint');
});

Deno.test('fixture: Pad Thai with required protein choice', async () => {
  const dish = makeFixtureDish({
    name: 'Pad Thai',
    price: 14.0,
    dish_kind: 'standard',
    primary_protein: 'chicken', // matches the default option
    modifier_groups: [
      {
        name: 'Choose your protein',
        selection_type: 'single',
        min_selections: 1,
        max_selections: 1,
        display_in_card: true, // protein meaningfully changes dish identity
        options: [
          {
            name: 'Chicken',
            price_delta: 0,
            price_override: null,
            primary_protein: 'chicken',
            serves_delta: 0,
            is_default: true,
          },
          {
            name: 'Shrimp',
            price_delta: 3,
            price_override: null,
            primary_protein: 'shellfish',
            serves_delta: 0,
            is_default: false,
          },
          {
            name: 'Tofu',
            price_delta: 0,
            price_override: null,
            primary_protein: 'vegetarian',
            serves_delta: 0,
            is_default: false,
          },
        ],
      },
    ],
  });
  const captured = await runFixture(dish);

  assertEquals(captured.modifier_groups.length, 1);
  assertEquals(captured.modifier_groups[0].min_selections, 1);
  assertEquals(captured.modifier_groups[0].display_in_card, true);
  assertEquals(captured.modifier_groups[0].options.length, 3);
  // Exactly one default in a required group
  const defaults = captured.modifier_groups[0].options.filter((o: ModOption) => o.is_default);
  assertEquals(defaults.length, 1);
  assertEquals(defaults[0].name, 'Chicken');
});

Deno.test('fixture: Caesar with optional add-ons', async () => {
  const dish = makeFixtureDish({
    name: 'Caesar Salad',
    price: 11.0,
    dish_kind: 'standard',
    primary_protein: 'vegetarian',
    modifier_groups: [
      {
        name: 'Add protein',
        selection_type: 'single',
        min_selections: 0, // optional
        max_selections: 1,
        display_in_card: false, // base dish identity intact without add-on
        options: [
          {
            name: 'Grilled chicken (+$5)',
            price_delta: 5,
            price_override: null,
            primary_protein: 'chicken',
            serves_delta: 0,
            is_default: false, // optional groups have no default
          },
          {
            name: 'Grilled shrimp (+$7)',
            price_delta: 7,
            price_override: null,
            primary_protein: 'shellfish',
            serves_delta: 0,
            is_default: false,
          },
        ],
      },
    ],
  });
  const captured = await runFixture(dish);

  assertEquals(captured.modifier_groups[0].min_selections, 0);
  assertEquals(captured.modifier_groups[0].display_in_card, false);
  // No default in optional groups
  const defaults = captured.modifier_groups[0].options.filter((o: ModOption) => o.is_default);
  assertEquals(defaults.length, 0);
});

Deno.test('fixture: Pizza S/M/L sizes with serves_delta', async () => {
  const dish = makeFixtureDish({
    name: 'Margherita Pizza',
    price: 12.0, // S
    dish_kind: 'standard',
    primary_protein: 'vegetarian',
    modifier_groups: [
      {
        name: 'Size',
        selection_type: 'single',
        min_selections: 1,
        max_selections: 1,
        display_in_card: false, // size doesn't change identity
        options: [
          {
            name: 'Small (8")',
            price_delta: 0,
            price_override: null,
            primary_protein: null,
            serves_delta: 0,
            is_default: true,
          },
          {
            name: 'Medium (12")',
            price_delta: 4,
            price_override: null,
            primary_protein: null,
            serves_delta: 1, // serves 2 instead of 1
            is_default: false,
          },
          {
            name: 'Large (16")',
            price_delta: 8,
            price_override: null,
            primary_protein: null,
            serves_delta: 2, // serves 3 instead of 1
            is_default: false,
          },
        ],
      },
    ],
  });
  const captured = await runFixture(dish);

  const opts = captured.modifier_groups[0].options;
  assertEquals(
    opts.map((o: ModOption) => o.serves_delta),
    [0, 1, 2]
  );
  assertEquals(
    opts.map((o: ModOption) => o.price_delta),
    [0, 4, 8]
  );
  // No option changes protein
  for (const opt of opts) assertEquals(opt.primary_protein, null);
});

Deno.test('fixture: build-your-own bowl with multiple groups', async () => {
  const dish = makeFixtureDish({
    name: 'Build-Your-Own Bowl',
    price: 13.5,
    dish_kind: 'configurable',
    primary_protein: 'vegetarian', // base before protein pick
    modifier_groups: [
      {
        name: 'Choose your base',
        selection_type: 'single',
        min_selections: 1,
        max_selections: 1,
        display_in_card: false,
        options: [
          {
            name: 'Brown rice',
            price_delta: 0,
            price_override: null,
            primary_protein: null,
            serves_delta: 0,
            is_default: true,
          },
          {
            name: 'Quinoa',
            price_delta: 1,
            price_override: null,
            primary_protein: null,
            serves_delta: 0,
            is_default: false,
          },
        ],
      },
      {
        name: 'Choose your protein',
        selection_type: 'single',
        min_selections: 1,
        max_selections: 1,
        display_in_card: true,
        options: [
          {
            name: 'Tofu',
            price_delta: 0,
            price_override: null,
            primary_protein: 'vegetarian',
            serves_delta: 0,
            is_default: true,
          },
          {
            name: 'Chicken',
            price_delta: 2,
            price_override: null,
            primary_protein: 'chicken',
            serves_delta: 0,
            is_default: false,
          },
        ],
      },
      {
        name: 'Toppings (up to 3)',
        selection_type: 'multiple',
        min_selections: 0,
        max_selections: 3,
        display_in_card: false,
        options: [
          {
            name: 'Avocado (+$2)',
            price_delta: 2,
            price_override: null,
            primary_protein: null,
            serves_delta: 0,
            is_default: false,
          },
          {
            name: 'Crushed peanuts',
            price_delta: 0,
            price_override: null,
            primary_protein: null,
            serves_delta: 0,
            is_default: false,
          },
        ],
      },
    ],
  });
  const captured = await runFixture(dish);

  assertEquals(captured.modifier_groups.length, 3);
  // Two required + one optional
  const required = captured.modifier_groups.filter((g: ModGroup) => g.min_selections >= 1);
  assertEquals(required.length, 2);
  // Only the protein group is display_in_card
  const inCard = captured.modifier_groups.filter((g: ModGroup) => g.display_in_card);
  assertEquals(inCard.length, 1);
  assertEquals(inCard[0].name, 'Choose your protein');
  // Multi-select group has max_selections > 1
  const toppings = captured.modifier_groups.find((g: ModGroup) => g.name.startsWith('Toppings'));
  assertEquals(toppings.selection_type, 'multiple');
  assertEquals(toppings.max_selections, 3);
});

Deno.test(
  'fixture: tasting menu with dining_format=course_menu and sequential required groups',
  async () => {
    const dish = makeFixtureDish({
      name: '5-Course Tasting Menu',
      price: 95.0,
      dish_kind: 'course_menu',
      dining_format: 'course_menu',
      primary_protein: 'fish', // anchor protein for the menu
      modifier_groups: [
        {
          name: 'Starter',
          selection_type: 'single',
          min_selections: 1,
          max_selections: 1,
          display_in_card: false,
          options: [
            {
              name: 'Beet salad',
              price_delta: 0,
              price_override: null,
              primary_protein: 'vegetarian',
              serves_delta: 0,
              is_default: true,
            },
            {
              name: 'Tuna tartare',
              price_delta: 0,
              price_override: null,
              primary_protein: 'fish',
              serves_delta: 0,
              is_default: false,
            },
          ],
        },
        {
          name: 'Main',
          selection_type: 'single',
          min_selections: 1,
          max_selections: 1,
          display_in_card: false,
          options: [
            {
              name: 'Branzino',
              price_delta: 0,
              price_override: null,
              primary_protein: 'fish',
              serves_delta: 0,
              is_default: true,
            },
            {
              name: 'Lamb chop',
              price_delta: 12,
              price_override: null,
              primary_protein: 'lamb',
              serves_delta: 0,
              is_default: false,
            },
          ],
        },
      ],
    });
    const captured = await runFixture(dish);

    assertEquals(captured.dining_format, 'course_menu');
    assertEquals(captured.dish_kind, 'course_menu');
    assertEquals(captured.modifier_groups.length, 2);
    // Each course is a required single-select
    for (const g of captured.modifier_groups) {
      assertEquals(g.min_selections, 1);
      assertEquals(g.selection_type, 'single');
    }
  }
);

Deno.test('fixture: buffet has dining_format=buffet and no modifier groups', async () => {
  const dish = makeFixtureDish({
    name: 'All-You-Can-Eat Sunday Brunch',
    price: 45.0,
    dish_kind: 'buffet',
    dining_format: 'buffet',
    primary_protein: 'other_meat',
    modifier_groups: [],
    bundled_items: [],
  });
  const captured = await runFixture(dish);

  assertEquals(captured.dining_format, 'buffet');
  assertEquals(captured.dish_kind, 'buffet');
  assertEquals(captured.modifier_groups.length, 0);
  assertEquals(captured.bundled_items.length, 0);
});

Deno.test('fixture: tiered wings with non-linear pricing via price_override', async () => {
  const dish = makeFixtureDish({
    name: 'Chicken Wings',
    price: 5.0, // 6-wing base price
    dish_kind: 'standard',
    primary_protein: 'chicken',
    modifier_groups: [
      {
        name: 'Quantity',
        selection_type: 'single',
        min_selections: 1,
        max_selections: 1,
        display_in_card: false,
        options: [
          {
            name: '6 wings',
            price_delta: 0,
            price_override: null, // base
            primary_protein: null,
            serves_delta: 0,
            is_default: true,
          },
          {
            name: '12 wings',
            price_delta: 0,
            price_override: 9.0, // 12 wings for $9, not 2× $5
            primary_protein: null,
            serves_delta: 1,
            is_default: false,
          },
          {
            name: '24 wings',
            price_delta: 0,
            price_override: 16.0, // bulk discount
            primary_protein: null,
            serves_delta: 3,
            is_default: false,
          },
        ],
      },
    ],
  });
  const captured = await runFixture(dish);

  const opts = captured.modifier_groups[0].options;
  assertEquals(opts[0].price_override, null);
  assertEquals(opts[1].price_override, 9.0);
  assertEquals(opts[2].price_override, 16.0);
  // price_delta is 0 throughout — price_override carries the value
  for (const opt of opts) assertEquals(opt.price_delta, 0);
});

Deno.test('fixture: combo meal with bundled_items', async () => {
  const dish = makeFixtureDish({
    name: 'Burger Meal',
    description: 'Cheeseburger with fries and a drink',
    price: 15.0,
    dish_kind: 'bundle',
    primary_protein: 'beef',
    bundled_items: [
      { name: 'cheeseburger', note: null },
      { name: 'fries', note: 'or sweet potato fries' },
      { name: 'drink', note: 'soft drink or iced tea' },
    ],
    modifier_groups: [],
  });
  const captured = await runFixture(dish);

  assertEquals(captured.dish_kind, 'bundle');
  assertEquals(captured.bundled_items.length, 3);
  assertEquals(captured.bundled_items[0].name, 'cheeseburger');
  assertEquals(captured.bundled_items[1].note, 'or sweet potato fries');
  assertEquals(captured.modifier_groups.length, 0);
});

// ── Phase 3b: restaurant cuisine self-heal ────────────────────────────────────
//
// The worker writes restaurants.cuisine_types from the inferred cuisines ONLY
// when the restaurant currently has none — gated empty, canonical-only, and
// best-effort (a write failure must never fail the scan job).

Deno.test(
  'cuisine self-heal: empty restaurant cuisine → inferred cuisine written + normalized',
  async () => {
    const job = makeJob('job-cuisine', { restaurant_id: 'rest-1' });
    const updates: Array<{ id: string; cuisines: string[] }> = [];

    const supa = makeSupaMock({
      jobs: [job],
      restaurantCuisine: [], // empty → eligible for self-heal
      onCuisineUpdate: (id, cuisines) => updates.push({ id, cuisines }),
    });

    // Page emits messy cuisine guesses; normalizeCuisines must canonicalize +
    // dedupe + drop the junk value.
    const openai = makeOpenAIMockSequence([
      {
        dishes: makeCannedDishes(1, 0),
        detected_language: 'es',
        cuisine_types: ['mexican', 'Mexican', 'NotACuisine'],
      },
    ]);

    const result = await processJobs({ supa, openai });

    assertEquals(result.processed, ['job-cuisine']);
    assertEquals(result.errors.length, 0);
    assertEquals(updates.length, 1);
    assertEquals(updates[0].id, 'rest-1');
    assertEquals(updates[0].cuisines, ['Mexican']);
  }
);

Deno.test('cuisine self-heal: non-empty restaurant cuisine is never overwritten', async () => {
  const job = makeJob('job-cuisine-skip', { restaurant_id: 'rest-2' });
  const updates: Array<{ id: string; cuisines: string[] }> = [];

  const supa = makeSupaMock({
    jobs: [job],
    restaurantCuisine: ['Thai'], // already set → must NOT be overwritten
    onCuisineUpdate: (id, cuisines) => updates.push({ id, cuisines }),
  });

  const openai = makeOpenAIMockSequence([
    { dishes: makeCannedDishes(1, 0), detected_language: 'en', cuisine_types: ['Italian'] },
  ]);

  const result = await processJobs({ supa, openai });

  assertEquals(result.processed, ['job-cuisine-skip']);
  assertEquals(updates.length, 0); // skipped — never overwrites
});
