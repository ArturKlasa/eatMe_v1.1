'use client';

import { useState } from 'react';
import { PRIMARY_PROTEINS, type DiningFormat } from '@eatme/shared';

export type Protein = (typeof PRIMARY_PROTEINS)[number];

export type PricePrefix = 'exact' | 'from' | 'per_person' | 'market_price' | 'ask_server';

export type CategoryMode = 'none' | 'existing' | 'canonical' | 'custom';

// Wire-format option from menu-scan-worker.
export type ExtractedModifierOption = {
  name: string;
  price_delta: number;
  price_override: number | null;
  primary_protein: Protein | null;
  removes_dietary_tags: string[];
  adds_allergens: string[];
  serves_delta: number;
  is_default: boolean;
};

// Wire-format group from menu-scan-worker.
export type ExtractedModifierGroup = {
  name: string;
  selection_type: 'single' | 'multiple';
  min_selections: number;
  max_selections: number;
  display_in_card: boolean;
  options: ExtractedModifierOption[];
};

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
  modifier_groups?: ExtractedModifierGroup[];
  // Legacy wire-format fields (worker still emits dish_kind through Phase 7;
  // courses/variants only present on pre-Phase-2 jobs). Read-only — UI never
  // edits these directly.
  dish_kind?: 'standard' | 'bundle' | 'configurable' | 'course_menu' | 'buffet';
};

// In-editor versions carry a local _id (for stable React keys + reordering).
// Otherwise they match the wire shape one-to-one.

export type EditableModifierOption = ExtractedModifierOption & {
  _id: string;
};

