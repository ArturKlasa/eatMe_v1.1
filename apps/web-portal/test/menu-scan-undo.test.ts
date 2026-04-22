import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockVerifyAdminRequest = vi.fn();
const mockCreateServerSupabaseClient = vi.fn();

vi.mock('@/lib/supabase-server', () => ({
  verifyAdminRequest: (...args: unknown[]) => mockVerifyAdminRequest(...args),
  createServerSupabaseClient: (...args: unknown[]) => mockCreateServerSupabaseClient(...args),
}));

const { POST } = await import('@/app/api/menu-scan/undo/route');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/menu-scan/undo', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeChain(data: unknown, error: unknown = null) {
  const result = { data, error };
  const c: Record<string, unknown> = {
    then(onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
      return Promise.resolve(result).then(onFulfilled, onRejected);
    },
    catch(onRejected: (e: unknown) => unknown) {
      return Promise.resolve(result).catch(onRejected);
    },
    finally(onFinally: () => void) {
      return Promise.resolve(result).finally(onFinally);
    },
  };
  c.select = vi.fn(() => c);
  c.eq = vi.fn(() => c);
  c.in = vi.fn(() => c);
  c.single = vi.fn(() => Promise.resolve(result));
  return c as Record<string, unknown>;
}

function makeSupabaseMock(jobRow: unknown, deleteError: unknown = null) {
  const updates: unknown[] = [];

  const client = {
    from: vi.fn((table: string) => {
      if (table === 'menu_scan_jobs') {
        const chain = makeChain(jobRow);
        return {
          ...chain,
          update: vi.fn((data: unknown) => {
            updates.push(data);
            return makeChain(null);
          }),
          delete: vi.fn(() => makeChain(null)),
        };
      }
      if (table === 'dishes') {
        return {
          ...makeChain(null, deleteError),
          delete: vi.fn(() => ({
            ...makeChain(null, deleteError),
            in: vi.fn(() => makeChain(null, deleteError)),
          })),
        };
      }
      return {
        ...makeChain(null),
        insert: vi.fn(() => makeChain(null)),
        update: vi.fn(() => makeChain(null)),
        delete: vi.fn(() => makeChain(null)),
      };
    }),
  };

  return { client, updates };
}

const adminUser = {
  user: { id: 'admin-1', email: 'admin@example.com', app_metadata: { role: 'admin' } },
  error: null,
  status: 200,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/menu-scan/undo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes saved dishes and resets job when within 15-minute window', async () => {
    mockVerifyAdminRequest.mockResolvedValue(adminUser);

    const savedAt = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5 min ago
    const { client, updates } = makeSupabaseMock({
      id: 'job-1',
      status: 'completed',
      saved_dish_ids: ['dish-a', 'dish-b', 'dish-c'],
      saved_at: savedAt,
    });
    mockCreateServerSupabaseClient.mockReturnValue(client);

    const res = await POST(makeRequest({ job_id: 'job-1' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.undone).toBe(3);

    // Job should be reset to needs_review with cleared saved fields
    const jobUpdate = updates[0] as Record<string, unknown>;
    expect(jobUpdate.status).toBe('needs_review');
    expect(jobUpdate.saved_dish_ids).toBeNull();
    expect(jobUpdate.saved_at).toBeNull();
    expect(jobUpdate.dishes_saved).toBe(0);
  });

  it('returns 409 when the 15-minute undo window has expired', async () => {
    mockVerifyAdminRequest.mockResolvedValue(adminUser);

    const savedAt = new Date(Date.now() - 20 * 60 * 1000).toISOString(); // 20 min ago
    const { client } = makeSupabaseMock({
      id: 'job-2',
      status: 'completed',
      saved_dish_ids: ['dish-x'],
      saved_at: savedAt,
    });
    mockCreateServerSupabaseClient.mockReturnValue(client);

    const res = await POST(makeRequest({ job_id: 'job-2' }));
    expect(res.status).toBe(409);

    const json = await res.json();
    expect(json.error).toMatch(/expired/i);
  });

  it('returns 401 for non-admin request', async () => {
    mockVerifyAdminRequest.mockResolvedValue({ error: 'Unauthorized', status: 401 });

    const res = await POST(makeRequest({ job_id: 'job-1' }));
    expect(res.status).toBe(401);
  });
});
