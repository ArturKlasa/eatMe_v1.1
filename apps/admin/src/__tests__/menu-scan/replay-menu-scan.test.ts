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

// Mock global fetch for worker trigger
const mockFetch = vi.fn().mockResolvedValue({ ok: true });
vi.stubGlobal('fetch', mockFetch);

import { createServerActionClient, createAdminServiceClient } from '@/lib/supabase/server';
import { logAdminAction } from '@/lib/audit';
import { replayMenuScan } from '@/app/(admin)/menu-scan/actions/menuScan';

const ADMIN_USER = {
  id: 'admin-uuid-123',
  email: 'admin@example.com',
  app_metadata: { role: 'admin' },
};

const MOCK_JOB = {
  id: 'job-uuid-001',
  restaurant_id: 'rest-uuid-001',
  input: {
    images: [{ bucket: 'menu-scan-uploads', path: 'rest-uuid-001/abc.jpg', page: 1 }],
  },
  status: 'failed',
};

const MOCK_NEW_JOB = { id: 'new-job-uuid-001' };

function makeServiceClient(
  jobData: unknown = MOCK_JOB,
  insertNewJob: unknown = MOCK_NEW_JOB,
  insertError: unknown = null
) {
  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'menu_scan_jobs') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: jobData, error: null }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: insertNewJob, error: insertError }),
            }),
          }),
        };
      }
      // admin_audit_log
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
  mockFetch.mockResolvedValue({ ok: true });
});

describe('replayMenuScan — auth', () => {
  it('returns FORBIDDEN for non-admin user', async () => {
    vi.mocked(createServerActionClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'u-1', email: 'owner@x.com', app_metadata: {} } },
          error: null,
        }),
      },
    } as never);

    const result = await replayMenuScan('job-uuid-001', { model: 'gpt-4o-2024-11-20' });
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

    const result = await replayMenuScan('job-uuid-001', { model: 'gpt-4o-2024-11-20' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.formError).toBe('UNAUTHENTICATED');
  });
});

describe('replayMenuScan — validation', () => {
  it('returns NOT_FOUND when job does not exist', async () => {
    vi.mocked(createAdminServiceClient).mockReturnValue(makeServiceClient(null) as never);

    const result = await replayMenuScan('non-existent-job', { model: 'gpt-4o-2024-11-20' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.formError).toBe('NOT_FOUND');
  });

  it('returns INVALID_MODEL for an unrecognised model string', async () => {
    const result = await replayMenuScan('job-uuid-001', {
      model: 'gpt-3.5-turbo' as 'gpt-4o-2024-11-20',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.formError).toBe('INVALID_MODEL');
  });
});

describe('replayMenuScan — happy path', () => {
  it('creates a new job, fires the worker, logs audit, and returns newJobId', async () => {
    const result = await replayMenuScan('job-uuid-001', { model: 'gpt-4o-2024-11-20' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.newJobId).toBe('new-job-uuid-001');
    }

    // worker was fired
    expect(mockFetch).toHaveBeenCalledOnce();

    // audit log written
    expect(logAdminAction).toHaveBeenCalledOnce();
  });

  it('writes audit log with action=replay_menu_scan', async () => {
    await replayMenuScan('job-uuid-001', { model: 'gpt-4o-mini' });

    expect(logAdminAction).toHaveBeenCalledWith(
      expect.anything(),
      { adminId: ADMIN_USER.id, adminEmail: ADMIN_USER.email },
      'replay_menu_scan',
      'menu_scan_job',
      'job-uuid-001',
      expect.anything(),
      expect.objectContaining({ model: 'gpt-4o-mini' })
    );
  });

  it('still returns ok=true when worker fetch fails (best-effort)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network error'));

    const result = await replayMenuScan('job-uuid-001', { model: 'gpt-4o-2024-11-20' });
    expect(result.ok).toBe(true);
  });
});

describe('replayMenuScan — insert failure', () => {
  it('returns CREATE_FAILED when insert errors', async () => {
    vi.mocked(createAdminServiceClient).mockReturnValue(
      makeServiceClient(MOCK_JOB, null, { message: 'constraint violation' }) as never
    );

    const result = await replayMenuScan('job-uuid-001', { model: 'gpt-4o-2024-11-20' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.formError).toBe('CREATE_FAILED');
  });
});
