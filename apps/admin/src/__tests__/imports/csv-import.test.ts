import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/server', () => ({
  NextRequest: class {
    private body: unknown;
    constructor(_url: string, opts?: { body?: unknown }) {
      this.body = opts?.body;
    }
    async json() {
      return this.body;
    }
    get headers() {
      return { get: () => null };
    }
  },
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
    }),
  },
}));
vi.mock('@/lib/supabase/server', () => ({
  createRouteHandlerClient: vi.fn(),
  createAdminServiceClient: vi.fn(),
}));
vi.mock('@/lib/audit', () => ({
  logAdminAction: vi.fn().mockResolvedValue(undefined),
}));

import { createRouteHandlerClient, createAdminServiceClient } from '@/lib/supabase/server';
import { logAdminAction } from '@/lib/audit';

const ADMIN_USER = {
  id: 'admin-uuid-123',
  email: 'admin@example.com',
  app_metadata: { role: 'admin' },
};

function makeInsertedId(id = 'rest-new-001') {
  return { data: { id }, error: null };
}

function makeServiceClient(opts?: {
  existingPlaceIds?: string[];
  nearbyCandidates?: Array<{
    id: string;
    name: string;
    google_place_id: string | null;
    lat: number | null;
    lng: number | null;
  }>;
  insertResult?: { data: { id: string } | null; error: unknown };
}) {
  const existing = opts?.existingPlaceIds ?? [];
  const nearby = opts?.nearbyCandidates ?? [];
  const insertRes = opts?.insertResult ?? makeInsertedId();
  let insertCallCount = 0;

  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'restaurants') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: existing.map(id => ({ google_place_id: id })),
              error: null,
            }),
            ilike: vi.fn().mockResolvedValue({
              data: nearby,
              error: null,
            }),
            limit: vi.fn().mockReturnValue({
              ilike: vi.fn().mockResolvedValue({ data: nearby, error: null }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockImplementation(() => {
                insertCallCount++;
                if (insertCallCount === 1) return Promise.resolve(insertRes);
                return Promise.resolve(makeInsertedId(`rest-new-00${insertCallCount}`));
              }),
            }),
          }),
        };
      }
      if (table === 'restaurant_import_jobs') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'job-001' }, error: null }),
            }),
          }),
        };
      }
      // admin_audit_log
      return { insert: vi.fn().mockResolvedValue({ error: null }) };
    }),
  };
}

function makeAuthClient(user = ADMIN_USER) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(createRouteHandlerClient).mockResolvedValue(makeAuthClient() as never);
  vi.mocked(createAdminServiceClient).mockReturnValue(makeServiceClient() as never);
  vi.mocked(logAdminAction).mockResolvedValue(undefined);
});

// Dynamically import POST after mocks are set up
async function importPost() {
  const mod = await import('@/app/api/admin/import-csv/route');
  return mod.POST;
}

function makeRequest(body: unknown) {
  return {
    json: async () => body,
    headers: { get: () => null },
  } as never;
}

describe('POST /api/admin/import-csv — auth', () => {
  it('returns 401 for unauthenticated user', async () => {
    vi.mocked(createRouteHandlerClient).mockResolvedValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: null }, error: new Error('no session') }),
      },
    } as never);

    const POST = await importPost();
    const res = await POST(makeRequest({ rows: [] }), { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin user', async () => {
    vi.mocked(createRouteHandlerClient).mockResolvedValue(
      makeAuthClient({ ...ADMIN_USER, app_metadata: { role: 'owner' } }) as never
    );

    const POST = await importPost();
    const res = await POST(makeRequest({ rows: [] }), { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
  });
});

