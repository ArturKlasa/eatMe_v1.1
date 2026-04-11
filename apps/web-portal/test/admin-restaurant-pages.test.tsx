import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// --- Hoisted mocks (called before any imports) ---
const { mockPush, mockSingle, mockGetUser, mockInsert, mockUpdate } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockSingle: vi.fn(),
  mockGetUser: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
}));

// --- Next.js navigation mocks ---
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useParams: () => ({ id: 'test-restaurant-id' }),
}));

// --- Supabase mock ---
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ single: mockSingle }) }),
      insert: () => ({
        ...mockInsert(),
        select: () => ({
          single: vi.fn().mockResolvedValue({
            data: { id: 'new-id', name: 'New Place', city: 'Paris', country_code: 'FR' },
            error: null,
          }),
        }),
      }),
      update: () => ({ eq: () => mockUpdate() }),
    }),
    auth: { getUser: mockGetUser },
  },
  formatLocationForSupabase: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('next/dynamic', () => ({
  __esModule: true,
  default: () => {
    const Stub = () => <div data-testid="location-picker-stub">LocationPicker</div>;
    Stub.displayName = 'LocationPickerStub';
    return Stub;
  },
}));

vi.mock('@/components/forms/CuisineSelector', () => ({
  CuisineSelector: ({ selected, onChange }: { selected: string[]; onChange: (v: string[]) => void }) => (
    <div data-testid="cuisine-selector">
      <button type="button" onClick={() => onChange(['Italian'])}>Select Italian</button>
      <span>{selected.join(',')}</span>
    </div>
  ),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-123' } }),
}));

vi.mock('@/lib/hooks/useRestaurantDraft', () => ({
  useRestaurantDraft: () => ({ draftData: null, lastSaved: null, saving: false }),
}));

// --- Component imports (after mocks) ---
import NewRestaurantPage from '@/app/admin/restaurants/new/page';
import EditRestaurantPage from '@/app/admin/restaurants/[id]/edit/page';

describe('Step 14: Admin create/edit pages with unified RestaurantForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } });
    mockInsert.mockReturnValue({ data: { id: 'new-id' }, error: null });
    mockUpdate.mockResolvedValue({ data: null, error: null });
  });

  describe('New restaurant page', () => {
    it('renders without crashing and shows create form', () => {
      render(<NewRestaurantPage />);
      expect(screen.getByText('Add New Restaurant')).toBeInTheDocument();
      expect(screen.getByLabelText(/Restaurant Name/)).toBeInTheDocument();
    });

    it('shows Create Restaurant button', () => {
      render(<NewRestaurantPage />);
      expect(screen.getByRole('button', { name: /Create Restaurant/ })).toBeInTheDocument();
    });

    it('Cancel button calls router.push', async () => {
      const { default: userEvent } = await import('@testing-library/user-event');
      const user = userEvent.setup();
      render(<NewRestaurantPage />);
      await user.click(screen.getByRole('button', { name: /Cancel/ }));
      expect(mockPush).toHaveBeenCalledWith('/admin/restaurants');
    });
  });

  describe('Edit restaurant page', () => {
    beforeEach(() => {
      mockSingle.mockResolvedValue({
        data: {
          id: 'test-restaurant-id',
          name: 'Old Bistro',
          restaurant_type: 'restaurant',
          city: 'Lyon',
          country_code: 'FR',
          delivery_available: false,
          takeout_available: false,
          dine_in_available: true,
          accepts_reservations: false,
          payment_methods: 'cash_and_card',
          cuisine_types: ['French'],
          operating_hours: {},
        },
        error: null,
      });
    });

    it('renders without crashing (shows skeleton initially)', () => {
      render(<EditRestaurantPage />);
      expect(document.body).toBeTruthy();
    });

    it('loads restaurant data and populates the name field', async () => {
      render(<EditRestaurantPage />);
      await waitFor(() => {
        expect(screen.getByLabelText(/Restaurant Name/)).toHaveValue('Old Bistro');
      });
    });

    it('shows Save Changes button in edit mode', async () => {
      render(<EditRestaurantPage />);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Save Changes/ })).toBeInTheDocument();
      });
    });
  });
});
