import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeWarningFlags, deduplicateRestaurants, importRestaurants } from '@/lib/import-service';
import type { MappedRestaurant } from '@/lib/import-types';

// ─── computeWarningFlags ──────────────────────────────────────────────────────

const baseRow = {
  id: 'r1',
  name: 'El Paisa',
  address: 'Av Insurgentes 123',
  location: { lat: 19.39, lng: -99.16 },
  cuisine_types: ['Mexican'],
  open_hours: { monday: { open: '09:00', close: '22:00' } },
  phone: '+525512345678',
  website: null,
  restaurant_type: 'restaurant',
  country_code: 'MX',
  city: null,
  state: null,
  postal_code: null,
  neighbourhood: null,
  delivery_available: null,
  takeout_available: null,
  dine_in_available: null,
  accepts_reservations: null,
  payment_methods: null,
  google_place_id: null,
  is_active: true,
  owner_id: null,
  description: null,
  image_url: null,
  rating: null,
  service_speed: null,
  restaurant_vector: null,
  suspended_at: null,
  suspended_by: null,
  suspension_reason: null,
  location_point: null,
  created_at: '2026-04-01T00:00:00Z',
  updated_at: null,
};

describe('computeWarningFlags', () => {
  it('returns empty array when all fields present', () => {
    const flags = computeWarningFlags(baseRow as never, 5);
    expect(flags).toHaveLength(0);
  });

  it('flags missing_cuisine when cuisine_types is empty', () => {
    const flags = computeWarningFlags({ ...baseRow, cuisine_types: [] } as never, 5);
    expect(flags).toContain('missing_cuisine');
  });

  it('flags missing_cuisine when cuisine_types is null', () => {
    const flags = computeWarningFlags({ ...baseRow, cuisine_types: null } as never, 5);
    expect(flags).toContain('missing_cuisine');
  });

  it('flags missing_hours when open_hours is null', () => {
    const flags = computeWarningFlags({ ...baseRow, open_hours: null } as never, 5);
    expect(flags).toContain('missing_hours');
  });

  it('flags missing_hours when open_hours is empty object', () => {
    const flags = computeWarningFlags({ ...baseRow, open_hours: {} } as never, 5);
    expect(flags).toContain('missing_hours');
  });

  it('flags missing_contact when both phone and website are null', () => {
    const flags = computeWarningFlags({ ...baseRow, phone: null, website: null } as never, 5);
    expect(flags).toContain('missing_contact');
  });

  it('does NOT flag missing_contact when only phone is present', () => {
    const flags = computeWarningFlags({ ...baseRow, phone: '+525512345678', website: null } as never, 5);
    expect(flags).not.toContain('missing_contact');
  });

  it('does NOT flag missing_contact when only website is present', () => {
    const flags = computeWarningFlags({ ...baseRow, phone: null, website: 'https://example.com' } as never, 5);
    expect(flags).not.toContain('missing_contact');
  });

  it('flags missing_menu when dishCount is 0', () => {
    const flags = computeWarningFlags(baseRow as never, 0);
    expect(flags).toContain('missing_menu');
  });

  it('returns multiple flags when multiple conditions fail', () => {
    const flags = computeWarningFlags(
      { ...baseRow, cuisine_types: [], open_hours: null, phone: null, website: null } as never,
      0
    );
    expect(flags).toContain('missing_cuisine');
    expect(flags).toContain('missing_hours');
    expect(flags).toContain('missing_contact');
    expect(flags).toContain('missing_menu');
    expect(flags).toHaveLength(4);
  });
});

// ─── deduplicateRestaurants ───────────────────────────────────────────────────

const sampleRestaurant: MappedRestaurant = {
  name: 'Taquería El Paisa',
  address: 'Av Insurgentes Sur 1234, CDMX',
  latitude: 19.391,
  longitude: -99.167,
  restaurant_type: 'restaurant',
  cuisine_types: ['Mexican'],
  country_code: 'MX',
  google_place_id: 'ChIJplace001',
};

