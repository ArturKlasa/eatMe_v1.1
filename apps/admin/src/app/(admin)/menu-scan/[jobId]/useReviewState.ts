'use client';

import { useState } from 'react';
import { type DiningFormat } from '@eatme/shared';
import {
  addGroup,
  addOption,
  moveGroup,
  moveOption,
  removeGroup,
  removeOption,
  updateGroup,
  updateOption,
} from '@/components/modifiers/groupReducers';

// Shared modifier types + factories live in the cross-route components/modifiers/
// module so the restaurant-detail dish editor can use the same Editor + types.
// Re-exported here so existing menu-scan callers keep working without changes.
export type {
  Protein,
  ExtractedModifierOption,
  ExtractedModifierGroup,
  EditableModifierOption,
  EditableModifierGroup,
} from '@/components/modifiers/editableTypes';
export {
  newEmptyModifierGroup,
  newEmptyModifierOption,
} from '@/components/modifiers/editableTypes';
import type {
  Protein,
  EditableModifierGroup,
  EditableModifierOption,
} from '@/components/modifiers/editableTypes';

export type PricePrefix = 'exact' | 'from' | 'per_person' | 'market_price' | 'ask_server';

export type CategoryMode = 'none' | 'existing' | 'canonical' | 'custom';

export type ExtractedBundledItem = {
  name: string;
  note: string | null;
};

// Wire shape from menu-scan-worker. `dish_kind` is still emitted by the worker
// during the Phase 2→4 window but is ignored by the review UI — the new
// modifier_groups + dining_format pair is the source of truth. `dish_kind` is
// kept here as an optional read-only field so legacy needs_review jobs that
// pre-date Phase 2 still parse; asEditable in ReviewDishEditor derives
// dining_format from dish_kind when dining_format is absent.
export type ExtractedDish = {
  name: string;
  description: string | null;
  price: number | null;
  primary_protein: Protein;
  suggested_category_name: string | null;
  canonical_category_slug: string | null;
  suggested_category_description: string | null;
  suggested_dish_category: string | null;
  source_image_index: number;
  confidence: number;
  display_price_prefix?: PricePrefix;
  serves?: number | null;
  dining_format?: DiningFormat | null;
  bundled_items?: ExtractedBundledItem[];
  modifier_groups?: import('@/components/modifiers/editableTypes').ExtractedModifierGroup[];
  // Legacy wire-format fields (worker still emits dish_kind through Phase 7;
  // courses/variants only present on pre-Phase-2 jobs). Read-only — UI never
  // edits these directly.
  dish_kind?: 'standard' | 'bundle' | 'configurable' | 'course_menu' | 'buffet';
};

export type EditableBundledItem = ExtractedBundledItem & {
  _id: string;
};

export type EditableDish = Omit<
  ExtractedDish,
  'display_price_prefix' | 'serves' | 'dining_format' | 'bundled_items' | 'modifier_groups'
> & {
  _id: string;
  _deleted: boolean;
  categoryMode: CategoryMode;
  categoryExistingId: string | null;
  categoryCanonicalSlug: string | null;
  categoryCustomName: string;
  dishCategoryId: string | null;
  dishCategoryUnmatched: boolean;
  display_price_prefix: PricePrefix;
  serves: number | null;
  dining_format: DiningFormat | null;
  bundled_items: EditableBundledItem[];
  modifier_groups: EditableModifierGroup[];
};

// ── Bundled-item factory + helpers (out of scope of the modifier lift) ───────

export function newEmptyBundledItem(): EditableBundledItem {
  return {
    _id: `bi-${crypto.randomUUID()}`,
    name: '',
    note: null,
  };
}

export function applyAddBundledItem(dishes: EditableDish[], dishId: string): EditableDish[] {
  return dishes.map(d => {
    if (d._id !== dishId) return d;
    return { ...d, bundled_items: [...d.bundled_items, newEmptyBundledItem()] };
  });
}

