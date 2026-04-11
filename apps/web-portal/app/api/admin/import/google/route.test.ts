import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('@/lib/supabase-server', () => ({
  createServerSupabaseClient: vi.fn(() => ({})),
  verifyAdminRequest: vi.fn(),
}));

vi.mock('@/lib/google-places', () => ({
  nearbySearchRestaurants: vi.fn(),
  textSearchRestaurants: vi.fn(),
  mapGooglePlaceToRestaurant: vi.fn(),
  getMonthlyApiUsage: vi.fn(),
  incrementApiUsage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/import-service', () => ({
  importRestaurants: vi.fn(),
}));

// Import after mocks are registered
import { GET, POST } from './route';
import { verifyAdminRequest } from '@/lib/supabase-server';
import {
  nearbySearchRestaurants,
  textSearchRestaurants,
  mapGooglePlaceToRestaurant,
  getMonthlyApiUsage,
  incrementApiUsage,
} from '@/lib/google-places';
import { importRestaurants } from '@/lib/import-service';

// ─── Clear mocks between tests ───────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ADMIN_USER = { id: 'admin-1', email: 'admin@example.com', app_metadata: { role: 'admin' } };

const MOCK_SUMMARY = {
  inserted: 1,
  skipped: 0,
  flagged: 0,
  errors: [],
  source: 'google_places' as const,
  jobId: 'job-1',
  restaurants: [],
  apiCallsUsed: 0,
};

const MOCK_PLACE = { id: 'place-001', displayName: { text: 'Test Café' } };

const MOCK_MAPPED = {
  name: 'Test Café',
  address: 'Av Test 1',
  latitude: 19.43,
  longitude: -99.13,
  restaurant_type: 'restaurant' as const,
  cuisine_types: ['Mexican'],
  country_code: 'MX',
  google_place_id: 'place-001',
};

