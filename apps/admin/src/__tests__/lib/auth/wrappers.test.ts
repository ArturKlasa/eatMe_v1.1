import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the supabase server module before importing wrappers
vi.mock('@/lib/supabase/server', () => ({
  createServerActionClient: vi.fn(),
}));

import { withAuth, withAdminAuth, withPublic } from '@/lib/auth/wrappers';
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

describe('withAuth', () => {
  it('calls handler with ctx when user is authenticated', async () => {
    const user = { id: 'user-1', app_metadata: {}, user_metadata: {} } as any;
    mockGetUser.mockResolvedValue({ data: { user }, error: null });

    const handler = vi.fn().mockResolvedValue({ ok: true, data: 'result' });
    const wrapped = withAuth(handler);
    const result = await wrapped('arg1', 'arg2');

    expect(result).toEqual({ ok: true, data: 'result' });
    expect(handler).toHaveBeenCalledWith(
      { user, userId: 'user-1', supabase: mockSupabase },
      'arg1',
      'arg2'
    );
  });

  it('returns UNAUTHENTICATED when no user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const handler = vi.fn();
    const wrapped = withAuth(handler);
    const result = await wrapped();

    expect(result).toEqual({ ok: false, formError: 'UNAUTHENTICATED' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns UNAUTHENTICATED when error from getUser', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('auth error') });

    const wrapped = withAuth(vi.fn());
    const result = await wrapped();

    expect(result).toEqual({ ok: false, formError: 'UNAUTHENTICATED' });
  });
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

describe('withPublic', () => {
  it('calls handler with supabase ctx', async () => {
    const handler = vi.fn().mockResolvedValue({ ok: true, data: undefined });
    const wrapped = withPublic(handler);
    const result = await wrapped('payload');

    expect(result).toEqual({ ok: true, data: undefined });
    expect(handler).toHaveBeenCalledWith({ supabase: mockSupabase }, 'payload');
  });
});
