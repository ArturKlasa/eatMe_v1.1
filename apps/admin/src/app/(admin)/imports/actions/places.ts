'use server';

import { z } from 'zod';
import { withAdminAuth } from '@/lib/auth/wrappers';
import type { ActionResult } from '@/lib/auth/wrappers';
import { createAdminServiceClient } from '@/lib/supabase/server';
import { logAdminAction } from '@/lib/audit';

const PLACES_API_BASE = 'https://places.googleapis.com/v1/places:searchNearby';
const MAX_ROWS_CAP = 1_000;

const fetchPlacesSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radius: z.number().min(50).max(50_000),
  maxRows: z.number().int().min(1).max(MAX_ROWS_CAP).optional().default(200),
});

export type FetchGooglePlacesInput = z.infer<typeof fetchPlacesSchema>;

export type GooglePlacesResult = {
  job_id: string;
  total_fetched: number;
  total_inserted: number;
  total_skipped: number;
};

type PlaceResult = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  internationalPhoneNumber?: string;
  websiteUri?: string;
  types?: string[];
};

export const fetchGooglePlaces = withAdminAuth<[FetchGooglePlacesInput], GooglePlacesResult>(
  async (ctx, input): Promise<ActionResult<GooglePlacesResult>> => {
    const parsed = fetchPlacesSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, formError: 'VALIDATION' };
    }

    const { lat, lng, radius, maxRows } = parsed.data;
    if (maxRows > MAX_ROWS_CAP) {
      return { ok: false, formError: 'VALIDATION' };
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      return { ok: false, formError: 'NO_API_KEY' };
    }

    const fieldMask = [
      'places.id',
      'places.displayName',
      'places.formattedAddress',
      'places.location',
      'places.internationalPhoneNumber',
      'places.websiteUri',
      'places.types',
    ].join(',');

    let allPlaces: PlaceResult[] = [];
    let pageToken: string | undefined;

    // Fetch pages until maxRows or no more pages
    do {
      const reqBody: Record<string, unknown> = {
        locationRestriction: {
          circle: { center: { latitude: lat, longitude: lng }, radius },
        },
        maxResultCount: Math.min(20, maxRows - allPlaces.length),
        rankPreference: 'DISTANCE',
      };
      if (pageToken) reqBody.pageToken = pageToken;

      const res = await fetch(PLACES_API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': fieldMask,
        },
        body: JSON.stringify(reqBody),
      });

      if (!res.ok) {
        return { ok: false, formError: 'PLACES_API_ERROR' };
      }

      const json = (await res.json()) as { places?: PlaceResult[]; nextPageToken?: string };
      allPlaces = allPlaces.concat(json.places ?? []);
      pageToken = json.nextPageToken;
    } while (pageToken && allPlaces.length < maxRows);

    allPlaces = allPlaces.slice(0, maxRows);

    const service = createAdminServiceClient();

    // Collect existing google_place_ids to dedup
    const placeIds = allPlaces.map(p => p.id).filter((id): id is string => Boolean(id));
    const existingSet = new Set<string>();
    if (placeIds.length > 0) {
      const { data: existing } = await service
        .from('restaurants')
        .select('google_place_id')
        .in('google_place_id', placeIds);
      for (const r of existing ?? []) {
        if (r.google_place_id) existingSet.add(r.google_place_id);
      }
    }

    const toInsert = allPlaces.filter(p => p.id && !existingSet.has(p.id));
    const restaurantIds: string[] = [];

    for (const place of toInsert) {
      const hasCoords = place.location?.latitude != null && place.location?.longitude != null;
      const insertPayload = {
        name: place.displayName?.text ?? 'Unknown',
        address: place.formattedAddress ?? '',
        google_place_id: place.id ?? null,
        phone: place.internationalPhoneNumber ?? null,
        website: place.websiteUri ?? null,
        status: 'draft' as const,
        allergens: [] as string[],
        dietary_tags: [] as string[],
        ...(hasCoords
          ? {
              location:
                `POINT(${place.location!.longitude} ${place.location!.latitude})` as unknown as null,
            }
          : {}),
      };

      const { data: inserted } = await service
        .from('restaurants')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .insert(insertPayload as any)
        .select('id')
        .single();

      if (inserted?.id) restaurantIds.push(inserted.id);
    }

    // Track API usage (best-effort)
    const month = new Date().toISOString().slice(0, 7);
    try {
      await service
        .from('google_api_usage')
        .upsert(
          {
            month,
            api_calls: allPlaces.length,
            estimated_cost_usd: (allPlaces.length / 1000) * 40,
          },
          { onConflict: 'month' }
        );
    } catch {
      // best-effort: ignore usage tracking failures
    }

    // Create import job record
    const { data: jobRow } = await service
      .from('restaurant_import_jobs')
      .insert({
        admin_id: ctx.userId,
        admin_email: ctx.user.email ?? '',
        source: 'google_places',
        status: 'completed',
        search_params: { lat, lng, radius, maxRows },
        total_fetched: allPlaces.length,
        total_inserted: restaurantIds.length,
        total_skipped: allPlaces.length - toInsert.length,
        total_flagged: 0,
        restaurant_ids: restaurantIds,
        api_calls_used: allPlaces.length,
        estimated_cost_usd: (allPlaces.length / 1000) * 40,
        completed_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    const jobId = jobRow?.id ?? 'unknown';

    await logAdminAction(
      service,
      { adminId: ctx.userId, adminEmail: ctx.user.email ?? '' },
      'google_places_import',
      'restaurant_import_job',
      jobId,
      null,
      { lat, lng, radius, total_inserted: restaurantIds.length }
    );

    return {
      ok: true,
      data: {
        job_id: jobId,
        total_fetched: allPlaces.length,
        total_inserted: restaurantIds.length,
        total_skipped: allPlaces.length - toInsert.length,
      },
    };
  }
);
