import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock the supabase-server module
const mockGetUser = vi.fn();

vi.mock('@/lib/supabase-server', () => ({
  createMiddlewareClient: vi.fn(() => ({
    client: {
      auth: {
        getUser: mockGetUser,
      },
    },
    response: {
      headers: { set: vi.fn() },
      status: 200,
      cookies: { set: vi.fn() },
    },
  })),
}));

// Import after mocking
const { middleware } = await import('@/middleware');

function makeRequest(pathname: string): NextRequest {
  return new NextRequest(new URL(`http://localhost:3000${pathname}`));
}

describe('middleware (auth redirects)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('unauthenticated user', () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
    });

    it('redirects /admin to /auth/login', async () => {
      const req = makeRequest('/admin');
      const res = await middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/auth/login');
    });

    it('redirects /admin/restaurants to /auth/login', async () => {
      const req = makeRequest('/admin/restaurants');
      const res = await middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/auth/login');
    });

    it('redirects /menu/123 to /auth/login', async () => {
      const req = makeRequest('/menu/123');
      const res = await middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/auth/login');
    });

    it('redirects /restaurant/abc to /auth/login', async () => {
      const req = makeRequest('/restaurant/abc');
      const res = await middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/auth/login');
    });

    it('redirects /onboard/basic-info to /auth/login', async () => {
      const req = makeRequest('/onboard/basic-info');
      const res = await middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/auth/login');
    });

    it('allows unauthenticated access to /auth/login', async () => {
      const req = makeRequest('/auth/login');
      const res = await middleware(req);
      expect(res.status).not.toBe(307);
    });

    it('allows unauthenticated access to /auth/signup', async () => {
      const req = makeRequest('/auth/signup');
      const res = await middleware(req);
      expect(res.status).not.toBe(307);
    });
  });

  describe('authenticated user', () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({
        data: {
          user: { id: 'user-1', email: 'test@example.com', app_metadata: { role: 'admin' } },
        },
      });
    });

    it('redirects /auth/login to /', async () => {
      const req = makeRequest('/auth/login');
      const res = await middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toMatch(/\/$/);
    });

    it('redirects /auth/signup to /', async () => {
      const req = makeRequest('/auth/signup');
      const res = await middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toMatch(/\/$/);
    });

    it('allows authenticated admin access to /admin', async () => {
      const req = makeRequest('/admin');
      const res = await middleware(req);
      expect(res.status).not.toBe(307);
    });

    it('allows authenticated access to /admin/restaurants', async () => {
      const req = makeRequest('/admin/restaurants');
      const res = await middleware(req);
      expect(res.status).not.toBe(307);
    });
  });

  describe('authenticated non-admin user', () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({
        data: {
          user: { id: 'user-1', email: 'owner@example.com', app_metadata: { role: 'owner' } },
        },
      });
    });

    it('redirects non-admin from /admin to /', async () => {
      const req = makeRequest('/admin');
      const res = await middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('admin_only');
    });
  });
});
