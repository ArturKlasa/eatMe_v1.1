import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, verifyAdminRequest } from '@/lib/supabase-server';
import { parseCsvToRestaurants } from '@/lib/csv-import';
import { importRestaurants } from '@/lib/import-service';

/** @param request */
export async function POST(request: NextRequest) {
  const auth = await verifyAdminRequest(request);
  if (auth.error || !auth.user) {
    return NextResponse.json(
      { error: auth.error ?? 'Unauthorized' },
      { status: auth.status ?? 401 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid multipart form data' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!file || typeof file === 'string') {
    return NextResponse.json(
      { error: 'No CSV file provided (field name: "file")' },
      { status: 400 }
    );
  }

  // Read file bytes and decode as text (try UTF-8, fall back to Latin-1)
  const buffer = await (file as File).arrayBuffer();
  let csvText: string;
  try {
    csvText = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    // Fall back to Latin-1 for files with non-UTF-8 encodings (common in Mexican datasets)
    csvText = new TextDecoder('latin1').decode(buffer);
  }

  const { restaurants, parseErrors } = parseCsvToRestaurants(csvText);

  // If there are structural errors (missing required columns) that prevented
  // any rows from being parsed, return 400 immediately.
  const structuralErrors = parseErrors.filter(
    e => e.field !== undefined && restaurants.length === 0
  );
  if (structuralErrors.length > 0 || (parseErrors.length > 0 && restaurants.length === 0)) {
    return NextResponse.json(
      {
        error: 'CSV parse failed',
        details: parseErrors.map(e => (e.field ? `Column "${e.field}": ${e.message}` : e.message)),
      },
      { status: 400 }
    );
  }

  const supabase = createServerSupabaseClient();
  const summary = await importRestaurants(
    restaurants,
    'csv',
    auth.user.id,
    auth.user.email ?? '',
    supabase,
    { searchParams: { filename: (file as File).name } }
  );

  // Merge any row-level parse errors into the summary errors list so the UI
  // can surface them alongside insert/validation errors.
  if (parseErrors.length > 0) {
    summary.errors.push(...parseErrors);
  }

  return NextResponse.json(summary);
}
