import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({
  createServerActionClient: vi.fn(),
}));

import { createServerActionClient } from '@/lib/supabase/server';

const { createDish, updateDish, archiveDish, unpublishDish } =
  await import('@/app/(app)/restaurant/[id]/actions/dish');

const mockGetUser = vi.fn();

function makeChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  for (const m of ['insert', 'update', 'select', 'eq', 'neq', 'in', 'delete', 'limit', 'order']) {
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
const UUID = '123e4567-e89b-12d3-a456-426614174000';

const baseStandardDish = {
  name: 'Chicken Sandwich',
  price: 12,
  primary_protein: 'chicken' as const,
  dish_kind: 'standard' as const,
};

// ─── createDish ───────────────────────────────────────────────────────────────

describe('createDish', () => {
  it('returns UNAUTHENTICATED when no user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(
      makeSupabase({ data: null, error: null }) as never
    );
    const result = await createDish('rest-1', 'cat-1', baseStandardDish);
    expect(result).toEqual({ ok: false, formError: 'UNAUTHENTICATED' });
  });

  it('rejects dish_kind="template" (removed post-mig-115)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(
      makeSupabase({ data: null, error: null }) as never
    );
    const result = await createDish('rest-1', 'cat-1', {
      ...baseStandardDish,
      dish_kind: 'template' as never,
    });
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ ok: false });
  });

  it('accepts all 5 valid dish_kind values', async () => {
    const kinds = ['standard', 'bundle', 'configurable', 'course_menu', 'buffet'] as const;
    for (const dish_kind of kinds) {
      mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
      vi.mocked(createServerActionClient).mockResolvedValue(
        makeSupabase({ data: { id: 'dish-xyz' }, error: null }) as never
      );

      const input =
        dish_kind === 'bundle'
          ? { ...baseStandardDish, dish_kind, bundle_items: [UUID] }
          : dish_kind === 'configurable'
            ? { ...baseStandardDish, dish_kind, is_template: false, slots: [] }
            : dish_kind === 'course_menu'
              ? { ...baseStandardDish, dish_kind, courses: [] }
              : { ...baseStandardDish, dish_kind };

      const result = await createDish('rest-1', 'cat-1', input as never);
      expect(result.ok, `dish_kind "${dish_kind}" should be accepted`).toBe(true);
    }
  });

  it('writes allergens=[] and dietary_tags=[] regardless of input', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    const supabase = makeSupabase({ data: { id: 'dish-1' }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(supabase as never);

    await createDish('rest-1', 'cat-1', baseStandardDish);

    const insertCall = (supabase._chain.insert as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(insertCall.allergens).toEqual([]);
    expect(insertCall.dietary_tags).toEqual([]);
  });

  it('writes status=draft on new dish', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    const supabase = makeSupabase({ data: { id: 'dish-1' }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(supabase as never);

    await createDish('rest-1', 'cat-1', baseStandardDish);

    const insertCall = (supabase._chain.insert as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(insertCall.status).toBe('draft');
  });

  it('sets is_template=true only for configurable kind', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    const supabase = makeSupabase({ data: { id: 'dish-1' }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(supabase as never);

    await createDish('rest-1', 'cat-1', {
      ...baseStandardDish,
      dish_kind: 'configurable',
      is_template: true,
      slots: [],
    });

    const insertCall = (supabase._chain.insert as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(insertCall.is_template).toBe(true);
    expect(insertCall.dish_kind).toBe('configurable');
  });

  it('sets is_template=false for non-configurable kinds', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    const supabase = makeSupabase({ data: { id: 'dish-1' }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(supabase as never);

    await createDish('rest-1', 'cat-1', baseStandardDish);

    const insertCall = (supabase._chain.insert as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(insertCall.is_template).toBe(false);
  });

  it('returns CREATE_FAILED on DB error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(
      makeSupabase({ data: null, error: { message: 'db error' } }) as never
    );
    const result = await createDish('rest-1', 'cat-1', baseStandardDish);
    expect(result).toEqual({ ok: false, formError: 'CREATE_FAILED' });
  });

  it('returns {ok:true, data:{id}} on success', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(
      makeSupabase({ data: { id: 'dish-xyz' }, error: null }) as never
    );
    const result = await createDish('rest-1', 'cat-1', baseStandardDish);
    expect(result).toEqual({ ok: true, data: { id: 'dish-xyz' } });
  });
});

// ─── archiveDish ──────────────────────────────────────────────────────────────

describe('archiveDish', () => {
  it('flips status to archived', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    const supabase = makeSupabase({ data: { id: 'dish-1' }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(supabase as never);

    const result = await archiveDish('dish-1', 'rest-1');
    expect(result).toEqual({ ok: true, data: undefined });

    const updateCall = (supabase._chain.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(updateCall).toMatchObject({ status: 'archived' });
  });

  it('returns NOT_FOUND for foreign dish', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(
      makeSupabase({ data: null, error: null }) as never
    );
    const result = await archiveDish('foreign-dish', 'rest-1');
    expect(result).toEqual({ ok: false, formError: 'NOT_FOUND' });
  });
});

// ─── unpublishDish ────────────────────────────────────────────────────────────

describe('unpublishDish', () => {
  it('flips status to draft', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    const supabase = makeSupabase({ data: { id: 'dish-1' }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(supabase as never);

    const result = await unpublishDish('dish-1', 'rest-1');
    expect(result).toEqual({ ok: true, data: undefined });

    const updateCall = (supabase._chain.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(updateCall).toMatchObject({ status: 'draft' });
  });

  it('returns NOT_FOUND for foreign dish', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(
      makeSupabase({ data: null, error: null }) as never
    );
    const result = await unpublishDish('foreign-dish', 'rest-1');
    expect(result).toEqual({ ok: false, formError: 'NOT_FOUND' });
  });

  it('only touches the dishes table', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    const supabase = makeSupabase({ data: { id: 'dish-1' }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(supabase as never);

    await unpublishDish('dish-1', 'rest-1');

    const fromCalls = (supabase.from as ReturnType<typeof vi.fn>).mock.calls;
    expect(fromCalls.every((c: unknown[]) => c[0] === 'dishes')).toBe(true);
  });
});

// ─── updateDish ───────────────────────────────────────────────────────────────

describe('updateDish', () => {
  it('returns NOT_FOUND for foreign dish', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(
      makeSupabase({ data: null, error: null }) as never
    );
    const result = await updateDish('foreign-dish', 'rest-1', baseStandardDish);
    expect(result).toEqual({ ok: false, formError: 'NOT_FOUND' });
  });

  it('returns {ok:true} on successful update', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(
      makeSupabase({ data: { id: 'dish-1' }, error: null }) as never
    );
    const result = await updateDish('dish-1', 'rest-1', baseStandardDish);
    expect(result).toEqual({ ok: true, data: undefined });
  });

  it('sets is_template correctly when switching to configurable', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    const supabase = makeSupabase({ data: { id: 'dish-1' }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(supabase as never);

    await updateDish('dish-1', 'rest-1', {
      ...baseStandardDish,
      dish_kind: 'configurable',
      is_template: true,
      slots: [],
    });

    const updateCall = (supabase._chain.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(updateCall).toMatchObject({ dish_kind: 'configurable', is_template: true });
  });
});
