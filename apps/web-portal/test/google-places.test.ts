import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  inferCuisineFromGoogleTypes,
  mapGoogleHoursToOpenHours,
  mapAddressComponents,
  mapGooglePlaceToRestaurant,
  nearbySearchRestaurants,
  textSearchRestaurants,
  getMonthlyApiUsage,
  incrementApiUsage,
} from '@/lib/google-places';
import type { GooglePlace } from '@/lib/google-places';

// ─── inferCuisineFromGoogleTypes ──────────────────────────────────────────────

describe('inferCuisineFromGoogleTypes', () => {
  it('maps mexican_restaurant to Mexican', () => {
    expect(inferCuisineFromGoogleTypes(['mexican_restaurant'])).toEqual(['Mexican']);
  });

  it('returns empty array for generic "restaurant" type', () => {
    expect(inferCuisineFromGoogleTypes(['restaurant'])).toEqual([]);
  });

  it('maps multiple specific types to multiple cuisines', () => {
    const result = inferCuisineFromGoogleTypes(['italian_restaurant', 'pizza_restaurant']);
    expect(result).toContain('Italian');
    expect(result).toContain('Pizza');
    expect(result).toHaveLength(2);
  });

  it('deduplicates cuisines when multiple types map to the same value', () => {
    // hamburger_restaurant and american_restaurant both map to 'American'
    const result = inferCuisineFromGoogleTypes(['american_restaurant', 'hamburger_restaurant']);
    expect(result.filter((c) => c === 'American')).toHaveLength(1);
  });

  it('returns empty array for completely unknown types', () => {
    expect(inferCuisineFromGoogleTypes(['unknown_type_xyz'])).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    expect(inferCuisineFromGoogleTypes([])).toEqual([]);
  });
});

// ─── mapGoogleHoursToOpenHours ────────────────────────────────────────────────

describe('mapGoogleHoursToOpenHours', () => {
  it('returns empty object for null input (missing hours)', () => {
    expect(mapGoogleHoursToOpenHours(null)).toEqual({});
  });

  it('returns empty object for undefined input', () => {
    expect(mapGoogleHoursToOpenHours(undefined)).toEqual({});
  });

  it('returns empty object for empty periods array', () => {
    expect(mapGoogleHoursToOpenHours([])).toEqual({});
  });

  it('maps standard hours correctly', () => {
    const periods = [
      { open: { day: 1, hour: 9, minute: 0 }, close: { day: 1, hour: 21, minute: 0 } },
      { open: { day: 2, hour: 8, minute: 30 }, close: { day: 2, hour: 22, minute: 30 } },
    ];
    const result = mapGoogleHoursToOpenHours(periods);
    expect(result.monday).toEqual({ open: '09:00', close: '21:00' });
    expect(result.tuesday).toEqual({ open: '08:30', close: '22:30' });
  });

  it('handles 24h restaurants: open.hour=0, close.hour=0 on next day', () => {
    const periods = [
      { open: { day: 1, hour: 0, minute: 0 }, close: { day: 2, hour: 0, minute: 0 } },
    ];
    const result = mapGoogleHoursToOpenHours(periods);
    expect(result.monday).toEqual({ open: '00:00', close: '23:59' });
  });

  it('handles overnight hours (close.day != open.day)', () => {
    // Friday 18:00 → Saturday 02:00 → stored as close: "02:00" on Friday
    const periods = [
      { open: { day: 5, hour: 18, minute: 0 }, close: { day: 6, hour: 2, minute: 0 } },
    ];
    const result = mapGoogleHoursToOpenHours(periods);
    expect(result.friday).toEqual({ open: '18:00', close: '02:00' });
  });

  it('merges multiple periods per day using earliest open + latest close', () => {
    const periods = [
      { open: { day: 1, hour: 11, minute: 0 }, close: { day: 1, hour: 14, minute: 0 } },
      { open: { day: 1, hour: 18, minute: 0 }, close: { day: 1, hour: 22, minute: 0 } },
    ];
    const result = mapGoogleHoursToOpenHours(periods);
    expect(result.monday).toEqual({ open: '11:00', close: '22:00' });
  });

  it('handles period with no close (always open)', () => {
    const periods = [
      { open: { day: 0, hour: 0, minute: 0 } },
    ];
    const result = mapGoogleHoursToOpenHours(periods);
    expect(result.sunday).toEqual({ open: '00:00', close: '23:59' });
  });
});

