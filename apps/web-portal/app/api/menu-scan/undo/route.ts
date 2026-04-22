import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, verifyAdminRequest } from '@/lib/supabase-server';

const UNDO_WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: NextRequest) {
  const auth = await verifyAdminRequest(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: { job_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { job_id } = body;
  if (!job_id) {
    return NextResponse.json({ error: 'job_id is required' }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();

  const { data: job, error: jobError } = await supabase
    .from('menu_scan_jobs')
    .select('id, status, saved_dish_ids, saved_at')
    .eq('id', job_id)
    .single();

  if (jobError || !job) {
    return NextResponse.json({ error: 'Scan job not found' }, { status: 404 });
  }

  const savedDishIds = job.saved_dish_ids as string[] | null;
  if (!job.saved_at || !savedDishIds?.length) {
    return NextResponse.json({ error: 'No saved state to undo' }, { status: 409 });
  }

  const diffMs = Date.now() - new Date(job.saved_at as string).getTime();
  if (diffMs > UNDO_WINDOW_MS) {
    return NextResponse.json({ error: 'Undo window has expired (15 minutes)' }, { status: 409 });
  }

  // CASCADE on dish_courses, dish_course_items, dish_ingredients handles related rows.
  const { error: deleteError } = await supabase.from('dishes').delete().in('id', savedDishIds);

  if (deleteError) {
    console.error('[MenuScan/undo] Delete error:', deleteError);
    return NextResponse.json({ error: 'Failed to undo: ' + deleteError.message }, { status: 500 });
  }

  await supabase
    .from('menu_scan_jobs')
    .update({
      status: 'needs_review',
      saved_dish_ids: null,
      saved_at: null,
      dishes_saved: 0,
    })
    .eq('id', job_id);

  return NextResponse.json({ undone: savedDishIds.length });
}