describe('POST /api/admin/import-csv — validation', () => {
  it('rejects invalid body (missing rows)', async () => {
    const POST = await importPost();
    const res = await POST(makeRequest({}), { params: Promise.resolve({}) });
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBe('INVALID_BODY');
  });

  it('returns per-row errors for malformed rows', async () => {
    const rows = [
      { name: '' }, // missing required name
      { name: 'Valid Place', lat: 999 }, // invalid lat
      { name: 'OK Place' }, // valid row
    ];

    const POST = await importPost();
    const res = await POST(makeRequest({ rows }), { params: Promise.resolve({}) });
    const data = (await res.json()) as { ok: boolean; data: { errors: unknown[] } };

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    // row 0 (empty name) and row 1 (bad lat) have errors
    expect(data.data.errors.length).toBeGreaterThanOrEqual(2);
    const errorIndices = (data.data.errors as Array<{ index: number }>).map(e => e.index);
    expect(errorIndices).toContain(0);
    expect(errorIndices).toContain(1);
  });
});

describe('POST /api/admin/import-csv — deduplication', () => {
  it('silently skips rows with matching google_place_id', async () => {
    vi.mocked(createAdminServiceClient).mockReturnValue(
      makeServiceClient({ existingPlaceIds: ['place-abc'] }) as never
    );

    const rows = [{ name: 'Dup Place', google_place_id: 'place-abc' }, { name: 'New Place' }];

    const POST = await importPost();
    const res = await POST(makeRequest({ rows }), { params: Promise.resolve({}) });
    const data = (await res.json()) as {
      ok: boolean;
      data: { total_inserted: number; total_skipped: number };
    };

    expect(data.ok).toBe(true);
    expect(data.data.total_skipped).toBe(1);
    expect(data.data.total_inserted).toBe(1);
  });

  it('inserts fuzzy duplicates (same city, similar name) with possible_duplicate=true', async () => {
    const nearby = [
      {
        id: 'existing-rest',
        name: 'Pizza Palace',
        google_place_id: null,
        lat: 40.7128,
        lng: -74.006,
      },
    ];
    vi.mocked(createAdminServiceClient).mockReturnValue(
      makeServiceClient({ nearbyCandidates: nearby }) as never
    );

    const rows = [
      // Very similar name, same city, close coordinates
      { name: 'Pizza Palaace', city: 'New York', lat: 40.7129, lng: -74.0061 },
    ];

    const POST = await importPost();
    const res = await POST(makeRequest({ rows }), { params: Promise.resolve({}) });
    const data = (await res.json()) as {
      ok: boolean;
      data: {
        total_inserted: number;
        total_flagged: number;
        inserted: Array<{ possible_duplicate: boolean }>;
      };
    };

    expect(data.ok).toBe(true);
    expect(data.data.total_inserted).toBe(1);
    expect(data.data.total_flagged).toBe(1);
    expect(data.data.inserted[0].possible_duplicate).toBe(true);
  });
});

describe('POST /api/admin/import-csv — happy path', () => {
  it('inserts valid rows and returns job_id + summary', async () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      name: `Restaurant ${i + 1}`,
      city: 'Chicago',
      address: `${i + 1} Main St`,
    }));

    const POST = await importPost();
    const res = await POST(makeRequest({ rows }), { params: Promise.resolve({}) });
    const data = (await res.json()) as {
      ok: boolean;
      data: { job_id: string; total_inserted: number };
    };

    expect(data.ok).toBe(true);
    expect(data.data.job_id).toBe('job-001');
    expect(data.data.total_inserted).toBe(10);
  });

  it('writes audit log with action=csv_import', async () => {
    const rows = [{ name: 'Test Restaurant' }];

    const POST = await importPost();
    await POST(makeRequest({ rows }), { params: Promise.resolve({}) });

    expect(logAdminAction).toHaveBeenCalledOnce();
    expect(logAdminAction).toHaveBeenCalledWith(
      expect.anything(),
      { adminId: ADMIN_USER.id, adminEmail: ADMIN_USER.email },
      'csv_import',
      'restaurant_import_job',
      'job-001',
      null,
      expect.objectContaining({ total_inserted: 1 })
    );
  });
});
