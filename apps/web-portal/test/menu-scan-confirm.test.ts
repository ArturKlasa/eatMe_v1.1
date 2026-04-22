import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mocks (must be hoisted before any dynamic import of the route)
// ---------------------------------------------------------------------------

const mockVerifyAdminRequest = vi.fn();
const mockCreateServerSupabaseClient = vi.fn();

vi.mock('@/lib/supabase-server', () => ({
  verifyAdminRequest: (...args: unknown[]) => mockVerifyAdminRequest(...args),
  createServerSupabaseClient: (...args: unknown[]) => mockCreateServerSupabaseClient(...args),
}));

vi.mock('@/lib/featureFlags', () => ({
  ingredientEntryEnabled: () => false,
}));

// Import after mocking
const { POST } = await import('@/app/api/menu-scan/confirm/route');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/menu-scan/confirm', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Returns a PromiseLike + chainable mock that resolves to { data, error }. */
function makeChain(data: unknown, error: unknown = null) {
  const result = { data, error };
  const c: Record<string, unknown> = {
    then(onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
      return Promise.resolve(result).then(onFulfilled, onRejected);
    },
    catch(onRejected: (e: unknown) => unknown) {
      return Promise.resolve(result).catch(onRejected);
    },
    finally(onFinally: () => void) {
      return Promise.resolve(result).finally(onFinally);
    },
  };
  c.select = vi.fn(() => c);
  c.eq = vi.fn(() => c);
  c.neq = vi.fn(() => c);
  c.in = vi.fn(() => c);
  c.single = vi.fn(() => Promise.resolve(result));
  return c as Record<string, unknown>;
}

type TableInserts = Record<string, unknown[]>;

/** Builds a minimal Supabase client mock. Returns captured inserts/updates per table. */
function makeSupabaseMock(tableConfig: Record<string, { data?: unknown; error?: unknown }> = {}) {
  const inserts: TableInserts = {};
  const updates: Record<string, unknown[]> = {};

  const client = {
    from: vi.fn((table: string) => {
      const cfg = tableConfig[table] ?? {};
      const chain = makeChain(cfg.data ?? null, cfg.error ?? null);

      return {
        ...chain,
        insert: vi.fn((rows: unknown) => {
          if (!inserts[table]) inserts[table] = [];
          inserts[table].push(rows);
          return makeChain(cfg.data ?? null, cfg.error ?? null);
        }),
        update: vi.fn((data: unknown) => {
          if (!updates[table]) updates[table] = [];
          updates[table].push(data);
          return makeChain(null);
        }),
        delete: vi.fn(() => makeChain(null)),
      };
    }),
  };

  return { client, inserts, updates };
}