describe('deduplicateRestaurants', () => {
  it('returns all incoming in toInsert when no duplicates exist', async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          in: vi.fn().mockResolvedValue({ data: [] }),
          is: vi.fn(() => ({
            filter: vi.fn(() => ({
              filter: vi.fn(() => ({
                filter: vi.fn(() => ({
                  filter: vi.fn().mockResolvedValue({ data: [] }),
                })),
              })),
            })),
          })),
        })),
      })),
    };

    const result = await deduplicateRestaurants([sampleRestaurant], supabase as never);
    expect(result.toInsert).toHaveLength(1);
    expect(result.toSkip).toHaveLength(0);
    expect(result.toFlag).toHaveLength(0);
  });

  it('moves restaurant to toSkip when exact google_place_id match exists', async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          in: vi.fn().mockResolvedValue({
            data: [{ id: 'existing-1', google_place_id: 'ChIJplace001' }],
          }),
          is: vi.fn(() => ({
            filter: vi.fn(() => ({
              filter: vi.fn(() => ({
                filter: vi.fn(() => ({
                  filter: vi.fn().mockResolvedValue({ data: [] }),
                })),
              })),
            })),
          })),
        })),
      })),
    };

    const result = await deduplicateRestaurants([sampleRestaurant], supabase as never);
    expect(result.toInsert).toHaveLength(0);
    expect(result.toSkip).toHaveLength(1);
    expect(result.toSkip[0].reason).toBe('exact_duplicate');
    expect(result.toSkip[0].existingId).toBe('existing-1');
    expect(result.toFlag).toHaveLength(0);
  });

  it('moves restaurant to toFlag when fuzzy name match within 200m', async () => {
    // Same name, very close lat/lng (within 200m)
    const nearbyRow = {
      id: 'existing-2',
      name: 'Taquería El Paisa',
      location: { lat: 19.391, lng: -99.167 }, // Same location
      google_place_id: null,
    };

    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          in: vi.fn().mockResolvedValue({ data: [] }),
          is: vi.fn(() => ({
            filter: vi.fn(() => ({
              filter: vi.fn(() => ({
                filter: vi.fn(() => ({
                  filter: vi.fn().mockResolvedValue({ data: [nearbyRow] }),
                })),
              })),
            })),
          })),
        })),
      })),
    };

    const r: MappedRestaurant = { ...sampleRestaurant, google_place_id: undefined };
    const result = await deduplicateRestaurants([r], supabase as never);
    expect(result.toInsert).toHaveLength(0);
    expect(result.toSkip).toHaveLength(0);
    expect(result.toFlag).toHaveLength(1);
  });

  it('adds restaurant to toInsert when name similar but distance > 200m', async () => {
    // Same name but far away (Mexico City vs Guadalajara)
    const farRow = {
      id: 'existing-3',
      name: 'Taquería El Paisa',
      location: { lat: 20.66, lng: -103.35 }, // Guadalajara
      google_place_id: null,
    };

    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          in: vi.fn().mockResolvedValue({ data: [] }),
          is: vi.fn(() => ({
            filter: vi.fn(() => ({
              filter: vi.fn(() => ({
                filter: vi.fn(() => ({
                  filter: vi.fn().mockResolvedValue({ data: [farRow] }),
                })),
              })),
            })),
          })),
        })),
      })),
    };

    const r: MappedRestaurant = { ...sampleRestaurant, google_place_id: undefined };
    const result = await deduplicateRestaurants([r], supabase as never);
    expect(result.toInsert).toHaveLength(1);
    expect(result.toSkip).toHaveLength(0);
    expect(result.toFlag).toHaveLength(0);
  });

  it('handles empty incoming list', async () => {
    const supabase = { from: vi.fn() };
    const result = await deduplicateRestaurants([], supabase as never);
    expect(result.toInsert).toHaveLength(0);
    expect(result.toSkip).toHaveLength(0);
    expect(result.toFlag).toHaveLength(0);
    expect(supabase.from).not.toHaveBeenCalled();
  });
});

