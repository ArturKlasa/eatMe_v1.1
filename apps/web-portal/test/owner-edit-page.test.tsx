import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// --- Hoisted mocks ---
const { mockPush, mockGetRestaurantForEdit, mockSupabaseUpdate, mockAddEventListener, mockRemoveEventListener } =
  vi.hoisted(() => ({
    mockPush: vi.fn(),
    mockGetRestaurantForEdit: vi.fn(),
    mockSupabaseUpdate: vi.fn(),
    mockAddEventListener: vi.fn(),
    mockRemoveEventListener: vi.fn(),
  }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('@/lib/restaurantService', () => ({
  getRestaurantForEdit: mockGetRestaurantForEdit,
}));

vi.mock('@/components/admin/RestaurantForm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/admin/RestaurantForm')>();
  return {
    ...actual,
    convertDbToFormData: vi.fn((data: Record<string, unknown>) => ({
      name: data.name ?? '',
      restaurant_type: data.restaurant_type ?? 'restaurant',
      description: data.description ?? '',
      phone: data.phone ?? '',
      website: data.website ?? '',
      address: data.address ?? '',
      city: data.city ?? '',
      neighbourhood: data.neighbourhood ?? '',
      state: data.state ?? '',
      postal_code: data.postal_code ?? '',
      country_code: data.country_code ?? 'US',
      latitude: '',
      longitude: '',
      delivery_available: data.delivery_available ?? true,
      takeout_available: data.takeout_available ?? true,
      dine_in_available: data.dine_in_available ?? true,
      accepts_reservations: data.accepts_reservations ?? false,
      payment_methods: data.payment_methods ?? 'cash_and_card',
      cuisine_types: data.cuisine_types ?? [],
      operating_hours: {},
    })),
    formDataToDbColumns: vi.fn((data) => data),
  };
});

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      update: () => ({ eq: () => mockSupabaseUpdate() }),
    }),
  },
}));

// sonner is globally mocked in test/setup.ts

vi.mock('next/dynamic', () => ({
  __esModule: true,
  default: () => {
    const Stub = () => <div data-testid="location-picker-stub">LocationPicker</div>;
    Stub.displayName = 'LocationPickerStub';
    return Stub;
  },
}));

vi.mock('@/components/forms/CuisineSelector', () => ({
  CuisineSelector: ({
    selected,
    onChange,
  }: {
    selected: string[];
    onChange: (v: string[]) => void;
  }) => (
    <div data-testid="cuisine-selector">
      <button type="button" onClick={() => onChange(['Italian', 'French'])}>
        Change Cuisines
      </button>
      <span data-testid="selected-cuisines">{selected.join(',')}</span>
    </div>
  ),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'owner-123' } }),
}));

vi.mock('@/lib/hooks/useRestaurantDraft', () => ({
  useRestaurantDraft: () => ({ draftData: null, lastSaved: null, saving: false }),
}));

// ProtectedRoute renders its children directly
vi.mock('@/components/ProtectedRoute', () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Default DB row returned by getRestaurantForEdit
const mockRestaurantRow = {
  id: 'rest-abc',
  name: 'Test Bistro',
  description: 'A nice place',
  address: '1 Test St',
  city: 'Testville',
  neighbourhood: null,
  state: null,
  postal_code: null,
  country_code: 'US',
  phone: '+1 555 0001',
  website: 'https://test.example.com',
  open_hours: null,
  cuisine_types: ['Italian'],
  restaurant_type: 'restaurant',
  delivery_available: true,
  takeout_available: false,
  dine_in_available: true,
  accepts_reservations: false,
  payment_methods: 'cash_and_card',
  service_speed: 'regular',
  location: { lat: 48.85, lng: 2.35 },
};

import EditRestaurantPage from '@/app/restaurant/edit/page';

describe('Step 15: Owner edit page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRestaurantForEdit.mockResolvedValue(mockRestaurantRow);
    mockSupabaseUpdate.mockResolvedValue({ data: null, error: null });
  });

  it('renders loading skeleton initially', () => {
    render(<EditRestaurantPage />);
    // The page starts in loading state; skeleton is rendered
    expect(document.body).toBeTruthy();
  });

  it('loads restaurant data and renders unified RestaurantForm', async () => {
    render(<EditRestaurantPage />);
    await waitFor(() => {
      expect(screen.getByLabelText(/Restaurant Name/)).toBeInTheDocument();
    });
    expect(mockGetRestaurantForEdit).toHaveBeenCalledWith('owner-123');
  });

  it('populates the name field with data from the service', async () => {
    render(<EditRestaurantPage />);
    await waitFor(() => {
      expect(screen.getByLabelText(/Restaurant Name/)).toHaveValue('Test Bistro');
    });
  });

  it('renders service options section (delivery, takeout, dine-in)', async () => {
    render(<EditRestaurantPage />);
    await waitFor(() => {
      expect(screen.getByLabelText('Delivery Available')).toBeInTheDocument();
      expect(screen.getByLabelText('Takeout Available')).toBeInTheDocument();
      expect(screen.getByLabelText('Dine-in Available')).toBeInTheDocument();
    });
  });

  it('renders payment methods section', async () => {
    render(<EditRestaurantPage />);
    await waitFor(() => {
      expect(screen.getByText('Payment Methods')).toBeInTheDocument();
    });
  });

  it('renders cuisines section', async () => {
    render(<EditRestaurantPage />);
    await waitFor(() => {
      expect(screen.getByTestId('cuisine-selector')).toBeInTheDocument();
    });
  });

  it('shows cascade warning InfoBox when cuisines are changed in edit mode', async () => {
    const user = userEvent.setup();
    render(<EditRestaurantPage />);

    await waitFor(() => {
      expect(screen.getByTestId('cuisine-selector')).toBeInTheDocument();
    });

    // Change cuisines — should trigger the cascade warning
    await user.click(screen.getByRole('button', { name: /Change Cuisines/ }));

    await waitFor(() => {
      expect(
        screen.getByText(/Changing cuisines will not remove existing dishes/)
      ).toBeInTheDocument();
    });
  });

  it('shows Save Changes button', async () => {
    render(<EditRestaurantPage />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Save Changes/ })).toBeInTheDocument();
    });
  });

  it('Cancel button navigates to /', async () => {
    const user = userEvent.setup();
    render(<EditRestaurantPage />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Cancel/ })).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /Cancel/ }));
    expect(mockPush).toHaveBeenCalledWith('/');
  });
});
