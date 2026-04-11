import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock next/dynamic to render a placeholder instead of LocationPicker
vi.mock('next/dynamic', () => ({
  __esModule: true,
  default: () => {
    const Stub = () => <div data-testid="location-picker-stub">LocationPicker</div>;
    Stub.displayName = 'LocationPickerStub';
    return Stub;
  },
}));

// Mock sonner toast
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Mock useAuth
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'test-user-123' } }),
}));

// Mock useRestaurantDraft
const mockUseRestaurantDraft = vi.fn().mockReturnValue({
  draftData: null,
  lastSaved: null,
  saving: false,
});
vi.mock('@/lib/hooks/useRestaurantDraft', () => ({
  useRestaurantDraft: (opts: unknown) => mockUseRestaurantDraft(opts),
}));

// Mock CuisineSelector to avoid complexity
vi.mock('@/components/forms/CuisineSelector', () => ({
  CuisineSelector: ({ selected, onChange }: { selected: string[]; onChange: (v: string[]) => void }) => (
    <div data-testid="cuisine-selector">
      <button type="button" onClick={() => onChange(['Italian'])}>
        Select Italian
      </button>
      <span data-testid="selected-cuisines">{selected.join(',')}</span>
    </div>
  ),
}));

import { RestaurantForm, ADMIN_FULL_SECTIONS, ADMIN_COMPACT_SECTIONS } from '@/components/admin/RestaurantForm';

const defaultProps = {
  mode: 'create' as const,
  onSuccess: vi.fn().mockResolvedValue(undefined),
  onCancel: vi.fn(),
};

