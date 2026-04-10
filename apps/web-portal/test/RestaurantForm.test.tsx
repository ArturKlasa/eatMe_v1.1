import { describe, it, expect, vi } from 'vitest';
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

import { RestaurantForm } from '@/components/admin/RestaurantForm';

const defaultProps = {
  mode: 'create' as const,
  onSubmit: vi.fn().mockResolvedValue(undefined),
  onCancel: vi.fn(),
};

describe('RestaurantForm', () => {
  it('renders all form sections', () => {
    render(<RestaurantForm {...defaultProps} />);

    // Basic Information section
    expect(screen.getByText('Basic Information')).toBeInTheDocument();
    expect(screen.getByLabelText(/Restaurant Name/)).toBeInTheDocument();

    // Cuisine Types section
    expect(screen.getByText('Cuisine Types')).toBeInTheDocument();

    // Location section
    expect(screen.getByText('Location')).toBeInTheDocument();
    expect(screen.getByLabelText(/Full Address/)).toBeInTheDocument();

    // Contact section
    expect(screen.getByText('Contact Information')).toBeInTheDocument();
    expect(screen.getByLabelText(/Phone Number/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Website/)).toBeInTheDocument();

    // Service Options section
    expect(screen.getByText('Service Options')).toBeInTheDocument();
    expect(screen.getByLabelText('Delivery Available')).toBeInTheDocument();
    expect(screen.getByLabelText('Takeout Available')).toBeInTheDocument();
    expect(screen.getByLabelText('Dine-in Available')).toBeInTheDocument();
    expect(screen.getByLabelText('Accepts Reservations')).toBeInTheDocument();

    // Payment Methods section
    expect(screen.getByText('Payment Methods')).toBeInTheDocument();

    // Operating Hours section
    expect(screen.getByText('Operating Hours')).toBeInTheDocument();
  });

  it('shows validation errors on empty submit', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<RestaurantForm {...defaultProps} onSubmit={onSubmit} />);

    // Clear the name field (it defaults to empty, but ensure it's empty)
    const nameInput = screen.getByLabelText(/Restaurant Name/);
    await user.clear(nameInput);

    // Click the submit button
    const submitBtn = screen.getByRole('button', { name: /Create Restaurant/ });
    await user.click(submitBtn);

    // Validation error should appear for required name field
    await waitFor(() => {
      expect(screen.getByText('Restaurant name is required')).toBeInTheDocument();
    });

    // onSubmit should NOT have been called
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows "Create Restaurant" button when mode is create', () => {
    render(<RestaurantForm {...defaultProps} mode="create" />);
    expect(screen.getByRole('button', { name: /Create Restaurant/ })).toBeInTheDocument();
  });

  it('shows "Save Changes" button when mode is edit', () => {
    render(<RestaurantForm {...defaultProps} mode="edit" />);
    expect(screen.getByRole('button', { name: /Save Changes/ })).toBeInTheDocument();
  });

  it('renders Cancel button', () => {
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

  it('pre-fills form when initialData is provided', () => {
    render(
      <RestaurantForm
        {...defaultProps}
        mode="edit"
        initialData={{
          name: 'Test Restaurant',
          phone: '+1234567890',
          city: 'San Francisco',
        }}
      />
    );

    expect(screen.getByLabelText(/Restaurant Name/)).toHaveValue('Test Restaurant');
    expect(screen.getByLabelText(/Phone Number/)).toHaveValue('+1234567890');
    expect(screen.getByLabelText(/City/)).toHaveValue('San Francisco');
  });
});
