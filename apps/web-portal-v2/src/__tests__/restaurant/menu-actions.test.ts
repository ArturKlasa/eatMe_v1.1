import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({
  createServerActionClient: vi.fn(),
}));

import { createServerActionClient } from '@/lib/supabase/server';

const { createMenu, updateMenu, archiveMenu } =
  await import('@/app/(app)/restaurant/[id]/actions/menu');

const mockGetUser = vi.fn();

function makeChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  for (const m of ['insert', 'update', 'select', 'eq', 'neq', 'limit', 'delete', 'in', 'order']) {
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

const authedUser = { id: 'user-abc', app_metadata: {}, user_metadata: {} } as never;

// ─── createMenu ───────────────────────────────────────────────────────────────

describe('createMenu', () => {
  it('returns UNAUTHENTICATED when no user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(
      makeSupabase({ data: null, error: null }) as never
    );
    const result = await createMenu('rest-123', { name: 'Lunch' });
    expect(result).toEqual({ ok: false, formError: 'UNAUTHENTICATED' });
  });

  it('returns fieldErrors when name is empty', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(
      makeSupabase({ data: null, error: null }) as never
    );
    const result = await createMenu('rest-123', { name: '' });
    expect(result).toMatchObject({ ok: false, fieldErrors: { name: expect.any(Array) } });
  });

  it('returns {ok:true, data:{id}} on success', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(
      makeSupabase({ data: { id: 'menu-abc' }, error: null }) as never
    );
    const result = await createMenu('rest-123', { name: 'Lunch' });
    expect(result).toEqual({ ok: true, data: { id: 'menu-abc' } });
  });

  it('inserts with status=draft', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    const supabase = makeSupabase({ data: { id: 'menu-xyz' }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(supabase as never);

    await createMenu('rest-123', { name: 'Dinner' });

    const insertCall = (supabase._chain.insert as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(insertCall).toMatchObject({ status: 'draft', name: 'Dinner' });
  });

  it('returns CREATE_FAILED on DB error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(
      makeSupabase({ data: null, error: { message: 'db error' } }) as never
    );
    const result = await createMenu('rest-123', { name: 'Brunch' });
    expect(result).toEqual({ ok: false, formError: 'CREATE_FAILED' });
  });
});

// ─── updateMenu ───────────────────────────────────────────────────────────────

describe('updateMenu', () => {
  it('returns UNAUTHENTICATED when no user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(
      makeSupabase({ data: null, error: null }) as never
    );
    const result = await updateMenu('menu-1', 'rest-1', { name: 'New Name' });
    expect(result).toEqual({ ok: false, formError: 'UNAUTHENTICATED' });
  });

  it('returns NOT_FOUND for foreign menu (RLS returns null)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(
      makeSupabase({ data: null, error: null }) as never
    );
    const result = await updateMenu('foreign-menu', 'rest-1', { name: 'X' });
    expect(result).toEqual({ ok: false, formError: 'NOT_FOUND' });
  });

  it('returns {ok:true} on success', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(
      makeSupabase({ data: { id: 'menu-1' }, error: null }) as never
    );
    const result = await updateMenu('menu-1', 'rest-1', { name: 'Updated Name' });
    expect(result).toEqual({ ok: true, data: undefined });
  });
});

// ─── archiveMenu ──────────────────────────────────────────────────────────────

describe('archiveMenu', () => {
  it('flips status to archived', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    const supabase = makeSupabase({ data: { id: 'menu-1' }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(supabase as never);

    const result = await archiveMenu('menu-1', 'rest-1');
    expect(result).toEqual({ ok: true, data: undefined });

    const updateCall = (supabase._chain.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(updateCall).toMatchObject({ status: 'archived' });
  });

  it('returns NOT_FOUND for foreign menu', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(
      makeSupabase({ data: null, error: null }) as never
    );
    const result = await archiveMenu('foreign-menu', 'rest-1');
    expect(result).toEqual({ ok: false, formError: 'NOT_FOUND' });
  });
});
