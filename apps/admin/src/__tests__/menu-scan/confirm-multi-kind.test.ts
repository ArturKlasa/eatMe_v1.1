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
import { adminConfirmMenuScan } from '@/app/(admin)/menu-scan/actions/menuScan';
import { confirmPayloadSchema } from '@/app/(admin)/menu-scan/actions/confirmSchema';

const ADMIN_USER = {
  id: 'admin-uuid',
  email: 'admin@example.com',
  app_metadata: { role: 'admin' },
};

// Minimal valid dish — clients that don't yet send is_parent/display_price_prefix/
// serves/variant_dishes/courses still validate via schema defaults.
const MINIMAL_DISH = {
  name: 'Test Dish',
  description: null,
  price: 10,
  dish_kind: 'standard' as const,
  primary_protein: 'chicken' as const,
  source_image_index: 0,
  category_existing_id: null,
  category_canonical_slug: null,
  category_custom_name: null,
  dish_category_id: null,
};

describe('confirmPayloadSchema — back-compat with Phase 3 client', () => {
  it('accepts a payload missing is_parent / display_price_prefix / serves and applies defaults', () => {
    const parsed = confirmPayloadSchema.parse({
      dishes: [MINIMAL_DISH],
      source_language_code: 'en',
    });
    expect(parsed.dishes[0].is_parent).toBe(false);
    expect(parsed.dishes[0].display_price_prefix).toBe('exact');
    expect(parsed.dishes[0].serves).toBe(null);
    expect(parsed.dishes[0].variant_dishes).toEqual([]);
    expect(parsed.dishes[0].courses).toEqual([]);
  });

  it('accepts a Bundle parent with nested variant_dishes', () => {
    const parsed = confirmPayloadSchema.parse({
      dishes: [
        {
          ...MINIMAL_DISH,
          name: 'Lunch Combo',
          dish_kind: 'bundle',
          is_parent: true,
          display_price_prefix: 'exact',
          price: 129,
          variant_dishes: [
            { ...MINIMAL_DISH, name: 'Soup', price: null },
            { ...MINIMAL_DISH, name: 'Salad', price: null },
          ],
        },
      ],
      source_language_code: 'en',
    });
    expect(parsed.dishes[0].is_parent).toBe(true);
    expect(parsed.dishes[0].variant_dishes).toHaveLength(2);
    expect(parsed.dishes[0].variant_dishes[0].name).toBe('Soup');
  });

  it('accepts a Course Menu parent with nested courses + items', () => {
    const parsed = confirmPayloadSchema.parse({
      dishes: [
        {
          ...MINIMAL_DISH,
          name: "Chef's Tasting Menu",
          dish_kind: 'course_menu',
          is_parent: true,
          display_price_prefix: 'per_person',
          price: 850,
          courses: [
            {
              course_number: 1,
              course_name: 'Starter',
              choice_type: 'one_of',
              required_count: 1,
              items: [
                { option_label: 'Tuna Tartare', price_delta: 0 },
                { option_label: 'Beet Salad', price_delta: 0 },
              ],
            },
          ],
        },
      ],
      source_language_code: 'en',
    });
    expect(parsed.dishes[0].courses).toHaveLength(1);
    expect(parsed.dishes[0].courses[0].items).toHaveLength(2);
    expect(parsed.dishes[0].courses[0].course_number).toBe(1);
  });

  it('rejects invalid display_price_prefix', () => {
    const result = confirmPayloadSchema.safeParse({
      dishes: [{ ...MINIMAL_DISH, display_price_prefix: 'bogus' }],
      source_language_code: 'en',
    });
    expect(result.success).toBe(false);
  });
});

// ── Action-level integration tests with mocked Supabase ──────────────────────

type Insert = { table: string; values: unknown };

interface MockOpts {
  jobStatus?: string;
  hasMenu?: boolean;
}

