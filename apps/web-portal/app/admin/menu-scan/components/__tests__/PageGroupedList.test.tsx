import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useReviewStore } from '../../store';
import { PageGroupedList } from '../PageGroupedList';
import { newEmptyDish } from '@/lib/menu-scan';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      then: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
  },
  formatLocationForSupabase: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  }),
}));

vi.mock('@/components/admin/menu-scan/DishGroupCard', () => ({
  DishGroupCard: () => <div data-testid="dish-group-card" />,
}));

vi.mock('@/components/admin/menu-scan/BatchToolbar', () => ({
  BatchToolbar: () => <div data-testid="batch-toolbar" />,
}));

vi.mock('../FlaggedDuplicatePanel', () => ({
  FlaggedDuplicatePanel: () => <div data-testid="flagged-duplicate-panel" />,
}));

vi.mock('@/components/admin/InlineIngredientSearch', () => ({
  InlineIngredientSearch: () => <div data-testid="inline-ingredient-search" />,
}));

vi.mock('@/lib/icons', () => ({
  getDietaryTagIcon: vi.fn().mockReturnValue('🌱'),
  getAllergenIcon: vi.fn().mockReturnValue('⚠'),
}));

vi.mock('@/lib/dish-categories', () => ({
  createDishCategory: vi.fn().mockResolvedValue({ data: null, error: null }),
  fetchDishCategories: vi.fn().mockResolvedValue({ data: [] }),
}));

vi.mock('../KindSelectorV2', () => ({
  KindSelectorV2: ({ currentKind }: { currentKind: string }) => (
    <div data-testid="kind-selector-v2" data-kind={currentKind} />
  ),
}));

vi.mock('../VariantEditor', () => ({
  VariantEditor: () => <div data-testid="variant-editor" />,
}));

vi.mock('../CourseEditor', () => ({
  CourseEditor: () => <div data-testid="course-editor" />,
}));

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  closestCenter: {},
  PointerSensor: class {},
  useSensor: () => ({}),
  useSensors: () => [],
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
  verticalListSortingStrategy: {},
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => undefined } },
}));

vi.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CollapsibleTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CollapsibleContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDishOnPage(pageIdx: number, name: string) {
  return { ...newEmptyDish(), name, source_image_index: pageIdx };
}

const BASE_STATE = {
  currency: 'USD',
  saving: false,
  previewUrls: ['blob:page1', 'blob:page2', 'blob:page3'],
  expandedDishes: new Set<string>(),
  flaggedDuplicates: [],
  selectedGroupIds: new Set<string>(),
  batchFilters: { confidenceMin: null, dishKind: null, hasGrouping: null },
  isSuggestingAll: false,
  suggestAllProgress: null,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PageGroupedList', () => {
  beforeEach(() => {
    useReviewStore.setState({
      ...BASE_STATE,
      editableMenus: [
        {
          name: 'Test Menu',
          menu_type: 'food',
          categories: [
            {
              name: 'Cat',
              dishes: [
                makeDishOnPage(0, 'Dish A'),
                makeDishOnPage(0, 'Dish B'),
                makeDishOnPage(1, 'Dish C'),
              ],
            },
          ],
        },
      ],
    } as never);
  });

  it('renders the correct number of page group headers', () => {
    render(<PageGroupedList />);
    const headers = screen.getAllByTestId('page-group-header');
    expect(headers).toHaveLength(2);
  });

  it('shows "Page 1" and "Page 2" labels', () => {
    render(<PageGroupedList />);
    expect(screen.getByText('Page 1')).toBeInTheDocument();
    expect(screen.getByText('Page 2')).toBeInTheDocument();
  });

  it('shows correct dish count per page group', () => {
    render(<PageGroupedList />);
    expect(screen.getByText('2 dishes')).toBeInTheDocument();
    expect(screen.getByText('1 dish')).toBeInTheDocument();
  });

  it('clicking a page chip dispatches setCurrentImageIdx with the correct page index', () => {
    const setCurrentImageIdx = vi.fn();
    useReviewStore.setState({ setCurrentImageIdx } as never);
    render(<PageGroupedList />);

    const chips = screen.getAllByTestId('page-chip');
    // First chip belongs to Page 1 (index 0)
    fireEvent.click(chips[0]);
    expect(setCurrentImageIdx).toHaveBeenCalledWith(0);
  });

  it('clicking a page chip on Page 2 dispatches setCurrentImageIdx(1)', () => {
    const setCurrentImageIdx = vi.fn();
    useReviewStore.setState({ setCurrentImageIdx } as never);
    render(<PageGroupedList />);

    const chips = screen.getAllByTestId('page-chip');
    // Last chip belongs to Page 2 (index 1) — Dish C
    fireEvent.click(chips[chips.length - 1]);
    expect(setCurrentImageIdx).toHaveBeenCalledWith(1);
  });

  it('clicking "View ↗" in a group header dispatches setCurrentImageIdx', () => {
    const setCurrentImageIdx = vi.fn();
    useReviewStore.setState({ setCurrentImageIdx } as never);
    render(<PageGroupedList />);

    const viewButtons = screen.getAllByText('View ↗');
    fireEvent.click(viewButtons[1]); // Page 2 header
    expect(setCurrentImageIdx).toHaveBeenCalledWith(1);
  });

  it('shows the total dish count in the save bar', () => {
    render(<PageGroupedList />);
    expect(screen.getByText('3 dishes')).toBeInTheDocument();
  });

  it('renders a single group when all dishes have the same source_image_index', () => {
    useReviewStore.setState({
      ...BASE_STATE,
      editableMenus: [
        {
          name: 'Menu',
          menu_type: 'food',
          categories: [
            {
              name: 'Cat',
              dishes: [makeDishOnPage(0, 'X'), makeDishOnPage(0, 'Y'), makeDishOnPage(0, 'Z')],
            },
          ],
        },
      ],
    } as never);
    render(<PageGroupedList />);
    const headers = screen.getAllByTestId('page-group-header');
    expect(headers).toHaveLength(1);
    // "3 dishes" appears in both the toolbar ("3 dishes extracted") and the group header
    expect(screen.getAllByText(/3 dishes/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders empty state when no menus exist', () => {
    useReviewStore.setState({ ...BASE_STATE, editableMenus: [] } as never);
    render(<PageGroupedList />);
    expect(screen.getByText('No dishes extracted')).toBeInTheDocument();
  });
});
