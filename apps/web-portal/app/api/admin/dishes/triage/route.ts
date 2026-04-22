import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, verifyAdminRequest } from '@/lib/supabase-server';

interface TriageEntry {
  dish_id: string;
  before_kind: string;
  after_kind: 'course_menu' | 'buffet';
}

export async function POST(request: NextRequest) {
  const auth = await verifyAdminRequest(request);
  if (auth.error || !auth.user) {
    return NextResponse.json(
      { error: auth.error },
      { status: (auth as { status: number }).status }
    );
  }
  const adminUser = auth.user;

  let entries: TriageEntry[];
  try {
    entries = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!Array.isArray(entries) || entries.length === 0) {
    return NextResponse.json(
      { error: 'Expected a non-empty array of triage entries' },
      { status: 400 }
    );
  }

  const validKinds = new Set(['course_menu', 'buffet']);
  for (const entry of entries) {
    if (!entry.dish_id || !entry.after_kind || !validKinds.has(entry.after_kind)) {
      return NextResponse.json(
        { error: `Invalid entry: dish_id and after_kind (course_menu|buffet) are required` },
        { status: 400 }
      );
    }
  }

  const supabase = createServerSupabaseClient();
  const now = new Date().toISOString();

  const errors: string[] = [];
  let updated = 0;

  for (const entry of entries) {
    const { error: updateError } = await supabase
      .from('dishes')
      .update({ dish_kind: entry.after_kind })
      .eq('id', entry.dish_id);

    if (updateError) {
      errors.push(`Failed to update dish ${entry.dish_id}: ${updateError.message}`);
      continue;
    }

    const { error: auditError } = await supabase.from('admin_audit_log').insert({
      admin_id: adminUser.id,
      admin_email: adminUser.email ?? '',
      action: 'dish_kind_triage',
      resource_type: 'dish',
      resource_id: entry.dish_id,
      old_data: { dish_kind: entry.before_kind },
      new_data: { dish_kind: entry.after_kind },
      created_at: now,
    });

    if (auditError) {
      // Non-fatal: update succeeded; log the audit failure but don't roll back.
      console.error('[triage] Audit log insert failed:', auditError.message);
    }

    updated++;
  }

  if (updated === 0) {
    return NextResponse.json(
      { error: `All updates failed. First: ${errors[0] ?? 'unknown'}`, errors },
      { status: 500 }
    );
  }

  return NextResponse.json({ updated, errors: errors.length > 0 ? errors : undefined });
}
