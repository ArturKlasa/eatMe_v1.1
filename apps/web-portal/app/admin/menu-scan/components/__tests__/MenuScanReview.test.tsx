import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useReviewStore } from '../../store';
import { MenuScanReview } from '../MenuScanReview';
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
    warning: vi.fn(),
    info: vi.fn(),
  }),
}));

vi.mock('@/components/admin/AddIngredientPanel', () => ({
  AddIngredientPanel: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="add-ingredient-panel">
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

vi.mock('@/components/admin/InlineIngredientSearch', () => ({
  InlineIngredientSearch: () => <div data-testid="inline-ingredient-search" />,
}));

vi.mock('@/components/admin/menu-scan/DishGroupCard', () => ({
  DishGroupCard: () => <div data-testid="dish-group-card" />,
}));

vi.mock('@/components/admin/menu-scan/BatchToolbar', () => ({
  BatchToolbar: () => <div data-testid="batch-toolbar" />,
}));

vi.mock('@/components/admin/menu-scan/FlaggedDuplicateCard', () => ({
  FlaggedDuplicateCard: () => <div data-testid="flagged-duplicate-card" />,
}));

vi.mock('@/lib/icons', () => ({
  getDietaryTagIcon: vi.fn().mockReturnValue('🌱'),
  getAllergenIcon: vi.fn().mockReturnValue('⚠'),
}));

vi.mock('@/lib/dish-categories', () => ({
  createDishCategory: vi.fn().mockResolvedValue({ data: null, error: null }),
  fetchDishCategories: vi.fn().mockResolvedValue({ data: [] }),
}));

vi.mock('next/dynamic', () => ({
  default: (_fn: unknown) => {
    const Component = () => <div data-testid="dynamic-component" />;
    Component.displayName = 'DynamicComponent';
    return Component;
  },
}));

describe('MenuScanReview', () => {
  beforeEach(() => {
    useReviewStore.setState({
      editableMenus: [
        {
          name: 'Test Menu',
          menu_type: 'food',
          categories: [
            {
              name: 'Test Cat',
              dishes: [newEmptyDish(), newEmptyDish()],
            },
          ],
        },
      ],
      selectedRestaurant: { id: '1', name: 'Test Restaurant', city: null, country_code: null },
      currency: 'USD',
      saving: false,
      imageFiles: [],
      previewUrls: [],
      lightboxOpen: false,
      extractionNotes: [],
      addIngredientTarget: null,
    });
  });

  it('renders ReviewHeader with correct dish count', () => {
    render(<MenuScanReview jobId="test-job" />);
    const matches = screen.getAllByText(/2 dish/i);
    expect(matches.length).toBeGreaterThan(0);
  });
});
