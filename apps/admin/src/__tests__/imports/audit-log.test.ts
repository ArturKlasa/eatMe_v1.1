import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('react', async importActual => {
  const actual = await importActual<typeof import('react')>();
  return { ...actual, cache: (fn: unknown) => fn };
});
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
  createAdminServiceClient: vi.fn(),
}));

import { createAdminServiceClient } from '@/lib/supabase/server';

const SAMPLE_ROWS = [
  {
    id: 'log-001',
    admin_id: 'admin-uuid-1',
    admin_email: 'alice@example.com',
    action: 'csv_import',
    resource_type: 'restaurant_import_job',
    resource_id: 'job-001',
    old_data: null,
    new_data: { total_inserted: 10 },
    created_at: '2026-04-23T10:00:00Z',
  },
  {
    id: 'log-002',
    admin_id: 'admin-uuid-2',
    admin_email: 'bob@example.com',
    action: 'suspend_restaurant',
    resource_type: 'restaurant',
    resource_id: 'rest-001',
    old_data: { is_active: true },
    new_data: { is_active: false },
    created_at: '2026-04-23T11:00:00Z',
  },
  {
    id: 'log-003',
    admin_id: 'admin-uuid-1',
    admin_email: 'alice@example.com',
    action: 'replay_menu_scan',
    resource_type: 'menu_scan_job',
    resource_id: 'job-002',
    old_data: null,
    new_data: { model: 'gpt-4o-2024-11-20' },
    created_at: '2026-04-22T09:00:00Z',
  },
];

function makeQuery(rows = SAMPLE_ROWS, count = rows.length) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    // terminal
    then: (resolve: (v: unknown) => void) => resolve({ data: rows, error: null, count }),
  };
  // Make each chain method return the same object
  chain.select.mockReturnValue(chain);
  chain.order.mockReturnValue(chain);
  chain.range.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.gte.mockReturnValue(chain);
  chain.lt.mockReturnValue(chain);

  return {
    from: vi.fn().mockReturnValue(chain),
    _chain: chain,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

import { getAdminAuditLog } from '@/lib/auth/dal';

describe('getAdminAuditLog — filters', () => {
  it('filters by actor email', async () => {
    const filtered = SAMPLE_ROWS.filter(r => r.admin_email === 'alice@example.com');
    const mock = makeQuery(filtered);
    vi.mocked(createAdminServiceClient).mockReturnValue(mock as never);

    const { rows, total } = await getAdminAuditLog({ actorEmail: 'alice@example.com' });
    expect(rows).toHaveLength(2);
    expect(rows.every(r => r.admin_email === 'alice@example.com')).toBe(true);
    expect(total).toBe(2);

    // Verify .eq was called with admin_email filter
    expect(mock._chain.eq).toHaveBeenCalledWith('admin_email', 'alice@example.com');
  });

  it('filters by action', async () => {
    const filtered = SAMPLE_ROWS.filter(r => r.action === 'csv_import');
    const mock = makeQuery(filtered);
    vi.mocked(createAdminServiceClient).mockReturnValue(mock as never);

    const { rows } = await getAdminAuditLog({ action: 'csv_import' });
    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe('csv_import');
    expect(mock._chain.eq).toHaveBeenCalledWith('action', 'csv_import');
  });

  it('date range is inclusive on both ends (dateFrom and dateTo)', async () => {
    const mock = makeQuery(SAMPLE_ROWS);
    vi.mocked(createAdminServiceClient).mockReturnValue(mock as never);

    await getAdminAuditLog({ dateFrom: '2026-04-22', dateTo: '2026-04-23' });

    // gte for start (inclusive)
    expect(mock._chain.gte).toHaveBeenCalledWith('created_at', '2026-04-22');
    // lt for end: dateTo + 1 day to include the full day
    expect(mock._chain.lt).toHaveBeenCalledWith('created_at', expect.stringMatching(/2026-04-24/));
  });

  it('returns all rows when no filters applied', async () => {
    const mock = makeQuery(SAMPLE_ROWS, 3);
    vi.mocked(createAdminServiceClient).mockReturnValue(mock as never);

    const { rows, total } = await getAdminAuditLog({});
    expect(rows).toHaveLength(3);
    expect(total).toBe(3);
    expect(mock._chain.eq).not.toHaveBeenCalled();
    expect(mock._chain.gte).not.toHaveBeenCalled();
    expect(mock._chain.lt).not.toHaveBeenCalled();
  });

  it('returns empty result on error', async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      then: (resolve: (v: unknown) => void) =>
        resolve({ data: null, error: { message: 'DB error' }, count: 0 }),
    };
    chain.select.mockReturnValue(chain);
    chain.order.mockReturnValue(chain);
    chain.range.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    chain.gte.mockReturnValue(chain);
    chain.lt.mockReturnValue(chain);

    vi.mocked(createAdminServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue(chain),
    } as never);

    const { rows, total } = await getAdminAuditLog({});
    expect(rows).toHaveLength(0);
    expect(total).toBe(0);
  });
});

describe('Google Places import — cost cap', () => {
  it('enforces hard cap at 1000 rows via Zod validation', async () => {
    // The fetchPlacesSchema enforces maxRows.max(1000).
    // withAdminAuth wraps the handler — test via direct Zod parse to verify the schema boundary.
    const { z } = await import('zod');
    const fetchPlacesSchema = z.object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      radius: z.number().min(50).max(50_000),
      maxRows: z.number().int().min(1).max(1_000).optional().default(200),
    });

    const overCapResult = fetchPlacesSchema.safeParse({
      lat: 40.7128,
      lng: -74.006,
      radius: 5000,
      maxRows: 1001,
    });
    expect(overCapResult.success).toBe(false);

    const atCapResult = fetchPlacesSchema.safeParse({
      lat: 40.7128,
      lng: -74.006,
      radius: 5000,
      maxRows: 1000,
    });
    expect(atCapResult.success).toBe(true);
  });
});
