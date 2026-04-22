import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useReviewStore } from '../../store';
import { ReviewHeader } from '../ReviewHeader';
import { newEmptyDish } from '@/lib/menu-scan';
import type { EditableMenu } from '@/lib/menu-scan';

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

vi.mock('@/lib/menu-scan-utils', () => ({
  pdfToImages: vi.fn().mockResolvedValue([]),
  resizeImageToBase64: vi.fn().mockResolvedValue('data:image/jpeg;base64,test'),
}));

// DropdownMenu uses Radix portals; mock to render children inline.
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => (
    <div>{children}</div>
  ),
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="shortcuts-dropdown">{children}</div>
  ),
}));

vi.stubGlobal(
  'requestAnimationFrame',
  vi.fn((cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  })
);

function makeDishNoPrice(): ReturnType<typeof newEmptyDish> {
  return {
    ...newEmptyDish(),
    _id: 'dish-no-price',
    name: 'Unnamed Dish',
    price: '',
    display_price_prefix: 'exact' as const,
    confidence: 0.9,
  };
}

function makeMenus(dishes: ReturnType<typeof newEmptyDish>[]): EditableMenu[] {
  return [{ name: 'Menu', menu_type: 'food', categories: [{ name: 'Mains', dishes }] }];
}

describe('ReviewHeader', () => {
  const mockOnOpenSaveModal = vi.fn();
  const mockSetExpandedDishes = vi.fn();
  const mockSetStep = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useReviewStore.setState({
      selectedRestaurant: { id: '1', name: 'Test Resto', city: null, country_code: null },
      currency: 'USD',
      editableMenus: makeMenus([makeDishNoPrice()]),
      imageFiles: [],
      saving: false,
      extractionNotes: [],
      setStep: mockSetStep,
      setExpandedDishes: mockSetExpandedDishes,
    } as never);
  });

  it('renders the restaurant name', () => {
    render(<ReviewHeader onOpenSaveModal={mockOnOpenSaveModal} />);
    expect(screen.getByText(/Test Resto/)).toBeInTheDocument();
  });

  it('Save button calls onOpenSaveModal', () => {
    render(<ReviewHeader onOpenSaveModal={mockOnOpenSaveModal} />);
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(mockOnOpenSaveModal).toHaveBeenCalled();
  });

  it('renders warning banner when warnings exist', () => {
    // makeDishNoPrice produces a "Dish has no price" error warning
    render(<ReviewHeader onOpenSaveModal={mockOnOpenSaveModal} />);
    // Show the warnings panel
    fireEvent.click(screen.getByText(/error/i));
    expect(screen.getAllByTestId('warning-row').length).toBeGreaterThan(0);
  });

  it('clicking a dish warning with dishId calls setExpandedDishes', () => {
    render(<ReviewHeader onOpenSaveModal={mockOnOpenSaveModal} />);
    fireEvent.click(screen.getByText(/error/i));
    const rows = screen.getAllByTestId('warning-row');
    const dishRow = rows.find(r => r.getAttribute('data-dish-id-target') === 'dish-no-price');
    expect(dishRow).toBeDefined();
    fireEvent.click(dishRow!);
    expect(mockSetExpandedDishes).toHaveBeenCalled();
  });

  it('warning rows without dishId are not clickable', () => {
    // Add a category-level warning (no dishId) by having an unnamed category
    useReviewStore.setState({
      editableMenus: [
        {
          name: 'Menu',
          menu_type: 'food',
          categories: [{ name: '', dishes: [] }],
        },
      ],
    } as never);
    render(<ReviewHeader onOpenSaveModal={mockOnOpenSaveModal} />);
    fireEvent.click(screen.getByText(/warning/i));
    const rows = screen.getAllByTestId('warning-row');
    const nonClickable = rows.find(r => !r.getAttribute('data-dish-id-target'));
    expect(nonClickable).toBeDefined();
    // Should have no role="button"
    expect(nonClickable!.getAttribute('role')).toBeNull();
  });

  it('keyboard shortcut help renders the shortcuts dropdown', () => {
    render(<ReviewHeader onOpenSaveModal={mockOnOpenSaveModal} />);
    expect(screen.getByTestId('shortcuts-dropdown')).toBeInTheDocument();
  });
});
