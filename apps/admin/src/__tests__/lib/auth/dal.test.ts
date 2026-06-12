/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('react', async importActual => {
  const actual = await importActual<typeof import('react')>();
  return { ...actual, cache: (fn: unknown) => fn };
});
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
  createAdminServiceClient: vi.fn(),
}));

import { redirect } from 'next/navigation';
import { createServerClient, createAdminServiceClient } from '@/lib/supabase/server';
import { verifySession, verifyAdminSession, getAllDishCategoryOptions } from '@/lib/auth/dal';

const mockGetClaims = vi.fn();
const mockSupabase = { auth: { getClaims: mockGetClaims } };

// Next.js redirect() throws internally — mirror that in tests so execution halts.
const REDIRECT_ERROR = new Error('NEXT_REDIRECT');

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(createServerClient).mockResolvedValue(mockSupabase as any);
  vi.mocked(redirect).mockImplementation(() => {
    throw REDIRECT_ERROR;
  });
});

describe('verifySession', () => {
  it('returns userId and claims when authenticated', async () => {
    const claims = { sub: 'user-1', app_metadata: {} } as any;
    mockGetClaims.mockResolvedValue({ data: { claims, header: {}, signature: null }, error: null });

    const session = await verifySession();

    expect(session).toEqual({ userId: 'user-1', claims });
    expect(redirect).not.toHaveBeenCalled();
  });

  it('redirects to /signin when no session (data: null)', async () => {
    mockGetClaims.mockResolvedValue({ data: null, error: null });

    await expect(verifySession()).rejects.toThrow(REDIRECT_ERROR);
    expect(redirect).toHaveBeenCalledWith('/signin');
  });
});

describe('verifyAdminSession', () => {
  it('returns session when user has admin role in app_metadata', async () => {
    const claims = { sub: 'admin-1', app_metadata: { role: 'admin' } } as any;
    mockGetClaims.mockResolvedValue({ data: { claims, header: {}, signature: null }, error: null });

    const session = await verifyAdminSession();

    expect(session.userId).toBe('admin-1');
    expect(redirect).not.toHaveBeenCalled();
  });

  it('redirects to /signin?forbidden=1 when non-admin', async () => {
    const claims = { sub: 'user-1', app_metadata: { role: 'owner' } } as any;
    mockGetClaims.mockResolvedValue({ data: { claims, header: {}, signature: null }, error: null });

    await expect(verifyAdminSession()).rejects.toThrow(REDIRECT_ERROR);
    expect(redirect).toHaveBeenCalledWith('/signin?forbidden=1');
  });

  it('redirects to /signin when no session (not admin)', async () => {
    mockGetClaims.mockResolvedValue({ data: null, error: null });

    await expect(verifyAdminSession()).rejects.toThrow(REDIRECT_ERROR);
    expect(redirect).toHaveBeenCalledWith('/signin');
  });
});

describe('getAllDishCategoryOptions', () => {
  // Chainable query mock whose .range(from, to) serves slices of `rows`,
  // mimicking PostgREST offset pagination (each page capped at 1000).
  function mockPagedClient(rows: Array<{ id: string; name: string; is_drink: boolean | null }>) {
    const range = vi.fn((from: number, to: number) =>
      Promise.resolve({ data: rows.slice(from, to + 1), error: null })
    );
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({ range })),
          })),
        })),
      })),
    };
    vi.mocked(createAdminServiceClient).mockReturnValue(client as any);
    return { range };
  }

  it('pages past the 1000-row PostgREST cap so the alphabetical tail survives', async () => {
    // Regression: prod has >1000 active dish_categories; an un-ranged select
    // dropped everything after row 1000, so new categories looked unsaved.
    const rows = Array.from({ length: 1325 }, (_, i) => ({
      id: `cat-${i}`,
      name: `Category ${String(i).padStart(4, '0')}`,
      is_drink: i % 2 === 0 ? null : true,
    }));
    const { range } = mockPagedClient(rows);

    const result = await getAllDishCategoryOptions();

    expect(result).toHaveLength(1325);
    expect(result[1324]).toEqual({ id: 'cat-1324', name: 'Category 1324', is_drink: false });
    expect(range).toHaveBeenCalledTimes(2);
    expect(range).toHaveBeenNthCalledWith(1, 0, 999);
    expect(range).toHaveBeenNthCalledWith(2, 1000, 1999);
  });

  it('stops after one fetch when the first page is short', async () => {
    const { range } = mockPagedClient([{ id: 'a', name: 'Aguas', is_drink: true }]);

    const result = await getAllDishCategoryOptions();

    expect(result).toEqual([{ id: 'a', name: 'Aguas', is_drink: true }]);
    expect(range).toHaveBeenCalledTimes(1);
  });

  it('terminates when the row count is an exact multiple of the page size', async () => {
    const rows = Array.from({ length: 1000 }, (_, i) => ({
      id: `cat-${i}`,
      name: `Category ${String(i).padStart(4, '0')}`,
      is_drink: false,
    }));
    const { range } = mockPagedClient(rows);

    const result = await getAllDishCategoryOptions();

    expect(result).toHaveLength(1000);
    // Second fetch comes back empty and ends the loop.
    expect(range).toHaveBeenCalledTimes(2);
  });
});
