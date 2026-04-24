import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('react', async importActual => {
  const actual = await importActual<typeof import('react')>();
  return { ...actual, cache: (fn: unknown) => fn };
});
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({
  createServerActionClient: vi.fn(),
  createAdminServiceClient: vi.fn(),
}));
vi.mock('@/lib/audit', () => ({
  logAdminAction: vi.fn().mockResolvedValue(undefined),
}));

import { createServerActionClient, createAdminServiceClient } from '@/lib/supabase/server';
import { logAdminAction } from '@/lib/audit';
import { suspendRestaurant } from '@/app/(admin)/restaurants/[id]/actions/restaurant';

const ADMIN_USER = {
  id: 'admin-uuid-123',
  email: 'admin@example.com',
  app_metadata: { role: 'admin' },
};

const MOCK_CURRENT_ROW = {
  is_active: true,
  suspended_at: null,
  suspended_by: null,
  suspension_reason: null,
};

function makeServiceClient(updateError: unknown = null) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: MOCK_CURRENT_ROW, error: null }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: updateError }),
      }),
      insert: vi.fn().mockResolvedValue({ error: null }),
    }),
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(createServerActionClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: ADMIN_USER }, error: null }),
    },
  } as never);
  vi.mocked(createAdminServiceClient).mockReturnValue(makeServiceClient() as never);
  vi.mocked(logAdminAction).mockResolvedValue(undefined);
});

describe('suspendRestaurant — validation', () => {
  it('requires reason when is_active=false', async () => {
    const result = await suspendRestaurant('r-1', { is_active: false });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors?.reason).toBeDefined();
    }
  });

  it('rejects empty reason string when suspending', async () => {
    const result = await suspendRestaurant('r-1', { is_active: false, reason: '   ' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors?.reason).toBeDefined();
    }
  });

  it('does not require reason when is_active=true (unsuspend)', async () => {
    const result = await suspendRestaurant('r-1', { is_active: true });
    expect(result.ok).toBe(true);
  });

  it('succeeds with valid reason when suspending', async () => {
    const result = await suspendRestaurant('r-1', { is_active: false, reason: 'spam listings' });
    expect(result.ok).toBe(true);
  });
});

describe('suspendRestaurant — audit log', () => {
  it('writes audit log with action=suspend_restaurant when suspending', async () => {
    await suspendRestaurant('r-1', { is_active: false, reason: 'spam listings' });

    expect(logAdminAction).toHaveBeenCalledWith(
      expect.anything(),
      { adminId: ADMIN_USER.id, adminEmail: ADMIN_USER.email },
      'suspend_restaurant',
      'restaurant',
      'r-1',
      expect.anything(),
      expect.anything()
    );
  });

  it('writes audit log with action=unsuspend_restaurant when unsuspending', async () => {
    await suspendRestaurant('r-1', { is_active: true });

    expect(logAdminAction).toHaveBeenCalledWith(
      expect.anything(),
      { adminId: ADMIN_USER.id, adminEmail: ADMIN_USER.email },
      'unsuspend_restaurant',
      'restaurant',
      'r-1',
      expect.anything(),
      expect.anything()
    );
  });

  it('does not call audit log when update fails', async () => {
    vi.mocked(createAdminServiceClient).mockReturnValue(
      makeServiceClient({ message: 'db error' }) as never
    );

    await suspendRestaurant('r-1', { is_active: false, reason: 'spam' });
    expect(logAdminAction).not.toHaveBeenCalled();
  });
});

describe('suspendRestaurant — auth', () => {
  it('returns FORBIDDEN for non-admin user', async () => {
    vi.mocked(createServerActionClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'u-1', email: 'owner@x.com', app_metadata: {} } },
          error: null,
        }),
      },
    } as never);

    const result = await suspendRestaurant('r-1', { is_active: false, reason: 'spam' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.formError).toBe('FORBIDDEN');
    }
  });

  it('returns UNAUTHENTICATED for unauthenticated user', async () => {
    vi.mocked(createServerActionClient).mockResolvedValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: null }, error: new Error('no session') }),
      },
    } as never);

    const result = await suspendRestaurant('r-1', { is_active: false, reason: 'spam' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.formError).toBe('UNAUTHENTICATED');
    }
  });
});