function makeMockServiceClient(opts: MockOpts = {}) {
  const inserts: Insert[] = [];
  const status = opts.jobStatus ?? 'needs_review';
  const hasMenu = opts.hasMenu ?? true;

  let insertCounter = 0;
  const nextId = (prefix: string) => `${prefix}-${++insertCounter}`;

  // Fluent query builder that lets every chain ".select()", ".eq()", ".in()",
  // ".is()", ".ilike()", ".order()", ".limit()", ".maybeSingle()", ".single()"
  // resolve to a predictable shape based on the originating table.
  const queryFor = (table: string) => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      in: vi.fn(() => Promise.resolve({ data: [], error: null })),
      is: vi.fn(() => builder),
      ilike: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
      maybeSingle: vi.fn(() => {
        if (table === 'menu_scan_jobs') {
          return Promise.resolve({
            data: { id: 'job-1', restaurant_id: 'rest-1', status },
            error: null,
          });
        }
        if (table === 'restaurants') {
          return Promise.resolve({
            data: { id: 'rest-1', country_code: 'MX' },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      }),
      single: vi.fn(() => Promise.resolve({ data: { id: nextId(table) }, error: null })),
    };
    return builder;
  };

  const client = {
    from: vi.fn((table: string) => ({
      select: vi.fn(() => {
        if (table === 'menus' && hasMenu) {
          // existing menu lookup → returns one row
          const limitChain = {
            data: [{ id: 'menu-1' }],
            error: null,
          };
          return {
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(() => Promise.resolve(limitChain)),
                })),
              })),
            })),
          };
        }
        return queryFor(table);
      }),
      insert: vi.fn((values: unknown) => {
        inserts.push({ table, values });
        // dishes.insert(...).select('id') returns array; everything else single
        if (table === 'dishes') {
          const arr = Array.isArray(values) ? values : [values];
          return {
            select: vi.fn(() =>
              Promise.resolve({
                data: arr.map(() => ({ id: nextId('dish') })),
                error: null,
              })
            ),
          };
        }
        return {
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: { id: nextId(table) }, error: null })),
          })),
        };
      }),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    })),
  };

  return { client, inserts };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(createServerActionClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: ADMIN_USER }, error: null }),
    },
  } as never);
});

