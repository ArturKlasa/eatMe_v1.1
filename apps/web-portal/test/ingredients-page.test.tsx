import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// sonner is globally mocked in test/setup.ts

// Mock ui-constants — use semantic tokens to avoid the no-hardcoded-colors CI check
vi.mock('@/lib/ui-constants', () => ({
  INGREDIENT_FAMILY_COLORS: {
    other: { bg: 'bg-muted', text: 'text-muted-foreground' },
    vegetables: { bg: 'bg-success/10', text: 'text-success' },
    meat: { bg: 'bg-destructive/10', text: 'text-destructive' },
  },
}));

// Build canonical ingredients for testing
const canonicalIngredients = Array.from({ length: 30 }, (_, i) => ({
  id: `canonical-${i}`,
  canonical_name: `ingredient_${String.fromCharCode(97 + (i % 26))}_${i}`,
  ingredient_family_name: 'other',
  is_vegetarian: true,
  is_vegan: false,
  created_at: null,
}));

// Build aliases for testing
const aliases = [
  {
    id: 'alias-1',
    display_name: 'Ground Beef',
    canonical_ingredient_id: 'canonical-0',
    canonical_ingredient: { canonical_name: 'beef', ingredient_family_name: 'meat' },
    created_at: null,
  },
  {
    id: 'alias-2',
    display_name: 'Roma Tomato',
    canonical_ingredient_id: 'canonical-1',
    canonical_ingredient: { canonical_name: 'tomato', ingredient_family_name: 'vegetables' },
    created_at: null,
  },
  {
    id: 'alias-3',
    display_name: 'Cherry Tomato',
    canonical_ingredient_id: 'canonical-1',
    canonical_ingredient: { canonical_name: 'tomato', ingredient_family_name: 'vegetables' },
    created_at: null,
  },
];

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'canonical_ingredients') {
        return {
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: canonicalIngredients, error: null }),
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
          delete: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      if (table === 'ingredient_aliases') {
        return {
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: aliases, error: null }),
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
          delete: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
    }),
  },
}));

import IngredientsPage from '@/app/admin/ingredients/page';

describe('IngredientsPage — useDialog + usePagination + useFilters integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the page and shows alias tab by default', async () => {
    render(<IngredientsPage />);
    await waitFor(() => expect(screen.getByText('Ingredients')).toBeInTheDocument());
    // Default tab is aliases
    expect(screen.getByText('Ground Beef')).toBeInTheDocument();
    expect(screen.getByText('Roma Tomato')).toBeInTheDocument();
  });

  it('filters aliases by search query', async () => {
    const user = userEvent.setup();
    render(<IngredientsPage />);
    await waitFor(() => expect(screen.getByText('Ground Beef')).toBeInTheDocument());

    const searchInput = screen.getByPlaceholderText('Search...');
    await user.type(searchInput, 'tomato');

    // Only tomato aliases should show
    expect(screen.queryByText('Ground Beef')).not.toBeInTheDocument();
    expect(screen.getByText('Roma Tomato')).toBeInTheDocument();
    expect(screen.getByText('Cherry Tomato')).toBeInTheDocument();
  });

  it('filters aliases by canonical ingredient name', async () => {
    const user = userEvent.setup();
    render(<IngredientsPage />);
    await waitFor(() => expect(screen.getByText('Ground Beef')).toBeInTheDocument());

    const searchInput = screen.getByPlaceholderText('Search...');
    await user.type(searchInput, 'beef');

    // Ground Beef maps to canonical "beef"
    expect(screen.getByText('Ground Beef')).toBeInTheDocument();
    expect(screen.queryByText('Roma Tomato')).not.toBeInTheDocument();
  });

  it('switches to canonical tab and shows paginated canonical ingredients', async () => {
    const user = userEvent.setup();
    render(<IngredientsPage />);
    await waitFor(() => expect(screen.getByText('Canonical Ingredients (30)')).toBeInTheDocument());

    await user.click(screen.getByText('Canonical Ingredients (30)'));

    // Should show first 25 items (pagination)
    await waitFor(() => {
      // At least one canonical ingredient should be visible
      expect(screen.getByText('ingredient_a_0')).toBeInTheDocument();
    });

    // Pagination should show since 30 > 25
    expect(screen.getByText(/1–25 of 30/)).toBeInTheDocument();
  });

  it('navigates to next page of canonical ingredients', async () => {
    const user = userEvent.setup();
    render(<IngredientsPage />);
    await waitFor(() => expect(screen.getByText('Canonical Ingredients (30)')).toBeInTheDocument());

    await user.click(screen.getByText('Canonical Ingredients (30)'));

    await waitFor(() => expect(screen.getByText(/1–25 of 30/)).toBeInTheDocument());

    // Click page 2
    const page2Link = screen.getByText('2');
    await user.click(page2Link);

    // Should now show items 26-30
    expect(screen.getByText(/26–30 of 30/)).toBeInTheDocument();
  });

  it('resets to page 1 when search changes', async () => {
    const user = userEvent.setup();
    render(<IngredientsPage />);
    await waitFor(() => expect(screen.getByText('Canonical Ingredients (30)')).toBeInTheDocument());

    await user.click(screen.getByText('Canonical Ingredients (30)'));

    // Navigate to page 2
    await waitFor(() => expect(screen.getByText(/1–25 of 30/)).toBeInTheDocument());
    await user.click(screen.getByText('2'));
    expect(screen.getByText(/26–30 of 30/)).toBeInTheDocument();

    // Search filters results to fewer items — pagination resets to page 1
    const searchInput = screen.getByPlaceholderText('Search...');
    await user.type(searchInput, 'ingredient_a_0');

    await waitFor(() => {
      // Only one result matches, pagination shows 1–1 of 1 (no pagination control)
      expect(screen.queryByText(/26–30/)).not.toBeInTheDocument();
    });
  });

  it('opens canonical dialog when Add Canonical is clicked', async () => {
    const user = userEvent.setup();
    render(<IngredientsPage />);
    await waitFor(() => expect(screen.getByText('Canonical Ingredients (30)')).toBeInTheDocument());

    await user.click(screen.getByText('Canonical Ingredients (30)'));
    await user.click(screen.getByText('+ Add Canonical'));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Add Canonical Ingredient')).toBeInTheDocument();
  });

  it('opens alias dialog when Add Alias is clicked', async () => {
    const user = userEvent.setup();
    render(<IngredientsPage />);
    await waitFor(() => expect(screen.getByText('Ground Beef')).toBeInTheDocument());

    await user.click(screen.getByText('+ Add Alias'));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Add Display Name (Alias)')).toBeInTheDocument();
  });

  it('closes canonical dialog when Cancel is clicked', async () => {
    const user = userEvent.setup();
    render(<IngredientsPage />);
    await waitFor(() => expect(screen.getByText('Canonical Ingredients (30)')).toBeInTheDocument());

    await user.click(screen.getByText('Canonical Ingredients (30)'));
    await user.click(screen.getByText('+ Add Canonical'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.click(screen.getByText('Cancel'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