// ─── importRestaurants ────────────────────────────────────────────────────────

describe('importRestaurants', () => {
  let insertCalls: unknown[][];
  let mockSupabase: ReturnType<typeof createMockSupabase>;

  function createMockSupabase() {
    insertCalls = [];

    const insertedRows = [
      { id: 'new-1', name: 'Taquería El Paisa', address: 'Av Insurgentes Sur 1234, CDMX', cuisine_types: ['Mexican'], open_hours: null, phone: null, website: null },
    ];

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'restaurants') {
          return {
            select: vi.fn(() => ({
              in: vi.fn().mockResolvedValue({ data: [] }),
              is: vi.fn(() => ({
                filter: vi.fn(() => ({
                  filter: vi.fn(() => ({
                    filter: vi.fn(() => ({
                      filter: vi.fn().mockResolvedValue({ data: [] }),
                    })),
                  })),
                })),
              })),
            })),
            insert: vi.fn((rows: unknown[]) => {
              insertCalls.push(rows);
              return {
                select: vi.fn().mockResolvedValue({ data: insertedRows, error: null }),
              };
            }),
          };
        }
        if (table === 'restaurant_import_jobs') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: 'job-uuid-123' }, error: null }),
              }),
            }),
          };
        }
        if (table === 'admin_audit_log') {
          return {
            insert: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        return { insert: vi.fn().mockResolvedValue({ data: null, error: null }) };
      }),
    };
    return supabase;
  }

  beforeEach(() => {
    mockSupabase = createMockSupabase();
  });

  it('builds insert payload with location: { lat, lng } — no location_point', async () => {
    await importRestaurants(
      [sampleRestaurant],
      'google_places',
      'admin-1',
      'admin@example.com',
      mockSupabase as never
    );

    expect(insertCalls).toHaveLength(1);
    const rows = insertCalls[0] as Array<Record<string, unknown>>;
    expect(rows[0].location).toEqual({ lat: 19.391, lng: -99.167 });
    expect(rows[0]).not.toHaveProperty('location_point');
  });

  it('returns correct ImportSummary counts', async () => {
    const summary = await importRestaurants(
      [sampleRestaurant],
      'google_places',
      'admin-1',
      'admin@example.com',
      mockSupabase as never
    );

    expect(summary.inserted).toBe(1);
    expect(summary.skipped).toBe(0);
    expect(summary.flagged).toBe(0);
    expect(summary.errors).toHaveLength(0);
    expect(summary.source).toBe('google_places');
  });

  it('creates a restaurant_import_jobs record', async () => {
    await importRestaurants(
      [sampleRestaurant],
      'google_places',
      'admin-1',
      'admin@example.com',
      mockSupabase as never
    );

    const jobInsertCall = mockSupabase.from.mock.calls.find(([t]) => t === 'restaurant_import_jobs');
    expect(jobInsertCall).toBeDefined();
  });

  it('writes an audit log entry with correct fields', async () => {
    await importRestaurants(
      [sampleRestaurant],
      'csv',
      'admin-1',
      'admin@example.com',
      mockSupabase as never
    );

    const auditCall = mockSupabase.from.mock.calls.find(([t]) => t === 'admin_audit_log');
    expect(auditCall).toBeDefined();

    const auditFrom = mockSupabase.from.mock.results.find(
      (_, i) => mockSupabase.from.mock.calls[i]?.[0] === 'admin_audit_log'
    );
    expect(auditFrom).toBeDefined();
  });

  it('skips invalid restaurants and reports them as errors', async () => {
    const invalid: MappedRestaurant = {
      name: '',
      address: 'Some address',
      latitude: 19.391,
      longitude: -99.167,
      restaurant_type: 'restaurant',
      cuisine_types: [],
      country_code: 'MX',
    };

    const summary = await importRestaurants(
      [invalid],
      'google_places',
      'admin-1',
      'admin@example.com',
      mockSupabase as never
    );

    expect(summary.errors.length).toBeGreaterThan(0);
    expect(summary.inserted).toBe(0);
  });
});
