/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('server-only', () => ({}));

const mockExchangeCodeForSession = vi.fn();
const mockGetUser = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createRouteHandlerClient: vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
      exchangeCodeForSession: mockExchangeCodeForSession,
    },
  })),
}));

const { GET } = await import('@/app/auth/callback/route');

function makeRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost:3000/auth/callback');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url.toString());
}

describe('GET /auth/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    mockExchangeCodeForSession.mockResolvedValue({ error: null });
  });

  it('redirects to /signin?error=<encoded> when provider sends ?error', async () => {
    const req = makeRequest({ error: 'access_denied' });
    const res = await GET(req as any, { params: Promise.resolve({}) });
    expect(res.status).toBe(307);
    const location = res.headers.get('location') ?? '';
    expect(location).toContain('/signin?error=');
    expect(location).toContain(encodeURIComponent('access_denied'));
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('uses error_description over error when both present', async () => {
    const req = makeRequest({
      error: 'access_denied',
      error_description: 'User cancelled the login',
    });
    const res = await GET(req as any, { params: Promise.resolve({}) });
    expect(res.status).toBe(307);
    const location = res.headers.get('location') ?? '';
    expect(location).toContain(encodeURIComponent('User cancelled the login'));
  });

  it('exchanges code and redirects to /restaurant on success', async () => {
    const req = makeRequest({ code: 'abc123' });
    const res = await GET(req as any, { params: Promise.resolve({}) });
    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('abc123');
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/restaurant');
  });

  it('redirects to /signin?error= when code exchange fails', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: { message: 'invalid code' } });
    const req = makeRequest({ code: 'bad-code' });
    const res = await GET(req as any, { params: Promise.resolve({}) });
    expect(res.status).toBe(307);
    const location = res.headers.get('location') ?? '';
    expect(location).toContain('/signin?error=');
    expect(location).toContain(encodeURIComponent('invalid code'));
  });

  it('redirects to /restaurant when no code and no error', async () => {
    const req = makeRequest({});
    const res = await GET(req as any, { params: Promise.resolve({}) });
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/restaurant');
  });

  it('honours validated ?next param', async () => {
    const req = makeRequest({ code: 'abc123', next: '/restaurant/my-id' });
    const res = await GET(req as any, { params: Promise.resolve({}) });
    expect(res.headers.get('location')).toContain('/restaurant/my-id');
  });
});
