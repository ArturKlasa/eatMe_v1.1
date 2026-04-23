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

const BASE = 'https://admin.example.com';

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

function makeAdminProxy(nr: NextResponseFactory) {
  return createAuthProxy({
    url: 'https://supabase.example.com',
    anonKey: 'anon',
    appRoutes: ['/restaurants', '/menu-scan', '/imports', '/audit'],
    authRoutes: ['/signin'],
    adminOnly: ['/'],
    postAuthPath: '/restaurants',
    forbiddenPath: '/signin?forbidden=1',
    NextResponse: nr,
  });
}

describe('admin app proxy', () => {
  it('redirects unauthenticated / to /signin?forbidden=1', async () => {
    authState.user = null;
    const nr = makeNR();
    const proxy = makeAdminProxy(nr);
    const res = await proxy(makeReq('/'));
    const loc = res.headers.get('Location') ?? '';
    expect(loc).toContain('/signin?forbidden=1');
  });

  it('redirects non-admin authenticated user hitting / to /signin?forbidden=1', async () => {
    authState.user = { app_metadata: { role: 'owner' } };
    const nr = makeNR();
    const proxy = makeAdminProxy(nr);
    const res = await proxy(makeReq('/'));
    expect(res.headers.get('Location')).toContain('/signin?forbidden=1');
  });

  it('admin user passes through /restaurants without redirect', async () => {
    authState.user = { app_metadata: { role: 'admin' } };
    const nr = makeNR();
    const proxy = makeAdminProxy(nr);
    await proxy(makeReq('/restaurants'));
    expect(nr.redirect).not.toHaveBeenCalled();
  });

  it('admin user passes through /menu-scan without redirect', async () => {
    authState.user = { app_metadata: { role: 'admin' } };
    const nr = makeNR();
    const proxy = makeAdminProxy(nr);
    await proxy(makeReq('/menu-scan'));
    expect(nr.redirect).not.toHaveBeenCalled();
  });

  it('admin user redirects authenticated user on /signin to /restaurants', async () => {
    authState.user = { app_metadata: { role: 'admin' } };
    const nr = makeNR();
    const proxy = makeAdminProxy(nr);
    const res = await proxy(makeReq('/signin'));
    // Authenticated admin visiting the sign-in page is bounced to postAuthPath.
    expect(res.headers.get('Location')).toContain('/restaurants');
  });
});
