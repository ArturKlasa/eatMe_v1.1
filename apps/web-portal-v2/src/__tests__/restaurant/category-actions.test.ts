import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({
  createServerActionClient: vi.fn(),
}));

import { createServerActionClient } from '@/lib/supabase/server';

const { createCategory, updateCategory, deleteCategory } =
  await import('@/app/(app)/restaurant/[id]/actions/category');

const mockGetUser = vi.fn();

function makeChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  for (const m of ['insert', 'update', 'select', 'eq', 'neq', 'delete', 'limit']) {
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

// ─── createCategory ───────────────────────────────────────────────────────────

describe('createCategory', () => {
  it('returns UNAUTHENTICATED when no user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(
      makeSupabase({ data: null, error: null }) as never
    );
    const result = await createCategory('rest-1', {
      menu_id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Mains',
    });
    expect(result).toEqual({ ok: false, formError: 'UNAUTHENTICATED' });
  });

  it('returns fieldErrors for empty name', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(
      makeSupabase({ data: null, error: null }) as never
    );
    const result = await createCategory('rest-1', {
      menu_id: '123e4567-e89b-12d3-a456-426614174000',
      name: '',
    });
    expect(result).toMatchObject({ ok: false, fieldErrors: { name: expect.any(Array) } });
  });

  it('returns fieldErrors for invalid menu_id UUID', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(
      makeSupabase({ data: null, error: null }) as never
    );
    const result = await createCategory('rest-1', { menu_id: 'not-a-uuid', name: 'Starters' });
    expect(result).toMatchObject({ ok: false, fieldErrors: { menu_id: expect.any(Array) } });
  });

  it('returns {ok:true, data:{id}} on success', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(
      makeSupabase({ data: { id: 'cat-xyz' }, error: null }) as never
    );
    const result = await createCategory('rest-1', {
      menu_id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Mains',
    });
    expect(result).toEqual({ ok: true, data: { id: 'cat-xyz' } });
  });

  it('includes restaurant_id in insert', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    const supabase = makeSupabase({ data: { id: 'cat-1' }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(supabase as never);

    await createCategory('rest-abc', {
      menu_id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Starters',
    });

    const insertCall = (supabase._chain.insert as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(insertCall).toMatchObject({ restaurant_id: 'rest-abc', name: 'Starters' });
  });
});

// ─── updateCategory ───────────────────────────────────────────────────────────

describe('updateCategory', () => {
  it('returns NOT_FOUND for foreign category', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(
      makeSupabase({ data: null, error: null }) as never
    );
    const result = await updateCategory('foreign-cat', 'rest-1', { name: 'New Name' });
    expect(result).toEqual({ ok: false, formError: 'NOT_FOUND' });
  });

  it('returns {ok:true} on success', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(
      makeSupabase({ data: { id: 'cat-1' }, error: null }) as never
    );
    const result = await updateCategory('cat-1', 'rest-1', { name: 'Updated' });
    expect(result).toEqual({ ok: true, data: undefined });
  });
});

// ─── deleteCategory ───────────────────────────────────────────────────────────

describe('deleteCategory', () => {
  it('returns NOT_FOUND for foreign category', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(
      makeSupabase({ data: null, error: null }) as never
    );
    const result = await deleteCategory('foreign-cat', 'rest-1');
    expect(result).toEqual({ ok: false, formError: 'NOT_FOUND' });
  });

  it('returns {ok:true} and hits menu_categories table', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    const supabase = makeSupabase({ data: { id: 'cat-1' }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(supabase as never);

    const result = await deleteCategory('cat-1', 'rest-1');
    expect(result).toEqual({ ok: true, data: undefined });

    const fromCalls = (supabase.from as ReturnType<typeof vi.fn>).mock.calls;
    expect(fromCalls.some((c: unknown[]) => c[0] === 'menu_categories')).toBe(true);
  });
});
