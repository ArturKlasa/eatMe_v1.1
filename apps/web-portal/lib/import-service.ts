import stringSimilarity from 'string-similarity';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@eatme/database';
import { validateImportedRestaurant } from '@/lib/import-validation';
import type {
  MappedRestaurant,
  ImportSummary,
  ImportError,
  ImportedRestaurantSummary,
  SkippedRestaurant,
  WarningFlag,
} from '@/lib/import-types';

type RestaurantRow = Database['public']['Tables']['restaurants']['Row'];

// Cost per 1K calls for Enterprise Plus tier
const COST_PER_CALL = 0.04;

/**
 * Deduplicates incoming restaurants against existing DB records.
 *
 * - Exact google_place_id match → toSkip (silently skip)
 * - Fuzzy name match (>= 0.8 similarity) within 200m → toFlag (insert but mark as possible_duplicate)
 * - No match → toInsert
 */
export async function deduplicateRestaurants(
  incoming: MappedRestaurant[],
  supabase: SupabaseClient<Database>
): Promise<{ toInsert: MappedRestaurant[]; toSkip: SkippedRestaurant[]; toFlag: MappedRestaurant[] }> {
  const toInsert: MappedRestaurant[] = [];
  const toSkip: SkippedRestaurant[] = [];
  const toFlag: MappedRestaurant[] = [];

  if (incoming.length === 0) {
    return { toInsert, toSkip, toFlag };
  }

  // Collect all google_place_ids from incoming that are defined
  const placeIds = incoming
    .map((r) => r.google_place_id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);

  // Fetch existing restaurants matching those place IDs
  const { data: existingByPlaceId } = placeIds.length > 0
    ? await supabase
        .from('restaurants')
        .select('id, google_place_id')
        .in('google_place_id', placeIds)
    : { data: [] };

  const exactMatchPlaceIds = new Set(
    (existingByPlaceId ?? []).map((r) => r.google_place_id).filter(Boolean)
  );

  // Determine bounding box for proximity check
  const lats = incoming.map((r) => r.latitude);
  const lngs = incoming.map((r) => r.longitude);
  const minLat = Math.min(...lats) - 0.002; // ~200m buffer
  const maxLat = Math.max(...lats) + 0.002;
  const minLng = Math.min(...lngs) - 0.002;
  const maxLng = Math.max(...lngs) + 0.002;

  // Fetch nearby existing restaurants without a place ID for fuzzy matching
  // We use a rough bounding box via PostgREST filter on location jsonb
  // Since we can't do ST_DWithin via PostgREST easily, we fetch nearby rows using lat/lng from location jsonb
  const { data: nearbyRestaurants } = await supabase
    .from('restaurants')
    .select('id, name, location')
    .is('google_place_id', null)
    .filter('location->>lat', 'gte', String(minLat))
    .filter('location->>lat', 'lte', String(maxLat))
    .filter('location->>lng', 'gte', String(minLng))
    .filter('location->>lng', 'lte', String(maxLng));

  const nearbyRows = nearbyRestaurants ?? [];

  for (const restaurant of incoming) {
    // Check exact place ID match first
    if (
      restaurant.google_place_id &&
      exactMatchPlaceIds.has(restaurant.google_place_id)
    ) {
      const existing = (existingByPlaceId ?? []).find(
        (r) => r.google_place_id === restaurant.google_place_id
      );
      toSkip.push({
        name: restaurant.name,
        google_place_id: restaurant.google_place_id,
        reason: 'exact_duplicate',
        existingId: existing?.id,
      });
      continue;
    }

    // Check fuzzy name + proximity match
    let isFuzzyDuplicate = false;
    for (const existing of nearbyRows) {
      if (!existing.name) continue;
      const similarity = stringSimilarity.compareTwoStrings(
        restaurant.name.toLowerCase(),
        existing.name.toLowerCase()
      );
      if (similarity >= 0.8) {
        // Check actual distance
        const existingLoc = existing.location as { lat?: number; lng?: number } | null;
        if (existingLoc?.lat !== undefined && existingLoc?.lng !== undefined) {
          const distanceMeters = haversineDistance(
            restaurant.latitude,
            restaurant.longitude,
            existingLoc.lat,
            existingLoc.lng
          );
          if (distanceMeters <= 200) {
            isFuzzyDuplicate = true;
            break;
          }
        }
      }
    }

    if (isFuzzyDuplicate) {
      toFlag.push(restaurant);
    } else {
      toInsert.push(restaurant);
    }
  }

  return { toInsert, toSkip, toFlag };
}

/**
 * Haversine distance between two lat/lng points, returns meters.
 */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Core import function used by both Google Places and CSV import paths.
 *
 * 1. Validates each restaurant
 * 2. Deduplicates against existing DB records
 * 3. Batch inserts new restaurants
 * 4. Creates a restaurant_import_jobs record
 * 5. Writes an admin_audit_log entry
 * 6. Returns an ImportSummary
 */
