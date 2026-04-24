import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({
  createServerActionClient: vi.fn(),
}));

import { createServerActionClient } from '@/lib/supabase/server';

const { confirmMenuScan, retryMenuScan } =
  await import('@/app/(app)/restaurant/[id]/actions/menuScan');

const mockGetUser = vi.fn();

function makeChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'update', 'insert', 'delete', 'eq', 'neq', 'in', 'limit']) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.single = vi.fn().mockResolvedValue(result);
  chain.maybeSingle = vi.fn().mockResolvedValue(result);
  return chain;
}

const authedUser = { id: 'user-abc', app_metadata: {}, user_metadata: {} } as never;

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── retryMenuScan ────────────────────────────────────────────────────────────

describe('retryMenuScan', () => {
  it('returns UNAUTHENTICATED when no session', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue({
      auth: { getUser: mockGetUser },
      from: vi.fn(),
    } as never);

    const result = await retryMenuScan('job-abc');
    expect(result).toEqual({ ok: false, formError: 'UNAUTHENTICATED' });
  });

  it('returns FORBIDDEN when job belongs to another user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    const chain = makeChain({
      data: { id: 'job-abc', created_by: 'other-user', restaurant_id: 'rest-123' },
      error: null,
    });
    vi.mocked(createServerActionClient).mockResolvedValue({
      auth: { getUser: mockGetUser },
      from: vi.fn().mockReturnValue(chain),
    } as never);

    const result = await retryMenuScan('job-abc');
    expect(result).toEqual({ ok: false, formError: 'FORBIDDEN' });
  });

  it('returns {ok:true} and resets status=pending, attempts=0, last_error=null', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });

    const jobChain = makeChain({
      data: { id: 'job-abc', created_by: 'user-abc', restaurant_id: 'rest-123' },
      error: null,
    });
    const updateChain = makeChain({ data: { id: 'job-abc' }, error: null });

    let callCount = 0;
    vi.mocked(createServerActionClient).mockResolvedValue({
      auth: { getUser: mockGetUser },
      from: vi.fn().mockImplementation(() => {
        callCount++;
        return callCount === 1 ? jobChain : updateChain;
      }),
    } as never);

    const result = await retryMenuScan('job-abc');
    expect(result).toEqual({ ok: true, data: undefined });

    const updateCall = (updateChain.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(updateCall).toMatchObject({
      status: 'pending',
      attempts: 0,
      last_error: null,
      locked_until: null,
    });
  });
});

// ─── confirmMenuScan ──────────────────────────────────────────────────────────

const validPayload = {
  job_id: '00000000-0000-0000-0000-000000000001',
  idempotency_key: '00000000-0000-0000-0000-000000000002',
  dishes: [
    {
      menu_category_id: '00000000-0000-0000-0000-000000000010',
      name: 'Burger',
      description: null,
      price: 12.99,
      dish_kind: 'standard' as const,
      primary_protein: 'beef' as const,
      is_template: false,
    },
  ],
};

describe('confirmMenuScan', () => {
  it('returns UNAUTHENTICATED when no session', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue({
      auth: { getUser: mockGetUser },
      from: vi.fn(),
      rpc: vi.fn(),
    } as never);

    const result = await confirmMenuScan(validPayload);
    expect(result).toEqual({ ok: false, formError: 'UNAUTHENTICATED' });
  });

  it('returns FORBIDDEN when job belongs to another user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });

    const jobChain = makeChain({
      data: { restaurant_id: 'rest-123', created_by: 'other-user', status: 'needs_review' },
      error: null,
    });

    vi.mocked(createServerActionClient).mockResolvedValue({
      auth: { getUser: mockGetUser },
      from: vi.fn().mockReturnValue(jobChain),
      rpc: vi.fn(),
    } as never);

    const result = await confirmMenuScan(validPayload);
    expect(result).toEqual({ ok: false, formError: 'FORBIDDEN' });
  });

  it('returns FORBIDDEN when menu_category_id does not belong to the restaurant', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });

    const jobChain = makeChain({
      data: { restaurant_id: 'rest-123', created_by: 'user-abc', status: 'needs_review' },
      error: null,
    });
    // menus chain
    const menusChain = makeChain({ data: [{ id: 'menu-xyz' }], error: null });
    menusChain.single = vi.fn().mockResolvedValue({ data: [{ id: 'menu-xyz' }], error: null });
    Object.assign(menusChain, {
      select: vi.fn().mockReturnValue(menusChain),
      eq: vi.fn().mockResolvedValue({ data: [{ id: 'menu-xyz' }], error: null }),
    });
    // categories chain — returns empty (category not in this restaurant)
    const categoriesChain = makeChain({ data: [], error: null });

    let callCount = 0;
    vi.mocked(createServerActionClient).mockResolvedValue({
      auth: { getUser: mockGetUser },
      from: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return jobChain; // job ownership
        if (callCount === 2) return menusChain; // menus lookup
        return categoriesChain; // categories lookup — empty = category not owned
      }),
      rpc: vi.fn(),
    } as never);

    const result = await confirmMenuScan(validPayload);
    expect(result).toEqual({ ok: false, formError: 'FORBIDDEN' });
  });

  it('returns {ok:true, data:{dishIds}} on success', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });

    const jobChain = makeChain({
      data: { restaurant_id: 'rest-123', created_by: 'user-abc', status: 'needs_review' },
      error: null,
    });
    const menusResult = { data: [{ id: 'menu-xyz' }], error: null };
    const categoriesResult = {
      data: [{ id: '00000000-0000-0000-0000-000000000010' }],
      error: null,
    };
    const rpcResult = { data: { confirmed: true, inserted_dish_ids: ['dish-1'] }, error: null };

    // Build chains that return correct results via 'eq' resolution
    const menusChain: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'neq', 'in']) {
      menusChain[m] = vi.fn().mockReturnValue(menusChain);
    }
    menusChain.single = vi.fn().mockResolvedValue(menusResult);
    menusChain.maybeSingle = vi.fn().mockResolvedValue(menusResult);
    (menusChain.eq as ReturnType<typeof vi.fn>).mockResolvedValue(menusResult);

    const catChain: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'neq']) {
      catChain[m] = vi.fn().mockReturnValue(catChain);
    }
    catChain.single = vi.fn().mockResolvedValue(categoriesResult);
    catChain.maybeSingle = vi.fn().mockResolvedValue(categoriesResult);
    // Two chained .in() calls: first returns the chain, second resolves with data
    catChain.in = vi.fn().mockReturnValueOnce(catChain).mockResolvedValueOnce(categoriesResult);

    let callCount = 0;
    vi.mocked(createServerActionClient).mockResolvedValue({
      auth: { getUser: mockGetUser },
      from: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return jobChain;
        if (callCount === 2) return menusChain;
        return catChain;
      }),
      rpc: vi.fn().mockResolvedValue(rpcResult),
    } as never);

    const result = await confirmMenuScan(validPayload);
    expect(result).toEqual({ ok: true, data: { dishIds: ['dish-1'] } });
  });

  it('returns fieldErrors for invalid payload (missing job_id)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue({
      auth: { getUser: mockGetUser },
      from: vi.fn(),
      rpc: vi.fn(),
    } as never);

    const badPayload = { ...validPayload, job_id: 'not-a-uuid' };
    const result = await confirmMenuScan(badPayload as never);
    expect(result).toMatchObject({ ok: false, fieldErrors: expect.any(Object) });
  });
});
