import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminAuthRoute } from '@/lib/auth/route-wrappers';
import { createAdminServiceClient } from '@/lib/supabase/server';
import { logAdminAction } from '@/lib/audit';

const csvRowSchema = z.object({
  name: z.string().min(1, 'name is required'),
  address: z.string().optional().default(''),
  city: z.string().optional().default(''),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  phone: z.string().optional().default(''),
  website: z.string().optional().default(''),
  google_place_id: z.string().optional().default(''),
  cuisine_types: z.string().optional().default(''),
});

type CsvRow = z.infer<typeof csvRowSchema>;

const requestBodySchema = z.object({
  rows: z.array(z.unknown()).min(1).max(500),
});

export type ImportCsvResult = {
  job_id: string;
  total_fetched: number;
  total_inserted: number;
  total_skipped: number;
  total_flagged: number;
  errors: Array<{ index: number; field: string; message: string }>;
  inserted: Array<{ index: number; id: string; possible_duplicate: boolean }>;
};

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function nameSimilarity(a: string, b: string): number {
  const la = a.toLowerCase().trim();
  const lb = b.toLowerCase().trim();
  if (la === lb) return 1;
  const longer = la.length >= lb.length ? la : lb;
  const shorter = la.length >= lb.length ? lb : la;
  const dist = levenshtein(longer, shorter);
  return (longer.length - dist) / longer.length;
}

// Haversine distance in meters between two lat/lng points
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

type CandidateRow = {
  id: string;
  name: string;
  google_place_id: string | null;
  // lat/lng extracted from GeoJSON location if available
  lat?: number | null;
  lng?: number | null;
};

async function findFuzzyDuplicate(
  service: ReturnType<typeof createAdminServiceClient>,
  row: CsvRow,
  existingPlaceIds: Set<string>
): Promise<boolean> {
  if (!row.name) return false;

  // Query candidates by city; location-based proximity deferred to RPC if added later
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (service.from('restaurants') as any).select('id, name, google_place_id').limit(200);

  if (row.city) {
    query = query.ilike('city', row.city);
  }

  const { data } = (await query) as { data: CandidateRow[] | null };
  if (!data || data.length === 0) return false;

  for (const candidate of data) {
    if (candidate.google_place_id && existingPlaceIds.has(candidate.google_place_id)) continue;

    const sim = nameSimilarity(row.name, candidate.name ?? '');
    if (sim < 0.75) continue;

    // If both have coordinates, check 200 m proximity
    if (row.lat != null && row.lng != null && candidate.lat != null && candidate.lng != null) {
      const dist = haversineMeters(row.lat, row.lng, candidate.lat, candidate.lng);
      if (dist <= 200) return true;
    } else if (sim >= 0.85) {
      // High name similarity in same city — flag without coordinate confirmation
      return true;
    }
  }
  return false;
}

export const POST = withAdminAuthRoute(async (ctx, req: NextRequest) => {
  const body = await req.json().catch(() => null);
  const parsed = requestBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 });
  }

  const service = createAdminServiceClient();
  const errors: ImportCsvResult['errors'] = [];
  const inserted: ImportCsvResult['inserted'] = [];
  let skipped = 0;

  // Validate all rows first
  const validRows: Array<{ index: number; row: CsvRow }> = [];
  for (let i = 0; i < parsed.data.rows.length; i++) {
    const result = csvRowSchema.safeParse(parsed.data.rows[i]);
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push({ index: i, field: issue.path.join('.') || 'row', message: issue.message });
      }
    } else {
      validRows.push({ index: i, row: result.data });
    }
  }

  // Collect existing google_place_ids for dedup
  const existingPlaceIds = new Set<string>();
  const placeIdsToCheck = validRows
    .map(({ row }) => row.google_place_id)
    .filter((id): id is string => Boolean(id));

  if (placeIdsToCheck.length > 0) {
    const { data: existingRows } = await service
      .from('restaurants')
      .select('google_place_id')
      .in('google_place_id', placeIdsToCheck);
    for (const r of (existingRows ?? []) as Array<{ google_place_id: string | null }>) {
      if (r.google_place_id) existingPlaceIds.add(r.google_place_id);
    }
  }

  // Insert valid rows
  const restaurantIds: string[] = [];
  for (const { index, row } of validRows) {
    // Exact dedup on google_place_id
    if (row.google_place_id && existingPlaceIds.has(row.google_place_id)) {
      skipped++;
      continue;
    }

    // Fuzzy dedup check (name similarity + same city)
    const isPossibleDuplicate = await findFuzzyDuplicate(service, row, existingPlaceIds);

    const cuisineArr = row.cuisine_types
      ? row.cuisine_types
          .split(',')
          .map(c => c.trim())
          .filter(Boolean)
      : [];

    const insertPayload = {
      name: row.name,
      address: row.address || '',
      city: row.city || null,
      phone: row.phone || null,
      website: row.website || null,
      google_place_id: row.google_place_id || null,
      cuisine_types: cuisineArr.length > 0 ? cuisineArr : null,
      status: 'draft' as const,
      allergens: [] as string[],
      dietary_tags: [] as string[],
      ...(row.lat != null && row.lng != null
        ? { location: `POINT(${row.lng} ${row.lat})` as unknown as null }
        : {}),
    };

    const { data: newRow, error: insertError } = await service
      .from('restaurants')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert(insertPayload as any)
      .select('id')
      .single();

    if (insertError || !newRow) {
      errors.push({ index, field: 'row', message: insertError?.message ?? 'INSERT_FAILED' });
      continue;
    }

    restaurantIds.push(newRow.id);
    inserted.push({ index, id: newRow.id, possible_duplicate: isPossibleDuplicate });
  }

  // Create import job record
  const { data: jobRow } = await service
    .from('restaurant_import_jobs')
    .insert({
      admin_id: ctx.userId,
      admin_email: ctx.user.email ?? '',
      source: 'csv',
      status: 'completed',
      search_params: { filename: 'csv-upload', row_count: parsed.data.rows.length } as never,
      total_fetched: parsed.data.rows.length,
      total_inserted: inserted.length,
      total_skipped: skipped,
      total_flagged: inserted.filter(r => r.possible_duplicate).length,
      errors: errors as never,
      restaurant_ids: restaurantIds,
      completed_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  const jobId = jobRow?.id ?? 'unknown';

  await logAdminAction(
    service,
    { adminId: ctx.userId, adminEmail: ctx.user.email ?? '' },
    'csv_import',
    'restaurant_import_job',
    jobId,
    null,
    {
      total_inserted: inserted.length,
      total_skipped: skipped,
      total_flagged: inserted.filter(r => r.possible_duplicate).length,
    }
  );

  const result: ImportCsvResult = {
    job_id: jobId,
    total_fetched: parsed.data.rows.length,
    total_inserted: inserted.length,
    total_skipped: skipped,
    total_flagged: inserted.filter(r => r.possible_duplicate).length,
    errors,
    inserted,
  };

  return NextResponse.json({ ok: true, data: result });
});