export async function importRestaurants(
  restaurants: MappedRestaurant[],
  source: 'google_places' | 'csv',
  adminId: string,
  adminEmail: string,
  supabase: SupabaseClient<Database>,
  options: { apiCallsUsed?: number; estimatedCostUsd?: number; searchParams?: Record<string, unknown> } = {}
): Promise<ImportSummary> {
  const errors: ImportError[] = [];
  const validRestaurants: MappedRestaurant[] = [];

  // Step 1: Validate
  for (let i = 0; i < restaurants.length; i++) {
    const result = validateImportedRestaurant(restaurants[i]);
    if (!result.valid) {
      result.errors.forEach((e) => errors.push({ ...e, index: i }));
    } else {
      validRestaurants.push(result.sanitized);
    }
  }

  // Step 2: Deduplicate
  const { toInsert, toSkip, toFlag } = await deduplicateRestaurants(validRestaurants, supabase);

  // Step 3: Build DB rows and batch insert
  const insertedSummaries: ImportedRestaurantSummary[] = [];
  const insertedIds: string[] = [];

  if (toInsert.length + toFlag.length > 0) {
    const rows = [...toInsert, ...toFlag].map((r) => ({
      name: r.name,
      address: r.address,
      // CRITICAL: set location as { lat, lng } jsonb — do NOT set location_point
      location: { lat: r.latitude, lng: r.longitude },
      phone: r.phone ?? null,
      website: r.website ?? null,
      restaurant_type: r.restaurant_type,
      cuisine_types: r.cuisine_types,
      country_code: r.country_code,
      city: r.city ?? null,
      state: r.state ?? null,
      postal_code: r.postal_code ?? null,
      neighbourhood: r.neighbourhood ?? null,
      open_hours: r.open_hours ?? null,
      delivery_available: r.delivery_available ?? null,
      takeout_available: r.takeout_available ?? null,
      dine_in_available: r.dine_in_available ?? null,
      accepts_reservations: r.accepts_reservations ?? null,
      payment_methods: r.payment_methods ?? null,
      google_place_id: r.google_place_id ?? null,
      is_active: true,
    }));

    const { data: inserted, error: insertError } = await supabase
      .from('restaurants')
      .insert(rows)
      .select('id, name, address, cuisine_types, open_hours, phone, website');

    if (insertError) {
      // If batch insert failed, record as errors and add error summaries for the results table
      const combinedRows = [...toInsert, ...toFlag];
      combinedRows.forEach((r, i) => {
        errors.push({
          index: i,
          message: insertError.message,
        });
        insertedSummaries.push({
          id: '',
          name: r.name,
          address: r.address,
          warnings: [],
          skipped: false,
          error: insertError.message,
        });
      });
    } else if (inserted) {
      const flaggedNames = new Set(toFlag.map((r) => r.name));
      for (const row of inserted) {
        const warnings: WarningFlag[] = [];
        if (flaggedNames.has(row.name)) warnings.push('possible_duplicate');
        insertedSummaries.push({
          id: row.id,
          name: row.name,
          address: row.address,
          warnings,
          skipped: false,
        });
        insertedIds.push(row.id);
      }
    }
  }

  // Add skipped restaurants to summary
  const skippedSummaries: ImportedRestaurantSummary[] = toSkip.map((s) => ({
    id: s.existingId ?? '',
    name: s.name,
    address: '',
    warnings: [],
    skipped: true,
    skipReason: s.reason === 'exact_duplicate' ? 'Already imported (same Google Place ID)' : 'Validation error',
  }));

  const totalFetched = restaurants.length;
  const totalInserted = insertedIds.length;
  const totalSkipped = toSkip.length;
  const totalFlagged = toFlag.length;
  const apiCallsUsed = options.apiCallsUsed ?? 0;
  const estimatedCostUsd = options.estimatedCostUsd ?? apiCallsUsed * COST_PER_CALL;

  // Step 4: Create import job record
  const { data: jobData } = await supabase
    .from('restaurant_import_jobs')
    .insert({
      admin_id: adminId,
      admin_email: adminEmail,
      source,
      status: 'completed',
      search_params: (options.searchParams ?? null) as Database['public']['Tables']['restaurant_import_jobs']['Insert']['search_params'],
      total_fetched: totalFetched,
      total_inserted: totalInserted,
      total_skipped: totalSkipped,
      total_flagged: totalFlagged,
      errors: errors as unknown as Database['public']['Tables']['restaurant_import_jobs']['Insert']['errors'],
      restaurant_ids: insertedIds,
      api_calls_used: apiCallsUsed,
      estimated_cost_usd: estimatedCostUsd,
      completed_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  const jobId = jobData?.id ?? crypto.randomUUID();

  // Step 5: Write audit log entry
  await supabase.from('admin_audit_log').insert({
    admin_id: adminId,
    admin_email: adminEmail,
    action: 'bulk_import',
    resource_type: 'restaurants',
    resource_id: jobId,
    new_data: {
      source,
      total_inserted: totalInserted,
      total_skipped: totalSkipped,
      total_flagged: totalFlagged,
      total_errors: errors.length,
    },
  });

  // Step 6: Return ImportSummary
  return {
    jobId,
    source,
    inserted: totalInserted,
    skipped: totalSkipped,
    flagged: totalFlagged,
    errors,
    restaurants: [...insertedSummaries, ...skippedSummaries],
    apiCallsUsed,
    estimatedCostUsd,
  };
}

/**
 * Computes warning flags for a restaurant based on its current state.
 * Pure function — flags are computed at query time, not stored.
 *
 * Note: 'possible_duplicate' is determined at import time and not re-computed here.
 */
export function computeWarningFlags(restaurant: RestaurantRow, dishCount: number): WarningFlag[] {
  const flags: WarningFlag[] = [];
  if (!restaurant.cuisine_types?.length) flags.push('missing_cuisine');
  if (!restaurant.open_hours || Object.keys(restaurant.open_hours as object).length === 0) {
    flags.push('missing_hours');
  }
  if (!restaurant.phone && !restaurant.website) flags.push('missing_contact');
  if (dishCount === 0) flags.push('missing_menu');
  return flags;
}
