import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useReviewStore } from '../../store';
import { DishEditPanelV2 } from '../DishEditPanelV2';
import { newEmptyDish } from '@/lib/menu-scan';

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
  }),
}));

vi.mock('@/lib/icons', () => ({
  getDietaryTagIcon: vi.fn().mockReturnValue('🌱'),
  getAllergenIcon: vi.fn().mockReturnValue('⚠'),
}));

vi.mock('@/lib/dish-categories', () => ({
  createDishCategory: vi.fn().mockResolvedValue({ data: null, error: null }),
}));

vi.mock('@/components/admin/InlineIngredientSearch', () => ({
  InlineIngredientSearch: () => <div data-testid="inline-ingredient-search" />,
}));

// Mock KindSelectorV2 to keep tests simple
vi.mock('../KindSelectorV2', () => ({
  KindSelectorV2: ({ currentKind }: { currentKind: string }) => (
    <div data-testid="kind-selector-v2" data-kind={currentKind} />
  ),
}));

// Mock VariantEditor
vi.mock('../VariantEditor', () => ({
  VariantEditor: () => <div data-testid="variant-editor" />,
}));

// Mock CourseEditor
vi.mock('../CourseEditor', () => ({
  CourseEditor: () => <div data-testid="course-editor" />,
}));

const baseStoreState = {
  dietaryTags: [],
  dishCategories: [],
  setDishCategories: vi.fn(),
  inlineSearchTarget: null,
  setInlineSearchTarget: vi.fn(),
  subIngredientEditTarget: null,
  setSubIngredientEditTarget: vi.fn(),
  setAddIngredientTarget: vi.fn(),
  updateDish: vi.fn(),
  addIngredientToDish: vi.fn(),
  removeIngredientFromDish: vi.fn(),
  addSubIngredient: vi.fn(),
  removeSubIngredient: vi.fn(),
  currency: 'USD',
  editableMenus: [{ name: 'Menu', menu_type: 'food', categories: [{ name: 'Cat', dishes: [] }] }],
};

describe('DishEditPanelV2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useReviewStore.setState(baseStoreState as never);
  });

  it('renders KindSelectorV2', () => {
    const dish = { ...newEmptyDish(), dish_kind: 'standard' as const };
    render(<DishEditPanelV2 dish={dish} mIdx={0} cIdx={0} dIdx={0} />);
    expect(screen.getByTestId('kind-selector-v2')).toBeInTheDocument();
  });

  it('renders price field for bundle (regression guard — price not hidden)', () => {
    const dish = {
      ...newEmptyDish(),
      dish_kind: 'bundle' as const,
      is_parent: true,
      price: '12.50',
    };
    render(<DishEditPanelV2 dish={dish} mIdx={0} cIdx={0} dIdx={0} />);
    const priceInput = screen.getByTestId('dish-price-input');
    expect(priceInput).toBeInTheDocument();
    expect(priceInput).toHaveValue(12.5);
  });

  it('renders price field for standard kind', () => {
    const dish = { ...newEmptyDish(), dish_kind: 'standard' as const };
    render(<DishEditPanelV2 dish={dish} mIdx={0} cIdx={0} dIdx={0} />);
    expect(screen.getByTestId('dish-price-input')).toBeInTheDocument();
  });

  it('shows "Total price (optional)" label for course_menu parent', () => {
    const dish = {
      ...newEmptyDish(),
      dish_kind: 'course_menu' as const,
      is_parent: true,
    };
    render(<DishEditPanelV2 dish={dish} mIdx={0} cIdx={0} dIdx={0} />);
    expect(screen.getByText('Total price (optional)')).toBeInTheDocument();
  });

  it('shows "Price" label for standard kind', () => {
    const dish = { ...newEmptyDish(), dish_kind: 'standard' as const };
    render(<DishEditPanelV2 dish={dish} mIdx={0} cIdx={0} dIdx={0} />);
    expect(screen.getByText('Price')).toBeInTheDocument();
  });

  it('renders VariantEditor when is_parent=true and kind=bundle', () => {
    const dish = {
      ...newEmptyDish(),
      dish_kind: 'bundle' as const,
      is_parent: true,
    };
    render(<DishEditPanelV2 dish={dish} mIdx={0} cIdx={0} dIdx={0} />);
    expect(screen.getByTestId('variant-editor')).toBeInTheDocument();
  });

  it('renders VariantEditor when is_parent=true and kind=configurable', () => {
    const dish = {
      ...newEmptyDish(),
      dish_kind: 'configurable' as const,
      is_parent: true,
    };
    render(<DishEditPanelV2 dish={dish} mIdx={0} cIdx={0} dIdx={0} />);
    expect(screen.getByTestId('variant-editor')).toBeInTheDocument();
  });

  it('does NOT render VariantEditor for course_menu (uses CourseEditor in Step 12)', () => {
    const dish = {
      ...newEmptyDish(),
      dish_kind: 'course_menu' as const,
      is_parent: true,
    };
    render(<DishEditPanelV2 dish={dish} mIdx={0} cIdx={0} dIdx={0} />);
    expect(screen.queryByTestId('variant-editor')).not.toBeInTheDocument();
  });

  it('does NOT render VariantEditor for non-parent standard dish', () => {
    const dish = { ...newEmptyDish(), dish_kind: 'standard' as const, is_parent: false };
    render(<DishEditPanelV2 dish={dish} mIdx={0} cIdx={0} dIdx={0} />);
    expect(screen.queryByTestId('variant-editor')).not.toBeInTheDocument();
  });

  it('renders CourseEditor for course_menu parent', () => {
    const dish = {
      ...newEmptyDish(),
      dish_kind: 'course_menu' as const,
      is_parent: true,
    };
    render(<DishEditPanelV2 dish={dish} mIdx={0} cIdx={0} dIdx={0} />);
    expect(screen.getByTestId('course-editor')).toBeInTheDocument();
  });

  it('does NOT render CourseEditor for non-course_menu kinds', () => {
    const dish = { ...newEmptyDish(), dish_kind: 'standard' as const, is_parent: false };
    render(<DishEditPanelV2 dish={dish} mIdx={0} cIdx={0} dIdx={0} />);
    expect(screen.queryByTestId('course-editor')).not.toBeInTheDocument();
  });
});
