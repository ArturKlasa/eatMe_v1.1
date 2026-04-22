import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStore } from 'zustand/vanilla';
import { createGroupSlice, GroupSlice } from '../groupSlice';
import { createReviewSlice, ReviewSlice } from '../reviewSlice';
import { newEmptyDish } from '@/lib/menu-scan';
import type { EditableDish, EditableMenu, FlaggedDuplicate } from '@/lib/menu-scan';
import type { RawExtractedDish } from '@/lib/menu-scan';

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

vi.mock('@/lib/menu-scan-utils', () => ({
  pdfToImages: vi.fn().mockResolvedValue([]),
  resizeImageToBase64: vi.fn().mockResolvedValue('data:image/jpeg;base64,test'),
}));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type TestStore = ReviewSlice & GroupSlice;

function makeStore() {
  return createStore<TestStore>()((...a) => ({
    ...createReviewSlice(...a),
    ...createGroupSlice(...a),
  }));
}

function makeDish(overrides: Partial<EditableDish> = {}): EditableDish {
  return { ...newEmptyDish(), group_status: 'ai_proposed', ...overrides };
}

function makeMenu(dishes: EditableDish[]): EditableMenu {
  return { name: 'Menu', menu_type: 'food', categories: [{ name: 'Cat', dishes }] };
}

