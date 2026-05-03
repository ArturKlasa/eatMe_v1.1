'use client';

import { useState } from 'react';
import { DISH_KIND_META, PRIMARY_PROTEINS } from '@eatme/shared';

export type DishKind = keyof typeof DISH_KIND_META;
export type Protein = (typeof PRIMARY_PROTEINS)[number];

export type PricePrefix = 'exact' | 'from' | 'per_person' | 'market_price' | 'ask_server';

export type CategoryMode = 'none' | 'existing' | 'canonical' | 'custom';

export type ExtractedCourseItem = {
  option_label: string;
  price_delta: number;
};

export type ExtractedCourse = {
  course_number: number;
  course_name: string | null;
  choice_type: 'fixed' | 'one_of';
  required_count: number;
  items: ExtractedCourseItem[];
};

// Wire shape from menu-scan-worker. Phase 7 will populate the optional
// is_parent / display_price_prefix / serves / variants / courses fields;
// today the worker leaves them undefined and hydration applies defaults.
export type ExtractedDish = {
  name: string;
  description: string | null;
  price: number | null;
  dish_kind: DishKind;
  primary_protein: Protein;
  suggested_category_name: string | null;
  canonical_category_slug: string | null;
  suggested_category_description: string | null;
  suggested_dish_category: string | null;
  source_image_index: number;
  confidence: number;
  is_parent?: boolean;
  display_price_prefix?: PricePrefix;
  serves?: number | null;
  variants?: ExtractedDish[] | null;
  courses?: ExtractedCourse[] | null;
};

export type EditableCourseItem = {
  _id: string;
  option_label: string;
  price_delta: number;
};

export type EditableCourse = {
  _id: string;
  course_number: number;
  course_name: string;
  choice_type: 'fixed' | 'one_of';
  required_count: number;
  items: EditableCourseItem[];
};

export type EditableDish = Omit<
  ExtractedDish,
  'is_parent' | 'display_price_prefix' | 'serves' | 'variants' | 'courses'
> & {
  _id: string;
  _deleted: boolean;
  categoryMode: CategoryMode;
  categoryExistingId: string | null;
  categoryCanonicalSlug: string | null;
  categoryCustomName: string;
  dishCategoryId: string | null;
  dishCategoryUnmatched: boolean;
  is_parent: boolean;
  display_price_prefix: PricePrefix;
  serves: number | null;
  parent_id: string | null;
  courses: EditableCourse[];
};

export function newEmptyCourse(courseNumber: number): EditableCourse {
  return {
    _id: `course-${crypto.randomUUID()}`,
    course_number: courseNumber,
    course_name: '',
    choice_type: 'one_of',
    required_count: 1,
    items: [],
  };
}

export function newEmptyCourseItem(): EditableCourseItem {
  return {
    _id: `ci-${crypto.randomUUID()}`,
    option_label: '',
    price_delta: 0,
  };
}

export function newEmptyVariant(parent: EditableDish): EditableDish {
  return {
    _id: `dish-${crypto.randomUUID()}`,
    _deleted: false,
    name: '',
    description: null,
    price: null,
    dish_kind: 'standard',
    primary_protein: parent.primary_protein,
    suggested_category_name: null,
    canonical_category_slug: null,
    suggested_category_description: null,
    suggested_dish_category: null,
    source_image_index: parent.source_image_index,
    confidence: 1,
    categoryMode: parent.categoryMode,
    categoryExistingId: parent.categoryExistingId,
    categoryCanonicalSlug: parent.categoryCanonicalSlug,
    categoryCustomName: parent.categoryCustomName,
    dishCategoryId: parent.dishCategoryId,
    dishCategoryUnmatched: false,
    is_parent: false,
    display_price_prefix: 'exact',
    serves: parent.serves,
    parent_id: parent._id,
    courses: [],
  };
}

