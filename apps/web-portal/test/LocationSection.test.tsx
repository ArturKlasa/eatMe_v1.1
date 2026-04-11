import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { LocationSection } from '@/components/onboarding/LocationSection';
import type { BasicInfoFormData } from '@/components/onboarding/types';

// Mock next/dynamic — LocationFormSection uses it for LocationPicker
vi.mock('next/dynamic', () => ({
  default: (
    _loader: () => Promise<unknown>,
    opts?: { loading?: () => React.ReactNode },
  ) => {
    const MockedComponent = () => {
      if (opts?.loading) return opts.loading();
      return <div data-testid="location-picker-mock">LocationPicker</div>;
    };
    MockedComponent.displayName = 'DynamicLocationPicker';
    return MockedComponent;
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/constants', () => ({
  COUNTRIES: [
    { value: 'US', label: 'United States' },
    { value: 'GB', label: 'United Kingdom' },
  ],
}));

const DEFAULT_LOCATION = {
  country: 'US',
  address: '',
  city: '',
  neighborhood: '',
  state: '',
  postalCode: '',
  lat: 0,
  lng: 0,
};

function Wrapper({ children, onSubmit }: { children: React.ReactNode; onSubmit?: (data: BasicInfoFormData) => void }) {
  const methods = useForm<BasicInfoFormData>({
    defaultValues: {
      name: '',
      restaurant_type: 'restaurant',
      description: '',
      location: DEFAULT_LOCATION,
      phone: '',
      website: '',
      delivery_available: true,
      takeout_available: true,
      dine_in_available: true,
      service_speed: 'regular',
      accepts_reservations: false,
      payment_methods: 'cash_and_card',
    },
  });
  return (
    <FormProvider {...methods}>
      <form onSubmit={onSubmit ? methods.handleSubmit(onSubmit) : undefined}>
        {children}
      </form>
    </FormProvider>
  );
}

describe('LocationSection', () => {
  it('renders the Location card title and description', () => {
    render(
      <Wrapper>
        <LocationSection />
      </Wrapper>
    );
    expect(screen.getByText('Location')).toBeInTheDocument();
    expect(screen.getByText(/Where can customers find you/)).toBeInTheDocument();
  });

  it('renders LocationFormSection fields — address, city, postal code', () => {
    render(
      <Wrapper>
        <LocationSection />
      </Wrapper>
    );
    expect(screen.getByLabelText(/Full Address/)).toBeInTheDocument();
    expect(screen.getByLabelText(/City/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Postal Code/)).toBeInTheDocument();
  });

  it('renders neighbourhood and state fields via LocationFormSection', () => {
    render(
      <Wrapper>
        <LocationSection />
      </Wrapper>
    );
    expect(screen.getByLabelText(/Neighbourhood/)).toBeInTheDocument();
    expect(screen.getByLabelText(/State/)).toBeInTheDocument();
  });

  it('renders lat/lng fields via LocationFormSection', () => {
    render(
      <Wrapper>
        <LocationSection />
      </Wrapper>
    );
    expect(screen.getByText(/Latitude/)).toBeInTheDocument();
    expect(screen.getByText(/Longitude/)).toBeInTheDocument();
  });

  it('renders the map tip text from LocationFormSection', () => {
    render(
      <Wrapper>
        <LocationSection />
      </Wrapper>
    );
    expect(screen.getByText(/Click anywhere on the map/)).toBeInTheDocument();
  });

  it('Controller propagates address input changes to form location field', async () => {
    const handleSubmit = vi.fn();
    render(
      <Wrapper onSubmit={handleSubmit}>
        <LocationSection />
        <button type="submit">Submit</button>
      </Wrapper>
    );

    const addressInput = screen.getByLabelText(/Full Address/);
    fireEvent.change(addressInput, { target: { value: '123 Main St' } });

    fireEvent.click(screen.getByRole('button', { name: /Submit/ }));

    await vi.waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          location: expect.objectContaining({ address: '123 Main St' }),
        }),
        expect.anything(),
      );
    });
  });

  it('Controller propagates city input changes to form location field', async () => {
    const handleSubmit = vi.fn();
    render(
      <Wrapper onSubmit={handleSubmit}>
        <LocationSection />
        <button type="submit">Submit</button>
      </Wrapper>
    );

    const cityInput = screen.getByLabelText(/City/);
    fireEvent.change(cityInput, { target: { value: 'San Francisco' } });

    fireEvent.click(screen.getByRole('button', { name: /Submit/ }));

    await vi.waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          location: expect.objectContaining({ city: 'San Francisco' }),
        }),
        expect.anything(),
      );
    });
  });
});
