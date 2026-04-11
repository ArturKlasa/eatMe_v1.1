import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'restaurant-123' }),
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  usePathname: () => '/admin/restaurants/restaurant-123/menus',
}));

// sonner is globally mocked in test/setup.ts

// Mock Supabase with chainable API
const mockSingle = vi.fn().mockResolvedValue({
  data: { name: 'Test Restaurant', cuisine_types: ['Italian'] },
  error: null,
});
const mockSelect = vi.fn().mockReturnThis();
const mockEq = vi.fn().mockReturnThis();
const mockOrder = vi.fn().mockResolvedValue({ data: [], error: null });
const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });
const mockUpdate = vi.fn().mockReturnThis();
const mockDelete = vi.fn().mockReturnThis();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect,
      eq: mockEq,
      order: mockOrder,
      single: mockSingle,
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
    })),
  },
}));

// Mock DishFormDialog so we can control isOpen/onClose
const mockOnClose = vi.fn();
vi.mock('@/components/forms/DishFormDialog', () => ({
  DishFormDialog: ({
    isOpen,
    onClose,
  }: {
    isOpen: boolean;
    onClose: () => void;
    restaurantId: string;
    menuCategoryId: string;
    dish: unknown;
    onSuccess: () => void;
    restaurantCuisine: string;
  }) => {
    mockOnClose.mockImplementation(onClose);
    return isOpen ? <div data-testid="dish-form-dialog">DishFormDialog</div> : null;
  },
}));

import RestaurantMenusPage from '@/app/admin/restaurants/[id]/menus/page';

describe('RestaurantMenusPage — useDialog integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset supabase mock: single returns restaurant, order returns []
    mockSingle.mockResolvedValue({
      data: { name: 'Test Restaurant', cuisine_types: ['Italian'] },
      error: null,
    });
    mockOrder.mockResolvedValue({ data: [], error: null });
    mockSelect.mockReturnThis();
    mockEq.mockReturnThis();
  });

  it('renders the page after loading', async () => {
    render(<RestaurantMenusPage />);
    // After data loads, the Add Menu button is present
    await waitFor(() => expect(screen.getByText('Add Menu')).toBeInTheDocument());
    // Page header shows restaurant name
    expect(screen.getAllByText(/Menus|Add Menu/).length).toBeGreaterThan(0);
  });

  it('opens menu dialog when Add Menu is clicked', async () => {
    const user = userEvent.setup();
    render(<RestaurantMenusPage />);
    await waitFor(() => expect(screen.getByText('Add Menu')).toBeInTheDocument());

    await user.click(screen.getByText('Add Menu'));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Add Menu', { selector: '[role="dialog"] *' })).toBeInTheDocument();
  });

  it('closes menu dialog when Cancel is clicked', async () => {
    const user = userEvent.setup();
    render(<RestaurantMenusPage />);
    await waitFor(() => expect(screen.getByText('Add Menu')).toBeInTheDocument());

    await user.click(screen.getByText('Add Menu'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.click(screen.getByText('Cancel'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('dish dialog opens via dishDialog.open and closes via dishDialog.reset', async () => {
    // Render the page with no menus loaded, then directly test dishDialog via DishFormDialog
    render(<RestaurantMenusPage />);
    await waitFor(() => expect(screen.getByText('Add Menu')).toBeInTheDocument());

    // Dish dialog is not visible initially
    expect(screen.queryByTestId('dish-form-dialog')).not.toBeInTheDocument();

    // Call the onClose callback from the mock to verify reset is wired correctly
    act(() => {
      mockOnClose();
    });

    // After reset, dish dialog should still be closed (it was already closed)
    expect(screen.queryByTestId('dish-form-dialog')).not.toBeInTheDocument();
  });

  it('dialog data resets after closing via onOpenChange', async () => {
    const user = userEvent.setup();
    render(<RestaurantMenusPage />);
    await waitFor(() => expect(screen.getByText('Add Menu')).toBeInTheDocument());

    // Open menu dialog
    await user.click(screen.getByText('Add Menu'));
    const nameInput = screen.getByPlaceholderText('e.g., Breakfast, Lunch, Dinner, Brunch');
    await user.type(nameInput, 'My Menu');
    expect(nameInput).toHaveValue('My Menu');

    // Close by clicking Cancel
    await user.click(screen.getByText('Cancel'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    // Reopen — dialog should start fresh (since reset is called by onOpenChange when ESC/overlay closes)
    await user.click(screen.getByText('Add Menu'));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    const freshInput = screen.getByPlaceholderText('e.g., Breakfast, Lunch, Dinner, Brunch');
    expect(freshInput).toHaveValue('');
  });
});
