import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('react', async importActual => {
  const actual = await importActual<typeof import('react')>();
  return { ...actual, cache: (fn: unknown) => fn };
});
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}));

import { createServerClient } from '@/lib/supabase/server';
import { getAdminRestaurants, isAdmin } from '@/lib/auth/dal';

// ─── isAdmin helper ───────────────────────────────────────────────────────────

describe('isAdmin', () => {
  it('returns true when app_metadata.role === "admin"', () => {
    expect(isAdmin({ app_metadata: { role: 'admin' } } as never)).toBe(true);
  });

  it('returns false when role is missing from app_metadata', () => {
    expect(isAdmin({ app_metadata: {} } as never)).toBe(false);
  });

  it('returns false when role is "owner" (not admin)', () => {
    expect(isAdmin({ app_metadata: { role: 'owner' } } as never)).toBe(false);
  });

  it('returns false when role is in user_metadata only (not app_metadata)', () => {
    expect(isAdmin({ app_metadata: {}, user_metadata: { role: 'admin' } } as never)).toBe(false);
  });
});

// ─── getAdminRestaurants ──────────────────────────────────────────────────────

const mockRpc = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(createServerClient).mockResolvedValue({ rpc: mockRpc } as never);
});

describe('getAdminRestaurants', () => {
  const fakeRow = {
    id: 'r-1',
    name: 'Burger Place',
    city: 'Warsaw',
    status: 'published',
    is_active: true,
    owner_id: 'u-1',
    owner_email: 'owner@example.com',
    created_at: '2024-01-01T00:00:00Z',
    total_count: 1,
  };

  it('returns rows and total on success', async () => {
    mockRpc.mockResolvedValue({ data: [fakeRow], error: null });

    const result = await getAdminRestaurants({});

    expect(result.rows).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.rows[0].name).toBe('Burger Place');
  });

  it('passes search param to RPC', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    await getAdminRestaurants({ search: 'Cafe' });

    expect(mockRpc).toHaveBeenCalledWith(
      'get_admin_restaurants',
      expect.objectContaining({ p_search: 'Cafe' })
    );
  });

  it('passes status filter to RPC', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    await getAdminRestaurants({ status: 'published' });

    expect(mockRpc).toHaveBeenCalledWith(
      'get_admin_restaurants',
      expect.objectContaining({ p_status: 'published' })
    );
  });

  it('passes is_active filter to RPC', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    await getAdminRestaurants({ is_active: false });

    expect(mockRpc).toHaveBeenCalledWith(
      'get_admin_restaurants',
      expect.objectContaining({ p_is_active: false })
    );
  });

  it('computes correct offset for page 2', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    await getAdminRestaurants({ page: 2, limit: 50 });

    expect(mockRpc).toHaveBeenCalledWith(
      'get_admin_restaurants',
      expect.objectContaining({ p_offset: 50, p_limit: 50 })
    );
  });

  it('returns empty result on RPC error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'db error' } });

    const result = await getAdminRestaurants({});

    expect(result).toEqual({ rows: [], total: 0 });
  });

  it('returns total 0 when data is empty array', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    const result = await getAdminRestaurants({});

    expect(result.total).toBe(0);
    expect(result.rows).toHaveLength(0);
  });
});