export function applySetKind(
  dishes: EditableDish[],
  id: string,
  newKind: DishKind
): EditableDish[] {
  return dishes.map(d => {
    if (d._id !== id) return d;
    const oldKind = d.dish_kind;
    let patch: Partial<EditableDish> = { dish_kind: newKind };
    switch (newKind) {
      case 'standard':
        patch = { ...patch, is_parent: false, display_price_prefix: 'exact' };
        break;
      case 'bundle':
        patch = { ...patch, is_parent: true, display_price_prefix: 'exact' };
        break;
      case 'configurable':
        patch = { ...patch, is_parent: true, display_price_prefix: 'from' };
        break;
      case 'course_menu':
        patch = { ...patch, is_parent: true, display_price_prefix: 'per_person' };
        if (d.courses.length === 0) {
          patch.courses = [newEmptyCourse(1)];
        }
        break;
      case 'buffet':
        patch = { ...patch, is_parent: false, display_price_prefix: 'per_person' };
        break;
    }
    if (oldKind === 'course_menu' && newKind !== 'course_menu') {
      patch.courses = [];
    }
    return { ...d, ...patch };
  });
}

export function applyAddVariant(dishes: EditableDish[], parentId: string): EditableDish[] {
  const parent = dishes.find(d => d._id === parentId);
  if (!parent) return dishes;
  return [...dishes, newEmptyVariant(parent)];
}

export function applyRemoveVariant(dishes: EditableDish[], variantId: string): EditableDish[] {
  return dishes.filter(d => d._id !== variantId);
}

export function applyAddCourse(dishes: EditableDish[], parentId: string): EditableDish[] {
  return dishes.map(d => {
    if (d._id !== parentId) return d;
    return { ...d, courses: [...d.courses, newEmptyCourse(d.courses.length + 1)] };
  });
}

export function applyRemoveCourse(
  dishes: EditableDish[],
  parentId: string,
  courseIdx: number
): EditableDish[] {
  return dishes.map(d => {
    if (d._id !== parentId) return d;
    const remaining = d.courses.filter((_, i) => i !== courseIdx);
    const renumbered = remaining.map((c, i) => ({ ...c, course_number: i + 1 }));
    return { ...d, courses: renumbered };
  });
}

export function applyMoveCourse(
  dishes: EditableDish[],
  parentId: string,
  fromIdx: number,
  toIdx: number
): EditableDish[] {
  return dishes.map(d => {
    if (d._id !== parentId) return d;
    if (
      fromIdx === toIdx ||
      fromIdx < 0 ||
      toIdx < 0 ||
      fromIdx >= d.courses.length ||
      toIdx >= d.courses.length
    ) {
      return d;
    }
    const courses = [...d.courses];
    const [moved] = courses.splice(fromIdx, 1);
    courses.splice(toIdx, 0, moved);
    const renumbered = courses.map((c, i) => ({ ...c, course_number: i + 1 }));
    return { ...d, courses: renumbered };
  });
}

export function applyUpdateCourse(
  dishes: EditableDish[],
  parentId: string,
  courseIdx: number,
  patch: Partial<EditableCourse>
): EditableDish[] {
  return dishes.map(d => {
    if (d._id !== parentId) return d;
    const courses = d.courses.map((c, i) => (i === courseIdx ? { ...c, ...patch } : c));
    return { ...d, courses };
  });
}

export function applyAddCourseItem(
  dishes: EditableDish[],
  parentId: string,
  courseIdx: number
): EditableDish[] {
  return dishes.map(d => {
    if (d._id !== parentId) return d;
    const courses = d.courses.map((c, i) => {
      if (i !== courseIdx) return c;
      return { ...c, items: [...c.items, newEmptyCourseItem()] };
    });
    return { ...d, courses };
  });
}

export function applyRemoveCourseItem(
  dishes: EditableDish[],
  parentId: string,
  courseIdx: number,
  itemIdx: number
): EditableDish[] {
  return dishes.map(d => {
    if (d._id !== parentId) return d;
    const courses = d.courses.map((c, i) => {
      if (i !== courseIdx) return c;
      return { ...c, items: c.items.filter((_, ii) => ii !== itemIdx) };
    });
    return { ...d, courses };
  });
}