// ─── mapAddressComponents ─────────────────────────────────────────────────────

describe('mapAddressComponents', () => {
  it('extracts standard Mexican address components', () => {
    const components = [
      { longText: 'Mexico', shortText: 'MX', types: ['country'], languageCode: 'en' },
      { longText: '06600', shortText: '06600', types: ['postal_code'], languageCode: 'es' },
      { longText: 'Ciudad de México', shortText: 'CDMX', types: ['administrative_area_level_1'], languageCode: 'es' },
      { longText: 'Cuauhtémoc', shortText: 'Cuauhtémoc', types: ['locality'], languageCode: 'es' },
      { longText: 'Juárez', shortText: 'Juárez', types: ['neighborhood', 'sublocality_level_1'], languageCode: 'es' },
    ];
    const result = mapAddressComponents(components);
    expect(result.country_code).toBe('MX');
    expect(result.postal_code).toBe('06600');
    expect(result.state).toBe('Ciudad de México');
    expect(result.city).toBe('Cuauhtémoc');
    expect(result.neighbourhood).toBe('Juárez');
  });

  it('returns MX as default when no country component present', () => {
    const result = mapAddressComponents([]);
    expect(result.country_code).toBe('MX');
  });

  it('handles minimal address (just country)', () => {
    const components = [
      { longText: 'Mexico', shortText: 'MX', types: ['country'] },
    ];
    const result = mapAddressComponents(components);
    expect(result.country_code).toBe('MX');
    expect(result.city).toBeUndefined();
    expect(result.state).toBeUndefined();
    expect(result.postal_code).toBeUndefined();
    expect(result.neighbourhood).toBeUndefined();
  });

  it('uses sublocality as city when locality is missing', () => {
    const components = [
      { longText: 'Mexico', shortText: 'MX', types: ['country'] },
      { longText: 'Delegación Iztapalapa', shortText: 'Iztapalapa', types: ['sublocality'] },
    ];
    const result = mapAddressComponents(components);
    expect(result.city).toBe('Delegación Iztapalapa');
  });

  it('prefers locality over sublocality for city', () => {
    const components = [
      { longText: 'Mexico', shortText: 'MX', types: ['country'] },
      { longText: 'SubLocality Name', shortText: 'SL', types: ['sublocality'] },
      { longText: 'Mexico City', shortText: 'CDMX', types: ['locality'] },
    ];
    const result = mapAddressComponents(components);
    expect(result.city).toBe('Mexico City');
  });
});

// ─── mapGooglePlaceToRestaurant ───────────────────────────────────────────────

const fullGooglePlace: GooglePlace = {
  id: 'ChIJfull123',
  displayName: { text: 'Taquería El Paisa', languageCode: 'es' },
  formattedAddress: 'Av Insurgentes Sur 1234, Col Narvarte, CDMX, Mexico',
  location: { latitude: 19.391, longitude: -99.167 },
  types: ['mexican_restaurant', 'restaurant'],
  primaryType: 'mexican_restaurant',
  addressComponents: [
    { longText: 'Mexico', shortText: 'MX', types: ['country'] },
    { longText: '03020', shortText: '03020', types: ['postal_code'] },
    { longText: 'Ciudad de México', shortText: 'CDMX', types: ['administrative_area_level_1'] },
    { longText: 'Benito Juárez', shortText: 'BJ', types: ['locality'] },
    { longText: 'Narvarte Poniente', shortText: 'Narvarte', types: ['neighborhood'] },
  ],
  regularOpeningHours: {
    periods: [
      { open: { day: 1, hour: 8, minute: 0 }, close: { day: 1, hour: 22, minute: 0 } },
    ],
  },
  nationalPhoneNumber: '+52 55 1234 5678',
  websiteUri: 'https://taqueriaelpaisa.com',
  dineIn: true,
  delivery: false,
  takeout: true,
  reservable: false,
};

