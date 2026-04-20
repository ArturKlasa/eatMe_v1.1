import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, verifyAdminRequest } from '@/lib/supabase-server';

/**
 * POST /api/admin/ingredient-concepts/[id]/variants
 * Body: { modifier: string | null, is_default?: boolean }
 *
 * Creates a new variant under the concept. Admin-created variants are never
 * flagged `needs_review` — only the resolver's auto-creation uses that flag.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifyAdminRequest(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id: conceptId } = await params;
  if (!conceptId) return NextResponse.json({ error: 'concept id required' }, { status: 400 });

  let body: { modifier?: string | null; is_default?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const modifier = body.modifier === null ? null : body.modifier?.trim() || null;
  const is_default = body.is_default === true;

  const supabase = createServerSupabaseClient();

  // If the caller promotes the new variant to default, clear the flag on any
  // existing default for this concept — the schema allows only one.
  if (is_default) {
    const { error } = await supabase
      .from('ingredient_variants')
      .update({ is_default: false })
      .eq('concept_id', conceptId)
      .eq('is_default', true);
    if (error) {
      console.error('[variants POST] clear previous default failed:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  const { data, error } = await supabase
    .from('ingredient_variants')
    .insert({
      concept_id: conceptId,
      modifier,
      is_default,
      needs_review: false,
    })
    .select('id, modifier, is_default, needs_review, created_at')
    .single();

  if (error || !data) {
    console.error('[variants POST] insert failed:', error);
    return NextResponse.json({ error: error?.message ?? 'Insert failed' }, { status: 500 });
  }
  return NextResponse.json({ variant: data });
}