function makeStoreWithDishes(dishes: EditableDish[]) {
  const store = makeStore();
  store.setState({ editableMenus: [makeMenu(dishes)] });
  return store;
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe('groupSlice — initial state', () => {
  it('starts with empty collections', () => {
    const store = makeStore();
    const s = store.getState();
    expect(s.flaggedDuplicates).toEqual([]);
    expect(s.selectedGroupIds).toEqual(new Set());
    expect(s.focusedGroupId).toBeNull();
    expect(s.batchFilters).toEqual({ confidenceMin: null, dishKind: null, hasGrouping: null });
  });
});

// ---------------------------------------------------------------------------
// Simple setters
// ---------------------------------------------------------------------------

describe('groupSlice — setters', () => {
  let store: ReturnType<typeof makeStore>;
  beforeEach(() => {
    store = makeStore();
    vi.clearAllMocks();
  });

  it('setFlaggedDuplicates replaces array', () => {
    const dup: FlaggedDuplicate = {
      existingDish: { name: 'Burger' } as RawExtractedDish,
      incomingDish: { name: 'Burger' } as RawExtractedDish,
      categoryName: 'Mains',
    };
    store.getState().setFlaggedDuplicates([dup]);
    expect(store.getState().flaggedDuplicates).toHaveLength(1);
  });

  it('setSelectedGroupIds accepts a Set', () => {
    const ids = new Set(['a', 'b']);
    store.getState().setSelectedGroupIds(ids);
    expect(store.getState().selectedGroupIds).toEqual(ids);
  });

  it('setSelectedGroupIds accepts an updater function', () => {
    store.setState({ selectedGroupIds: new Set(['a']) });
    store.getState().setSelectedGroupIds(prev => new Set([...prev, 'b']));
    expect(store.getState().selectedGroupIds).toEqual(new Set(['a', 'b']));
  });

  it('setBatchFilters updates filters', () => {
    store.getState().setBatchFilters({ confidenceMin: 0.8, dishKind: 'bundle', hasGrouping: true });
    const { batchFilters } = store.getState();
    expect(batchFilters.confidenceMin).toBe(0.8);
    expect(batchFilters.dishKind).toBe('bundle');
  });

  it('setFocusedGroupId sets id', () => {
    store.getState().setFocusedGroupId('dish-1');
    expect(store.getState().focusedGroupId).toBe('dish-1');
  });
});

// ---------------------------------------------------------------------------
// acceptGroup / rejectGroup
// ---------------------------------------------------------------------------

describe('groupSlice — acceptGroup', () => {
  it('marks parent and children as accepted', () => {
    const parent = makeDish({ is_parent: true });
    const child = makeDish({ parent_id: parent._id });
    const store = makeStoreWithDishes([parent, child]);

    store.getState().acceptGroup(parent._id);

    const dishes = store.getState().editableMenus[0].categories[0].dishes;
    expect(dishes[0].group_status).toBe('accepted');
    expect(dishes[1].group_status).toBe('accepted');
  });

  it('does not touch unrelated dishes', () => {
    const parent = makeDish({ is_parent: true });
    const other = makeDish();
    const store = makeStoreWithDishes([parent, other]);

    store.getState().acceptGroup(parent._id);

    const dishes = store.getState().editableMenus[0].categories[0].dishes;
    expect(dishes[1].group_status).toBe('ai_proposed');
  });
});

describe('groupSlice — rejectGroup', () => {
  it('marks parent and children as rejected', () => {
    const parent = makeDish({ is_parent: true });
    const child = makeDish({ parent_id: parent._id });
    const store = makeStoreWithDishes([parent, child]);

    store.getState().rejectGroup(parent._id);

    const dishes = store.getState().editableMenus[0].categories[0].dishes;
    expect(dishes[0].group_status).toBe('rejected');
    expect(dishes[1].group_status).toBe('rejected');
  });
});

// ---------------------------------------------------------------------------
// ungroupChild
// ---------------------------------------------------------------------------

describe('groupSlice — ungroupChild', () => {
  it('clears child parent_id and removes from parent variant_ids', () => {
    const child = makeDish();
    const parent = makeDish({ is_parent: true, variant_ids: [child._id] });
    const store = makeStoreWithDishes([parent, child]);

    store.getState().ungroupChild(child._id);

    const dishes = store.getState().editableMenus[0].categories[0].dishes;
    const updatedChild = dishes.find(d => d._id === child._id)!;
    const updatedParent = dishes.find(d => d._id === parent._id)!;

    expect(updatedChild.parent_id).toBeNull();
    expect(updatedChild.group_status).toBe('manual');
    expect(updatedParent.variant_ids).not.toContain(child._id);
  });

  it('sets parent is_parent=false when last child removed', () => {
    const child = makeDish();
    const parent = makeDish({ is_parent: true, variant_ids: [child._id] });
    const store = makeStoreWithDishes([parent, child]);

    store.getState().ungroupChild(child._id);

    const updatedParent = store
      .getState()
      .editableMenus[0].categories[0].dishes.find(d => d._id === parent._id)!;
    expect(updatedParent.is_parent).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// dismissFlaggedDuplicate
// ---------------------------------------------------------------------------

describe('groupSlice — dismissFlaggedDuplicate', () => {
  it('removes duplicate at given index', () => {
    const store = makeStore();
    const dups: FlaggedDuplicate[] = [
      {
        existingDish: { name: 'A' } as RawExtractedDish,
        incomingDish: { name: 'A' } as RawExtractedDish,
        categoryName: null,
      },
      {
        existingDish: { name: 'B' } as RawExtractedDish,
        incomingDish: { name: 'B' } as RawExtractedDish,
        categoryName: null,
      },
    ];
    store.setState({ flaggedDuplicates: dups });
    store.getState().dismissFlaggedDuplicate(0);
    expect(store.getState().flaggedDuplicates).toHaveLength(1);
    expect(store.getState().flaggedDuplicates[0].existingDish.name).toBe('B');
  });
});

// ---------------------------------------------------------------------------
// groupFlaggedDuplicate
// ---------------------------------------------------------------------------

describe('groupSlice — groupFlaggedDuplicate', () => {
  it('marks matching dish as parent and removes from flagged list', () => {
    const dish = makeDish({ name: 'Burger', price: '10' });
    const store = makeStoreWithDishes([dish]);
    const dup: FlaggedDuplicate = {
      existingDish: { name: 'Burger', price: 10 } as unknown as RawExtractedDish,
      incomingDish: { name: 'Burger' } as RawExtractedDish,
      categoryName: null,
    };
    store.setState({ flaggedDuplicates: [dup] });

    store.getState().groupFlaggedDuplicate(0);

    const dishes = store.getState().editableMenus[0].categories[0].dishes;
    expect(dishes[0].is_parent).toBe(true);
    expect(dishes[0].group_status).toBe('manual');
    expect(store.getState().flaggedDuplicates).toHaveLength(0);
  });

  it('is a no-op for out-of-range index', () => {
    const store = makeStore();
    store.setState({ flaggedDuplicates: [] });
    expect(() => store.getState().groupFlaggedDuplicate(5)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// acceptHighConfidence
// ---------------------------------------------------------------------------

describe('groupSlice — acceptHighConfidence', () => {
  it('accepts parent + child when parent meets threshold', () => {
    const parent = makeDish({ is_parent: true, confidence: 0.9 });
    const child = makeDish({ parent_id: parent._id, confidence: 0.9 });
    const store = makeStoreWithDishes([parent, child]);

    store.getState().acceptHighConfidence(0.8);

    const dishes = store.getState().editableMenus[0].categories[0].dishes;
    expect(dishes[0].group_status).toBe('accepted');
    expect(dishes[1].group_status).toBe('accepted');
  });

  it('does not accept parent below threshold', () => {
    const parent = makeDish({ is_parent: true, confidence: 0.5 });
    const store = makeStoreWithDishes([parent]);

    store.getState().acceptHighConfidence(0.8);

    const dishes = store.getState().editableMenus[0].categories[0].dishes;
    expect(dishes[0].group_status).toBe('ai_proposed');
  });

  it('skips already-reviewed groups', () => {
    const parent = makeDish({ is_parent: true, confidence: 0.9, group_status: 'accepted' });
    const store = makeStoreWithDishes([parent]);

    store.getState().acceptHighConfidence(0.8);

    // Still accepted, not double-counted
    const dishes = store.getState().editableMenus[0].categories[0].dishes;
    expect(dishes[0].group_status).toBe('accepted');
  });
});

// ---------------------------------------------------------------------------
// acceptSelected / rejectSelected
// ---------------------------------------------------------------------------

describe('groupSlice — acceptSelected / rejectSelected', () => {
  it('acceptSelected marks selected ids as accepted and clears selection', () => {
    const d1 = makeDish({ is_parent: true });
    const d2 = makeDish({ is_parent: true });
    const store = makeStoreWithDishes([d1, d2]);
    store.setState({ selectedGroupIds: new Set([d1._id]) });

    store.getState().acceptSelected();

    const dishes = store.getState().editableMenus[0].categories[0].dishes;
    expect(dishes[0].group_status).toBe('accepted');
    expect(dishes[1].group_status).toBe('ai_proposed');
    expect(store.getState().selectedGroupIds.size).toBe(0);
  });

  it('rejectSelected marks selected ids as rejected and clears selection', () => {
    const d1 = makeDish({ is_parent: true });
    const store = makeStoreWithDishes([d1]);
    store.setState({ selectedGroupIds: new Set([d1._id]) });

    store.getState().rejectSelected();

    const dishes = store.getState().editableMenus[0].categories[0].dishes;
    expect(dishes[0].group_status).toBe('rejected');
    expect(store.getState().selectedGroupIds.size).toBe(0);
  });
});
