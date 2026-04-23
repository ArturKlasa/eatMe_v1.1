import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock 'server-only' so it doesn't throw outside Next.js
vi.mock('server-only', () => ({}));

// Mock next/navigation redirect so it throws a known object (Next.js behaviour)
const mockRedirect = vi.fn((url: string): never => {
  throw Object.assign(new Error('NEXT_REDIRECT'), { digest: `NEXT_REDIRECT;${url}` });
});
vi.mock('next/navigation', () => ({ redirect: mockRedirect }));

// Mutable auth state for the supabase mock
const authState: {
  signInResult: { data: object; error: null } | { data: null; error: { message: string } };
  signUpResult:
    | { data: { session: object | null }; error: null }
    | { data: null; error: { message: string } };
} = {
  signInResult: { data: {}, error: null },
  signUpResult: { data: { session: {} }, error: null },
};

vi.mock('@/lib/supabase/server', () => ({
  createServerActionClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
      signInWithPassword: vi.fn(async () => authState.signInResult),
      signUp: vi.fn(async () => authState.signUpResult),
    },
  })),
}));

// Import after mocks are set up
const { signInWithPassword, signUpWithPassword } = await import('@/app/(auth)/actions');

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe('signInWithPassword', () => {
  beforeEach(() => {
    mockRedirect.mockClear();
    authState.signInResult = { data: {}, error: null };
  });

  it('redirects to /restaurant on successful sign-in (no redirect param)', async () => {
    const fd = makeFormData({ email: 'owner@example.com', password: 'secret123' });
    await expect(signInWithPassword(fd)).rejects.toMatchObject({
      digest: expect.stringContaining('/restaurant'),
    });
  });

  it('honours the ?redirect param', async () => {
    const fd = makeFormData({
      email: 'owner@example.com',
      password: 'secret123',
      redirect: '/restaurant/abc-123',
    });
    await expect(signInWithPassword(fd)).rejects.toMatchObject({
      digest: expect.stringContaining('/restaurant/abc-123'),
    });
  });

  it('falls back to /restaurant when redirect param is an absolute URL', async () => {
    const fd = makeFormData({
      email: 'owner@example.com',
      password: 'secret123',
      redirect: 'https://evil.com/phish',
    });
    await expect(signInWithPassword(fd)).rejects.toMatchObject({
      digest: expect.stringContaining('/restaurant'),
    });
    expect(mockRedirect).toHaveBeenCalledWith('/restaurant');
  });

  it('falls back to /restaurant when redirect param is protocol-relative', async () => {
    const fd = makeFormData({
      email: 'owner@example.com',
      password: 'secret123',
      redirect: '//evil.com',
    });
    await expect(signInWithPassword(fd)).rejects.toMatchObject({
      digest: expect.stringContaining('/restaurant'),
    });
    expect(mockRedirect).toHaveBeenCalledWith('/restaurant');
  });

  it('returns formError when Supabase rejects credentials', async () => {
    authState.signInResult = { data: null, error: { message: 'Invalid login credentials' } };
    const fd = makeFormData({ email: 'owner@example.com', password: 'wrongpass' });
    const result = await signInWithPassword(fd);
    expect(result).toEqual({ ok: false, formError: 'Invalid login credentials' });
  });

  it('returns fieldErrors for invalid email', async () => {
    const fd = makeFormData({ email: 'not-an-email', password: 'secret123' });
    const result = await signInWithPassword(fd);
    expect(result).toMatchObject({ ok: false, fieldErrors: { email: expect.any(Array) } });
  });
});

describe('signUpWithPassword', () => {
  beforeEach(() => {
    mockRedirect.mockClear();
    authState.signUpResult = { data: { session: {} }, error: null };
  });

  it('redirects to /onboard when Supabase returns a session', async () => {
    const fd = makeFormData({ email: 'new@example.com', password: 'secure1234' });
    await expect(signUpWithPassword(fd)).rejects.toMatchObject({
      digest: expect.stringContaining('/onboard'),
    });
  });

  it('returns {ok:true, data:{needsEmailConfirmation:true}} when no session', async () => {
    authState.signUpResult = { data: { session: null }, error: null };
    const fd = makeFormData({ email: 'new@example.com', password: 'secure1234' });
    const result = await signUpWithPassword(fd);
    expect(result).toEqual({ ok: true, data: { needsEmailConfirmation: true } });
  });

  it('returns formError when Supabase returns an error', async () => {
    authState.signUpResult = { data: null, error: { message: 'User already registered' } };
    const fd = makeFormData({ email: 'existing@example.com', password: 'secure1234' });
    const result = await signUpWithPassword(fd);
    expect(result).toEqual({ ok: false, formError: 'User already registered' });
  });

  it('returns fieldErrors for short password', async () => {
    const fd = makeFormData({ email: 'new@example.com', password: 'short' });
    const result = await signUpWithPassword(fd);
    expect(result).toMatchObject({ ok: false, fieldErrors: { password: expect.any(Array) } });
  });
});
