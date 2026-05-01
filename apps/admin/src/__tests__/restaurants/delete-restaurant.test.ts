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
import { adminDeleteRestaurant } from '@/app/(admin)/restaurants/[id]/actions/restaurant';

const ADMIN_USER = {
  id: 'admin-uuid-123',
  email: 'admin@example.com',
  app_metadata: { role: 'admin' },
};

const RESTAURANT_NAME = "Joe's Diner";
const RESTAURANT_ID = 'rest-uuid-001';

const RPC_RESPONSE = {
  dishes_deleted: 12,
  menu_categories_deleted: 4,
  menus_deleted: 2,
  opinions_deleted: 7,
  photos_deleted: 3,
  visits_deleted: 5,
  favorites_deleted: 1,
  scan_jobs_deleted: 0,
  option_groups_deleted: 0,
  options_deleted: 0,
  analytics_deleted: 0,
  interactions_deleted: 0,
  session_views_deleted: 0,
  sessions_unset: 0,
  recommendations_deleted: 0,
  votes_deleted: 0,
  responses_deleted: 0,
  storage_paths: [],
};

type ServiceOpts = {
  currentRow?: { id: string; name: string; status: string } | null;
  rpcError?: unknown;
  rpcData?: typeof RPC_RESPONSE | null;
  storageThrows?: boolean;
};

function makeServiceClient(opts: ServiceOpts = {}) {
  const {
    currentRow = { id: RESTAURANT_ID, name: RESTAURANT_NAME, status: 'published' },
    rpcError = null,
    rpcData = RPC_RESPONSE,
    storageThrows = false,
  } = opts;

  const rpc = vi.fn().mockResolvedValue({ data: rpcData, error: rpcError });

  const storage = {
    from: vi.fn().mockReturnValue({
      remove: storageThrows
        ? vi.fn().mockRejectedValue(new Error('storage gone'))
        : vi.fn().mockResolvedValue({ data: [], error: null }),
      list: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
  };

  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: currentRow, error: null }),
        }),
      }),
      insert: vi.fn().mockResolvedValue({ error: null }),
    }),
    rpc,
    storage,
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

describe('adminDeleteRestaurant — happy path', () => {
  it('calls the cascade RPC with the right uuid and returns counts', async () => {
    const client = makeServiceClient();
    vi.mocked(createAdminServiceClient).mockReturnValue(client as never);

    const result = await adminDeleteRestaurant(RESTAURANT_ID, { confirmName: RESTAURANT_NAME });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.dishes_deleted).toBe(12);
      expect(result.data.menus_deleted).toBe(2);
    }
    expect(client.rpc).toHaveBeenCalledWith('admin_delete_restaurant', {
      p_restaurant_id: RESTAURANT_ID,
    });
  });

  it('writes audit log with action=delete_restaurant', async () => {
    await adminDeleteRestaurant(RESTAURANT_ID, { confirmName: RESTAURANT_NAME });

    expect(logAdminAction).toHaveBeenCalledWith(
      expect.anything(),
      { adminId: ADMIN_USER.id, adminEmail: ADMIN_USER.email },
      'delete_restaurant',
      'restaurant',
      RESTAURANT_ID,
      { name: RESTAURANT_NAME, status: 'published' },
      expect.objectContaining({ dishes_deleted: 12 })
    );
  });
});

describe('adminDeleteRestaurant — guards', () => {
  it('returns CONFIRM_MISMATCH when name does not match and skips the RPC', async () => {
    const client = makeServiceClient();
    vi.mocked(createAdminServiceClient).mockReturnValue(client as never);

    const result = await adminDeleteRestaurant(RESTAURANT_ID, { confirmName: 'wrong name' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.formError).toBe('CONFIRM_MISMATCH');
    expect(client.rpc).not.toHaveBeenCalled();
    expect(logAdminAction).not.toHaveBeenCalled();
  });

  it('returns NOT_FOUND when restaurant does not exist and skips the RPC', async () => {
    const client = makeServiceClient({ currentRow: null });
    vi.mocked(createAdminServiceClient).mockReturnValue(client as never);

    const result = await adminDeleteRestaurant(RESTAURANT_ID, { confirmName: RESTAURANT_NAME });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.formError).toBe('NOT_FOUND');
    expect(client.rpc).not.toHaveBeenCalled();
    expect(logAdminAction).not.toHaveBeenCalled();
  });

  it('surfaces RPC errors as formError and skips audit', async () => {
    const client = makeServiceClient({ rpcError: { message: 'fk violation on dish_opinions' } });
    vi.mocked(createAdminServiceClient).mockReturnValue(client as never);

    const result = await adminDeleteRestaurant(RESTAURANT_ID, { confirmName: RESTAURANT_NAME });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.formError).toContain('fk violation');
    expect(logAdminAction).not.toHaveBeenCalled();
  });

  it('still returns ok when storage cleanup throws (best-effort)', async () => {
    const client = makeServiceClient({ storageThrows: true });
    vi.mocked(createAdminServiceClient).mockReturnValue(client as never);
    // Suppress the console.error from the swallowed storage failure
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await adminDeleteRestaurant(RESTAURANT_ID, {
      confirmName: RESTAURANT_NAME,
    });

    expect(result.ok).toBe(true);
    expect(logAdminAction).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});

describe('adminDeleteRestaurant — auth', () => {
  it('returns FORBIDDEN for non-admin user', async () => {
    vi.mocked(createServerActionClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'u-1', email: 'owner@x.com', app_metadata: {} } },
          error: null,
        }),
      },
    } as never);

    const result = await adminDeleteRestaurant(RESTAURANT_ID, { confirmName: RESTAURANT_NAME });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.formError).toBe('FORBIDDEN');
  });

  it('returns UNAUTHENTICATED for unauthenticated user', async () => {
    vi.mocked(createServerActionClient).mockResolvedValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: null }, error: new Error('no session') }),
      },
    } as never);

    const result = await adminDeleteRestaurant(RESTAURANT_ID, { confirmName: RESTAURANT_NAME });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.formError).toBe('UNAUTHENTICATED');
  });
});