describe('mapGooglePlaceToRestaurant', () => {
  it('maps all fields from a complete Google place', () => {
    const result = mapGooglePlaceToRestaurant(fullGooglePlace);
    expect(result.name).toBe('Taquería El Paisa');
    expect(result.address).toBe('Av Insurgentes Sur 1234, Col Narvarte, CDMX, Mexico');
    expect(result.latitude).toBe(19.391);
    expect(result.longitude).toBe(-99.167);
    expect(result.phone).toBe('+52 55 1234 5678');
    expect(result.website).toBe('https://taqueriaelpaisa.com');
    expect(result.cuisine_types).toContain('Mexican');
    expect(result.restaurant_type).toBe('restaurant');
    expect(result.country_code).toBe('MX');
    expect(result.google_place_id).toBe('ChIJfull123');
    expect(result.dine_in_available).toBe(true);
    expect(result.delivery_available).toBe(false);
    expect(result.takeout_available).toBe(true);
    expect(result.accepts_reservations).toBe(false);
    expect(result.open_hours?.monday).toEqual({ open: '08:00', close: '22:00' });
  });

  it('handles sparse place (missing hours, phone, website)', () => {
    const sparse: GooglePlace = {
      id: 'ChIJsparse',
      displayName: { text: 'Café Simple' },
      formattedAddress: 'Calle 5, CDMX',
      location: { latitude: 19.4, longitude: -99.1 },
      types: ['cafe'],
    };
    const result = mapGooglePlaceToRestaurant(sparse);
    expect(result.name).toBe('Café Simple');
    expect(result.phone).toBeUndefined();
    expect(result.website).toBeUndefined();
    expect(result.open_hours).toBeUndefined();
    expect(result.cuisine_types).toContain('Cafe');
    expect(result.restaurant_type).toBe('cafe');
  });

  it('returns empty string for name when displayName is missing', () => {
    const place: GooglePlace = {
      location: { latitude: 19.4, longitude: -99.1 },
      types: [],
    };
    const result = mapGooglePlaceToRestaurant(place);
    expect(result.name).toBe('');
  });

  it('sets open_hours to undefined when hours are missing (not empty object)', () => {
    const place: GooglePlace = {
      ...fullGooglePlace,
      regularOpeningHours: undefined,
    };
    const result = mapGooglePlaceToRestaurant(place);
    expect(result.open_hours).toBeUndefined();
  });
});

// ─── nearbySearchRestaurants ──────────────────────────────────────────────────

describe('nearbySearchRestaurants', () => {
  beforeEach(() => {
    process.env.GOOGLE_PLACES_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.GOOGLE_PLACES_API_KEY;
  });

  it('sends POST to correct URL with correct body and headers', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ places: [], nextPageToken: null }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await nearbySearchRestaurants(19.4326, -99.1332, 5000);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://places.googleapis.com/v1/places:searchNearby');
    expect(options.method).toBe('POST');

    const headers = options.headers as Record<string, string>;
    expect(headers['X-Goog-Api-Key']).toBe('test-api-key');
    expect(headers['X-Goog-FieldMask']).toContain('places.id');
    expect(headers['X-Goog-FieldMask']).toContain('places.regularOpeningHours');
    expect(headers['X-Goog-FieldMask']).toContain('places.dineIn');

    const body = JSON.parse(options.body as string);
    expect(body.includedTypes).toContain('restaurant');
    expect(body.includedTypes).toContain('cafe');
    expect(body.maxResultCount).toBe(20);
    expect(body.locationRestriction.circle.center.latitude).toBe(19.4326);
    expect(body.locationRestriction.circle.center.longitude).toBe(-99.1332);
    expect(body.locationRestriction.circle.radius).toBe(5000);
  });

  it('passes pageToken when provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ places: [] }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await nearbySearchRestaurants(19.4326, -99.1332, 5000, 'token-abc');

    const body = JSON.parse((mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.pageToken).toBe('token-abc');
  });

  it('returns places and nextPageToken from response', async () => {
    const mockPlaces: GooglePlace[] = [{ id: 'p1', displayName: { text: 'El Paisa' } }];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ places: mockPlaces, nextPageToken: 'next-token' }),
    }));

    const result = await nearbySearchRestaurants(19.4326, -99.1332, 5000);
    expect(result.places).toHaveLength(1);
    expect(result.nextPageToken).toBe('next-token');
  });

  it('returns nextPageToken as null when not in response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ places: [] }),
    }));

    const result = await nearbySearchRestaurants(19.4326, -99.1332, 5000);
    expect(result.nextPageToken).toBeNull();
  });

  it('throws when API key is not set', async () => {
    delete process.env.GOOGLE_PLACES_API_KEY;
    await expect(nearbySearchRestaurants(0, 0, 1000)).rejects.toThrow('GOOGLE_PLACES_API_KEY');
  });

  it('throws on non-OK response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => 'Bad Request',
    }));

    await expect(nearbySearchRestaurants(0, 0, 1000)).rejects.toThrow('400');
  });
});

