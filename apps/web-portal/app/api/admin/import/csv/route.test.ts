import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('@/lib/supabase-server', () => ({
  createServerSupabaseClient: vi.fn(() => ({})),
  verifyAdminRequest: vi.fn(),
}));

vi.mock('@/lib/csv-import', () => ({
  parseCsvToRestaurants: vi.fn(),
}));

vi.mock('@/lib/import-service', () => ({
  importRestaurants: vi.fn(),
}));

// Import after mocks are registered
import { POST } from './route';
import { verifyAdminRequest } from '@/lib/supabase-server';
import { parseCsvToRestaurants } from '@/lib/csv-import';
import { importRestaurants } from '@/lib/import-service';

// ─── Clear mocks between tests ───────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ADMIN_USER = { id: 'admin-1', email: 'admin@example.com', app_metadata: { role: 'admin' } };

const MOCK_MAPPED = {
  name: 'Taquería El Paisa',
  address: 'Av Insurgentes Sur 1234, CDMX',
  latitude: 19.391,
  longitude: -99.167,
  restaurant_type: 'restaurant' as const,
  cuisine_types: ['Mexican'],
  country_code: 'MX',
};

const MOCK_SUMMARY = {
  inserted: 1,
  skipped: 0,
  flagged: 0,
  errors: [],
  source: 'csv' as const,
  jobId: 'job-csv-1',
  restaurants: [],
  apiCallsUsed: 0,
};

const MINIMAL_CSV = `name,latitude,longitude\nTaquería El Paisa,19.391,-99.167\n`;

function makeCsvRequest(csvContent: string, filename = 'restaurants.csv'): NextRequest {
  const formData = new FormData();
  formData.append('file', new File([csvContent], filename, { type: 'text/csv' }));
  return new NextRequest('http://localhost/api/admin/import/csv', {
    method: 'POST',
    body: formData,
  });
}

function makeRequestWithoutFile(): NextRequest {
  const formData = new FormData();
  // Intentionally omit the 'file' field
  return new NextRequest('http://localhost/api/admin/import/csv', {
    method: 'POST',
    body: formData,
  });
}

// ─── Auth tests ───────────────────────────────────────────────────────────────

