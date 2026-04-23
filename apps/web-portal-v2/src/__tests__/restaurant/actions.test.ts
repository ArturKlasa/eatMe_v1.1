import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({
  createServerActionClient: vi.fn(),
}));

import { createServerActionClient } from '@/lib/supabase/server';

const {
  createRestaurantDraft,
  updateRestaurantBasics,
  archiveRestaurant,
  unpublishRestaurant,
  publishRestaurant,
} = await import('@/app/(app)/restaurant/[id]/actions/restaurant');

const mockGetUser = vi.fn();

function makeChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  for (const m of ['insert', 'update', 'select', 'eq', 'neq', 'limit']) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.single = vi.fn().mockResolvedValue(result);
  chain.maybeSingle = vi.fn().mockResolvedValue(result);
  return chain;
}

function makeSupabase(chainResult: { data: unknown; error: unknown }) {
  const chain = makeChain(chainResult);
  return {
    auth: { getUser: mockGetUser },
    from: vi.fn().mockReturnValue(chain),
    _chain: chain,
  };
}

beforeEach(() => {
  mockGetUser.mockReset();
});

const authedUser = { id: 'user-abc', app_metadata: {}, user_metadata: {} } as any;

// ─── createRestaurantDraft ────────────────────────────────────────────────────

describe('createRestaurantDraft', () => {
  it('returns UNAUTHENTICATED when no user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(
      makeSupabase({ data: null, error: null }) as any
    );

    const result = await createRestaurantDraft({ name: 'Cafe Test' });
    expect(result).toEqual({ ok: false, formError: 'UNAUTHENTICATED' });
  });

  it('returns fieldErrors when name is too short', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(
      makeSupabase({ data: null, error: null }) as any
    );

    const result = await createRestaurantDraft({ name: 'A' });
    expect(result).toMatchObject({ ok: false, fieldErrors: { name: expect.any(Array) } });
  });

  it('returns {ok:true, data:{id}} on success', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(
      makeSupabase({ data: { id: 'rest-123' }, error: null }) as any
    );

    const result = await createRestaurantDraft({ name: 'Test Cafe' });
    expect(result).toEqual({ ok: true, data: { id: 'rest-123' } });
  });

  it('returns CREATE_FAILED when DB insert fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(
      makeSupabase({ data: null, error: { message: 'db error' } }) as any
    );

    const result = await createRestaurantDraft({ name: 'Test Cafe' });
    expect(result).toEqual({ ok: false, formError: 'CREATE_FAILED' });
  });

  it('inserts location as WKT string not an object (PostGIS pitfall)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    const supabase = makeSupabase({ data: { id: 'rest-wkt' }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(supabase as any);

    await createRestaurantDraft({ name: 'WKT Test Cafe' });

    const insertCall = (supabase._chain.insert as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(typeof insertCall.location).toBe('string');
    expect(insertCall.location).toBe('POINT(0 0)');
  });
});

// ─── updateRestaurantBasics ───────────────────────────────────────────────────

describe('updateRestaurantBasics', () => {
  const validInput = { name: 'Test Cafe', address: '123 Main St', cuisines: [] };

  it('returns UNAUTHENTICATED when no user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(
      makeSupabase({ data: null, error: null }) as any
    );

    const result = await updateRestaurantBasics('rest-123', validInput);
    expect(result).toEqual({ ok: false, formError: 'UNAUTHENTICATED' });
  });

  it('returns fieldErrors for Zod validation failure (name too short)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(
      makeSupabase({ data: null, error: null }) as any
    );

    const result = await updateRestaurantBasics('rest-123', { name: 'X', cuisines: [] });
    expect(result).toMatchObject({ ok: false, fieldErrors: { name: expect.any(Array) } });
  });

  it('returns NOT_FOUND when restaurant belongs to another owner (RLS returns null)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(
      makeSupabase({ data: null, error: null }) as any
    );

    const result = await updateRestaurantBasics('foreign-rest', validInput);
    expect(result).toEqual({ ok: false, formError: 'NOT_FOUND' });
  });

  it('returns {ok:true} on successful update', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(
      makeSupabase({ data: { id: 'rest-123' }, error: null }) as any
    );

    const result = await updateRestaurantBasics('rest-123', validInput);
    expect(result).toEqual({ ok: true, data: undefined });
  });
});

// ─── archiveRestaurant ────────────────────────────────────────────────────────

