import { describe, it, expect } from 'vitest';
import {
  applyAddCourse,
  applyAddCourseItem,
  applyAddVariant,
  applyMoveCourse,
  applyMoveCourseItem,
  applyRemoveCourse,
  applyRemoveCourseItem,
  applyRemoveVariant,
  applySetKind,
  applyUpdateCourse,
  applyUpdateCourseItem,
  newEmptyCourse,
  type EditableDish,
} from '@/app/(admin)/menu-scan/[jobId]/useReviewState';

function makeDish(overrides: Partial<EditableDish> = {}): EditableDish {
  return {
    _id: 'dish-1',
    _deleted: false,
    name: 'Test',
    description: null,
    price: 10,
    dish_kind: 'standard',
    primary_protein: 'chicken',
    suggested_category_name: null,
    canonical_category_slug: null,
    suggested_category_description: null,
    suggested_dish_category: null,
    source_image_index: 0,
    confidence: 0.9,
    categoryMode: 'none',
    categoryExistingId: null,
    categoryCanonicalSlug: null,
    categoryCustomName: '',
    dishCategoryId: null,
    dishCategoryUnmatched: false,
    is_parent: false,
    display_price_prefix: 'exact',
    serves: null,
    parent_id: null,
    courses: [],
    ...overrides,
  };
}

describe('applySetKind — field mapping', () => {
  it('standard → is_parent=false, display_price_prefix=exact', () => {
    const next = applySetKind([makeDish()], 'dish-1', 'standard');
    expect(next[0].dish_kind).toBe('standard');
    expect(next[0].is_parent).toBe(false);
    expect(next[0].display_price_prefix).toBe('exact');
  });

  it('bundle → is_parent=true, display_price_prefix=exact', () => {
    const next = applySetKind([makeDish()], 'dish-1', 'bundle');
    expect(next[0].dish_kind).toBe('bundle');
    expect(next[0].is_parent).toBe(true);
    expect(next[0].display_price_prefix).toBe('exact');
  });

  it('configurable → is_parent=true, display_price_prefix=from', () => {
    const next = applySetKind([makeDish()], 'dish-1', 'configurable');
    expect(next[0].dish_kind).toBe('configurable');
    expect(next[0].is_parent).toBe(true);
    expect(next[0].display_price_prefix).toBe('from');
  });

  it('buffet → is_parent=false, display_price_prefix=per_person', () => {
    const next = applySetKind([makeDish()], 'dish-1', 'buffet');
    expect(next[0].dish_kind).toBe('buffet');
    expect(next[0].is_parent).toBe(false);
    expect(next[0].display_price_prefix).toBe('per_person');
  });

  it('course_menu → is_parent=true, display_price_prefix=per_person, auto-seeds Course 1', () => {
    const next = applySetKind([makeDish()], 'dish-1', 'course_menu');
    expect(next[0].dish_kind).toBe('course_menu');
    expect(next[0].is_parent).toBe(true);
    expect(next[0].display_price_prefix).toBe('per_person');
    expect(next[0].courses).toHaveLength(1);
    expect(next[0].courses[0].course_number).toBe(1);
  });

  it('course_menu does not duplicate Course 1 if courses already exist', () => {
    const existing = newEmptyCourse(1);
    const next = applySetKind([makeDish({ courses: [existing] })], 'dish-1', 'course_menu');
    expect(next[0].courses).toHaveLength(1);
    expect(next[0].courses[0]._id).toBe(existing._id);
  });

  it('leaving course_menu clears courses', () => {
    const next = applySetKind(
      [makeDish({ dish_kind: 'course_menu', is_parent: true, courses: [newEmptyCourse(1)] })],
      'dish-1',
      'standard'
    );
    expect(next[0].dish_kind).toBe('standard');
    expect(next[0].courses).toEqual([]);
  });

  it('does not reset price', () => {
    const next = applySetKind([makeDish({ price: 99.5 })], 'dish-1', 'configurable');
    expect(next[0].price).toBe(99.5);
  });

  it('returns same reference for non-matched dishes', () => {
    const a = makeDish({ _id: 'dish-1' });
    const b = makeDish({ _id: 'dish-2' });
    const next = applySetKind([a, b], 'dish-1', 'bundle');
    expect(next[1]).toBe(b);
  });
});

