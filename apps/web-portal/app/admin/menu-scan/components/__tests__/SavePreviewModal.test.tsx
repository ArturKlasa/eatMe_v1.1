import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useReviewStore } from '../../store';
import { SavePreviewModal } from '../SavePreviewModal';
import type { EditableDish, EditableMenu } from '@/lib/menu-scan';

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
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), warning: vi.fn() }),
}));

vi.mock('@/lib/menuScanConfig', () => ({ CONFIDENCE_THRESHOLD: 0.7 }));

// Mock Dialog to render children directly (jsdom doesn't handle Radix portals).
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({
    open,
    children,
  }: {
    open: boolean;
    onOpenChange?: () => void;
    children: React.ReactNode;
  }) => (open ? <div data-testid="dialog">{children}</div> : null),
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

function makeDish(overrides: Partial<EditableDish> = {}, index = 0): EditableDish {
  return {
    _id: `dish-${index}`,
    name: `Dish ${index}`,
    description: '',
    price: '100',
    dietary_tags: [],
    spice_level: null,
    calories: null,
    dish_category_id: null,
    confidence: 0.9,
    ingredients: [],
    dish_kind: 'standard',
    is_parent: false,
    serves: null,
    display_price_prefix: 'exact',
    variant_ids: [],
    primary_protein: null,
    parent_id: null,
    group_status: 'ai_proposed',
    source_image_index: 0,
    ...overrides,
  };
}

function makeMenuWithDishes(dishes: Partial<EditableDish>[]): EditableMenu[] {
  return [
    {
      name: 'Menu',
      menu_type: 'food',
      categories: [
        {
          name: 'Mains',
          dishes: dishes.map((d, i) => makeDish(d, i)),
        },
      ],
    },
  ];
}

describe('SavePreviewModal', () => {
  const mockHandleSave = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useReviewStore.setState({
      handleSave: mockHandleSave,
      saving: false,
      editableMenus: makeMenuWithDishes([{ confidence: 0.9 }, { confidence: 0.9 }]),
    } as never);
  });

  it('renders nothing when closed', () => {
    render(<SavePreviewModal open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
  });

  it('renders the dialog when open', () => {
    render(<SavePreviewModal open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByTestId('dialog')).toBeInTheDocument();
  });

  it('shows insert count from selectConfirmSummary', () => {
    render(<SavePreviewModal open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByTestId('insert-count').textContent).toBe('2');
  });

  it('does not show flagged warning when all dishes are high-confidence', () => {
    render(<SavePreviewModal open={true} onOpenChange={vi.fn()} />);
    expect(screen.queryByTestId('untouched-flagged-warning')).not.toBeInTheDocument();
  });

  it('shows flagged warning when low-confidence ai_proposed dishes exist', () => {
    useReviewStore.setState({
      editableMenus: makeMenuWithDishes([
        { confidence: 0.5, group_status: 'ai_proposed' },
        { confidence: 0.9 },
      ]),
    } as never);
    render(<SavePreviewModal open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByTestId('untouched-flagged-warning')).toBeInTheDocument();
  });

  it('confirm button is disabled when flagged dishes exist and save-anyway is unchecked', () => {
    useReviewStore.setState({
      editableMenus: makeMenuWithDishes([{ confidence: 0.5, group_status: 'ai_proposed' }]),
    } as never);
    render(<SavePreviewModal open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByTestId('confirm-save-button')).toBeDisabled();
  });

  it('confirm button becomes enabled after checking save-anyway', () => {
    useReviewStore.setState({
      editableMenus: makeMenuWithDishes([{ confidence: 0.5, group_status: 'ai_proposed' }]),
    } as never);
    render(<SavePreviewModal open={true} onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByTestId('save-anyway-checkbox'));
    expect(screen.getByTestId('confirm-save-button')).not.toBeDisabled();
  });

  it('clicking confirm calls handleSave', async () => {
    render(<SavePreviewModal open={true} onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByTestId('confirm-save-button'));
    expect(mockHandleSave).toHaveBeenCalled();
  });
});