describe('archiveRestaurant', () => {
  it('returns UNAUTHENTICATED when no user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(
      makeSupabase({ data: null, error: null }) as any
    );

    const result = await archiveRestaurant('rest-123');
    expect(result).toEqual({ ok: false, formError: 'UNAUTHENTICATED' });
  });

  it('returns NOT_FOUND for foreign restaurant', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(
      makeSupabase({ data: null, error: null }) as any
    );

    const result = await archiveRestaurant('foreign-rest');
    expect(result).toEqual({ ok: false, formError: 'NOT_FOUND' });
  });

  it('flips status to archived for own restaurant', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    const supabase = makeSupabase({ data: { id: 'rest-123' }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(supabase as any);

    const result = await archiveRestaurant('rest-123');
    expect(result).toEqual({ ok: true, data: undefined });

    const updateCall = (supabase._chain.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(updateCall).toMatchObject({ status: 'archived' });
  });
});

// ─── unpublishRestaurant ──────────────────────────────────────────────────────

describe('unpublishRestaurant', () => {
  it('returns UNAUTHENTICATED when no user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(
      makeSupabase({ data: null, error: null }) as any
    );

    const result = await unpublishRestaurant('rest-123');
    expect(result).toEqual({ ok: false, formError: 'UNAUTHENTICATED' });
  });

  it('flips status to draft without touching menus or dishes', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    const supabase = makeSupabase({ data: { id: 'rest-123' }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(supabase as any);

    const result = await unpublishRestaurant('rest-123');
    expect(result).toEqual({ ok: true, data: undefined });

    // Only 'restaurants' table was touched — menus and dishes were NOT queried
    const fromCalls = (supabase.from as ReturnType<typeof vi.fn>).mock.calls;
    expect(fromCalls.every((call: unknown[]) => call[0] === 'restaurants')).toBe(true);

    const updateCall = (supabase._chain.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(updateCall).toMatchObject({ status: 'draft' });
  });

  it('returns NOT_FOUND for foreign restaurant', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(
      makeSupabase({ data: null, error: null }) as any
    );

    const result = await unpublishRestaurant('foreign-rest');
    expect(result).toEqual({ ok: false, formError: 'NOT_FOUND' });
  });
});

// ─── publishRestaurant ────────────────────────────────────────────────────────

function makeRpcSupabase(rpcResult: { data: unknown; error: unknown }) {
  const mockRpc = vi.fn().mockResolvedValue(rpcResult);
  const mockChannel = {
    send: vi.fn().mockResolvedValue('ok'),
  };
  const mockRemoveChannel = vi.fn().mockResolvedValue(undefined);
  return {
    auth: { getUser: mockGetUser },
    from: vi.fn(),
    rpc: mockRpc,
    channel: vi.fn().mockReturnValue(mockChannel),
    removeChannel: mockRemoveChannel,
    _rpc: mockRpc,
  };
}

describe('publishRestaurant', () => {
  it('returns UNAUTHENTICATED when no user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(
      makeRpcSupabase({ data: null, error: null }) as any
    );

    const result = await publishRestaurant('rest-123');
    expect(result).toEqual({ ok: false, formError: 'UNAUTHENTICATED' });
  });

  it('maps insufficient_privilege → FORBIDDEN', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(
      makeRpcSupabase({
        data: null,
        error: { code: 'insufficient_privilege', message: 'Forbidden: not owner or admin' },
      }) as any
    );

    const result = await publishRestaurant('rest-123');
    expect(result).toEqual({ ok: false, formError: 'FORBIDDEN' });
  });

  it('maps NO_DATA_FOUND → NOT_FOUND', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(
      makeRpcSupabase({
        data: null,
        error: { code: 'NO_DATA_FOUND', message: 'Restaurant not found' },
      }) as any
    );

    const result = await publishRestaurant('rest-123');
    expect(result).toEqual({ ok: false, formError: 'NOT_FOUND' });
  });

  it('maps CHECK constraint violation → VALIDATION', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(
      makeRpcSupabase({
        data: null,
        error: { code: '23514', message: 'violates check constraint' },
      }) as any
    );

    const result = await publishRestaurant('rest-123');
    expect(result).toEqual({ ok: false, formError: 'VALIDATION' });
  });

  it('maps unknown DB error → UNKNOWN_ERROR', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(
      makeRpcSupabase({
        data: null,
        error: { code: '58000', message: 'system error' },
      }) as any
    );

    const result = await publishRestaurant('rest-123');
    expect(result).toEqual({ ok: false, formError: 'UNKNOWN_ERROR' });
  });

  it('returns {ok:true} and calls publish_restaurant_draft RPC on success', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    const supabase = makeRpcSupabase({ data: null, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(supabase as any);

    const result = await publishRestaurant('rest-123');
    expect(result).toEqual({ ok: true, data: undefined });
    expect(supabase._rpc).toHaveBeenCalledWith('publish_restaurant_draft', {
      p_restaurant_id: 'rest-123',
    });
  });
});
