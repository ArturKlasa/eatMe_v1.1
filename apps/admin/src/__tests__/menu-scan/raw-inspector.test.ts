import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('react', async importActual => {
  const actual = await importActual<typeof import('react')>();
  return { ...actual, cache: (fn: unknown) => fn };
});
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({
  createServerActionClient: vi.fn(),
  createAdminServiceClient: vi.fn(),
}));
vi.mock('@/lib/audit', () => ({
  logAdminAction: vi.fn().mockResolvedValue(undefined),
}));

import { createServerActionClient, createAdminServiceClient } from '@/lib/supabase/server';
import { logAdminAction } from '@/lib/audit';
import { adminUpdateJobStatus } from '@/app/(admin)/menu-scan/actions/menuScan';

const ADMIN_USER = {
  id: 'admin-uuid-123',
  email: 'admin@example.com',
  app_metadata: { role: 'admin' },
};

const MOCK_JOB_ROW = { status: 'failed' };

function makeServiceClient(currentRow: unknown = MOCK_JOB_ROW, updateError: unknown = null) {
  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'menu_scan_jobs') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: currentRow, error: null }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: updateError }),
          }),
        };
      }
      return {
        insert: vi.fn().mockResolvedValue({ error: null }),
      };
    }),
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(createServerActionClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: ADMIN_USER }, error: null }),
    },
  } as never);
  vi.mocked(createAdminServiceClient).mockReturnValue(makeServiceClient() as never);
  vi.mocked(logAdminAction).mockResolvedValue(undefined);
});

describe('adminUpdateJobStatus — auth', () => {
  it('returns FORBIDDEN for non-admin user', async () => {
    vi.mocked(createServerActionClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'u-1', email: 'owner@x.com', app_metadata: {} } },
          error: null,
        }),
      },
    } as never);

    const result = await adminUpdateJobStatus('job-1', { status: 'failed' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.formError).toBe('FORBIDDEN');
  });

  it('returns UNAUTHENTICATED for unauthenticated user', async () => {
    vi.mocked(createServerActionClient).mockResolvedValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: null }, error: new Error('no session') }),
      },
    } as never);

    const result = await adminUpdateJobStatus('job-1', { status: 'failed' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.formError).toBe('UNAUTHENTICATED');
  });
});

describe('adminUpdateJobStatus — validation', () => {
  it('returns NOT_FOUND for a missing job', async () => {
    vi.mocked(createAdminServiceClient).mockReturnValue(makeServiceClient(null) as never);

    const result = await adminUpdateJobStatus('non-existent', { status: 'failed' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.formError).toBe('NOT_FOUND');
  });
});

describe('adminUpdateJobStatus — happy path', () => {
  it('updates status and logs audit action', async () => {
    // current status is 'failed', flipping to 'needs_review'
    const result = await adminUpdateJobStatus('job-1', { status: 'needs_review' });

    expect(result.ok).toBe(true);

    expect(logAdminAction).toHaveBeenCalledWith(
      expect.anything(),
      { adminId: ADMIN_USER.id, adminEmail: ADMIN_USER.email },
      'update_job_status',
      'menu_scan_job',
      'job-1',
      { status: 'failed' },
      { status: 'needs_review' }
    );
  });

  it('is a no-op (ok=true, no audit) when status already matches', async () => {
    // current status is 'failed', requesting 'failed' — no change
    const result = await adminUpdateJobStatus('job-1', { status: 'failed' });

    expect(result.ok).toBe(true);
    expect(logAdminAction).not.toHaveBeenCalled();
  });
});

describe('adminUpdateJobStatus — update failure', () => {
  it('returns UPDATE_FAILED when db update errors', async () => {
    vi.mocked(createAdminServiceClient).mockReturnValue(
      makeServiceClient(MOCK_JOB_ROW, { message: 'db error' }) as never
    );

    const result = await adminUpdateJobStatus('job-1', { status: 'needs_review' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.formError).toBe('UPDATE_FAILED');
  });
});

describe('Raw JSON inspector — serialisation', () => {
  it('JSON.stringify does not mutate the original result_json object', () => {
    const resultJson = {
      dishes: [
        { name: 'Pizza', confidence: 0.95, price: 12.99 },
        { name: 'Burger', confidence: 0.88, price: 9.5 },
      ],
    };

    const original = JSON.parse(JSON.stringify(resultJson)) as typeof resultJson;

    // Simulate what AdminJobShell does
    const serialised = JSON.stringify(resultJson, null, 2);

    // Object identity check: resultJson should not be mutated
    expect(resultJson).toEqual(original);
    expect(typeof serialised).toBe('string');
    expect(serialised).toContain('"confidence": 0.95');
  });

  it('handles null result_json without throwing', () => {
    const resultJson = null;
    // Matches the conditional in AdminJobShell: resultJson !== null check
    const serialised =
      resultJson !== null && resultJson !== undefined
        ? JSON.stringify(resultJson, null, 2)
        : 'null';
    expect(serialised).toBe('null');
  });
});