describe('POST /api/admin/import/csv — auth', () => {
  it('returns 401 when request is unauthenticated', async () => {
    vi.mocked(verifyAdminRequest).mockResolvedValueOnce({
      error: 'Unauthorized',
      status: 401,
    } as never);

    const res = await POST(makeCsvRequest(MINIMAL_CSV));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it('returns 401 when user is not admin', async () => {
    vi.mocked(verifyAdminRequest).mockResolvedValueOnce({
      error: 'Forbidden',
      status: 401,
    } as never);

    const res = await POST(makeCsvRequest(MINIMAL_CSV));
    expect(res.status).toBe(401);
  });
});

// ─── File validation ──────────────────────────────────────────────────────────

describe('POST /api/admin/import/csv — file validation', () => {
  beforeEach(() => {
    vi.mocked(verifyAdminRequest).mockResolvedValue({ user: ADMIN_USER, error: null } as never);
  });

  it('returns 400 when no file is provided', async () => {
    const res = await POST(makeRequestWithoutFile());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/file/i);
  });

  it('returns 400 when CSV has structural parse errors and no valid rows', async () => {
    vi.mocked(parseCsvToRestaurants).mockReturnValueOnce({
      restaurants: [],
      parseErrors: [{ message: 'Missing required column: name', field: 'name' }],
    } as never);

    const res = await POST(makeCsvRequest('wrong,headers\n1,2\n'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/CSV parse failed/i);
    expect(body.details).toBeDefined();
    expect(body.details.length).toBeGreaterThan(0);
  });
});

// ─── Success flow ─────────────────────────────────────────────────────────────

describe('POST /api/admin/import/csv — success', () => {
  beforeEach(() => {
    vi.mocked(verifyAdminRequest).mockResolvedValue({ user: ADMIN_USER, error: null } as never);
  });

  it('parses CSV and returns ImportSummary on valid input', async () => {
    vi.mocked(parseCsvToRestaurants).mockReturnValueOnce({
      restaurants: [MOCK_MAPPED],
      parseErrors: [],
    } as never);
    vi.mocked(importRestaurants).mockResolvedValueOnce({ ...MOCK_SUMMARY, inserted: 1 } as never);

    const res = await POST(makeCsvRequest(MINIMAL_CSV));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.inserted).toBe(1);
    expect(body.errors).toHaveLength(0);
  });

  it('calls importRestaurants with source="csv" and admin credentials', async () => {
    vi.mocked(parseCsvToRestaurants).mockReturnValueOnce({
      restaurants: [MOCK_MAPPED],
      parseErrors: [],
    } as never);
    vi.mocked(importRestaurants).mockResolvedValueOnce(MOCK_SUMMARY as never);

    await POST(makeCsvRequest(MINIMAL_CSV));

    expect(importRestaurants).toHaveBeenCalledWith(
      [MOCK_MAPPED],
      'csv',
      ADMIN_USER.id,
      ADMIN_USER.email,
      expect.anything(),
      expect.objectContaining({ searchParams: expect.anything() })
    );
  });

  it('merges row-level parse errors into summary errors', async () => {
    const rowError = { message: 'Invalid lat on row 2', row: 2 };
    vi.mocked(parseCsvToRestaurants).mockReturnValueOnce({
      restaurants: [MOCK_MAPPED],
      parseErrors: [rowError],
    } as never);
    vi.mocked(importRestaurants).mockResolvedValueOnce({ ...MOCK_SUMMARY, errors: [] } as never);

    const res = await POST(makeCsvRequest(MINIMAL_CSV));
    expect(res.status).toBe(200);
    const body = await res.json();
    // Row-level errors merged into the response
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0].message).toMatch(/Invalid lat/);
  });
});

// ─── Deduplication ────────────────────────────────────────────────────────────

describe('POST /api/admin/import/csv — dedup', () => {
  it('returns skipped count when restaurants already exist in DB', async () => {
    vi.mocked(verifyAdminRequest).mockResolvedValue({ user: ADMIN_USER, error: null } as never);
    vi.mocked(parseCsvToRestaurants).mockReturnValueOnce({
      restaurants: [MOCK_MAPPED],
      parseErrors: [],
    } as never);
    // importRestaurants (which contains dedup logic) reports 0 inserted, 1 skipped
    vi.mocked(importRestaurants).mockResolvedValueOnce({
      ...MOCK_SUMMARY,
      inserted: 0,
      skipped: 1,
    } as never);

    const res = await POST(makeCsvRequest(MINIMAL_CSV));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.inserted).toBe(0);
    expect(body.skipped).toBe(1);
  });
});

// ─── Special characters ───────────────────────────────────────────────────────

describe('POST /api/admin/import/csv — encoding', () => {
  it('handles CSV files with special characters (accents, ñ) without throwing', async () => {
    vi.mocked(verifyAdminRequest).mockResolvedValue({ user: ADMIN_USER, error: null } as never);
    const csvWithAccents = `name,latitude,longitude\nCafé Señorita,19.391,-99.167\n`;
    // The mock returns a parsed restaurant regardless of input — we verify no crash and 200 response
    vi.mocked(parseCsvToRestaurants).mockReturnValueOnce({
      restaurants: [{ ...MOCK_MAPPED, name: 'Café Señorita' }],
      parseErrors: [],
    } as never);
    vi.mocked(importRestaurants).mockResolvedValueOnce({ ...MOCK_SUMMARY, inserted: 1 } as never);

    const res = await POST(makeCsvRequest(csvWithAccents));
    expect(res.status).toBe(200);
    // parseCsvToRestaurants was called (route did not crash on the file)
    expect(parseCsvToRestaurants).toHaveBeenCalledOnce();
  });
});
