import { describe, it, expect } from 'vitest';
import {
  applyAddBundledItem,
  applyRemoveBundledItem,
  applyUpdateBundledItem,
  type EditableDish,
} from '@/app/(admin)/menu-scan/[jobId]/useReviewState';
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
import {
  newEmptyModifierGroup,
  newEmptyModifierOption,
  type EditableModifierGroup,
} from '@/components/modifiers/editableTypes';

function makeDish(overrides: Partial<EditableDish> = {}): EditableDish {
  return {
    _id: 'dish-1',
    _deleted: false,
    name: 'Test',
    description: null,
    price: 10,
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
    display_price_prefix: 'exact',
    serves: null,
    dining_format: null,
    bundled_items: [],
    modifier_groups: [],
    ...overrides,
  };
}

function makeGroup(overrides: Partial<EditableModifierGroup> = {}): EditableModifierGroup {
  return {
    ...newEmptyModifierGroup(),
    name: 'Size',
    ...overrides,
  };
}

describe('addGroup / removeGroup / moveGroup', () => {
  it('addGroup appends an empty group', () => {
    const next = addGroup([]);
    expect(next).toHaveLength(1);
    expect(next[0].name).toBe('');
    expect(next[0].selection_type).toBe('single');
  });

  it('addGroup preserves existing groups', () => {
    const start = [makeGroup({ name: 'A' })];
    const next = addGroup(start);
    expect(next).toHaveLength(2);
    expect(next[0].name).toBe('A');
    expect(next[1].name).toBe('');
  });

  it('removeGroup drops the group at index', () => {
    const groups = [makeGroup({ name: 'A' }), makeGroup({ name: 'B' }), makeGroup({ name: 'C' })];
    const next = removeGroup(groups, 1);
    expect(next.map(g => g.name)).toEqual(['A', 'C']);
  });

  it('moveGroup reorders groups', () => {
    const groups = [makeGroup({ name: 'A' }), makeGroup({ name: 'B' }), makeGroup({ name: 'C' })];
    const next = moveGroup(groups, 0, 2);
    expect(next.map(g => g.name)).toEqual(['B', 'C', 'A']);
  });

  it('moveGroup is a no-op for out-of-bounds indices', () => {
    const groups = [makeGroup(), makeGroup()];
    const next = moveGroup(groups, 0, 5);
    expect(next).toStrictEqual(groups);
  });
});

describe('updateGroup', () => {
  it('merges patch into target group only', () => {
    const groups = [makeGroup({ name: 'A' }), makeGroup({ name: 'B' })];
    const next = updateGroup(groups, 1, {
      name: 'Renamed',
      selection_type: 'multiple',
      max_selections: 3,
    });
    expect(next[0].name).toBe('A');
    expect(next[1].name).toBe('Renamed');
    expect(next[1].selection_type).toBe('multiple');
    expect(next[1].max_selections).toBe(3);
  });
});

describe('addOption / removeOption / moveOption', () => {
  function groupsWithOptions(count: number): EditableModifierGroup[] {
    const group = makeGroup();
    group.options = Array.from({ length: count }, (_, i) => ({
      ...newEmptyModifierOption(),
      name: `Opt ${i + 1}`,
      price_delta: i,
    }));
    return [group];
  }

  it('addOption appends an empty option', () => {
    const next = addOption(groupsWithOptions(1), 0);
    expect(next[0].options).toHaveLength(2);
    expect(next[0].options[1].name).toBe('');
  });

  it('removeOption drops the option at index', () => {
    const next = removeOption(groupsWithOptions(3), 0, 1);
    expect(next[0].options.map(o => o.name)).toEqual(['Opt 1', 'Opt 3']);
  });

  it('moveOption reorders options within a group', () => {
    const next = moveOption(groupsWithOptions(3), 0, 0, 2);
    expect(next[0].options.map(o => o.name)).toEqual(['Opt 2', 'Opt 3', 'Opt 1']);
  });
});

describe('updateOption', () => {
  it('merges patch into target option only', () => {
    const group = makeGroup();
    group.options = [
      { ...newEmptyModifierOption(), name: 'A' },
      { ...newEmptyModifierOption(), name: 'B' },
    ];
    const next = updateOption([group], 0, 1, {
      name: 'Edited',
      price_delta: 5,
      primary_protein: 'beef',
      is_default: true,
    });
    expect(next[0].options[0].name).toBe('A');
    expect(next[0].options[1].name).toBe('Edited');
    expect(next[0].options[1].price_delta).toBe(5);
    expect(next[0].options[1].primary_protein).toBe('beef');
    expect(next[0].options[1].is_default).toBe(true);
  });
});

describe('applyAddBundledItem / applyRemoveBundledItem / applyUpdateBundledItem', () => {
  it('addBundledItem appends an empty item', () => {
    const next = applyAddBundledItem([makeDish()], 'dish-1');
    expect(next[0].bundled_items).toHaveLength(1);
    expect(next[0].bundled_items[0].name).toBe('');
    expect(next[0].bundled_items[0].note).toBe(null);
  });

  it('removeBundledItem drops the item at index', () => {
    const dish = makeDish({
      bundled_items: [
        { _id: 'bi-1', name: 'Soup', note: null },
        { _id: 'bi-2', name: 'Salad', note: 'tossed' },
        { _id: 'bi-3', name: 'Bread', note: null },
      ],
    });
    const next = applyRemoveBundledItem([dish], 'dish-1', 1);
    expect(next[0].bundled_items.map(b => b.name)).toEqual(['Soup', 'Bread']);
  });

  it('updateBundledItem merges patch into target item only', () => {
    const dish = makeDish({
      bundled_items: [
        { _id: 'bi-1', name: 'Soup', note: null },
        { _id: 'bi-2', name: 'Salad', note: null },
      ],
    });
    const next = applyUpdateBundledItem([dish], 'dish-1', 1, {
      name: 'Caesar Salad',
      note: 'no anchovies',
    });
    expect(next[0].bundled_items[0].name).toBe('Soup');
    expect(next[0].bundled_items[1].name).toBe('Caesar Salad');
    expect(next[0].bundled_items[1].note).toBe('no anchovies');
  });
});
