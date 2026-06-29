/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the supabase server module before importing wrappers
vi.mock('@/lib/supabase/server', () => ({
  createServerActionClient: vi.fn(),
}));

import { withAdminAuth } from '@/lib/auth/wrappers';
import { createServerActionClient } from '@/lib/supabase/server';

const mockGetUser = vi.fn();
const mockSupabase = {
  auth: { getUser: mockGetUser },
  from: vi.fn(),
  rpc: vi.fn(),
  storage: {},
  channel: vi.fn(),
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(createServerActionClient).mockResolvedValue(mockSupabase as any);
});

describe('withAdminAuth', () => {
  it('calls handler when user has admin role in app_metadata', async () => {
    const user = { id: 'admin-1', app_metadata: { role: 'admin' }, user_metadata: {} } as any;
    mockGetUser.mockResolvedValue({ data: { user }, error: null });

    const handler = vi.fn().mockResolvedValue({ ok: true, data: null });
    const wrapped = withAdminAuth(handler);
    const result = await wrapped();

    expect(result).toEqual({ ok: true, data: null });
    expect(handler).toHaveBeenCalledWith({ user, userId: 'admin-1', supabase: mockSupabase });
  });

  it('returns UNAUTHENTICATED when no user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const wrapped = withAdminAuth(vi.fn());
    const result = await wrapped();

    expect(result).toEqual({ ok: false, formError: 'UNAUTHENTICATED' });
  });

  it('returns FORBIDDEN when user lacks admin role', async () => {
    const user = { id: 'user-1', app_metadata: { role: 'user' }, user_metadata: {} } as any;
    mockGetUser.mockResolvedValue({ data: { user }, error: null });

    const wrapped = withAdminAuth(vi.fn());
    const result = await wrapped();

    expect(result).toEqual({ ok: false, formError: 'FORBIDDEN' });
  });

  it('returns FORBIDDEN when user has admin in user_metadata (not app_metadata)', async () => {
    const user = { id: 'user-1', app_metadata: {}, user_metadata: { role: 'admin' } } as any;
    mockGetUser.mockResolvedValue({ data: { user }, error: null });

    const wrapped = withAdminAuth(vi.fn());
    const result = await wrapped();

    expect(result).toEqual({ ok: false, formError: 'FORBIDDEN' });
  });
});