export function applyMoveCourseItem(
  dishes: EditableDish[],
  parentId: string,
  courseIdx: number,
  fromIdx: number,
  toIdx: number
): EditableDish[] {
  return dishes.map(d => {
    if (d._id !== parentId) return d;
    const courses = d.courses.map((c, i) => {
      if (i !== courseIdx) return c;
      if (
        fromIdx === toIdx ||
        fromIdx < 0 ||
        toIdx < 0 ||
        fromIdx >= c.items.length ||
        toIdx >= c.items.length
      ) {
        return c;
      }
      const items = [...c.items];
      const [moved] = items.splice(fromIdx, 1);
      items.splice(toIdx, 0, moved);
      return { ...c, items };
    });
    return { ...d, courses };
  });
}

export function applyUpdateCourseItem(
  dishes: EditableDish[],
  parentId: string,
  courseIdx: number,
  itemIdx: number,
  patch: Partial<EditableCourseItem>
): EditableDish[] {
  return dishes.map(d => {
    if (d._id !== parentId) return d;
    const courses = d.courses.map((c, i) => {
      if (i !== courseIdx) return c;
      return {
        ...c,
        items: c.items.map((it, ii) => (ii === itemIdx ? { ...it, ...patch } : it)),
      };
    });
    return { ...d, courses };
  });
}

export function useReviewState(initial: EditableDish[]) {
  const [dishes, setDishes] = useState<EditableDish[]>(initial);

  const update = (id: string, patch: Partial<EditableDish>) => {
    setDishes(prev => prev.map(d => (d._id === id ? { ...d, ...patch } : d)));
  };

  const toggleDelete = (id: string) => {
    setDishes(prev => prev.map(d => (d._id === id ? { ...d, _deleted: !d._deleted } : d)));
  };

  const setKind = (id: string, newKind: DishKind) =>
    setDishes(prev => applySetKind(prev, id, newKind));

  const addVariant = (parentId: string) => setDishes(prev => applyAddVariant(prev, parentId));

  const removeVariant = (variantId: string) =>
    setDishes(prev => applyRemoveVariant(prev, variantId));

  const addCourse = (parentId: string) => setDishes(prev => applyAddCourse(prev, parentId));

  const removeCourse = (parentId: string, courseIdx: number) =>
    setDishes(prev => applyRemoveCourse(prev, parentId, courseIdx));

  const moveCourse = (parentId: string, fromIdx: number, toIdx: number) =>
    setDishes(prev => applyMoveCourse(prev, parentId, fromIdx, toIdx));

  const updateCourse = (parentId: string, courseIdx: number, patch: Partial<EditableCourse>) =>
    setDishes(prev => applyUpdateCourse(prev, parentId, courseIdx, patch));

  const addCourseItem = (parentId: string, courseIdx: number) =>
    setDishes(prev => applyAddCourseItem(prev, parentId, courseIdx));

  const removeCourseItem = (parentId: string, courseIdx: number, itemIdx: number) =>
    setDishes(prev => applyRemoveCourseItem(prev, parentId, courseIdx, itemIdx));

  const moveCourseItem = (parentId: string, courseIdx: number, fromIdx: number, toIdx: number) =>
    setDishes(prev => applyMoveCourseItem(prev, parentId, courseIdx, fromIdx, toIdx));

  const updateCourseItem = (
    parentId: string,
    courseIdx: number,
    itemIdx: number,
    patch: Partial<EditableCourseItem>
  ) => setDishes(prev => applyUpdateCourseItem(prev, parentId, courseIdx, itemIdx, patch));

  return {
    dishes,
    update,
    toggleDelete,
    setKind,
    addVariant,
    removeVariant,
    addCourse,
    removeCourse,
    moveCourse,
    updateCourse,
    addCourseItem,
    removeCourseItem,
    moveCourseItem,
    updateCourseItem,
  };
}
