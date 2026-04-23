import { describe, it, expect, vi } from 'vitest';
import { createAuthProxy } from '@eatme/shared/auth/proxy';
import type { AuthProxyRequest, NextResponseFactory } from '@eatme/shared/auth/proxy';

// Use a mutable state object so the mock factory closure always reads the latest value.
const { authState } = vi.hoisted(() => ({
  authState: { user: null as object | null },
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: vi
        .fn()
        .mockImplementation(() => Promise.resolve({ data: { user: authState.user } })),
    },
  })),
}));

const BASE = 'https://owner.example.com';

function makeReq(pathAndQuery: string): AuthProxyRequest {
  const [pathname] = pathAndQuery.split('?');
  return {
    url: BASE + pathAndQuery,
    nextUrl: { pathname },
    cookies: { getAll: () => [] },
    headers: new Headers(),
  };
}

function makeNR(): NextResponseFactory {
  return {
    next: vi.fn(
      () => ({ cookies: { set: vi.fn() } }) as unknown as ReturnType<NextResponseFactory['next']>
    ),
    redirect: vi.fn(
      (url: string | URL) =>
        new Response(null, { status: 302, headers: { Location: url.toString() } })
    ),
  };
}

function makeOwnerProxy(nr: NextResponseFactory) {
  return createAuthProxy({
    url: 'https://supabase.example.com',
    anonKey: 'anon',
    appRoutes: ['/onboard', '/restaurant', '/profile'],
    authRoutes: ['/signin', '/signup'],
    postAuthPath: '/restaurant',
    NextResponse: nr,
  });
}

describe('owner app proxy', () => {
  it('redirects unauthenticated /onboard to /signin?redirect=%2Fonboard', async () => {
    authState.user = null;
    const nr = makeNR();
    const proxy = makeOwnerProxy(nr);
    const res = await proxy(makeReq('/onboard'));
    const loc = res.headers.get('Location') ?? '';
    expect(loc).toContain('/signin?redirect=');
    expect(loc).toContain(encodeURIComponent('/onboard'));
  });

  it('redirects unauthenticated /restaurant/123 to /signin?redirect=...', async () => {
    authState.user = null;
    const nr = makeNR();
    const proxy = makeOwnerProxy(nr);
    const res = await proxy(makeReq('/restaurant/123'));
    expect(res.headers.get('Location')).toContain('/signin?redirect=');
  });

  it('passes through unauthenticated /signin without redirect', async () => {
    authState.user = null;
    const nr = makeNR();
    const proxy = makeOwnerProxy(nr);
    await proxy(makeReq('/signin'));
    expect(nr.redirect).not.toHaveBeenCalled();
  });

  it('redirects authenticated user on /signin to /restaurant', async () => {
    authState.user = { app_metadata: {} };
    const nr = makeNR();
    const proxy = makeOwnerProxy(nr);
    const res = await proxy(makeReq('/signin'));
    expect(res.headers.get('Location')).toContain('/restaurant');
  });
});
