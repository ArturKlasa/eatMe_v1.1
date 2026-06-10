import { describe, it, expect } from 'vitest';
import {
  applyAddBundledItem,
  applyCopyModifierGroups,
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
    portion_amount: null,
    portion_unit: null,
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

describe('applyCopyModifierGroups (bulk copy, operator issue #13)', () => {
  function makeGroupWithOptions(name: string): EditableModifierGroup {
    const group = makeGroup({ name });
    group.options = [
      { ...newEmptyModifierOption(), name: 'Pollo', price_delta: 0 },
      { ...newEmptyModifierOption(), name: 'Arrachera', price_delta: 25 },
    ];
    return group;
  }

  function makeDishes(): EditableDish[] {
    return [
      makeDish({
        _id: 'dish-1',
        name: 'Taco A',
        modifier_groups: [makeGroupWithOptions('Proteína')],
      }),
      makeDish({ _id: 'dish-2', name: 'Taco B' }),
      makeDish({ _id: 'dish-3', name: 'Taco C' }),
    ];
  }

  it('deep-clones all source groups into each target with fresh _ids', () => {
    const next = applyCopyModifierGroups(makeDishes(), 'dish-1', ['dish-2', 'dish-3']);

    for (const id of ['dish-2', 'dish-3']) {
      const target = next.find(d => d._id === id)!;
      expect(target.modifier_groups).toHaveLength(1);
      expect(target.modifier_groups[0].name).toBe('Proteína');
      expect(target.modifier_groups[0].options.map(o => o.name)).toEqual(['Pollo', 'Arrachera']);
      expect(target.modifier_groups[0].options[1].price_delta).toBe(25);
    }

    const source = next.find(d => d._id === 'dish-1')!;
    const copy = next.find(d => d._id === 'dish-2')!;
    // Fresh identities — copies are independent of the source and of each other
    expect(copy.modifier_groups[0]._id).not.toBe(source.modifier_groups[0]._id);
    expect(copy.modifier_groups[0].options[0]._id).not.toBe(
      source.modifier_groups[0].options[0]._id
    );
    const other = next.find(d => d._id === 'dish-3')!;
    expect(copy.modifier_groups[0]._id).not.toBe(other.modifier_groups[0]._id);
  });

  it('clones are independent — editing the copy does not touch the source', () => {
    const next = applyCopyModifierGroups(makeDishes(), 'dish-1', ['dish-2']);
    const copy = next.find(d => d._id === 'dish-2')!;
    copy.modifier_groups[0].options[0].name = 'MUTATED';
    const source = next.find(d => d._id === 'dish-1')!;
    expect(source.modifier_groups[0].options[0].name).toBe('Pollo');
  });

  it('skips groups whose name already exists on the target (case-insensitive)', () => {
    const dishes = makeDishes();
    dishes[1].modifier_groups = [makeGroup({ name: 'proteína' })];
    const next = applyCopyModifierGroups(dishes, 'dish-1', ['dish-2']);
    const target = next.find(d => d._id === 'dish-2')!;
    expect(target.modifier_groups).toHaveLength(1);
    expect(target.modifier_groups[0].name).toBe('proteína');
  });

  it('copying twice does not duplicate groups', () => {
    const once = applyCopyModifierGroups(makeDishes(), 'dish-1', ['dish-2']);
    const twice = applyCopyModifierGroups(once, 'dish-1', ['dish-2']);
    expect(twice.find(d => d._id === 'dish-2')!.modifier_groups).toHaveLength(1);
  });

  it('never copies a dish onto itself, even when selected', () => {
    const next = applyCopyModifierGroups(makeDishes(), 'dish-1', ['dish-1', 'dish-2']);
    expect(next.find(d => d._id === 'dish-1')!.modifier_groups).toHaveLength(1);
    expect(next.find(d => d._id === 'dish-2')!.modifier_groups).toHaveLength(1);
  });

  it('is a no-op when the source is missing or has no groups', () => {
    const dishes = makeDishes();
    expect(applyCopyModifierGroups(dishes, 'nope', ['dish-2'])).toBe(dishes);
    expect(applyCopyModifierGroups(dishes, 'dish-2', ['dish-3'])).toBe(dishes);
  });
});
