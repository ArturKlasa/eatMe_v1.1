import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({
  createServerActionClient: vi.fn(),
}));

import { createServerActionClient } from '@/lib/supabase/server';

const { createMenuScanJob } = await import('@/app/(app)/restaurant/[id]/actions/menuScan');

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

function makeSupabase(
  ownerResult: { data: unknown; error: unknown },
  insertResult: { data: unknown; error: unknown }
) {
  const ownerChain = makeChain(ownerResult);
  const insertChain = makeChain(insertResult);
  let callCount = 0;
  return {
    auth: { getUser: mockGetUser },
    from: vi.fn().mockImplementation(() => {
      callCount++;
      return callCount === 1 ? ownerChain : insertChain;
    }),
    _ownerChain: ownerChain,
    _insertChain: insertChain,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

const authedUser = { id: 'user-abc', app_metadata: {}, user_metadata: {} } as never;

const validInput = {
  images: [{ bucket: 'menu-scan-uploads' as const, path: 'rest-123/uuid.jpg', page: 1 }],
};

// ─── createMenuScanJob ────────────────────────────────────────────────────────

describe('createMenuScanJob', () => {
  it('returns UNAUTHENTICATED when no session', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(
      makeSupabase({ data: null, error: null }, { data: null, error: null }) as never
    );

    const result = await createMenuScanJob('rest-123', validInput);
    expect(result).toEqual({ ok: false, formError: 'UNAUTHENTICATED' });
  });

  it('returns FORBIDDEN when restaurant belongs to another owner', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(
      makeSupabase({ data: null, error: null }, { data: null, error: null }) as never
    );

    const result = await createMenuScanJob('foreign-rest', validInput);
    expect(result).toEqual({ ok: false, formError: 'FORBIDDEN' });
  });

  it('returns fieldErrors when images array is empty (0 images)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(
      makeSupabase({ data: { id: 'rest-123' }, error: null }, { data: null, error: null }) as never
    );

    const result = await createMenuScanJob('rest-123', { images: [] });
    expect(result).toMatchObject({ ok: false, fieldErrors: { images: expect.any(Array) } });
  });

  it('returns fieldErrors when images exceed 20 entries', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(
      makeSupabase({ data: { id: 'rest-123' }, error: null }, { data: null, error: null }) as never
    );

    const tooMany = Array.from({ length: 21 }, (_, i) => ({
      bucket: 'menu-scan-uploads' as const,
      path: `rest-123/img-${i}.jpg`,
      page: i + 1,
    }));
    const result = await createMenuScanJob('rest-123', { images: tooMany });
    expect(result).toMatchObject({ ok: false, fieldErrors: { images: expect.any(Array) } });
  });

  it('returns {ok:true, data:{jobId}} on success', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(
      makeSupabase(
        { data: { id: 'rest-123' }, error: null },
        { data: { id: 'job-uuid-999' }, error: null }
      ) as never
    );

    const result = await createMenuScanJob('rest-123', validInput);
    expect(result).toEqual({ ok: true, data: { jobId: 'job-uuid-999' } });
  });

  it('returns CREATE_FAILED when DB insert fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(
      makeSupabase(
        { data: { id: 'rest-123' }, error: null },
        { data: null, error: { message: 'db error' } }
      ) as never
    );

    const result = await createMenuScanJob('rest-123', validInput);
    expect(result).toEqual({ ok: false, formError: 'CREATE_FAILED' });
  });

  it('rejects images with bucket !== menu-scan-uploads', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(
      makeSupabase({ data: { id: 'rest-123' }, error: null }, { data: null, error: null }) as never
    );

    // cast as never: testing runtime Zod rejection of an invalid bucket value
    const result = await createMenuScanJob('rest-123', {
      images: [{ bucket: 'dish-photos', path: 'rest-123/uuid.jpg', page: 1 }],
    } as never);
    expect(result).toMatchObject({ ok: false, fieldErrors: expect.any(Object) });
  });

  it('inserts status=pending and correct restaurant_id + created_by', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    const supabase = makeSupabase(
      { data: { id: 'rest-123' }, error: null },
      { data: { id: 'job-abc' }, error: null }
    );
    vi.mocked(createServerActionClient).mockResolvedValue(supabase as never);

    await createMenuScanJob('rest-123', validInput);

    const insertCall = (supabase._insertChain.insert as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(insertCall).toMatchObject({
      restaurant_id: 'rest-123',
      created_by: 'user-abc',
      status: 'pending',
    });
    expect(insertCall.input.images).toHaveLength(1);
  });
});
