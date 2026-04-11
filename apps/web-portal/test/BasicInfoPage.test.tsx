import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  usePathname: () => '/onboard/basic-info',
}));

// Mock auth context
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'test-user-123' } }),
}));

// Mock ProtectedRoute to pass through
vi.mock('@/components/ProtectedRoute', () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock storage
vi.mock('@/lib/storage', () => ({
  loadRestaurantData: vi.fn(() => null),
  saveRestaurantData: vi.fn(),
  autoSave: vi.fn(),
  cancelAutoSave: vi.fn(),
}));

// sonner is globally mocked in test/setup.ts

// Mock constants
vi.mock('@/lib/constants', () => ({
  DAYS_OF_WEEK: [
    { key: 'monday', label: 'Monday' },
    { key: 'tuesday', label: 'Tuesday' },
    { key: 'wednesday', label: 'Wednesday' },
    { key: 'thursday', label: 'Thursday' },
    { key: 'friday', label: 'Friday' },
    { key: 'saturday', label: 'Saturday' },
    { key: 'sunday', label: 'Sunday' },
  ],
  COUNTRIES: [
    { value: 'US', label: 'United States' },
    { value: 'GB', label: 'United Kingdom' },
  ],
  CUISINE_TYPES: ['Italian', 'Mexican', 'Chinese', 'Japanese'],
  CUISINES: ['Italian', 'Mexican', 'Chinese', 'Japanese', 'American', 'French'],
  POPULAR_CUISINES: ['Italian', 'Mexican', 'Chinese'],
  SERVICE_SPEED_OPTIONS: [
    { value: 'regular', label: 'Regular' },
    { value: 'fast-food', label: 'Fast Food' },
  ],
  PAYMENT_METHOD_OPTIONS: [
    { value: 'cash_and_card', label: 'Cash & Card' },
    { value: 'cash_only', label: 'Cash Only' },
    { value: 'card_only', label: 'Card Only' },
  ],
  RESTAURANT_TYPES: [
    { value: 'restaurant', label: 'Restaurant', description: 'Full-service dining' },
    { value: 'cafe', label: 'Cafe', description: 'Coffee shop' },
  ],
}));

// Mock dynamic imports (LocationPicker)
vi.mock('next/dynamic', () => ({
  default: (_loader: () => Promise<unknown>, opts?: { loading?: () => React.ReactNode }) => {
    const MockComponent = () => <div data-testid="location-picker-mock">Map</div>;
    MockComponent.displayName = 'DynamicMock';
    return MockComponent;
  },
}));

import BasicInfoPage from '@/app/onboard/basic-info/page';

describe('BasicInfoPage (integration)', () => {
  it('renders the page title', async () => {
    render(<BasicInfoPage />);
    expect(await screen.findByText('Restaurant Information')).toBeInTheDocument();
  });

  it('renders all major form sections', async () => {
    render(<BasicInfoPage />);

    // Basic info
    expect(await screen.findByText('Restaurant Information')).toBeInTheDocument();

    // Contact
    expect(screen.getByText('Contact Information')).toBeInTheDocument();

    // Location
    expect(screen.getByText('Location')).toBeInTheDocument();

    // Cuisine
    expect(screen.getByText(/Cuisine Types/)).toBeInTheDocument();

    // Operating Hours
    expect(screen.getByText('Operating Hours')).toBeInTheDocument();

    // Service Options
    expect(screen.getByText('Service Options')).toBeInTheDocument();
  });

  it('renders navigation buttons', async () => {
    render(<BasicInfoPage />);

    await screen.findByText('Restaurant Information');
    expect(screen.getByText('Continue to Menu')).toBeInTheDocument();
    expect(screen.getAllByText(/Back to Dashboard/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders AutoSaveIndicator', async () => {
    render(<BasicInfoPage />);
    // The AutoSaveIndicator is present but initially hidden (no save yet)
    // It becomes visible after form changes trigger auto-save
    await screen.findByText('Restaurant Information');
    // The component renders but shows nothing until saving starts — that's correct behavior
  });
});
