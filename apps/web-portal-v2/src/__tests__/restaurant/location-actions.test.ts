/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({
  createServerActionClient: vi.fn(),
}));

import { createServerActionClient } from '@/lib/supabase/server';

const { updateRestaurantLocation, updateRestaurantHours } =
  await import('@/app/(app)/restaurant/[id]/actions/restaurant');

const mockGetUser = vi.fn();

function makeChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  for (const m of ['insert', 'update', 'select', 'eq', 'neq', 'limit']) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.single = vi.fn().mockResolvedValue(result);
  chain.maybeSingle = vi.fn().mockResolvedValue(result);
  return chain;
}

function makeSupabase(chainResult: { data: unknown; error: unknown }) {
  const chain = makeChain(chainResult);
  return {
    auth: { getUser: mockGetUser },
    from: vi.fn().mockReturnValue(chain),
    _chain: chain,
  };
}

beforeEach(() => {
  mockGetUser.mockReset();
});

const authedUser = { id: 'user-abc', app_metadata: {}, user_metadata: {} } as any;

const validLocation = { lat: 40.7128, lng: -74.006, address: '123 Broadway, New York, NY' };

const validHours = {
  operating_hours: {
    monday: { open: '09:00', close: '22:00' },
    friday: { open: '10:00', close: '23:00' },
  },
  delivery_available: true,
  takeout_available: false,
  dine_in_available: true,
  accepts_reservations: false,
};

// ─── updateRestaurantLocation ─────────────────────────────────────────────────

describe('updateRestaurantLocation', () => {
  it('returns UNAUTHENTICATED when no user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(
      makeSupabase({ data: null, error: null }) as any
    );

    const result = await updateRestaurantLocation('rest-123', validLocation);
    expect(result).toEqual({ ok: false, formError: 'UNAUTHENTICATED' });
  });

  it('returns fieldErrors for invalid lat', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(
      makeSupabase({ data: null, error: null }) as any
    );

    const result = await updateRestaurantLocation('rest-123', {
      lat: 999,
      lng: 0,
      address: '123 Main Street, City',
    });
    expect(result).toMatchObject({ ok: false, fieldErrors: { lat: expect.any(Array) } });
  });

  it('returns fieldErrors for invalid lng', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(
      makeSupabase({ data: null, error: null }) as any
    );

    const result = await updateRestaurantLocation('rest-123', {
      lat: 0,
      lng: 999,
      address: '123 Main Street, City',
    });
    expect(result).toMatchObject({ ok: false, fieldErrors: { lng: expect.any(Array) } });
  });

  it('returns fieldErrors for address too short', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(
      makeSupabase({ data: null, error: null }) as any
    );

    const result = await updateRestaurantLocation('rest-123', {
      lat: 40,
      lng: -74,
      address: 'abc',
    });
    expect(result).toMatchObject({ ok: false, fieldErrors: { address: expect.any(Array) } });
  });

  it('returns NOT_FOUND for foreign restaurant (RLS returns null)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(
      makeSupabase({ data: null, error: null }) as any
    );

    const result = await updateRestaurantLocation('foreign-rest', validLocation);
    expect(result).toEqual({ ok: false, formError: 'NOT_FOUND' });
  });

  it('stores location as POINT(lng lat) — longitude first (PostGIS WKT)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    const supabase = makeSupabase({ data: { id: 'rest-123' }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(supabase as any);

    const result = await updateRestaurantLocation('rest-123', validLocation);
    expect(result).toEqual({ ok: true, data: undefined });

    const updateCall = (supabase._chain.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    // Longitude first, latitude second — matches PostGIS POINT(lng lat) convention
    expect(updateCall.location).toBe(`POINT(${validLocation.lng} ${validLocation.lat})`);
    expect(updateCall.address).toBe(validLocation.address);
  });

  it('returns {ok:true} on successful update', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(
      makeSupabase({ data: { id: 'rest-123' }, error: null }) as any
    );

    const result = await updateRestaurantLocation('rest-123', validLocation);
    expect(result).toEqual({ ok: true, data: undefined });
  });
});

// ─── updateRestaurantHours ────────────────────────────────────────────────────

describe('updateRestaurantHours', () => {
  it('returns UNAUTHENTICATED when no user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(
      makeSupabase({ data: null, error: null }) as any
    );

    const result = await updateRestaurantHours('rest-123', validHours);
    expect(result).toEqual({ ok: false, formError: 'UNAUTHENTICATED' });
  });

  it('returns {ok:true} on successful update', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(
      makeSupabase({ data: { id: 'rest-123' }, error: null }) as any
    );

    const result = await updateRestaurantHours('rest-123', validHours);
    expect(result).toEqual({ ok: true, data: undefined });
  });

  it('stores operating_hours as open_hours column', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    const supabase = makeSupabase({ data: { id: 'rest-123' }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(supabase as any);

    await updateRestaurantHours('rest-123', validHours);

    const updateCall = (supabase._chain.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(updateCall.open_hours).toEqual(validHours.operating_hours);
    expect(updateCall.delivery_available).toBe(true);
    expect(updateCall.dine_in_available).toBe(true);
    expect(updateCall.takeout_available).toBe(false);
    expect(updateCall.accepts_reservations).toBe(false);
  });

  it('returns NOT_FOUND for foreign restaurant', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(
      makeSupabase({ data: null, error: null }) as any
    );

    const result = await updateRestaurantHours('foreign-rest', validHours);
    expect(result).toEqual({ ok: false, formError: 'NOT_FOUND' });
  });

  it('returns fieldErrors for invalid time format', async () => {
    mockGetUser.mockResolvedValue({ data: { user: authedUser }, error: null });
    vi.mocked(createServerActionClient).mockResolvedValue(
      makeSupabase({ data: null, error: null }) as any
    );

    const result = await updateRestaurantHours('rest-123', {
      ...validHours,
      operating_hours: { monday: { open: '25:00', close: '22:00' } },
    });
    expect(result).toMatchObject({ ok: false, fieldErrors: expect.any(Object) });
  });
});
