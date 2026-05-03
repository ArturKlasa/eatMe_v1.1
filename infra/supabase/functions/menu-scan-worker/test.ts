// test.ts — Deno integration tests for menu-scan-worker
// Run with: deno test supabase/functions/menu-scan-worker/test.ts --allow-env
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
      dish_kind: 'standard',
      primary_protein: 'fish',
      suggested_category_name: 'Mains',
      source_image_index: 0,
      confidence: 0.95,
    },
  ],
  // runExtraction merges per-page results into a single shape that always
  // includes detected_language (the Zod schema requires the field — null is
  // the canonical "uncertain" value). Keeping it here avoids assertEquals
  // tripping on the missing-vs-null difference.
  detected_language: null,
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
}) {
  const { jobs = [], onComplete, onFail } = options;
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
                new Headers()
              );
            }
            if (rateLimitOnCall !== undefined && callCount === rateLimitOnCall) {
              throw new OpenAI.RateLimitError(
                429,
                { message: 'rate limit' },
                'Rate Limit',
                new Headers()
              );
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
  assertEquals(capturedResult, CANNED_RESULT);
});

Deno.test(
  'concurrency: 5 pending jobs processed with no double-claims (MAX_PER_TICK cap)',
  async () => {
    const jobs = ['job-001', 'job-002', 'job-003', 'job-004', 'job-005'].map(makeJob);
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

Deno.test('retry: RateLimitError on primary → immediately falls back to gpt-4o-mini', async () => {
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
});

Deno.test('retry: RateLimitError exhausted → job ends in failed after max attempts', async () => {
  // Simulate a job that is on its 3rd attempt (attempts=3) with all models failing.
  const job = makeJob('job-fail', { attempts: 3 });
  const failed: string[] = [];

  const supa = makeSupaMock({
    jobs: [job],
    onFail: id => failed.push(id),
  });

  // Both primary and fallback rate-limit (call 1 = fallback since attempts=3 >= 2; call 1 is fallback; throw 429 always)
  const openai = {
    beta: {
      chat: {
        completions: {
          parse: async () => {
            throw new OpenAI.RateLimitError(
              429,
              { message: 'rate limit' },
              'Rate Limit',
              new Headers()
            );
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
});

Deno.test('multi-image: all 3 pages fail with RateLimitError → job ends in error', async () => {
  // attempts >= 2 so each call goes straight to the fallback model. All fallbacks 429.
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

  const rateLimitErr = new OpenAI.RateLimitError(
    429,
    { message: 'rate limit' },
    'Rate Limit',
    new Headers()
  );
  const openai = makeOpenAIMockSequence([rateLimitErr, rateLimitErr, rateLimitErr]);

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
