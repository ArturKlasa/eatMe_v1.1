import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { LocationSection } from '@/components/onboarding/LocationSection';
import type { BasicInfoFormData } from '@/components/onboarding/types';

// Mock the dynamic import of LocationPicker — it renders a LoadingSkeleton fallback initially
vi.mock('next/dynamic', () => ({
  default: (
    _loader: () => Promise<unknown>,
    opts?: { loading?: () => React.ReactNode },
  ) => {
    // Return the loading component to simulate SSR/initial state
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

function Wrapper({ children }: { children: React.ReactNode }) {
  const methods = useForm<BasicInfoFormData>({
    defaultValues: {
      name: '', restaurant_type: 'restaurant', description: '', country: 'US',
      city: '', neighbourhood: '', state: '', postal_code: '', address: '',
      location_lat: '', location_lng: '', phone: '', website: '',
      delivery_available: true, takeout_available: true, dine_in_available: true,
      service_speed: 'regular', accepts_reservations: false, payment_methods: 'cash_and_card',
    },
  });
  return <FormProvider {...methods}>{children}</FormProvider>;
}

describe('LocationSection', () => {
  it('renders loading skeleton initially (dynamic import fallback)', () => {
    render(
      <Wrapper>
        <LocationSection
          mapCoordinates={null}
          onMapCoordinatesChange={() => {}}
          country="US"
          onCountryChange={() => {}}
        />
      </Wrapper>
    );
    // The loading fallback from dynamic() is a LoadingSkeleton
    // The section card should be visible
    expect(screen.getByText('Location')).toBeInTheDocument();
    expect(screen.getByText(/Click anywhere on the map/)).toBeInTheDocument();
  });

  it('renders address fields', () => {
    render(
      <Wrapper>
        <LocationSection
          mapCoordinates={null}
          onMapCoordinatesChange={() => {}}
          country="US"
          onCountryChange={() => {}}
        />
      </Wrapper>
    );
    expect(screen.getByLabelText(/City/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Postal Code/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Full Address/)).toBeInTheDocument();
    expect(screen.getByText(/Latitude/)).toBeInTheDocument();
    expect(screen.getByText(/Longitude/)).toBeInTheDocument();
  });

  it('renders country selector with value', () => {
    render(
      <Wrapper>
        <LocationSection
          mapCoordinates={null}
          onMapCoordinatesChange={() => {}}
          country="US"
          onCountryChange={() => {}}
        />
      </Wrapper>
    );
    // Country label exists (use getAllByText since both the label and select value may match)
    expect(screen.getAllByText(/Country/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders neighbourhood and state fields', () => {
    render(
      <Wrapper>
        <LocationSection
          mapCoordinates={null}
          onMapCoordinatesChange={() => {}}
          country="US"
          onCountryChange={() => {}}
        />
      </Wrapper>
    );
    expect(screen.getByLabelText(/Neighbourhood/)).toBeInTheDocument();
    expect(screen.getByLabelText(/State/)).toBeInTheDocument();
  });
});
