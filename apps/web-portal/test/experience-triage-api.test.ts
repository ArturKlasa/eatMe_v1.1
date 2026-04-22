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

const { POST } = await import('@/app/api/admin/dishes/triage/route');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/admin/dishes/triage', {
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

interface MockClientState {
  updates: Array<{ table: string; data: Record<string, unknown> }>;
  inserts: Array<{ table: string; data: Record<string, unknown> }>;
}

function makeSupabaseMock(
  updateError: unknown = null,
  auditError: unknown = null
): { client: unknown; state: MockClientState } {
  const state: MockClientState = { updates: [], inserts: [] };

  const client = {
    from: vi.fn((table: string) => ({
      update: vi.fn((data: Record<string, unknown>) => {
        state.updates.push({ table, data });
        return {
          ...makeChain(null, updateError),
          eq: vi.fn(() => makeChain(null, updateError)),
        };
      }),
      insert: vi.fn((data: Record<string, unknown>) => {
        state.inserts.push({ table, data });
        return makeChain(null, auditError);
      }),
    })),
  };

  return { client, state };
}

const adminUser = {
  user: { id: 'admin-uuid-1', email: 'admin@example.com', app_metadata: { role: 'admin' } },
  error: null,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/admin/dishes/triage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('batch-updates dish_kind and inserts audit log rows for each dish', async () => {
    mockVerifyAdminRequest.mockResolvedValue(adminUser);
    const { client, state } = makeSupabaseMock();
    mockCreateServerSupabaseClient.mockReturnValue(client);

    const entries = [
      { dish_id: 'dish-1', before_kind: 'experience', after_kind: 'course_menu' },
      { dish_id: 'dish-2', before_kind: 'experience', after_kind: 'buffet' },
    ];

    const res = await POST(makeRequest(entries));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.updated).toBe(2);
    expect(json.errors).toBeUndefined();

    // Verify dish updates
    const dishUpdates = state.updates.filter(u => u.table === 'dishes');
    expect(dishUpdates).toHaveLength(2);
    expect(dishUpdates[0].data).toEqual({ dish_kind: 'course_menu' });
    expect(dishUpdates[1].data).toEqual({ dish_kind: 'buffet' });

    // Verify audit log inserts
    const auditInserts = state.inserts.filter(i => i.table === 'admin_audit_log');
    expect(auditInserts).toHaveLength(2);
    expect(auditInserts[0].data).toMatchObject({
      admin_id: 'admin-uuid-1',
      action: 'dish_kind_triage',
      resource_type: 'dish',
      resource_id: 'dish-1',
      old_data: { dish_kind: 'experience' },
      new_data: { dish_kind: 'course_menu' },
    });
    expect(auditInserts[1].data).toMatchObject({
      resource_id: 'dish-2',
      new_data: { dish_kind: 'buffet' },
    });
  });

  it('returns 401 for non-admin requests', async () => {
    mockVerifyAdminRequest.mockResolvedValue({ error: 'Unauthorized', status: 401 });

    const res = await POST(
      makeRequest([{ dish_id: 'x', before_kind: 'experience', after_kind: 'buffet' }])
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid after_kind value', async () => {
    mockVerifyAdminRequest.mockResolvedValue(adminUser);

    const res = await POST(
      makeRequest([{ dish_id: 'dish-1', before_kind: 'experience', after_kind: 'standard' }])
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 for empty array', async () => {
    mockVerifyAdminRequest.mockResolvedValue(adminUser);

    const res = await POST(makeRequest([]));
    expect(res.status).toBe(400);
  });

  it('continues and reports errors when some dish updates fail', async () => {
    mockVerifyAdminRequest.mockResolvedValue(adminUser);
    // First dish update fails, second succeeds
    let callCount = 0;
    const client = {
      from: vi.fn((table: string) => ({
        update: vi.fn((data: Record<string, unknown>) => {
          callCount++;
          const err = callCount === 1 ? { message: 'DB error' } : null;
          return {
            ...makeChain(null, err),
            eq: vi.fn(() => makeChain(null, err)),
          };
        }),
        insert: vi.fn(() => makeChain(null)),
      })),
    };
    mockCreateServerSupabaseClient.mockReturnValue(client);

    const entries = [
      { dish_id: 'dish-bad', before_kind: 'experience', after_kind: 'course_menu' },
      { dish_id: 'dish-good', before_kind: 'experience', after_kind: 'buffet' },
    ];

    const res = await POST(makeRequest(entries));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.updated).toBe(1);
    expect(json.errors).toHaveLength(1);
    expect(json.errors[0]).toMatch(/dish-bad/);
  });

  it('audit log failure is non-fatal — dish update still counts as updated', async () => {
    mockVerifyAdminRequest.mockResolvedValue(adminUser);
    const { client, state } = makeSupabaseMock(null, { message: 'audit insert failed' });
    mockCreateServerSupabaseClient.mockReturnValue(client);

    const entries = [{ dish_id: 'dish-1', before_kind: 'experience', after_kind: 'course_menu' }];

    const res = await POST(makeRequest(entries));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.updated).toBe(1);

    // Dish was updated
    expect(state.updates.some(u => u.table === 'dishes')).toBe(true);
    // Audit was attempted
    expect(state.inserts.some(i => i.table === 'admin_audit_log')).toBe(true);
  });
});
