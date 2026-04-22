import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStore } from 'zustand/vanilla';
import { createReviewSlice, ReviewSlice } from '../reviewSlice';
import { newEmptyDish } from '@/lib/menu-scan';
import type { EditableDish, EditableMenu, EnrichedResult } from '@/lib/menu-scan';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    }),
  },
  formatLocationForSupabase: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

vi.mock('@/lib/menu-scan-utils', () => ({
  pdfToImages: vi.fn().mockResolvedValue([]),
  resizeImageToBase64: vi.fn().mockResolvedValue('data:image/jpeg;base64,test'),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStore() {
  return createStore<ReviewSlice>()(createReviewSlice);
}

function makeStoreWithDish(dishOverrides: Partial<EditableDish> = {}) {
  const store = makeStore();
  const dish: EditableDish = { ...newEmptyDish(), ...dishOverrides };
  const menu: EditableMenu = {
    name: 'Menu',
    menu_type: 'food',
    categories: [{ name: 'Cat', dishes: [dish] }],
  };
  store.setState({ editableMenus: [menu] });
  return { store, dishId: dish._id };
}

function makeEnrichedDish(dish_kind: string, extra: Record<string, unknown> = {}) {
  return {
    name: 'Test Dish',
    price: 10,
    description: null,
    raw_ingredients: null,
    dietary_hints: [],
    allergen_hints: [],
    spice_level: null,
    calories: null,
    dish_category: null,
    confidence: 0.9,
    is_parent: false,
    dish_kind,
    serves: null,
    display_price_prefix: 'exact' as const,
    variants: null,
    matched_ingredients: [],
    mapped_dietary_tags: [],
    mapped_allergens: [],
    dish_category_id: null,
    ...extra,
  };
}

function makeEnrichedResult(dishes: ReturnType<typeof makeEnrichedDish>[]): EnrichedResult {
  return {
    menus: [
      {
        name: 'Menu',
        menu_type: 'food',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        categories: [{ name: 'Cat', dishes: dishes as any }],
      },
    ],
    currency: 'USD',
  };
}

// ---------------------------------------------------------------------------
// setKind — field mapping
// ---------------------------------------------------------------------------

describe('reviewSlice — setKind field mapping', () => {
  let store: ReturnType<typeof makeStore>;
  let dishId: string;

  beforeEach(() => {
    ({ store, dishId } = makeStoreWithDish());
  });

  it('standard → is_parent=false, display_price_prefix=exact', () => {
    store.getState().setKind(dishId, 'standard');
    const dish = store.getState().editableMenus[0].categories[0].dishes[0];
    expect(dish.dish_kind).toBe('standard');
    expect(dish.is_parent).toBe(false);
    expect(dish.display_price_prefix).toBe('exact');
  });

  it('bundle → is_parent=true, display_price_prefix=exact', () => {
    store.getState().setKind(dishId, 'bundle');
    const dish = store.getState().editableMenus[0].categories[0].dishes[0];
    expect(dish.dish_kind).toBe('bundle');
    expect(dish.is_parent).toBe(true);
    expect(dish.display_price_prefix).toBe('exact');
  });

  it('configurable → is_parent=true, display_price_prefix=from', () => {
    store.getState().setKind(dishId, 'configurable');
    const dish = store.getState().editableMenus[0].categories[0].dishes[0];
    expect(dish.dish_kind).toBe('configurable');
    expect(dish.is_parent).toBe(true);
    expect(dish.display_price_prefix).toBe('from');
  });

  it('buffet → is_parent=false, display_price_prefix=per_person', () => {
    store.getState().setKind(dishId, 'buffet');
    const dish = store.getState().editableMenus[0].categories[0].dishes[0];
    expect(dish.dish_kind).toBe('buffet');
    expect(dish.is_parent).toBe(false);
    expect(dish.display_price_prefix).toBe('per_person');
  });
});

// ---------------------------------------------------------------------------
// setKind — no silent price drop
// ---------------------------------------------------------------------------

describe('reviewSlice — setKind no silent price drop', () => {
  it('changing kind does not reset price', () => {
    const { store, dishId } = makeStoreWithDish({ price: '99.50', dish_kind: 'standard' });
    store.getState().setKind(dishId, 'configurable');
    const dish = store.getState().editableMenus[0].categories[0].dishes[0];
    expect(dish.price).toBe('99.50');
  });

  it('combo → bundle keeps price', () => {
    const { store, dishId } = makeStoreWithDish({ price: '45.00', dish_kind: 'bundle' });
    store.getState().setKind(dishId, 'configurable');
    const dish = store.getState().editableMenus[0].categories[0].dishes[0];
    expect(dish.price).toBe('45.00');
  });
});

// ---------------------------------------------------------------------------
// setKind — course_menu auto-seeds Course 1
// ---------------------------------------------------------------------------

describe('reviewSlice — setKind course_menu', () => {
  it('auto-seeds Course 1 when switching to course_menu with no existing courses', () => {
    const { store, dishId } = makeStoreWithDish({ courses: [] });
    store.getState().setKind(dishId, 'course_menu');
    const dish = store.getState().editableMenus[0].categories[0].dishes[0];
    expect(dish.dish_kind).toBe('course_menu');
    expect(dish.is_parent).toBe(true);
    expect(dish.display_price_prefix).toBe('per_person');
    expect(dish.courses).toHaveLength(1);
    expect(dish.courses![0].course_number).toBe(1);
  });

  it('does not add duplicate course if courses already exist', () => {
    const { store, dishId } = makeStoreWithDish({
      dish_kind: 'course_menu',
      courses: [
        {
          _id: 'existing-course',
          course_number: 1,
          course_name: 'Starter',
          choice_type: 'one_of',
          required_count: 1,
          items: [],
        },
      ],
    });
    store.getState().setKind(dishId, 'course_menu');
    const dish = store.getState().editableMenus[0].categories[0].dishes[0];
    expect(dish.courses).toHaveLength(1);
    expect(dish.courses![0]._id).toBe('existing-course');
  });

  it('clears courses when switching away from course_menu', () => {
    const { store, dishId } = makeStoreWithDish({
      dish_kind: 'course_menu',
      courses: [
        {
          _id: 'c1',
          course_number: 1,
          course_name: 'Starter',
          choice_type: 'one_of',
          required_count: 1,
          items: [],
        },
      ],
    });
    store.getState().setKind(dishId, 'standard');
    const dish = store.getState().editableMenus[0].categories[0].dishes[0];
    expect(dish.dish_kind).toBe('standard');
    expect(dish.courses).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Course actions
// ---------------------------------------------------------------------------

describe('reviewSlice — addCourse / removeCourse / reorderCourses / updateCourseField', () => {
  it('addCourse appends a new course with correct course_number', () => {
    const { store, dishId } = makeStoreWithDish({ dish_kind: 'course_menu', courses: [] });
    store.getState().addCourse(dishId);
    const dish = store.getState().editableMenus[0].categories[0].dishes[0];
    expect(dish.courses).toHaveLength(1);
    expect(dish.courses![0].course_number).toBe(1);

    store.getState().addCourse(dishId);
    const dish2 = store.getState().editableMenus[0].categories[0].dishes[0];
    expect(dish2.courses).toHaveLength(2);
    expect(dish2.courses![1].course_number).toBe(2);
  });

  it('removeCourse removes course at index and renumbers', () => {
    const { store, dishId } = makeStoreWithDish({
      dish_kind: 'course_menu',
      courses: [
        {
          _id: 'c1',
          course_number: 1,
          course_name: 'A',
          choice_type: 'one_of',
          required_count: 1,
          items: [],
        },
        {
          _id: 'c2',
          course_number: 2,
          course_name: 'B',
          choice_type: 'one_of',
          required_count: 1,
          items: [],
        },
        {
          _id: 'c3',
          course_number: 3,
          course_name: 'C',
          choice_type: 'one_of',
          required_count: 1,
          items: [],
        },
      ],
    });
    store.getState().removeCourse(dishId, 1); // remove 'B'
    const dish = store.getState().editableMenus[0].categories[0].dishes[0];
    expect(dish.courses).toHaveLength(2);
    expect(dish.courses![0]._id).toBe('c1');
    expect(dish.courses![0].course_number).toBe(1);
    expect(dish.courses![1]._id).toBe('c3');
    expect(dish.courses![1].course_number).toBe(2);
  });

  it('reorderCourses moves course and renumbers', () => {
    const { store, dishId } = makeStoreWithDish({
      dish_kind: 'course_menu',
      courses: [
        {
          _id: 'c1',
          course_number: 1,
          course_name: 'A',
          choice_type: 'one_of',
          required_count: 1,
          items: [],
        },
        {
          _id: 'c2',
          course_number: 2,
          course_name: 'B',
          choice_type: 'one_of',
          required_count: 1,
          items: [],
        },
        {
          _id: 'c3',
          course_number: 3,
          course_name: 'C',
          choice_type: 'one_of',
          required_count: 1,
          items: [],
        },
      ],
    });
    store.getState().reorderCourses(dishId, 0, 2); // move 'A' to end
    const dish = store.getState().editableMenus[0].categories[0].dishes[0];
    expect(dish.courses!.map(c => c._id)).toEqual(['c2', 'c3', 'c1']);
    expect(dish.courses!.map(c => c.course_number)).toEqual([1, 2, 3]);
  });

  it('updateCourseField merges patch into course', () => {
    const { store, dishId } = makeStoreWithDish({
      dish_kind: 'course_menu',
      courses: [
        {
          _id: 'c1',
          course_number: 1,
          course_name: 'Old Name',
          choice_type: 'one_of',
          required_count: 1,
          items: [],
        },
      ],
    });
    store
      .getState()
      .updateCourseField(dishId, 0, { course_name: 'New Name', choice_type: 'fixed' });
    const course = store.getState().editableMenus[0].categories[0].dishes[0].courses![0];
    expect(course.course_name).toBe('New Name');
    expect(course.choice_type).toBe('fixed');
    expect(course._id).toBe('c1'); // not overwritten
  });
});

// ---------------------------------------------------------------------------
// Course item actions
// ---------------------------------------------------------------------------

describe('reviewSlice — course item actions', () => {
  function makeStoreWithCourse() {
    const { store, dishId } = makeStoreWithDish({
      dish_kind: 'course_menu',
      courses: [
        {
          _id: 'c1',
          course_number: 1,
          course_name: 'Starter',
          choice_type: 'one_of',
          required_count: 1,
          items: [
            { _id: 'i1', option_label: 'Soup', price_delta: 0 },
            { _id: 'i2', option_label: 'Salad', price_delta: 0 },
          ],
        },
      ],
    });
    return { store, dishId };
  }

  it('addCourseItem appends a new empty item', () => {
    const { store, dishId } = makeStoreWithCourse();
    store.getState().addCourseItem(dishId, 0);
    const items = store.getState().editableMenus[0].categories[0].dishes[0].courses![0].items;
    expect(items).toHaveLength(3);
    expect(items[2].option_label).toBe('');
    expect(items[2].price_delta).toBe(0);
  });

  it('removeCourseItem removes item at index', () => {
    const { store, dishId } = makeStoreWithCourse();
    store.getState().removeCourseItem(dishId, 0, 0); // remove 'Soup'
    const items = store.getState().editableMenus[0].categories[0].dishes[0].courses![0].items;
    expect(items).toHaveLength(1);
    expect(items[0]._id).toBe('i2');
  });

  it('reorderCourseItems moves item', () => {
    const { store, dishId } = makeStoreWithCourse();
    store.getState().reorderCourseItems(dishId, 0, 0, 1); // move 'Soup' after 'Salad'
    const items = store.getState().editableMenus[0].categories[0].dishes[0].courses![0].items;
    expect(items.map(i => i._id)).toEqual(['i2', 'i1']);
  });

  it('updateCourseItem merges patch into item', () => {
    const { store, dishId } = makeStoreWithCourse();
    store.getState().updateCourseItem(dishId, 0, 0, { option_label: 'Bisque', price_delta: 5 });
    const item = store.getState().editableMenus[0].categories[0].dishes[0].courses![0].items[0];
    expect(item.option_label).toBe('Bisque');
    expect(item.price_delta).toBe(5);
    expect(item._id).toBe('i1');
  });
});

// ---------------------------------------------------------------------------
// hydrateFromJob — legacy kind normalization
// ---------------------------------------------------------------------------

describe('reviewSlice — hydrateFromJob normalization', () => {
  it('normalizes combo → bundle', () => {
    const store = makeStore();
    const enriched = makeEnrichedResult([makeEnrichedDish('combo')]);
    store.getState().hydrateFromJob(enriched, 'job-1', 'USD');
    const dish = store.getState().editableMenus[0].categories[0].dishes[0];
    expect(dish.dish_kind).toBe('bundle');
  });

  it('normalizes template → configurable + is_template=true', () => {
    const store = makeStore();
    const enriched = makeEnrichedResult([makeEnrichedDish('template')]);
    store.getState().hydrateFromJob(enriched, 'job-2', 'USD');
    const dish = store.getState().editableMenus[0].categories[0].dishes[0];
    expect(dish.dish_kind).toBe('configurable');
    expect(dish.is_template).toBe(true);
  });

  it('normalizes experience → configurable (no is_template)', () => {
    const store = makeStore();
    const enriched = makeEnrichedResult([makeEnrichedDish('experience')]);
    store.getState().hydrateFromJob(enriched, 'job-3', 'USD');
    const dish = store.getState().editableMenus[0].categories[0].dishes[0];
    expect(dish.dish_kind).toBe('configurable');
    expect(dish.is_template).toBeUndefined();
  });

  it('sets jobId and currency on the store', () => {
    const store = makeStore();
    const enriched = makeEnrichedResult([makeEnrichedDish('standard')]);
    store.getState().hydrateFromJob(enriched, 'job-42', 'MXN');
    expect(store.getState().jobId).toBe('job-42');
    expect(store.getState().currency).toBe('MXN');
  });

  it('does not alter modern kinds', () => {
    const store = makeStore();
    const enriched = makeEnrichedResult([
      makeEnrichedDish('standard'),
      makeEnrichedDish('bundle'),
      makeEnrichedDish('configurable'),
      makeEnrichedDish('buffet'),
    ]);
    store.getState().hydrateFromJob(enriched, 'job-5', 'USD');
    const dishes = store.getState().editableMenus[0].categories[0].dishes;
    expect(dishes[0].dish_kind).toBe('standard');
    expect(dishes[1].dish_kind).toBe('bundle');
    expect(dishes[2].dish_kind).toBe('configurable');
    expect(dishes[3].dish_kind).toBe('buffet');
  });
});
