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
}));

import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { verifySession, verifyAdminSession } from '@/lib/auth/dal';

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