function makeAdminRequest(body: object): NextRequest {
  return new NextRequest('http://localhost/api/admin/import/google', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeGetRequest(): NextRequest {
  return new NextRequest('http://localhost/api/admin/import/google', { method: 'GET' });
}

// ─── Auth tests ───────────────────────────────────────────────────────────────

describe('POST /api/admin/import/google — auth', () => {
  it('returns 401 when request is unauthenticated', async () => {
    vi.mocked(verifyAdminRequest).mockResolvedValueOnce({
      error: 'Unauthorized',
      status: 401,
    } as never);

    const res = await POST(makeAdminRequest({ lat: 19.43, lng: -99.13, radius: 5000 }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it('returns 401 when user is not admin', async () => {
    vi.mocked(verifyAdminRequest).mockResolvedValueOnce({
      error: 'Forbidden',
      status: 401,
    } as never);

    const res = await POST(makeAdminRequest({ lat: 19.43, lng: -99.13, radius: 5000 }));
    expect(res.status).toBe(401);
  });
});

describe('GET /api/admin/import/google — auth', () => {
  it('returns 401 when unauthenticated', async () => {
    vi.mocked(verifyAdminRequest).mockResolvedValueOnce({
      error: 'Unauthorized',
      status: 401,
    } as never);

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
  });

  it('returns monthly usage for authenticated admin', async () => {
    vi.mocked(verifyAdminRequest).mockResolvedValueOnce({
      user: ADMIN_USER,
      error: null,
    } as never);
    vi.mocked(getMonthlyApiUsage).mockResolvedValueOnce({ calls: 42, estimatedCost: 0.21 } as never);

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.calls).toBe(42);
  });
});

// ─── Validation tests ─────────────────────────────────────────────────────────

describe('POST /api/admin/import/google — validation', () => {
  beforeEach(() => {
    vi.mocked(verifyAdminRequest).mockResolvedValue({ user: ADMIN_USER, error: null } as never);
  });

  it('returns 400 for out-of-range lat', async () => {
    const res = await POST(makeAdminRequest({ lat: 91, lng: -99.13, radius: 5000 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/lat/);
  });

  it('returns 400 for out-of-range lng', async () => {
    const res = await POST(makeAdminRequest({ lat: 19.43, lng: 200, radius: 5000 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/lng/);
  });

  it('returns 400 for radius below minimum', async () => {
    const res = await POST(makeAdminRequest({ lat: 19.43, lng: -99.13, radius: 50 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/radius/);
  });

  it('returns 400 for radius above maximum', async () => {
    const res = await POST(makeAdminRequest({ lat: 19.43, lng: -99.13, radius: 100000 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/radius/);
  });

  it('returns 400 for maxPages above 10', async () => {
    const res = await POST(makeAdminRequest({ lat: 19.43, lng: -99.13, radius: 5000, maxPages: 11 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/maxPages/);
  });

  it('returns 400 for invalid JSON body', async () => {
    const req = new NextRequest('http://localhost/api/admin/import/google', {
      method: 'POST',
      body: 'not-json',
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

// ─── Success flow ─────────────────────────────────────────────────────────────

describe('POST /api/admin/import/google — success', () => {
  beforeEach(() => {
    vi.mocked(verifyAdminRequest).mockResolvedValue({ user: ADMIN_USER, error: null } as never);
    vi.mocked(getMonthlyApiUsage).mockResolvedValue({ calls: 0, estimatedCost: 0 } as never);
    vi.mocked(incrementApiUsage).mockResolvedValue(undefined as never);
    vi.mocked(mapGooglePlaceToRestaurant).mockReturnValue(MOCK_MAPPED as never);
  });

  it('calls nearbySearchRestaurants and returns ImportSummary', async () => {
    vi.mocked(nearbySearchRestaurants).mockResolvedValueOnce({
      places: [MOCK_PLACE],
      nextPageToken: null,
    } as never);
    vi.mocked(importRestaurants).mockResolvedValueOnce({ ...MOCK_SUMMARY, inserted: 1 } as never);

    const res = await POST(makeAdminRequest({ lat: 19.43, lng: -99.13, radius: 5000 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.inserted).toBe(1);
    expect(nearbySearchRestaurants).toHaveBeenCalledOnce();
  });

  it('uses textSearchRestaurants when textQuery is provided', async () => {
    vi.mocked(textSearchRestaurants).mockResolvedValueOnce({
      places: [MOCK_PLACE],
      nextPageToken: null,
    } as never);
    vi.mocked(importRestaurants).mockResolvedValueOnce(MOCK_SUMMARY as never);

    await POST(makeAdminRequest({ lat: 19.43, lng: -99.13, radius: 5000, textQuery: 'tacos en Roma' }));
    expect(textSearchRestaurants).toHaveBeenCalledOnce();
    expect(nearbySearchRestaurants).not.toHaveBeenCalled();
  });

  it('increments API usage after successful import', async () => {
    vi.mocked(nearbySearchRestaurants).mockResolvedValueOnce({
      places: [MOCK_PLACE],
      nextPageToken: null,
    } as never);
    vi.mocked(importRestaurants).mockResolvedValueOnce(MOCK_SUMMARY as never);

    await POST(makeAdminRequest({ lat: 19.43, lng: -99.13, radius: 5000 }));
    expect(incrementApiUsage).toHaveBeenCalledWith(expect.anything(), 1);
  });

  it('maps each place via mapGooglePlaceToRestaurant before importing', async () => {
    vi.mocked(nearbySearchRestaurants).mockResolvedValueOnce({
      places: [MOCK_PLACE, { id: 'place-002' }],
      nextPageToken: null,
    } as never);
    vi.mocked(importRestaurants).mockResolvedValueOnce(MOCK_SUMMARY as never);

    await POST(makeAdminRequest({ lat: 19.43, lng: -99.13, radius: 5000 }));
    expect(mapGooglePlaceToRestaurant).toHaveBeenCalledTimes(2);
  });
});

// ─── Pagination ───────────────────────────────────────────────────────────────

describe('POST /api/admin/import/google — pagination', () => {
  beforeEach(() => {
    vi.mocked(verifyAdminRequest).mockResolvedValue({ user: ADMIN_USER, error: null } as never);
    vi.mocked(getMonthlyApiUsage).mockResolvedValue({ calls: 0, estimatedCost: 0 } as never);
    vi.mocked(incrementApiUsage).mockResolvedValue(undefined as never);
    vi.mocked(mapGooglePlaceToRestaurant).mockReturnValue(MOCK_MAPPED as never);
    vi.mocked(importRestaurants).mockResolvedValue(MOCK_SUMMARY as never);
  });

  it('fetches maxPages pages when nextPageToken is always returned', async () => {
    vi.mocked(nearbySearchRestaurants)
      .mockResolvedValueOnce({ places: [MOCK_PLACE], nextPageToken: 'token-1' } as never)
      .mockResolvedValueOnce({ places: [MOCK_PLACE], nextPageToken: 'token-2' } as never)
      .mockResolvedValueOnce({ places: [MOCK_PLACE], nextPageToken: null } as never);

    await POST(makeAdminRequest({ lat: 19.43, lng: -99.13, radius: 5000, maxPages: 3 }));
    expect(nearbySearchRestaurants).toHaveBeenCalledTimes(3);
  });

  it('stops pagination when Google returns no nextPageToken (even if maxPages > pages available)', async () => {
    vi.mocked(nearbySearchRestaurants)
      .mockResolvedValueOnce({ places: [MOCK_PLACE], nextPageToken: 'token-1' } as never)
      .mockResolvedValueOnce({ places: [MOCK_PLACE], nextPageToken: null } as never);

    await POST(makeAdminRequest({ lat: 19.43, lng: -99.13, radius: 5000, maxPages: 5 }));
    expect(nearbySearchRestaurants).toHaveBeenCalledTimes(2);
  });

  it('passes page token to subsequent search calls', async () => {
    vi.mocked(nearbySearchRestaurants)
      .mockResolvedValueOnce({ places: [MOCK_PLACE], nextPageToken: 'my-token' } as never)
      .mockResolvedValueOnce({ places: [], nextPageToken: null } as never);

    await POST(makeAdminRequest({ lat: 19.43, lng: -99.13, radius: 5000, maxPages: 2 }));

    const secondCall = vi.mocked(nearbySearchRestaurants).mock.calls[1];
    expect(secondCall[3]).toBe('my-token');
  });

  it('tracks apiCallsUsed equal to number of pages fetched', async () => {
    vi.mocked(nearbySearchRestaurants)
      .mockResolvedValueOnce({ places: [MOCK_PLACE], nextPageToken: 'tok' } as never)
      .mockResolvedValueOnce({ places: [MOCK_PLACE], nextPageToken: null } as never);

    await POST(makeAdminRequest({ lat: 19.43, lng: -99.13, radius: 5000, maxPages: 2 }));
    expect(incrementApiUsage).toHaveBeenCalledWith(expect.anything(), 2);
  });
});

// ─── Partial failure ──────────────────────────────────────────────────────────

describe('POST /api/admin/import/google — partial failure', () => {
  beforeEach(() => {
    vi.mocked(verifyAdminRequest).mockResolvedValue({ user: ADMIN_USER, error: null } as never);
    vi.mocked(getMonthlyApiUsage).mockResolvedValue({ calls: 0, estimatedCost: 0 } as never);
    vi.mocked(incrementApiUsage).mockResolvedValue(undefined as never);
    vi.mocked(mapGooglePlaceToRestaurant).mockReturnValue(MOCK_MAPPED as never);
  });

  it('skips a failing page and continues with remaining pages', async () => {
    vi.mocked(nearbySearchRestaurants)
      .mockRejectedValueOnce(new Error('Network timeout'))
      .mockResolvedValueOnce({ places: [MOCK_PLACE], nextPageToken: null } as never);
    vi.mocked(importRestaurants).mockResolvedValueOnce({ ...MOCK_SUMMARY, inserted: 1 } as never);

    const res = await POST(makeAdminRequest({ lat: 19.43, lng: -99.13, radius: 5000, maxPages: 2 }));
    expect(res.status).toBe(200);
    // importRestaurants was still called with the results from the successful page
    expect(importRestaurants).toHaveBeenCalledOnce();
  });

  it('stops pagination and returns partial results with warning on 403 quota error', async () => {
    vi.mocked(nearbySearchRestaurants)
      .mockResolvedValueOnce({ places: [MOCK_PLACE], nextPageToken: 'tok' } as never)
      .mockRejectedValueOnce(new Error('403 Quota exceeded'));
    vi.mocked(importRestaurants).mockResolvedValueOnce({ ...MOCK_SUMMARY, inserted: 1 } as never);

    const res = await POST(makeAdminRequest({ lat: 19.43, lng: -99.13, radius: 5000, maxPages: 3 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.warnings).toBeDefined();
    expect(body.warnings.some((w: string) => w.includes('403'))).toBe(true);
    // Only 1 page was successfully fetched before 403
    expect(incrementApiUsage).toHaveBeenCalledWith(expect.anything(), 1);
  });

  it('continues after a single place mapping error and imports the rest', async () => {
    vi.mocked(nearbySearchRestaurants).mockResolvedValueOnce({
      places: [{ id: 'bad' }, MOCK_PLACE],
      nextPageToken: null,
    } as never);
    vi.mocked(mapGooglePlaceToRestaurant)
      .mockImplementationOnce(() => { throw new Error('bad place data'); })
      .mockReturnValueOnce(MOCK_MAPPED as never);
    vi.mocked(importRestaurants).mockResolvedValueOnce({ ...MOCK_SUMMARY, inserted: 1 } as never);

    const res = await POST(makeAdminRequest({ lat: 19.43, lng: -99.13, radius: 5000 }));
    expect(res.status).toBe(200);
    // importRestaurants receives only the 1 successfully mapped place
    const importArg = vi.mocked(importRestaurants).mock.calls[0][0] as unknown[];
    expect(importArg).toHaveLength(1);
  });
});

// ─── Budget warning ───────────────────────────────────────────────────────────

describe('POST /api/admin/import/google — budget warning', () => {
  it('includes budget warning when monthly calls > 900', async () => {
    vi.mocked(verifyAdminRequest).mockResolvedValue({ user: ADMIN_USER, error: null } as never);
    vi.mocked(getMonthlyApiUsage).mockResolvedValue({ calls: 950, estimatedCost: 4.75 } as never);
    vi.mocked(nearbySearchRestaurants).mockResolvedValueOnce({ places: [], nextPageToken: null } as never);
    vi.mocked(importRestaurants).mockResolvedValueOnce({ ...MOCK_SUMMARY, inserted: 0 } as never);
    vi.mocked(incrementApiUsage).mockResolvedValue(undefined as never);

    const res = await POST(makeAdminRequest({ lat: 19.43, lng: -99.13, radius: 5000 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.warnings).toBeDefined();
    expect(body.warnings.some((w: string) => w.includes('950'))).toBe(true);
  });

  it('does not include budget warning when monthly calls <= 900', async () => {
    vi.mocked(verifyAdminRequest).mockResolvedValue({ user: ADMIN_USER, error: null } as never);
    vi.mocked(getMonthlyApiUsage).mockResolvedValue({ calls: 100, estimatedCost: 0.5 } as never);
    vi.mocked(nearbySearchRestaurants).mockResolvedValueOnce({ places: [], nextPageToken: null } as never);
    vi.mocked(importRestaurants).mockResolvedValueOnce({ ...MOCK_SUMMARY, inserted: 0 } as never);
    vi.mocked(incrementApiUsage).mockResolvedValue(undefined as never);

    const res = await POST(makeAdminRequest({ lat: 19.43, lng: -99.13, radius: 5000 }));
    const body = await res.json();
    expect(body.warnings).toBeUndefined();
  });
});