export type EditableModifierGroup = Omit<ExtractedModifierGroup, 'options'> & {
  _id: string;
  options: EditableModifierOption[];
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

// ── Factories ────────────────────────────────────────────────────────────────

export function newEmptyModifierGroup(): EditableModifierGroup {
  return {
    _id: `mg-${crypto.randomUUID()}`,
    name: '',
    selection_type: 'single',
    min_selections: 1,
    max_selections: 1,
    display_in_card: false,
    options: [],
  };
}

export function newEmptyModifierOption(): EditableModifierOption {
  return {
    _id: `mo-${crypto.randomUUID()}`,
    name: '',
    price_delta: 0,
    price_override: null,
    primary_protein: null,
    removes_dietary_tags: [],
    adds_allergens: [],
    serves_delta: 0,
    is_default: false,
  };
}

export function newEmptyBundledItem(): EditableBundledItem {
  return {
    _id: `bi-${crypto.randomUUID()}`,
    name: '',
    note: null,
  };
}

// ── Modifier-group helpers ───────────────────────────────────────────────────

export function applyAddModifierGroup(dishes: EditableDish[], dishId: string): EditableDish[] {
  return dishes.map(d => {
    if (d._id !== dishId) return d;
    return { ...d, modifier_groups: [...d.modifier_groups, newEmptyModifierGroup()] };
  });
}

export function applyRemoveModifierGroup(
  dishes: EditableDish[],
  dishId: string,
  groupIdx: number
): EditableDish[] {
  return dishes.map(d => {
    if (d._id !== dishId) return d;
    return {
      ...d,
      modifier_groups: d.modifier_groups.filter((_, i) => i !== groupIdx),
    };
  });
}

export function applyMoveModifierGroup(
  dishes: EditableDish[],
  dishId: string,
  fromIdx: number,
  toIdx: number
): EditableDish[] {
  return dishes.map(d => {
    if (d._id !== dishId) return d;
    if (
      fromIdx === toIdx ||
      fromIdx < 0 ||
      toIdx < 0 ||
      fromIdx >= d.modifier_groups.length ||
      toIdx >= d.modifier_groups.length
    ) {
      return d;
    }
    const groups = [...d.modifier_groups];
    const [moved] = groups.splice(fromIdx, 1);
    groups.splice(toIdx, 0, moved);
    return { ...d, modifier_groups: groups };
  });
}

export function applyUpdateModifierGroup(
  dishes: EditableDish[],
  dishId: string,
  groupIdx: number,
  patch: Partial<EditableModifierGroup>
): EditableDish[] {
  return dishes.map(d => {
    if (d._id !== dishId) return d;
    const groups = d.modifier_groups.map((g, i) => (i === groupIdx ? { ...g, ...patch } : g));
    return { ...d, modifier_groups: groups };
  });
}

// ── Modifier-option helpers ──────────────────────────────────────────────────

export function applyAddModifierOption(
  dishes: EditableDish[],
  dishId: string,
  groupIdx: number
): EditableDish[] {
  return dishes.map(d => {
    if (d._id !== dishId) return d;
    const groups = d.modifier_groups.map((g, i) => {
      if (i !== groupIdx) return g;
      return { ...g, options: [...g.options, newEmptyModifierOption()] };
    });
    return { ...d, modifier_groups: groups };
  });
}

export function applyRemoveModifierOption(
  dishes: EditableDish[],
  dishId: string,
  groupIdx: number,
  optIdx: number
): EditableDish[] {
  return dishes.map(d => {
    if (d._id !== dishId) return d;
    const groups = d.modifier_groups.map((g, i) => {
      if (i !== groupIdx) return g;
      return { ...g, options: g.options.filter((_, ii) => ii !== optIdx) };
    });
    return { ...d, modifier_groups: groups };
  });
}

export function applyMoveModifierOption(
  dishes: EditableDish[],
  dishId: string,
  groupIdx: number,
  fromIdx: number,
  toIdx: number
): EditableDish[] {
  return dishes.map(d => {
    if (d._id !== dishId) return d;
    const groups = d.modifier_groups.map((g, i) => {
      if (i !== groupIdx) return g;
      if (
        fromIdx === toIdx ||
        fromIdx < 0 ||
        toIdx < 0 ||
        fromIdx >= g.options.length ||
        toIdx >= g.options.length
      ) {
        return g;
      }
      const opts = [...g.options];
      const [moved] = opts.splice(fromIdx, 1);
      opts.splice(toIdx, 0, moved);
      return { ...g, options: opts };
    });
    return { ...d, modifier_groups: groups };
  });
}

export function applyUpdateModifierOption(
  dishes: EditableDish[],
  dishId: string,
  groupIdx: number,
  optIdx: number,
  patch: Partial<EditableModifierOption>
): EditableDish[] {
  return dishes.map(d => {
    if (d._id !== dishId) return d;
    const groups = d.modifier_groups.map((g, i) => {
      if (i !== groupIdx) return g;
      return {
        ...g,
        options: g.options.map((o, ii) => (ii === optIdx ? { ...o, ...patch } : o)),
      };
    });
    return { ...d, modifier_groups: groups };
  });
}

// ── Bundled-item helpers ─────────────────────────────────────────────────────

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

export function useReviewState(initial: EditableDish[]) {
  const [dishes, setDishes] = useState<EditableDish[]>(initial);

  const update = (id: string, patch: Partial<EditableDish>) => {
    setDishes(prev => prev.map(d => (d._id === id ? { ...d, ...patch } : d)));
  };

  const toggleDelete = (id: string) => {
    setDishes(prev => prev.map(d => (d._id === id ? { ...d, _deleted: !d._deleted } : d)));
  };

  const addModifierGroup = (dishId: string) =>
    setDishes(prev => applyAddModifierGroup(prev, dishId));

  const removeModifierGroup = (dishId: string, groupIdx: number) =>
    setDishes(prev => applyRemoveModifierGroup(prev, dishId, groupIdx));

  const moveModifierGroup = (dishId: string, fromIdx: number, toIdx: number) =>
    setDishes(prev => applyMoveModifierGroup(prev, dishId, fromIdx, toIdx));

  const updateModifierGroup = (
    dishId: string,
    groupIdx: number,
    patch: Partial<EditableModifierGroup>
  ) => setDishes(prev => applyUpdateModifierGroup(prev, dishId, groupIdx, patch));

  const addModifierOption = (dishId: string, groupIdx: number) =>
    setDishes(prev => applyAddModifierOption(prev, dishId, groupIdx));

  const removeModifierOption = (dishId: string, groupIdx: number, optIdx: number) =>
    setDishes(prev => applyRemoveModifierOption(prev, dishId, groupIdx, optIdx));

  const moveModifierOption = (dishId: string, groupIdx: number, fromIdx: number, toIdx: number) =>
    setDishes(prev => applyMoveModifierOption(prev, dishId, groupIdx, fromIdx, toIdx));

  const updateModifierOption = (
    dishId: string,
    groupIdx: number,
    optIdx: number,
    patch: Partial<EditableModifierOption>
  ) => setDishes(prev => applyUpdateModifierOption(prev, dishId, groupIdx, optIdx, patch));

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
