import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the storage module before importing
vi.mock('@/lib/storage', () => ({
  loadRestaurantData: vi.fn(),
  autoSave: vi.fn(),
  cancelAutoSave: vi.fn(),
  saveRestaurantData: vi.fn(),
}));

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
}));

import { loadRestaurantData } from '@/lib/storage';
import { loadFormDefaults } from '@/lib/hooks/useRestaurantDraft';

describe('loadFormDefaults (useRestaurantDraft utility)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns default values when no userId', () => {
    const defaults = loadFormDefaults(undefined);
    expect(defaults.name).toBe('');
    expect(defaults.restaurant_type).toBe('restaurant');
    expect(defaults.location.country).toBe('US');
    expect(defaults.delivery_available).toBe(true);
    expect(defaults.payment_methods).toBe('cash_and_card');
  });

  it('returns default values when no saved data', () => {
    vi.mocked(loadRestaurantData).mockReturnValue(null);
    const defaults = loadFormDefaults('user-123');
    expect(defaults.name).toBe('');
    expect(defaults.restaurant_type).toBe('restaurant');
  });

  it('loads from localStorage when data exists', () => {
    vi.mocked(loadRestaurantData).mockReturnValue({
      basicInfo: {
        name: 'Test Restaurant',
        restaurant_type: 'cafe',
        country: 'GB',
        address: '123 Main St',
        cuisines: ['italian', 'pizza'],
        location: { lat: 51.5, lng: -0.1 },
        phone: '+44123456',
      },
      operations: {
        delivery_available: false,
        takeout_available: true,
        dine_in_available: true,
        service_speed: 'fast-food',
        payment_methods: 'card_only',
        operating_hours: {
          monday: { open: '08:00', close: '22:00' },
        },
      },
      menus: [],
      dishes: [],
      currentStep: 1,
    } as unknown as ReturnType<typeof loadRestaurantData>);

    const defaults = loadFormDefaults('user-123');
    expect(defaults.name).toBe('Test Restaurant');
    expect(defaults.restaurant_type).toBe('cafe');
    expect(defaults.location.country).toBe('GB');
    expect(defaults.location.address).toBe('123 Main St');
    expect(defaults.location.lat).toBe(51.5);
    expect(defaults.location.lng).toBe(-0.1);
    expect(defaults.delivery_available).toBe(false);
    expect(defaults.service_speed).toBe('fast-food');
    expect(defaults.payment_methods).toBe('card_only');
    expect(defaults.phone).toBe('+44123456');
  });

  it('handles partial saved data gracefully', () => {
    vi.mocked(loadRestaurantData).mockReturnValue({
      basicInfo: { name: 'Partial' },
      operations: {},
      menus: [],
      dishes: [],
      currentStep: 1,
    } as unknown as ReturnType<typeof loadRestaurantData>);

    const defaults = loadFormDefaults('user-123');
    expect(defaults.name).toBe('Partial');
    expect(defaults.location.city).toBe('');
    expect(defaults.delivery_available).toBe(true); // falls back to default
  });
});
