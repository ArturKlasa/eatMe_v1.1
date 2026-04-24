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
import { verifySession } from '@/lib/auth/dal';

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

  it('redirects to /signin on auth error', async () => {
    mockGetClaims.mockResolvedValue({ data: null, error: new Error('fail') });

    await expect(verifySession()).rejects.toThrow(REDIRECT_ERROR);
    expect(redirect).toHaveBeenCalledWith('/signin');
  });
});