describe('applyAddVariant / applyRemoveVariant', () => {
  it('addVariant appends a child with parent_id set and is_parent=false', () => {
    const parent = makeDish({ _id: 'p1', dish_kind: 'bundle', is_parent: true });
    const next = applyAddVariant([parent], 'p1');
    expect(next).toHaveLength(2);
    const variant = next[1];
    expect(variant.parent_id).toBe('p1');
    expect(variant.is_parent).toBe(false);
    expect(variant.dish_kind).toBe('standard');
  });

  it('addVariant inherits primary_protein and category from parent', () => {
    const parent = makeDish({
      _id: 'p1',
      primary_protein: 'beef',
      categoryMode: 'canonical',
      categoryCanonicalSlug: 'mains',
      dishCategoryId: 'cat-uuid',
    });
    const next = applyAddVariant([parent], 'p1');
    const variant = next[1];
    expect(variant.primary_protein).toBe('beef');
    expect(variant.categoryMode).toBe('canonical');
    expect(variant.categoryCanonicalSlug).toBe('mains');
    expect(variant.dishCategoryId).toBe('cat-uuid');
  });

  it('addVariant is a no-op when parent does not exist', () => {
    const dishes = [makeDish()];
    const next = applyAddVariant(dishes, 'no-such-id');
    expect(next).toBe(dishes);
  });

  it('removeVariant removes the dish by id', () => {
    const parent = makeDish({ _id: 'p1' });
    const variant = makeDish({ _id: 'v1', parent_id: 'p1' });
    const next = applyRemoveVariant([parent, variant], 'v1');
    expect(next).toHaveLength(1);
    expect(next[0]._id).toBe('p1');
  });
});

describe('applyAddCourse / applyRemoveCourse / applyMoveCourse', () => {
  function parentWithCourses(count: number): EditableDish {
    return makeDish({
      _id: 'p1',
      dish_kind: 'course_menu',
      is_parent: true,
      courses: Array.from({ length: count }, (_, i) => ({
        ...newEmptyCourse(i + 1),
        course_name: `Course ${i + 1}`,
      })),
    });
  }

  it('addCourse appends with the correct course_number', () => {
    const next = applyAddCourse([parentWithCourses(2)], 'p1');
    expect(next[0].courses).toHaveLength(3);
    expect(next[0].courses[2].course_number).toBe(3);
  });

  it('removeCourse removes and renumbers the rest', () => {
    const next = applyRemoveCourse([parentWithCourses(3)], 'p1', 0);
    expect(next[0].courses).toHaveLength(2);
    expect(next[0].courses[0].course_number).toBe(1);
    expect(next[0].courses[1].course_number).toBe(2);
    expect(next[0].courses[0].course_name).toBe('Course 2');
  });

  it('moveCourse swaps and renumbers', () => {
    const next = applyMoveCourse([parentWithCourses(3)], 'p1', 0, 2);
    expect(next[0].courses[0].course_name).toBe('Course 2');
    expect(next[0].courses[1].course_name).toBe('Course 3');
    expect(next[0].courses[2].course_name).toBe('Course 1');
    expect(next[0].courses.map(c => c.course_number)).toEqual([1, 2, 3]);
  });

  it('moveCourse is a no-op for out-of-bounds indices', () => {
    const start = [parentWithCourses(2)];
    expect(applyMoveCourse(start, 'p1', 0, 5)).toStrictEqual(start);
  });

  it('updateCourse merges patch into target course only', () => {
    const next = applyUpdateCourse([parentWithCourses(2)], 'p1', 1, {
      course_name: 'Renamed',
      choice_type: 'fixed',
    });
    expect(next[0].courses[0].course_name).toBe('Course 1');
    expect(next[0].courses[1].course_name).toBe('Renamed');
    expect(next[0].courses[1].choice_type).toBe('fixed');
  });
});

describe('applyAddCourseItem / applyRemoveCourseItem / applyMoveCourseItem / applyUpdateCourseItem', () => {
  function parentWithItems(itemCount: number): EditableDish {
    const course = newEmptyCourse(1);
    course.items = Array.from({ length: itemCount }, (_, i) => ({
      _id: `ci-${i}`,
      option_label: `Item ${i + 1}`,
      price_delta: i,
    }));
    return makeDish({
      _id: 'p1',
      dish_kind: 'course_menu',
      is_parent: true,
      courses: [course],
    });
  }

  it('addCourseItem appends an empty item', () => {
    const next = applyAddCourseItem([parentWithItems(1)], 'p1', 0);
    expect(next[0].courses[0].items).toHaveLength(2);
    expect(next[0].courses[0].items[1].option_label).toBe('');
  });

  it('removeCourseItem drops the item at index', () => {
    const next = applyRemoveCourseItem([parentWithItems(3)], 'p1', 0, 1);
    expect(next[0].courses[0].items).toHaveLength(2);
    expect(next[0].courses[0].items.map(it => it.option_label)).toEqual(['Item 1', 'Item 3']);
  });

  it('moveCourseItem reorders items within a course', () => {
    const next = applyMoveCourseItem([parentWithItems(3)], 'p1', 0, 0, 2);
    expect(next[0].courses[0].items.map(it => it.option_label)).toEqual([
      'Item 2',
      'Item 3',
      'Item 1',
    ]);
  });

  it('updateCourseItem merges patch into target item only', () => {
    const next = applyUpdateCourseItem([parentWithItems(2)], 'p1', 0, 1, {
      option_label: 'Edited',
      price_delta: 5,
    });
    expect(next[0].courses[0].items[0].option_label).toBe('Item 1');
    expect(next[0].courses[0].items[1].option_label).toBe('Edited');
    expect(next[0].courses[0].items[1].price_delta).toBe(5);
  });
});
