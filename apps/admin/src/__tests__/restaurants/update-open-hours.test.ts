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
import { updateAdminRestaurantOpeningHours } from '@/app/(admin)/restaurants/[id]/actions/restaurant';

const ADMIN_USER = {
  id: 'admin-uuid-123',
  email: 'admin@example.com',
  app_metadata: { role: 'admin' },
};

// Captures the last update payload so assertions can check what was written.
let lastUpdatePayload: unknown = undefined;

function makeServiceClient(updateError: unknown = null) {
  lastUpdatePayload = undefined;
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: { open_hours: null }, error: null }),
        }),
      }),
      update: vi.fn().mockImplementation((payload: unknown) => {
        lastUpdatePayload = payload;
        return { eq: vi.fn().mockResolvedValue({ error: updateError }) };
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

describe('updateAdminRestaurantOpeningHours — validation', () => {
  it('accepts a valid weekly schedule', async () => {
    const result = await updateAdminRestaurantOpeningHours('r-1', {
      open_hours: {
        monday: { open: '09:00', close: '22:00' },
        friday: { open: '10:00', close: '23:30' },
      },
    });
    expect(result.ok).toBe(true);
  });

  it('rejects an out-of-range hour (24:00)', async () => {
    const result = await updateAdminRestaurantOpeningHours('r-1', {
      open_hours: { monday: { open: '24:00', close: '22:00' } },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors).toBeDefined();
  });

  it('rejects malformed minutes (9:60)', async () => {
    const result = await updateAdminRestaurantOpeningHours('r-1', {
      open_hours: { monday: { open: '09:60', close: '22:00' } },
    });
    expect(result.ok).toBe(false);
  });

  it('rejects garbage day keys', async () => {
    const result = await updateAdminRestaurantOpeningHours('r-1', {
      open_hours: {
        moonday: { open: '09:00', close: '22:00' },
      } as unknown as Record<string, { open: string; close: string }>,
    });
    expect(result.ok).toBe(false);
  });

  it('allows overnight spans (close < open)', async () => {
    const result = await updateAdminRestaurantOpeningHours('r-1', {
      open_hours: { friday: { open: '18:00', close: '02:00' } },
    });
    expect(result.ok).toBe(true);
  });
});

describe('updateAdminRestaurantOpeningHours — persistence shape', () => {
  it('writes only the days the caller supplied; omits the rest', async () => {
    await updateAdminRestaurantOpeningHours('r-1', {
      open_hours: { monday: { open: '09:00', close: '22:00' } },
    });
    expect(lastUpdatePayload).toEqual({
      open_hours: { monday: { open: '09:00', close: '22:00' } },
    });
  });

  it('coerces an empty schedule to null (treated as "no hours")', async () => {
    await updateAdminRestaurantOpeningHours('r-1', { open_hours: {} });
    expect(lastUpdatePayload).toEqual({ open_hours: null });
  });

  it('passes null straight through when caller wants to clear', async () => {
    await updateAdminRestaurantOpeningHours('r-1', { open_hours: null });
    expect(lastUpdatePayload).toEqual({ open_hours: null });
  });
});

describe('updateAdminRestaurantOpeningHours — audit log', () => {
  it('writes audit log with action=update_restaurant_open_hours', async () => {
    await updateAdminRestaurantOpeningHours('r-1', {
      open_hours: { monday: { open: '09:00', close: '22:00' } },
    });

    expect(logAdminAction).toHaveBeenCalledWith(
      expect.anything(),
      { adminId: ADMIN_USER.id, adminEmail: ADMIN_USER.email },
      'update_restaurant_open_hours',
      'restaurant',
      'r-1',
      expect.objectContaining({ open_hours: null }),
      expect.objectContaining({
        open_hours: { monday: { open: '09:00', close: '22:00' } },
      })
    );
  });
});
