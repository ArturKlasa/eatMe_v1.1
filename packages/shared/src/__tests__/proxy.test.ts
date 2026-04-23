import { describe, it, expect, vi } from 'vitest';
import { createAuthProxy } from '../auth/proxy';
import type { AuthProxyConfig, AuthProxyRequest, NextResponseFactory } from '../auth/proxy';

const BASE_URL = 'https://app.example.com';

function makeRequest(
  pathAndQuery: string,
  cookies: Array<{ name: string; value: string }> = []
): AuthProxyRequest {
  const [pathname] = pathAndQuery.split('?');
  return {
    url: BASE_URL + pathAndQuery,
    nextUrl: { pathname },
    cookies: { getAll: () => cookies },
    headers: new Headers(),
  };
}

function makeNextResponse(): NextResponseFactory {
  const passResponse = { cookies: { set: vi.fn() } } as ReturnType<NextResponseFactory['next']>;
  return {
    next: vi.fn(() => passResponse),
    redirect: vi.fn(
      (url: string | URL) =>
        new Response(null, { status: 302, headers: { Location: url.toString() } })
    ),
  };
}

function makeConfig(overrides: Partial<AuthProxyConfig> = {}): AuthProxyConfig {
  return {
    url: 'https://supabase.example.com',
    anonKey: 'anon-key',
    appRoutes: ['/dashboard'],
    authRoutes: ['/signin', '/login'],
    adminOnly: ['/admin'],
    NextResponse: makeNextResponse(),
    ...overrides,
  };
}

function mockGetUser(supabaseMock: ReturnType<typeof vi.fn>, user: object | null) {
  supabaseMock.mockReturnValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
    cookies: { getAll: vi.fn(() => []), setAll: vi.fn() },
  });
}

// We stub createServerClient at module level
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(),
}));

import { createServerClient } from '@supabase/ssr';

const mockCreateServerClient = createServerClient as ReturnType<typeof vi.fn>;

describe('createAuthProxy — default redirect paths', () => {
  it('redirects unauthenticated appRoute visitor to /signin?redirect=...', async () => {
    mockCreateServerClient.mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    });
    const config = makeConfig();
    const handler = createAuthProxy(config);
    const res = await handler(makeRequest('/dashboard/home'));
    expect(res.headers.get('Location')).toContain('/signin?redirect=');
  });

  it('redirects non-admin hitting adminOnly route to /signin?forbidden=1', async () => {
    mockCreateServerClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { app_metadata: { role: 'owner' } } } }),
      },
    });
    const config = makeConfig();
    const handler = createAuthProxy(config);
    const res = await handler(makeRequest('/admin/restaurants'));
    expect(res.headers.get('Location')).toContain('/signin?forbidden=1');
  });

  it('redirects authenticated user hitting authRoute to /restaurant', async () => {
    mockCreateServerClient.mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { app_metadata: {} } } }) },
    });
    const config = makeConfig();
    const handler = createAuthProxy(config);
    const res = await handler(makeRequest('/signin'));
    expect(res.headers.get('Location')).toContain('/restaurant');
  });
});

describe('createAuthProxy — custom redirect paths', () => {
  it('uses signinPath for unauthenticated appRoute visitors', async () => {
    mockCreateServerClient.mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    });
    const config = makeConfig({ signinPath: '/login' });
    const handler = createAuthProxy(config);
    const res = await handler(makeRequest('/dashboard/home'));
    const location = res.headers.get('Location') ?? '';
    expect(location).toContain('/login?redirect=');
    expect(location).not.toContain('/signin');
  });

  it('uses forbiddenPath for non-admin adminOnly visitors', async () => {
    mockCreateServerClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { app_metadata: { role: 'owner' } } } }),
      },
    });
    const config = makeConfig({ forbiddenPath: '/login?forbidden=1' });
    const handler = createAuthProxy(config);
    const res = await handler(makeRequest('/admin/restaurants'));
    const location = res.headers.get('Location') ?? '';
    expect(location).toContain('/login?forbidden=1');
    expect(location).not.toContain('/signin');
  });

  it('uses postAuthPath for authenticated authRoute visitors', async () => {
    mockCreateServerClient.mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { app_metadata: {} } } }) },
    });
    const config = makeConfig({ postAuthPath: '/restaurants', authRoutes: ['/login'] });
    const handler = createAuthProxy(config);
    const res = await handler(makeRequest('/login'));
    const location = res.headers.get('Location') ?? '';
    expect(location).toContain('/restaurants');
    expect(location).not.toContain('/restaurant\b');
  });

  it('authenticated non-admin on forbiddenPath (/signin?forbidden=1) passes through — no redirect loop', async () => {
    mockCreateServerClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { app_metadata: { role: 'owner' } } } }),
      },
    });
    const NR = makeNextResponse();
    const config = makeConfig({ NextResponse: NR });
    const handler = createAuthProxy(config);
    await handler(makeRequest('/signin?forbidden=1'));
    expect(NR.redirect).not.toHaveBeenCalled();
  });

  it('admin user passes through adminOnly route', async () => {
    mockCreateServerClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { app_metadata: { role: 'admin' } } } }),
      },
    });
    const NR = makeNextResponse();
    const config = makeConfig({ NextResponse: NR });
    const handler = createAuthProxy(config);
    await handler(makeRequest('/admin/restaurants'));
    expect(NR.redirect).not.toHaveBeenCalled();
  });
});
