import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ---------------------------------------------------------------------------
// Shared mocks
// ---------------------------------------------------------------------------

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: vi.fn() }),
  usePathname: () => '/admin',
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'test-user', email: 'admin@test.com' } }),
}));

vi.mock('@/components/ProtectedRoute', () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/lib/storage', () => ({
  loadRestaurantData: vi.fn(() => null),
  saveRestaurantData: vi.fn(),
  autoSave: vi.fn(),
  cancelAutoSave: vi.fn(),
}));

// sonner is globally mocked in test/setup.ts

vi.mock('@/lib/constants', () => ({
  DAYS_OF_WEEK: [{ key: 'monday', label: 'Monday' }],
  COUNTRIES: [{ value: 'US', label: 'United States' }],
  CUISINE_TYPES: ['Italian'],
  CUISINES: ['Italian', 'Mexican'],
  POPULAR_CUISINES: ['Italian'],
  SERVICE_SPEED_OPTIONS: [{ value: 'regular', label: 'Regular' }],
  PAYMENT_METHOD_OPTIONS: [{ value: 'cash_and_card', label: 'Cash & Card' }],
  RESTAURANT_TYPES: [{ value: 'restaurant', label: 'Restaurant', description: 'Full-service dining' }],
  SPICE_LEVELS: [{ value: 'none', label: 'None', icon: '' }],
}));

vi.mock('next/dynamic', () => ({
  default: () => {
    const M = () => <div data-testid="location-picker-mock">Map</div>;
    M.displayName = 'DynamicMock';
    return M;
  },
}));

// ---------------------------------------------------------------------------
// Step 19.1 — Onboarding routing fix: basic-info → menu
// ---------------------------------------------------------------------------

describe('Step 19: BasicInfoPage routing', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('submit handler calls router.push("/onboard/menu")', async () => {
    const { default: BasicInfoPage } = await import('@/app/onboard/basic-info/page');
    render(<BasicInfoPage />);

    // Verify the submit button label reflects the new destination
    const submitBtn = await screen.findByText(/Continue to Menu/i);
    expect(submitBtn).toBeInTheDocument();
  });

  it('does NOT route to /onboard/review', async () => {
    const { default: BasicInfoPage } = await import('@/app/onboard/basic-info/page');
    render(<BasicInfoPage />);

    await screen.findByText(/Continue to Menu/i);
    // The button text should not say "Review"
    expect(screen.queryByText(/Continue to Review/i)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Step 19.2 — Review stats grid is responsive
// ---------------------------------------------------------------------------

vi.mock('@/lib/restaurantService', () => ({
  getRestaurantFull: vi.fn(() => Promise.resolve(null)),
  submitRestaurantProfile: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/lib/validation', () => ({
  basicInfoSchema: {
    safeParse: vi.fn(() => ({ success: true })),
  },
}));

describe('Step 19: ReviewPage stats grid responsiveness', () => {
  it('stats grid has sm:grid-cols-3 class', async () => {
    // Override storage mock to return data so the page renders the grid
    const { loadRestaurantData } = await import('@/lib/storage');
    vi.mocked(loadRestaurantData).mockReturnValueOnce({
      basicInfo: { name: 'Test', address: '123 St', country: 'US', cuisines: ['Italian'] } as never,
      operations: {},
      menus: [{ id: 'm1', name: 'Main', description: '', is_active: true, display_order: 1, dishes: [{ id: 'd1', name: 'Dish', price: 10, dietary_tags: [], allergens: [] } as never] }],
      dishes: [],
      currentStep: 3,
    } as never);

    const { getRestaurantFull } = await import('@/lib/restaurantService');
    vi.mocked(getRestaurantFull).mockResolvedValueOnce({
      basicInfo: { name: 'Test', address: '123 St', country: 'US', cuisines: ['Italian'] } as never,
      operations: {},
      menus: [{ id: 'm1', name: 'Main', description: '', is_active: true, display_order: 1, dishes: [{ id: 'd1', name: 'Dish', price: 10, dietary_tags: [], allergens: [] } as never] }],
      dishes: [],
      currentStep: 3,
    } as never);

    const { default: ReviewPage } = await import('@/app/onboard/review/page');
    render(<ReviewPage />);

    // Wait for load
    await screen.findByText('Review & Submit');

    // Find the stats grid — it's the first grid with the menu/dish/cuisine counts
    const grids = document.querySelectorAll('.grid');
    const statsGrid = Array.from(grids).find(el =>
      el.className.includes('sm:grid-cols-3')
    );
    expect(statsGrid).toBeDefined();
    expect(statsGrid?.className).toContain('sm:grid-cols-3');
    expect(statsGrid?.className).toContain('grid-cols-1');
  });
});

// ---------------------------------------------------------------------------
// Step 19.3 — Admin sidebar hidden on mobile, hamburger button present
// ---------------------------------------------------------------------------

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() =>
        Promise.resolve({
          data: { session: { user: { id: 'u1', email: 'admin@test.com', user_metadata: { role: 'admin' } } } },
          error: null,
        })
      ),
      signOut: vi.fn(() => Promise.resolve({ error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}));

describe('Step 19: AdminSidebar mobile visibility', () => {
  it('AdminSidebar aside element has hidden md:flex classes', async () => {
    const { AdminSidebar } = await import('@/components/admin/AdminSidebar');
    render(<AdminSidebar />);
    const aside = document.querySelector('aside');
    expect(aside).not.toBeNull();
    expect(aside?.className).toContain('hidden');
    expect(aside?.className).toContain('md:flex');
  });
});

describe('Step 19: AdminHeader mobile hamburger', () => {
  it('renders the mobile menu button', async () => {
    const { AdminHeader } = await import('@/components/admin/AdminHeader');
    const user = { id: 'u1', email: 'admin@test.com' } as never;
    render(<AdminHeader user={user} />);
    const btn = screen.getByTestId('mobile-menu-button');
    expect(btn).toBeInTheDocument();
  });

  it('mobile menu button is md:hidden', async () => {
    const { AdminHeader } = await import('@/components/admin/AdminHeader');
    const user = { id: 'u1', email: 'admin@test.com' } as never;
    render(<AdminHeader user={user} />);
    const btn = screen.getByTestId('mobile-menu-button');
    expect(btn.className).toContain('md:hidden');
  });
});
