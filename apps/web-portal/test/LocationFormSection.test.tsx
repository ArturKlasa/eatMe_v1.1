import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LocationFormSection } from '@/components/LocationFormSection';
import type { LocationData } from '@/components/LocationFormSection';

// Mock next/dynamic to skip LocationPicker (browser-only)
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

// sonner is globally mocked in test/setup.ts

vi.mock('@/lib/constants', () => ({
  COUNTRIES: [
    { value: 'US', label: 'United States' },
    { value: 'GB', label: 'United Kingdom' },
    { value: 'PL', label: 'Poland' },
  ],
}));

const defaultValue: LocationData = {
  country: 'US',
  address: '',
  city: '',
  neighborhood: '',
  state: '',
  postalCode: '',
  lat: 0,
  lng: 0,
};

describe('LocationFormSection', () => {
  it('renders the country select', () => {
    render(<LocationFormSection value={defaultValue} onChange={vi.fn()} />);
    expect(screen.getByText('Country')).toBeInTheDocument();
  });

  it('renders the address input', () => {
    render(<LocationFormSection value={defaultValue} onChange={vi.fn()} />);
    expect(screen.getByLabelText(/Full Address/)).toBeInTheDocument();
  });

  it('renders city, postal code, neighbourhood, and state inputs', () => {
    render(<LocationFormSection value={defaultValue} onChange={vi.fn()} />);
    expect(screen.getByLabelText(/City/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Postal Code/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Neighbourhood/)).toBeInTheDocument();
    expect(screen.getByLabelText(/State/)).toBeInTheDocument();
  });

  it('renders latitude and longitude as read-only inputs', () => {
    render(<LocationFormSection value={defaultValue} onChange={vi.fn()} />);
    const latInput = screen.getByLabelText(/Latitude/);
    const lngInput = screen.getByLabelText(/Longitude/);
    expect(latInput).toHaveAttribute('readonly');
    expect(lngInput).toHaveAttribute('readonly');
  });

  it('calls onChange with updated address when address input changes', () => {
    const handleChange = vi.fn();
    render(<LocationFormSection value={defaultValue} onChange={handleChange} />);
    const addressInput = screen.getByLabelText(/Full Address/);
    fireEvent.change(addressInput, { target: { value: '123 Main St' } });
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({ address: '123 Main St' })
    );
  });

  it('calls onChange with updated city when city input changes', () => {
    const handleChange = vi.fn();
    render(<LocationFormSection value={defaultValue} onChange={handleChange} />);
    const cityInput = screen.getByLabelText(/City/);
    fireEvent.change(cityInput, { target: { value: 'Warsaw' } });
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({ city: 'Warsaw' })
    );
  });

  it('displays existing value in address input', () => {
    const value: LocationData = { ...defaultValue, address: '42 Baker Street' };
    render(<LocationFormSection value={value} onChange={vi.fn()} />);
    expect(screen.getByDisplayValue('42 Baker Street')).toBeInTheDocument();
  });

  it('renders the info tip about clicking the map', () => {
    render(<LocationFormSection value={defaultValue} onChange={vi.fn()} />);
    expect(screen.getByText(/Click anywhere on the map/)).toBeInTheDocument();
  });
});
