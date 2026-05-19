import { describe, it, expect } from 'vitest';
import {
  applyAddBundledItem,
  applyAddModifierGroup,
  applyAddModifierOption,
  applyMoveModifierGroup,
  applyMoveModifierOption,
  applyRemoveBundledItem,
  applyRemoveModifierGroup,
  applyRemoveModifierOption,
  applyUpdateBundledItem,
  applyUpdateModifierGroup,
  applyUpdateModifierOption,
  newEmptyModifierGroup,
  newEmptyModifierOption,
  type EditableDish,
  type EditableModifierGroup,
} from '@/app/(admin)/menu-scan/[jobId]/useReviewState';

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

describe('applyAddModifierGroup / applyRemoveModifierGroup / applyMoveModifierGroup', () => {
  it('addModifierGroup appends an empty group', () => {
    const next = applyAddModifierGroup([makeDish()], 'dish-1');
    expect(next[0].modifier_groups).toHaveLength(1);
    expect(next[0].modifier_groups[0].name).toBe('');
    expect(next[0].modifier_groups[0].selection_type).toBe('single');
  });

  it('addModifierGroup is a no-op when dish does not match', () => {
    const start = [makeDish()];
    const next = applyAddModifierGroup(start, 'no-such-id');
    expect(next[0].modifier_groups).toHaveLength(0);
  });

  it('removeModifierGroup drops the group at index', () => {
    const dish = makeDish({
      modifier_groups: [
        makeGroup({ name: 'A' }),
        makeGroup({ name: 'B' }),
        makeGroup({ name: 'C' }),
      ],
    });
    const next = applyRemoveModifierGroup([dish], 'dish-1', 1);
    expect(next[0].modifier_groups.map(g => g.name)).toEqual(['A', 'C']);
  });

  it('moveModifierGroup reorders groups', () => {
    const dish = makeDish({
      modifier_groups: [
        makeGroup({ name: 'A' }),
        makeGroup({ name: 'B' }),
        makeGroup({ name: 'C' }),
      ],
    });
    const next = applyMoveModifierGroup([dish], 'dish-1', 0, 2);
    expect(next[0].modifier_groups.map(g => g.name)).toEqual(['B', 'C', 'A']);
  });

  it('moveModifierGroup is a no-op for out-of-bounds indices', () => {
    const dish = makeDish({ modifier_groups: [makeGroup(), makeGroup()] });
    const next = applyMoveModifierGroup([dish], 'dish-1', 0, 5);
    expect(next).toStrictEqual([dish]);
  });
});

describe('applyUpdateModifierGroup', () => {
  it('merges patch into target group only', () => {
    const dish = makeDish({
      modifier_groups: [makeGroup({ name: 'A' }), makeGroup({ name: 'B' })],
    });
    const next = applyUpdateModifierGroup([dish], 'dish-1', 1, {
      name: 'Renamed',
      selection_type: 'multiple',
      max_selections: 3,
    });
    expect(next[0].modifier_groups[0].name).toBe('A');
    expect(next[0].modifier_groups[1].name).toBe('Renamed');
    expect(next[0].modifier_groups[1].selection_type).toBe('multiple');
    expect(next[0].modifier_groups[1].max_selections).toBe(3);
  });
});

describe('applyAddModifierOption / applyRemoveModifierOption / applyMoveModifierOption', () => {
  function dishWithOptions(count: number): EditableDish {
    const group = makeGroup();
    group.options = Array.from({ length: count }, (_, i) => ({
      ...newEmptyModifierOption(),
      name: `Opt ${i + 1}`,
      price_delta: i,
    }));
    return makeDish({ modifier_groups: [group] });
  }

  it('addModifierOption appends an empty option', () => {
    const next = applyAddModifierOption([dishWithOptions(1)], 'dish-1', 0);
    expect(next[0].modifier_groups[0].options).toHaveLength(2);
    expect(next[0].modifier_groups[0].options[1].name).toBe('');
  });

  it('removeModifierOption drops the option at index', () => {
    const next = applyRemoveModifierOption([dishWithOptions(3)], 'dish-1', 0, 1);
    expect(next[0].modifier_groups[0].options.map(o => o.name)).toEqual(['Opt 1', 'Opt 3']);
  });

  it('moveModifierOption reorders options within a group', () => {
    const next = applyMoveModifierOption([dishWithOptions(3)], 'dish-1', 0, 0, 2);
    expect(next[0].modifier_groups[0].options.map(o => o.name)).toEqual([
      'Opt 2',
      'Opt 3',
      'Opt 1',
    ]);
  });
});

describe('applyUpdateModifierOption', () => {
  it('merges patch into target option only', () => {
    const group = makeGroup();
    group.options = [
      { ...newEmptyModifierOption(), name: 'A' },
      { ...newEmptyModifierOption(), name: 'B' },
    ];
    const dish = makeDish({ modifier_groups: [group] });
    const next = applyUpdateModifierOption([dish], 'dish-1', 0, 1, {
      name: 'Edited',
      price_delta: 5,
      primary_protein: 'beef',
      is_default: true,
    });
    expect(next[0].modifier_groups[0].options[0].name).toBe('A');
    expect(next[0].modifier_groups[0].options[1].name).toBe('Edited');
    expect(next[0].modifier_groups[0].options[1].price_delta).toBe(5);
    expect(next[0].modifier_groups[0].options[1].primary_protein).toBe('beef');
    expect(next[0].modifier_groups[0].options[1].is_default).toBe(true);
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