const adminUser = {
  user: { id: 'admin-1', email: 'admin@example.com', app_metadata: { role: 'admin' } },
  error: null,
  status: 200,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/menu-scan/confirm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 for non-admin request', async () => {
    mockVerifyAdminRequest.mockResolvedValue({ error: 'Unauthorized', status: 401 });

    const req = makeRequest({ job_id: 'j1', restaurant_id: 'r1', menus: [] });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('inserts dish_courses and dish_course_items for a course_menu dish', async () => {
    mockVerifyAdminRequest.mockResolvedValue(adminUser);

    const { client, inserts, updates } = makeSupabaseMock({
      menu_scan_jobs: { data: { id: 'job-1', status: 'needs_review' } },
      ingredient_concepts: { data: [] },
      menus: { data: { id: 'menu-1' } },
      menu_categories: { data: { id: 'cat-1' } },
      dishes: { data: null },
      dish_courses: { data: null },
      dish_course_items: { data: null },
    });
    mockCreateServerSupabaseClient.mockReturnValue(client);

    const payload = {
      job_id: 'job-1',
      restaurant_id: 'rest-1',
      menus: [
        {
          name: 'Menu',
          menu_type: 'food',
          categories: [
            {
              name: 'Mains',
              dishes: [
                {
                  name: 'Tasting Menu',
                  price: 1200,
                  dish_kind: 'course_menu',
                  is_parent: true,
                  serves: 2,
                  display_price_prefix: 'per_person',
                  dietary_tags: [],
                  canonical_ingredient_ids: [],
                  courses: [
                    {
                      course_number: 1,
                      course_name: 'Starter',
                      choice_type: 'one_of',
                      items: [
                        { option_label: 'Oysters', price_delta: 0 },
                        { option_label: 'Tartare', price_delta: 0 },
                      ],
                    },
                    {
                      course_number: 2,
                      course_name: 'Main',
                      choice_type: 'fixed',
                      items: [{ option_label: 'Wagyu', price_delta: 0 }],
                    },
                    {
                      course_number: 3,
                      course_name: 'Dessert',
                      choice_type: 'one_of',
                      items: [
                        { option_label: 'Tiramisu', price_delta: 0 },
                        { option_label: 'Sorbet', price_delta: 20 },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const res = await POST(makeRequest(payload));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.status).toMatch(/^completed/);

    // 3 dish_courses rows (one per course)
    expect(inserts['dish_courses']).toHaveLength(3);
    expect(inserts['dish_courses'][0]).toMatchObject({
      course_number: 1,
      course_name: 'Starter',
      choice_type: 'one_of',
    });
    expect(inserts['dish_courses'][2]).toMatchObject({
      course_number: 3,
      course_name: 'Dessert',
    });

    // 3 dish_course_items inserts (one batch per course)
    expect(inserts['dish_course_items']).toHaveLength(3);
    // Course 1 has 2 items
    expect((inserts['dish_course_items'][0] as unknown[]).length).toBe(2);
    // Course 2 has 1 item
    expect((inserts['dish_course_items'][1] as unknown[]).length).toBe(1);
    // Course 3 has 2 items
    expect((inserts['dish_course_items'][2] as unknown[]).length).toBe(2);

    // saved_dish_ids and saved_at set on the job
    const jobUpdate = updates['menu_scan_jobs']?.[0] as Record<string, unknown>;
    expect(jobUpdate).toBeDefined();
    expect(Array.isArray(jobUpdate.saved_dish_ids)).toBe(true);
    expect((jobUpdate.saved_dish_ids as string[]).length).toBeGreaterThan(0);
    expect(jobUpdate.saved_at).toBeDefined();
  });

  it('wires parent_dish_id for variant children', async () => {
    mockVerifyAdminRequest.mockResolvedValue(adminUser);

    const { client, inserts } = makeSupabaseMock({
      menu_scan_jobs: { data: { id: 'job-2', status: 'needs_review' } },
      ingredient_concepts: { data: [] },
      menus: { data: { id: 'menu-2' } },
      menu_categories: { data: { id: 'cat-2' } },
      dishes: { data: null },
    });
    mockCreateServerSupabaseClient.mockReturnValue(client);

    const payload = {
      job_id: 'job-2',
      restaurant_id: 'rest-1',
      menus: [
        {
          name: 'Menu',
          menu_type: 'food',
          categories: [
            {
              name: 'Burgers',
              dishes: [
                {
                  name: 'Classic Burger',
                  price: 0,
                  dish_kind: 'configurable',
                  is_parent: true,
                  serves: 1,
                  display_price_prefix: 'exact',
                  dietary_tags: [],
                  canonical_ingredient_ids: [],
                  variant_dishes: [
                    {
                      name: 'Classic Burger — Single',
                      price: 80,
                      dish_kind: 'configurable',
                      is_parent: false,
                      serves: 1,
                      display_price_prefix: 'exact',
                      dietary_tags: [],
                      canonical_ingredient_ids: [],
                    },
                    {
                      name: 'Classic Burger — Double',
                      price: 120,
                      dish_kind: 'configurable',
                      is_parent: false,
                      serves: 1,
                      display_price_prefix: 'exact',
                      dietary_tags: [],
                      canonical_ingredient_ids: [],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const res = await POST(makeRequest(payload));
    expect(res.status).toBe(200);

    // Parent inserted as single row (Pass 1)
    const parentInserts = inserts['dishes'] as unknown[];
    expect(parentInserts).toBeDefined();
    expect(parentInserts.length).toBeGreaterThan(0);

    // Children inserted as batch (Pass 2) — the second dishes insert is the child batch
    const childBatch = parentInserts[1] as Array<Record<string, unknown>>;
    expect(Array.isArray(childBatch)).toBe(true);
    expect(childBatch).toHaveLength(2);
    // Both children reference the same parent_dish_id
    expect(childBatch[0].parent_dish_id).toBe(childBatch[1].parent_dish_id);
    expect(childBatch[0].parent_dish_id).toBeTruthy();
  });
});
