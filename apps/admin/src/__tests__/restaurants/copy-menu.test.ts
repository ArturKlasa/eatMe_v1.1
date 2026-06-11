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
import {
  adminCopyRestaurantMenu,
  searchCopySourceRestaurants,
} from '@/app/(admin)/restaurants/[id]/actions/copyMenu';

const ADMIN_USER = {
  id: 'admin-uuid-123',
  email: 'admin@example.com',
  app_metadata: { role: 'admin' },
};

const TARGET_ID = 'rest-target-001';
const SOURCE_ID = 'rest-source-001';

const RPC_COUNTS = {
  menus_copied: 1,
  categories_copied: 4,
  dishes_copied: 32,
  option_groups_copied: 6,
  options_copied: 18,
};

function makeAuthClient(user: unknown = ADMIN_USER) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
  };
}

function makeServiceClient(opts?: {
  rpcResult?: { data: unknown; error: unknown };
  searchRows?: unknown[];
}) {
  const rpc = vi.fn().mockResolvedValue(opts?.rpcResult ?? { data: RPC_COUNTS, error: null });
  const limit = vi.fn().mockResolvedValue({ data: opts?.searchRows ?? [], error: null });
  const order = vi.fn().mockReturnValue({ limit });
  const neq = vi.fn().mockReturnValue({ order });
  const ilike = vi.fn().mockReturnValue({ neq });
  const select = vi.fn().mockReturnValue({ ilike });
  const from = vi.fn().mockReturnValue({ select });
  return { rpc, from, _spies: { select, ilike, neq, limit } };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createServerActionClient).mockResolvedValue(makeAuthClient() as never);
  vi.mocked(createAdminServiceClient).mockReturnValue(makeServiceClient() as never);
});

describe('adminCopyRestaurantMenu', () => {
  it('rejects non-admin users', async () => {
    vi.mocked(createServerActionClient).mockResolvedValue(
      makeAuthClient({ ...ADMIN_USER, app_metadata: { role: 'owner' } }) as never
    );
    const result = await adminCopyRestaurantMenu(TARGET_ID, SOURCE_ID);
    expect(result).toEqual({ ok: false, formError: 'FORBIDDEN' });
  });

  it('calls the RPC with source + target and returns counts', async () => {
    const service = makeServiceClient();
    vi.mocked(createAdminServiceClient).mockReturnValue(service as never);

    const result = await adminCopyRestaurantMenu(TARGET_ID, SOURCE_ID);
    expect(result).toEqual({ ok: true, data: RPC_COUNTS });
    expect(service.rpc).toHaveBeenCalledWith('admin_copy_restaurant_menu', {
      p_source_restaurant_id: SOURCE_ID,
      p_target_restaurant_id: TARGET_ID,
    });
  });

  it('audit-logs the copy with counts + source id', async () => {
    await adminCopyRestaurantMenu(TARGET_ID, SOURCE_ID);
    expect(logAdminAction).toHaveBeenCalledWith(
      expect.anything(),
      { adminId: ADMIN_USER.id, adminEmail: ADMIN_USER.email },
      'copy_restaurant_menu',
      'restaurant',
      TARGET_ID,
      null,
      expect.objectContaining({ source_restaurant_id: SOURCE_ID, dishes_copied: 32 })
    );
  });

  it('maps RAISE EXCEPTION codes to readable errors', async () => {
    vi.mocked(createAdminServiceClient).mockReturnValue(
      makeServiceClient({
        rpcResult: { data: null, error: { message: 'TARGET_HAS_MENUS' } },
      }) as never
    );
    const result = await adminCopyRestaurantMenu(TARGET_ID, SOURCE_ID);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.formError).toMatch(/already has menus/);
    expect(logAdminAction).not.toHaveBeenCalled();
  });
});

describe('searchCopySourceRestaurants', () => {
  it('returns [] for queries under 2 chars without querying', async () => {
    const service = makeServiceClient();
    vi.mocked(createAdminServiceClient).mockReturnValue(service as never);
    const result = await searchCopySourceRestaurants(TARGET_ID, 'a');
    expect(result).toEqual({ ok: true, data: [] });
    expect(service.from).not.toHaveBeenCalled();
  });

  it('maps rows (embedded dish count) and excludes the target id', async () => {
    const service = makeServiceClient({
      searchRows: [
        {
          id: SOURCE_ID,
          name: 'Taquería Norte Centro',
          city: 'CDMX',
          status: 'published',
          dishes: [{ count: 32 }],
        },
      ],
    });
    vi.mocked(createAdminServiceClient).mockReturnValue(service as never);

    const result = await searchCopySourceRestaurants(TARGET_ID, 'norte');
    expect(result).toEqual({
      ok: true,
      data: [
        {
          id: SOURCE_ID,
          name: 'Taquería Norte Centro',
          city: 'CDMX',
          status: 'published',
          dish_count: 32,
        },
      ],
    });
    expect(service._spies.ilike).toHaveBeenCalledWith('name', '%norte%');
    expect(service._spies.neq).toHaveBeenCalledWith('id', TARGET_ID);
  });
});
