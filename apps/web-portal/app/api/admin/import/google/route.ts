import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, verifyAdminRequest } from '@/lib/supabase-server';
import {
  nearbySearchRestaurants,
  textSearchRestaurants,
  mapGooglePlaceToRestaurant,
  getMonthlyApiUsage,
  incrementApiUsage,
} from '@/lib/google-places';
import { importRestaurants } from '@/lib/import-service';
import type { MappedRestaurant } from '@/lib/import-types';

/** @param request */
export async function GET(request: NextRequest) {
  const auth = await verifyAdminRequest(request);
  if (auth.error || !auth.user) {
    return NextResponse.json(
      { error: auth.error ?? 'Unauthorized' },
      { status: auth.status ?? 401 }
    );
  }

  const supabase = createServerSupabaseClient();
  const usage = await getMonthlyApiUsage(supabase);
  return NextResponse.json(usage);
}

/** @param request */
export async function POST(request: NextRequest) {
  const auth = await verifyAdminRequest(request);
  if (auth.error || !auth.user) {
    return NextResponse.json(
      { error: auth.error ?? 'Unauthorized' },
      { status: auth.status ?? 401 }
    );
  }
  const user = auth.user;
  const adminId = user.id;
  const adminEmail = user.email ?? '';

  let lat: number;
  let lng: number;
  let radius: number;
  let maxPages: number;
  let textQuery: string | undefined;

  try {
    const body = await request.json();
    lat = body.lat;
    lng = body.lng;
    radius = body.radius;
    maxPages = typeof body.maxPages === 'number' ? body.maxPages : 1;
    textQuery =
      typeof body.textQuery === 'string' && body.textQuery.trim().length > 0
        ? body.textQuery.trim()
        : undefined;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof lat !== 'number' || lat < -90 || lat > 90) {
    return NextResponse.json({ error: 'lat must be a number between -90 and 90' }, { status: 400 });
  }
  if (typeof lng !== 'number' || lng < -180 || lng > 180) {
    return NextResponse.json(
      { error: 'lng must be a number between -180 and 180' },
      { status: 400 }
    );
  }
  if (typeof radius !== 'number' || radius < 100 || radius > 50000) {
    return NextResponse.json(
      { error: 'radius must be between 100 and 50000 meters' },
      { status: 400 }
    );
  }
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 10) {
    return NextResponse.json(
      { error: 'maxPages must be an integer between 1 and 10' },
      { status: 400 }
    );
  }

  const supabase = createServerSupabaseClient();

  const usage = await getMonthlyApiUsage(supabase);
  const budgetWarning =
    usage !== null && usage.calls > 900
      ? `Warning: ${usage.calls} API calls used this month (approaching 1000-call limit)`
      : undefined;

  const allMapped: MappedRestaurant[] = [];
  let apiCallsUsed = 0;
  let pageToken: string | undefined;
  let quotaWarning: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    try {
      const result = textQuery
        ? await textSearchRestaurants(textQuery, lat, lng, radius, pageToken)
        : await nearbySearchRestaurants(lat, lng, radius, pageToken);

      apiCallsUsed++;

      for (const place of result.places) {
        try {
          allMapped.push(mapGooglePlaceToRestaurant(place));
        } catch {
          // Individual place mapping failure — skip, continue
        }
      }

      if (!result.nextPageToken) {
        break;
      }
      pageToken = result.nextPageToken;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);

      if (msg.includes('403')) {
        // Quota exhausted — import what we have, include warning
        quotaWarning = 'Google Places API quota exceeded (403). Partial results imported.';
        break;
      }

      // Other page failure — skip this page, continue
      console.error(`Google Places search page ${page + 1} failed:`, msg);
    }
  }

  const summary = await importRestaurants(
    allMapped,
    'google_places',
    adminId,
    adminEmail,
    supabase,
    {
      apiCallsUsed,
      searchParams: { lat, lng, radius, maxPages, textQuery },
    }
  );

  if (apiCallsUsed > 0) {
    await incrementApiUsage(supabase, apiCallsUsed).catch(() => null);
  }

  const warnings: string[] = [];
  if (budgetWarning) warnings.push(budgetWarning);
  if (quotaWarning) warnings.push(quotaWarning);

  return NextResponse.json({
    ...summary,
    ...(warnings.length > 0 ? { warnings } : {}),
  });
}
