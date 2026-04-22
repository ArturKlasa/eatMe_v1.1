import { describe, it, expect, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';
import {
  selectFlaggedDishes,
  selectDishesByImageIndex,
  selectConfirmSummary,
  selectTotalDishCount,
  selectParentGroups,
} from '../selectors';
import { createReviewSlice, ReviewSlice } from '../reviewSlice';
import { createGroupSlice, GroupSlice } from '../groupSlice';
import { newEmptyDish } from '@/lib/menu-scan';
import type { EditableDish, EditableMenu } from '@/lib/menu-scan';

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
  return { ...newEmptyDish(), ...overrides };
}

function makeMenu(dishes: EditableDish[]): EditableMenu {
  return { name: 'Menu', menu_type: 'food', categories: [{ name: 'Cat', dishes }] };
}

const THRESHOLD = 0.7; // matches CONFIDENCE_THRESHOLD default

// ---------------------------------------------------------------------------
// selectFlaggedDishes
// ---------------------------------------------------------------------------

describe('selectFlaggedDishes', () => {
  it('returns dishes below threshold with ai_proposed status', () => {
    const low = makeDish({ confidence: 0.5, group_status: 'ai_proposed' });
    const high = makeDish({ confidence: 0.9, group_status: 'ai_proposed' });
    const touched = makeDish({ confidence: 0.4, group_status: 'accepted' });

    const store = makeStore();
    store.setState({ editableMenus: [makeMenu([low, high, touched])] });

    const result = selectFlaggedDishes(store.getState());
    expect(result).toHaveLength(1);
    expect(result[0]._id).toBe(low._id);
  });

  it('returns empty array when all dishes are above threshold', () => {
    const store = makeStore();
    store.setState({
      editableMenus: [makeMenu([makeDish({ confidence: 0.8 }), makeDish({ confidence: 1.0 })])],
    });
    expect(selectFlaggedDishes(store.getState())).toHaveLength(0);
  });

  it('returns empty array when store has no dishes', () => {
    const store = makeStore();
    expect(selectFlaggedDishes(store.getState())).toHaveLength(0);
  });

  it('excludes low-confidence dishes that have been touched (non ai_proposed)', () => {
    const rejected = makeDish({ confidence: 0.3, group_status: 'rejected' });
    const manual = makeDish({ confidence: 0.2, group_status: 'manual' });
    const store = makeStore();
    store.setState({ editableMenus: [makeMenu([rejected, manual])] });
    expect(selectFlaggedDishes(store.getState())).toHaveLength(0);
  });

  it('treats dishes at exactly THRESHOLD as not flagged', () => {
    const atThreshold = makeDish({ confidence: THRESHOLD, group_status: 'ai_proposed' });
    const store = makeStore();
    store.setState({ editableMenus: [makeMenu([atThreshold])] });
    expect(selectFlaggedDishes(store.getState())).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// selectDishesByImageIndex
// ---------------------------------------------------------------------------

describe('selectDishesByImageIndex', () => {
  it('groups dishes by source_image_index', () => {
    const d1 = makeDish({ source_image_index: 0 });
    const d2 = makeDish({ source_image_index: 0 });
    const d3 = makeDish({ source_image_index: 1 });
    const d4 = makeDish({ source_image_index: 2 });

    const store = makeStore();
    store.setState({ editableMenus: [makeMenu([d1, d2, d3, d4])] });

    const result = selectDishesByImageIndex(store.getState());
    expect(result.get(0)).toHaveLength(2);
    expect(result.get(1)).toHaveLength(1);
    expect(result.get(2)).toHaveLength(1);
  });

  it('defaults to index 0 when source_image_index is undefined', () => {
    const d = makeDish(); // source_image_index not set
    const store = makeStore();
    store.setState({ editableMenus: [makeMenu([d])] });

    const result = selectDishesByImageIndex(store.getState());
    expect(result.get(0)).toHaveLength(1);
  });

  it('returns empty map when no dishes', () => {
    const store = makeStore();
    const result = selectDishesByImageIndex(store.getState());
    expect(result.size).toBe(0);
  });

  it('preserves dish order within each group', () => {
    const d1 = makeDish({ source_image_index: 0 });
    const d2 = makeDish({ source_image_index: 0 });
    const store = makeStore();
    store.setState({ editableMenus: [makeMenu([d1, d2])] });

    const group = selectDishesByImageIndex(store.getState()).get(0)!;
    expect(group[0]._id).toBe(d1._id);
    expect(group[1]._id).toBe(d2._id);
  });
});

// ---------------------------------------------------------------------------
// selectConfirmSummary
// ---------------------------------------------------------------------------

describe('selectConfirmSummary', () => {
  it('returns correct insertCount (excludes rejected dishes)', () => {
    const d1 = makeDish({ group_status: 'accepted' });
    const d2 = makeDish({ group_status: 'rejected' });
    const d3 = makeDish({ group_status: 'ai_proposed' });
    const store = makeStore();
    store.setState({ editableMenus: [makeMenu([d1, d2, d3])] });

    const summary = selectConfirmSummary(store.getState());
    expect(summary.insertCount).toBe(2); // d2 is rejected, excluded
  });

  it('returns updateCount as 0', () => {
    const store = makeStore();
    expect(selectConfirmSummary(store.getState()).updateCount).toBe(0);
  });

  it('correctly counts acceptedFlaggedCount and untouchedFlaggedCount', () => {
    const untouched = makeDish({ confidence: 0.5, group_status: 'ai_proposed' });
    const touched = makeDish({ confidence: 0.3, group_status: 'accepted' });
    const normal = makeDish({ confidence: 0.9, group_status: 'ai_proposed' });
    const store = makeStore();
    store.setState({ editableMenus: [makeMenu([untouched, touched, normal])] });

    const summary = selectConfirmSummary(store.getState());
    expect(summary.untouchedFlaggedCount).toBe(1);
    expect(summary.acceptedFlaggedCount).toBe(1);
  });

  it('returns all zeros when store is empty', () => {
    const store = makeStore();
    const summary = selectConfirmSummary(store.getState());
    expect(summary.insertCount).toBe(0);
    expect(summary.updateCount).toBe(0);
    expect(summary.acceptedFlaggedCount).toBe(0);
    expect(summary.untouchedFlaggedCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// selectTotalDishCount
// ---------------------------------------------------------------------------

describe('selectTotalDishCount', () => {
  it('counts all non-rejected dishes', () => {
    const d1 = makeDish({ group_status: 'accepted' });
    const d2 = makeDish({ group_status: 'rejected' });
    const d3 = makeDish();
    const store = makeStore();
    store.setState({ editableMenus: [makeMenu([d1, d2, d3])] });

    expect(selectTotalDishCount(store.getState())).toBe(2);
  });

  it('returns 0 for empty store', () => {
    const store = makeStore();
    expect(selectTotalDishCount(store.getState())).toBe(0);
  });

  it('counts across multiple menus and categories', () => {
    const store = makeStore();
    store.setState({
      editableMenus: [
        {
          name: 'Food',
          menu_type: 'food',
          categories: [
            { name: 'A', dishes: [makeDish(), makeDish()] },
            { name: 'B', dishes: [makeDish()] },
          ],
        },
        {
          name: 'Drinks',
          menu_type: 'drink',
          categories: [{ name: 'C', dishes: [makeDish(), makeDish(), makeDish()] }],
        },
      ],
    });
    expect(selectTotalDishCount(store.getState())).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// selectParentGroups
// ---------------------------------------------------------------------------

describe('selectParentGroups', () => {
  it('returns parent groups with their children', () => {
    const child = makeDish();
    const parent = makeDish({ is_parent: true });
    child.parent_id = parent._id;
    const lone = makeDish(); // non-parent, non-child

    const store = makeStore();
    store.setState({ editableMenus: [makeMenu([parent, child, lone])] });

    const groups = selectParentGroups(store.getState());
    expect(groups).toHaveLength(1);
    expect(groups[0].parent._id).toBe(parent._id);
    expect(groups[0].children).toHaveLength(1);
    expect(groups[0].children[0]._id).toBe(child._id);
  });

  it('returns empty array when no parents', () => {
    const store = makeStore();
    store.setState({ editableMenus: [makeMenu([makeDish(), makeDish()])] });
    expect(selectParentGroups(store.getState())).toHaveLength(0);
  });
});
