import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock sonner toast — use inline object to avoid hoisting issues
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));

// Mock leaflet — LocationPicker dynamically imports it
vi.mock('leaflet', () => {
  const mockMap = {
    setView: vi.fn().mockReturnThis(),
    on: vi.fn(),
    remove: vi.fn(),
  };
  const mockMarker = {
    addTo: vi.fn().mockReturnThis(),
    setLatLng: vi.fn(),
  };
  const mockTileLayer = { addTo: vi.fn() };
  return {
    default: {
      map: vi.fn(() => mockMap),
      marker: vi.fn(() => mockMarker),
      tileLayer: vi.fn(() => mockTileLayer),
      Icon: { Default: { prototype: {}, mergeOptions: vi.fn() } },
    },
  };
});

vi.mock('leaflet/dist/leaflet.css', () => ({}));
vi.mock('@/lib/parseAddress', () => ({
  parseNominatimAddress: vi.fn(),
}));

import LocationPicker from '@/components/LocationPicker';
import { toast } from 'sonner';

describe('LocationPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    // Without geolocation resolving, map won't initialize
    Object.defineProperty(navigator, 'geolocation', {
      value: {
        getCurrentPosition: vi.fn(), // never calls callback
      },
      writable: true,
      configurable: true,
    });

    render(
      <LocationPicker
        onLocationSelect={vi.fn()}
      />
    );
    expect(screen.getByText('Loading map...')).toBeInTheDocument();
  });

  it('shows toast on geolocation denial', () => {
    Object.defineProperty(navigator, 'geolocation', {
      value: {
        getCurrentPosition: vi.fn((_success, error) => {
          error({
            code: 1, // PERMISSION_DENIED
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
            message: 'User denied',
          });
        }),
      },
      writable: true,
      configurable: true,
    });

    render(
      <LocationPicker
        onLocationSelect={vi.fn()}
      />
    );

    expect(toast.warning).toHaveBeenCalledWith(
      expect.stringContaining('Location access denied')
    );
  });

  it('shows toast when geolocation not supported', () => {
    Object.defineProperty(navigator, 'geolocation', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    render(
      <LocationPicker
        onLocationSelect={vi.fn()}
      />
    );

    expect(toast.warning).toHaveBeenCalledWith(
      expect.stringContaining('not supported')
    );
  });

  it('renders map container with aria-label', () => {
    Object.defineProperty(navigator, 'geolocation', {
      value: {
        getCurrentPosition: vi.fn(),
      },
      writable: true,
      configurable: true,
    });

    render(
      <LocationPicker
        onLocationSelect={vi.fn()}
      />
    );

    expect(screen.getByLabelText('Restaurant location map')).toBeInTheDocument();
  });
});