describe('RestaurantForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRestaurantDraft.mockReturnValue({ draftData: null, lastSaved: null, saving: false });
  });

  it('renders all form sections when sections=ADMIN_FULL_SECTIONS', () => {
    render(<RestaurantForm {...defaultProps} sections={ADMIN_FULL_SECTIONS} />);
    expect(screen.getByText('Basic Information')).toBeInTheDocument();
    expect(screen.getByLabelText(/Restaurant Name/)).toBeInTheDocument();
    expect(screen.getByText('Cuisine Types')).toBeInTheDocument();
    expect(screen.getByText('Location')).toBeInTheDocument();
    expect(screen.getByText('Contact Information')).toBeInTheDocument();
    expect(screen.getByLabelText(/Phone Number/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Website/)).toBeInTheDocument();
    expect(screen.getByText('Service Options')).toBeInTheDocument();
    expect(screen.getByLabelText('Delivery Available')).toBeInTheDocument();
    expect(screen.getByLabelText('Takeout Available')).toBeInTheDocument();
    expect(screen.getByLabelText('Dine-in Available')).toBeInTheDocument();
    expect(screen.getByLabelText('Accepts Reservations')).toBeInTheDocument();
    expect(screen.getByText('Payment Methods')).toBeInTheDocument();
    expect(screen.getByText('Operating Hours')).toBeInTheDocument();
  });

  it('shows "Create Restaurant" button when mode is create', () => {
    render(<RestaurantForm {...defaultProps} mode="create" />);
    expect(screen.getByRole('button', { name: /Create Restaurant/ })).toBeInTheDocument();
  });

  it('shows "Save Changes" button when mode is edit', () => {
    render(<RestaurantForm {...defaultProps} mode="edit" />);
    expect(screen.getByRole('button', { name: /Save Changes/ })).toBeInTheDocument();
  });

  it('renders Cancel button when onCancel provided', () => {
    render(<RestaurantForm {...defaultProps} />);
    expect(screen.getByRole('button', { name: /Cancel/ })).toBeInTheDocument();
  });

  it('calls onCancel when Cancel is clicked', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<RestaurantForm {...defaultProps} onCancel={onCancel} />);
    await user.click(screen.getByRole('button', { name: /Cancel/ }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('shows validation errors on empty submit', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    render(<RestaurantForm {...defaultProps} onSuccess={onSuccess} />);
    const nameInput = screen.getByLabelText(/Restaurant Name/);
    await user.clear(nameInput);
    const submitBtn = screen.getByRole('button', { name: /Create Restaurant/ });
    await user.click(submitBtn);
    await waitFor(() => {
      expect(screen.getByText('Restaurant name is required')).toBeInTheDocument();
    });
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('pre-fills form fields from initialData in edit mode', () => {
    render(
      <RestaurantForm
        {...defaultProps}
        mode="edit"
        initialData={{
          name: 'Test Restaurant',
          phone: '+1234567890',
        }}
      />
    );
    expect(screen.getByLabelText(/Restaurant Name/)).toHaveValue('Test Restaurant');
    expect(screen.getByLabelText(/Phone Number/)).toHaveValue('+1234567890');
  });

  it('calls onSuccess with form data on valid submit', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn().mockResolvedValue(undefined);
    render(<RestaurantForm {...defaultProps} onSuccess={onSuccess} />);
    await user.type(screen.getByLabelText(/Restaurant Name/), 'My Restaurant');
    await user.click(screen.getByRole('button', { name: /Create Restaurant/ }));
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'My Restaurant' })
      );
    });
  });

  it('also works with legacy onSubmit prop', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<RestaurantForm mode="create" onSubmit={onSubmit} onCancel={vi.fn()} />);
    await user.type(screen.getByLabelText(/Restaurant Name/), 'Legacy Form');
    await user.click(screen.getByRole('button', { name: /Create Restaurant/ }));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Legacy Form' })
      );
    });
  });

  it('hides location section when sections.location=false', () => {
    render(
      <RestaurantForm
        {...defaultProps}
        sections={{ basicInfo: true, contact: false, location: false, cuisines: false, operatingHours: false, serviceOptions: false }}
      />
    );
    expect(screen.queryByText('Location')).not.toBeInTheDocument();
  });

  it('shows only basicInfo and location in compact mode with ADMIN_COMPACT_SECTIONS', () => {
    render(
      <RestaurantForm
        {...defaultProps}
        variant="compact"
        sections={ADMIN_COMPACT_SECTIONS}
      />
    );
    expect(screen.getByText('Basic Information')).toBeInTheDocument();
    expect(screen.getByText('Location')).toBeInTheDocument();
    expect(screen.queryByText('Contact Information')).not.toBeInTheDocument();
    expect(screen.queryByText('Operating Hours')).not.toBeInTheDocument();
  });

  it('renders SectionCard (collapsible) in compact variant', () => {
    render(
      <RestaurantForm
        {...defaultProps}
        variant="compact"
        sections={{ basicInfo: true }}
      />
    );
    // Compact sections use collapsible SectionCard — trigger button should be present
    expect(screen.getByRole('button', { name: /Collapse section|Expand section/ })).toBeInTheDocument();
  });

  it('does not activate draft when enableDraft=false', () => {
    render(<RestaurantForm {...defaultProps} enableDraft={false} />);
    // useRestaurantDraft should be called with userId=undefined
    expect(mockUseRestaurantDraft).toHaveBeenCalledWith(
      expect.objectContaining({ userId: undefined })
    );
  });

  it('activates draft with userId when enableDraft=true', () => {
    render(<RestaurantForm {...defaultProps} enableDraft={true} />);
    expect(mockUseRestaurantDraft).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'test-user-123' })
    );
  });

  it('shows cuisine cascade warning in edit mode when cuisines change', async () => {
    const user = userEvent.setup();
    render(
      <RestaurantForm
        {...defaultProps}
        mode="edit"
        sections={{ cuisines: true }}
        initialData={{ cuisine_types: ['Mexican'] }}
      />
    );
    // No warning initially
    expect(screen.queryByText(/Changing cuisines/)).not.toBeInTheDocument();
    // Change cuisines
    await user.click(screen.getByRole('button', { name: /Select Italian/ }));
    await waitFor(() => {
      expect(screen.getByText(/Changing cuisines/)).toBeInTheDocument();
    });
  });
});