describe('adminConfirmMenuScan — multi-pass insert', () => {
  it('Bundle parent + variants → 1 parent + 2 children with parent_dish_id', async () => {
    const { client, inserts } = makeMockServiceClient();
    vi.mocked(createAdminServiceClient).mockReturnValue(client as never);

    const result = await adminConfirmMenuScan('job-1', {
      dishes: [
        {
          ...MINIMAL_DISH,
          name: 'Lunch Combo',
          dish_kind: 'bundle',
          is_parent: true,
          display_price_prefix: 'exact',
          price: 129,
          variant_dishes: [
            { ...MINIMAL_DISH, name: 'Soup', price: null },
            { ...MINIMAL_DISH, name: 'Salad', price: null },
          ],
        },
      ],
      source_language_code: 'en',
    });

    expect(result.ok).toBe(true);

    const dishInserts = inserts.filter(i => i.table === 'dishes');
    // Pass 1: parents (1 dish), Pass 2: children (1 batch insert of 2 dishes)
    expect(dishInserts).toHaveLength(2);

    const parentBatch = dishInserts[0].values as Array<Record<string, unknown>>;
    expect(parentBatch).toHaveLength(1);
    expect(parentBatch[0].is_parent).toBe(true);
    expect(parentBatch[0].dish_kind).toBe('bundle');
    expect(parentBatch[0].price).toBe(129);

    const childBatch = dishInserts[1].values as Array<Record<string, unknown>>;
    expect(childBatch).toHaveLength(2);
    expect(childBatch[0].is_parent).toBe(false);
    expect(childBatch[0].parent_dish_id).toBeTruthy();
    expect(childBatch[0].name).toBe('Soup');
    expect(childBatch[1].name).toBe('Salad');
  });

  it('Configurable parent forces price=0 (display-only container)', async () => {
    const { client, inserts } = makeMockServiceClient();
    vi.mocked(createAdminServiceClient).mockReturnValue(client as never);

    const result = await adminConfirmMenuScan('job-1', {
      dishes: [
        {
          ...MINIMAL_DISH,
          name: 'Poke Bowl',
          dish_kind: 'configurable',
          is_parent: true,
          display_price_prefix: 'from',
          price: 250,
          variant_dishes: [
            { ...MINIMAL_DISH, name: 'Tuna', price: 250 },
            { ...MINIMAL_DISH, name: 'Salmon', price: 280 },
          ],
        },
      ],
      source_language_code: 'en',
    });

    expect(result.ok).toBe(true);

    const dishInserts = inserts.filter(i => i.table === 'dishes');
    const parentBatch = dishInserts[0].values as Array<Record<string, unknown>>;
    expect(parentBatch[0].price).toBe(0);
    const childBatch = dishInserts[1].values as Array<Record<string, unknown>>;
    expect(childBatch[0].price).toBe(250);
    expect(childBatch[1].price).toBe(280);
  });

  it('Bundle parent keeps its bundled price (not forced to zero)', async () => {
    const { client, inserts } = makeMockServiceClient();
    vi.mocked(createAdminServiceClient).mockReturnValue(client as never);

    await adminConfirmMenuScan('job-1', {
      dishes: [
        {
          ...MINIMAL_DISH,
          name: 'Set Menu',
          dish_kind: 'bundle',
          is_parent: true,
          display_price_prefix: 'exact',
          price: 99,
          variant_dishes: [],
        },
      ],
      source_language_code: 'en',
    });

    const dishInserts = inserts.filter(i => i.table === 'dishes');
    const parentBatch = dishInserts[0].values as Array<Record<string, unknown>>;
    expect(parentBatch[0].price).toBe(99);
  });

  it('Course menu parent → dish_courses + dish_course_items inserts', async () => {
    const { client, inserts } = makeMockServiceClient();
    vi.mocked(createAdminServiceClient).mockReturnValue(client as never);

    const result = await adminConfirmMenuScan('job-1', {
      dishes: [
        {
          ...MINIMAL_DISH,
          name: 'Tasting Menu',
          dish_kind: 'course_menu',
          is_parent: true,
          display_price_prefix: 'per_person',
          price: 850,
          courses: [
            {
              course_number: 1,
              course_name: 'Starter',
              choice_type: 'one_of',
              required_count: 1,
              items: [
                { option_label: 'Tartare', price_delta: 0 },
                { option_label: 'Salad', price_delta: 0 },
              ],
            },
            {
              course_number: 2,
              course_name: 'Main',
              choice_type: 'one_of',
              required_count: 1,
              items: [{ option_label: 'Steak', price_delta: 50 }],
            },
          ],
        },
      ],
      source_language_code: 'en',
    });

    expect(result.ok).toBe(true);

    const courseInserts = inserts.filter(i => i.table === 'dish_courses');
    expect(courseInserts).toHaveLength(2);
    const c1 = courseInserts[0].values as Record<string, unknown>;
    expect(c1.course_number).toBe(1);
    expect(c1.course_name).toBe('Starter');
    expect(c1.choice_type).toBe('one_of');

    const itemInserts = inserts.filter(i => i.table === 'dish_course_items');
    expect(itemInserts).toHaveLength(2); // one batch per course
    const items1 = itemInserts[0].values as Array<Record<string, unknown>>;
    expect(items1).toHaveLength(2);
    expect(items1[0].option_label).toBe('Tartare');
    expect(items1[0].sort_order).toBe(0);
    expect(items1[1].sort_order).toBe(1);

    const items2 = itemInserts[1].values as Array<Record<string, unknown>>;
    expect(items2[0].option_label).toBe('Steak');
    expect(items2[0].price_delta).toBe(50);
  });

  it('Standalone-only payload skips parent/variant/course passes', async () => {
    const { client, inserts } = makeMockServiceClient();
    vi.mocked(createAdminServiceClient).mockReturnValue(client as never);

    const result = await adminConfirmMenuScan('job-1', {
      dishes: [
        { ...MINIMAL_DISH, name: 'Caesar Salad', price: 12 },
        { ...MINIMAL_DISH, name: 'Margherita', price: 15 },
      ],
      source_language_code: 'en',
    });

    expect(result.ok).toBe(true);

    const dishInserts = inserts.filter(i => i.table === 'dishes');
    expect(dishInserts).toHaveLength(1); // only standalones pass
    const batch = dishInserts[0].values as Array<Record<string, unknown>>;
    expect(batch).toHaveLength(2);
    expect(batch[0].is_parent).toBe(false);
    expect(batch[0].parent_dish_id).toBe(null);

    expect(inserts.filter(i => i.table === 'dish_courses')).toHaveLength(0);
    expect(inserts.filter(i => i.table === 'dish_course_items')).toHaveLength(0);
  });

  it('display_price_prefix and serves are persisted on each row', async () => {
    const { client, inserts } = makeMockServiceClient();
    vi.mocked(createAdminServiceClient).mockReturnValue(client as never);

    await adminConfirmMenuScan('job-1', {
      dishes: [
        {
          ...MINIMAL_DISH,
          name: 'AYCE BBQ',
          dish_kind: 'buffet',
          is_parent: false,
          display_price_prefix: 'per_person',
          serves: 1,
          price: 299,
        },
      ],
      source_language_code: 'en',
    });

    const dishInserts = inserts.filter(i => i.table === 'dishes');
    const batch = dishInserts[0].values as Array<Record<string, unknown>>;
    expect(batch[0].display_price_prefix).toBe('per_person');
    expect(batch[0].serves).toBe(1);
    expect(batch[0].dish_kind).toBe('buffet');
  });
});
