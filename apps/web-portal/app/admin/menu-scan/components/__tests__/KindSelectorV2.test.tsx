import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useReviewStore } from '../../store';
import { KindSelectorV2 } from '../KindSelectorV2';
import { DISH_KIND_META } from '@eatme/shared';

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

// Capture onValueChange from the last rendered Select so SelectItems can call it.
let _selectOnValueChange: (v: string) => void = () => {};

// Mock Radix Select — jsdom can't render Radix portals/focus management.
// SelectItem uses onClick to forward the selection to the parent Select's onValueChange.
vi.mock('@/components/ui/select', () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange?: (v: string) => void;
    children: React.ReactNode;
  }) => {
    if (onValueChange) _selectOnValueChange = onValueChange;
    return (
      <div data-testid="select-root" data-value={value}>
        {children}
      </div>
    );
  },
  SelectTrigger: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="select-trigger">{children}</div>
  ),
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="select-content">{children}</div>
  ),
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <button
      type="button"
      data-testid={`select-item-${value}`}
      data-value={value}
      onClick={() => _selectOnValueChange(value)}
    >
      {children}
    </button>
  ),
}));

describe('KindSelectorV2', () => {
  const mockSetKind = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    _selectOnValueChange = () => {};
    useReviewStore.setState({ setKind: mockSetKind } as never);
  });

  it('renders select items for all 5 new kinds', () => {
    render(
      <KindSelectorV2
        dishId="dish-1"
        currentKind="standard"
        currentIsParent={false}
        currentPricePrefix="exact"
      />
    );
    for (const kind of Object.keys(DISH_KIND_META)) {
      expect(screen.getByTestId(`select-item-${kind}`)).toBeInTheDocument();
    }
  });

  it('clicking bundle dispatches setKind with bundle', () => {
    render(
      <KindSelectorV2
        dishId="dish-1"
        currentKind="standard"
        currentIsParent={false}
        currentPricePrefix="exact"
      />
    );
    fireEvent.click(screen.getByTestId('select-item-bundle'));
    expect(mockSetKind).toHaveBeenCalledWith('dish-1', 'bundle');
  });

  it('shows caption when kind change affects is_parent', () => {
    render(
      <KindSelectorV2
        dishId="dish-1"
        currentKind="standard"
        currentIsParent={false}
        currentPricePrefix="exact"
      />
    );
    fireEvent.click(screen.getByTestId('select-item-bundle'));
    expect(screen.getByTestId('kind-change-caption')).toBeInTheDocument();
    expect(screen.getByTestId('kind-change-caption').textContent).toContain('parent=true');
  });

  it('shows caption when kind change affects display_price_prefix', () => {
    render(
      <KindSelectorV2
        dishId="dish-1"
        currentKind="standard"
        currentIsParent={false}
        currentPricePrefix="exact"
      />
    );
    fireEvent.click(screen.getByTestId('select-item-buffet'));
    expect(screen.getByTestId('kind-change-caption').textContent).toContain(
      'price prefix=per_person'
    );
  });

  it('shows no caption when neither is_parent nor price_prefix change', () => {
    render(
      <KindSelectorV2
        dishId="dish-1"
        currentKind="bundle"
        currentIsParent={true}
        currentPricePrefix="exact"
      />
    );
    // bundle → bundle: same effects, no caption
    fireEvent.click(screen.getByTestId('select-item-bundle'));
    expect(screen.queryByTestId('kind-change-caption')).not.toBeInTheDocument();
  });

  it('clicking configurable dispatches setKind with configurable', () => {
    render(
      <KindSelectorV2
        dishId="dish-abc"
        currentKind="standard"
        currentIsParent={false}
        currentPricePrefix="exact"
      />
    );
    fireEvent.click(screen.getByTestId('select-item-configurable'));
    expect(mockSetKind).toHaveBeenCalledWith('dish-abc', 'configurable');
  });
});
