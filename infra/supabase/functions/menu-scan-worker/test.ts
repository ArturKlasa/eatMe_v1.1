// test.ts — Deno integration tests for menu-scan-worker
// Run with: deno test supabase/functions/menu-scan-worker/test.ts --allow-env
//
// Tests mock Supabase + OpenAI deps so no live DB or API key is needed.

import {
  assertEquals,
  assertArrayIncludes,
} from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import OpenAI from 'npm:openai@4';
import { processJobs, WorkerDeps, ProcessResult, MAX_PER_TICK, PRIMARY_PROTEINS } from './index.ts';
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