export function applyRemoveBundledItem(
  dishes: EditableDish[],
  dishId: string,
  itemIdx: number
): EditableDish[] {
  return dishes.map(d => {
    if (d._id !== dishId) return d;
    return { ...d, bundled_items: d.bundled_items.filter((_, i) => i !== itemIdx) };
  });
}

export function applyUpdateBundledItem(
  dishes: EditableDish[],
  dishId: string,
  itemIdx: number,
  patch: Partial<EditableBundledItem>
): EditableDish[] {
  return dishes.map(d => {
    if (d._id !== dishId) return d;
    return {
      ...d,
      bundled_items: d.bundled_items.map((b, i) => (i === itemIdx ? { ...b, ...patch } : b)),
    };
  });
}

// ── Hook ─────────────────────────────────────────────────────────────────────

// Modifier-group setters compose the pure reducers from
// @/components/modifiers/groupReducers — same logic the restaurant-detail
// editor uses, so behaviour can't drift between the two surfaces.

export function useReviewState(initial: EditableDish[]) {
  const [dishes, setDishes] = useState<EditableDish[]>(initial);

  const update = (id: string, patch: Partial<EditableDish>) => {
    setDishes(prev => prev.map(d => (d._id === id ? { ...d, ...patch } : d)));
  };

  const toggleDelete = (id: string) => {
    setDishes(prev => prev.map(d => (d._id === id ? { ...d, _deleted: !d._deleted } : d)));
  };

  // Helper to apply a groups-reducer to one dish only.
  const updateDishGroups = (
    dishId: string,
    fn: (groups: EditableModifierGroup[]) => EditableModifierGroup[]
  ) =>
    setDishes(prev =>
      prev.map(d => (d._id === dishId ? { ...d, modifier_groups: fn(d.modifier_groups) } : d))
    );

  const addModifierGroup = (dishId: string) => updateDishGroups(dishId, addGroup);

  const removeModifierGroup = (dishId: string, groupIdx: number) =>
    updateDishGroups(dishId, g => removeGroup(g, groupIdx));

  const moveModifierGroup = (dishId: string, fromIdx: number, toIdx: number) =>
    updateDishGroups(dishId, g => moveGroup(g, fromIdx, toIdx));

  const updateModifierGroup = (
    dishId: string,
    groupIdx: number,
    patch: Partial<EditableModifierGroup>
  ) => updateDishGroups(dishId, g => updateGroup(g, groupIdx, patch));

  const addModifierOption = (dishId: string, groupIdx: number) =>
    updateDishGroups(dishId, g => addOption(g, groupIdx));

  const removeModifierOption = (dishId: string, groupIdx: number, optIdx: number) =>
    updateDishGroups(dishId, g => removeOption(g, groupIdx, optIdx));

  const moveModifierOption = (dishId: string, groupIdx: number, fromIdx: number, toIdx: number) =>
    updateDishGroups(dishId, g => moveOption(g, groupIdx, fromIdx, toIdx));

  const updateModifierOption = (
    dishId: string,
    groupIdx: number,
    optIdx: number,
    patch: Partial<EditableModifierOption>
  ) => updateDishGroups(dishId, g => updateOption(g, groupIdx, optIdx, patch));

  const addBundledItem = (dishId: string) => setDishes(prev => applyAddBundledItem(prev, dishId));

  const removeBundledItem = (dishId: string, itemIdx: number) =>
    setDishes(prev => applyRemoveBundledItem(prev, dishId, itemIdx));

  const updateBundledItem = (
    dishId: string,
    itemIdx: number,
    patch: Partial<EditableBundledItem>
  ) => setDishes(prev => applyUpdateBundledItem(prev, dishId, itemIdx, patch));

  return {
    dishes,
    update,
    toggleDelete,
    addModifierGroup,
    removeModifierGroup,
    moveModifierGroup,
    updateModifierGroup,
    addModifierOption,
    removeModifierOption,
    moveModifierOption,
    updateModifierOption,
    addBundledItem,
    removeBundledItem,
    updateBundledItem,
  };
}