// ─── textSearchRestaurants ────────────────────────────────────────────────────

describe('textSearchRestaurants', () => {
  beforeEach(() => {
    process.env.GOOGLE_PLACES_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.GOOGLE_PLACES_API_KEY;
  });

  it('sends POST with textQuery and locationBias in body', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ places: [] }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await textSearchRestaurants('tacos in Roma Norte', 19.4, -99.17, 3000);

    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://places.googleapis.com/v1/places:searchText');
    const body = JSON.parse(options.body as string);
    expect(body.textQuery).toBe('tacos in Roma Norte');
    expect(body.locationBias.circle.center.latitude).toBe(19.4);
    expect(body.locationBias.circle.radius).toBe(3000);
  });

  it('uses the same FieldMask as nearbySearch', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ places: [] }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await textSearchRestaurants('pizza', 19.4, -99.1, 5000);

    const headers = (mockFetch.mock.calls[0] as [string, RequestInit])[1].headers as Record<string, string>;
    expect(headers['X-Goog-FieldMask']).toContain('places.dineIn');
    expect(headers['X-Goog-FieldMask']).toContain('places.regularOpeningHours');
  });

  it('passes pageToken when provided', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ places: [] }),
    }));

    await textSearchRestaurants('tacos', 0, 0, 1000, 'page-token-xyz');

    const body = JSON.parse((vi.mocked(fetch).mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.pageToken).toBe('page-token-xyz');
  });
});

// ─── incrementApiUsage ────────────────────────────────────────────────────────

describe('incrementApiUsage', () => {
  it('creates a new row for current month when none exists', async () => {
    const insertMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: null }),
          })),
        })),
        insert: insertMock,
        update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({}) })),
      })),
    };

    await incrementApiUsage(supabase as never, 3);
    expect(insertMock).toHaveBeenCalledOnce();
    const insertArg = insertMock.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.api_calls).toBe(3);
    expect(typeof insertArg.month).toBe('string');
    expect((insertArg.month as string)).toMatch(/^\d{4}-\d{2}$/);
  });

  it('increments existing row for current month', async () => {
    const updateEqMock = vi.fn().mockResolvedValue({});
    const updateMock = vi.fn(() => ({ eq: updateEqMock }));
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: 'usage-1', api_calls: 10, estimated_cost_usd: 0.4 },
            }),
          })),
        })),
        insert: vi.fn(),
        update: updateMock,
      })),
    };

    await incrementApiUsage(supabase as never, 5);
    expect(updateMock).toHaveBeenCalledOnce();
    const updateArg = updateMock.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg.api_calls).toBe(15); // 10 existing + 5 new
  });
});

// ─── getMonthlyApiUsage ───────────────────────────────────────────────────────

describe('getMonthlyApiUsage', () => {
  it('returns zero when no row exists for current month', async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: null }),
          })),
        })),
      })),
    };
    const result = await getMonthlyApiUsage(supabase as never);
    expect(result.calls).toBe(0);
    expect(result.estimatedCost).toBe(0);
  });

  it('returns existing row values', async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { api_calls: 42, estimated_cost_usd: 1.68 },
            }),
          })),
        })),
      })),
    };
    const result = await getMonthlyApiUsage(supabase as never);
    expect(result.calls).toBe(42);
    expect(result.estimatedCost).toBeCloseTo(1.68);
  });
});
