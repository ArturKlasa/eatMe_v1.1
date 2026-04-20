import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, verifyAdminRequest } from '@/lib/supabase-server';

/**
 * POST /api/admin/ingredient-variants/[id]/merge
 * Body: { target_variant_id: string }
 *
 * Reassigns all dish_ingredients.variant_id references from the source
 * variant to the target, then deletes the source. Both variants must
 * belong to the same concept — we refuse cross-concept merges because
 * that would quietly change the ingredient concept on existing dishes.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifyAdminRequest(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id: sourceId } = await params;
  if (!sourceId) return NextResponse.json({ error: 'variant id required' }, { status: 400 });

  let body: { target_variant_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const targetId = body.target_variant_id;
  if (!targetId) {
    return NextResponse.json({ error: 'target_variant_id is required' }, { status: 400 });
  }
  if (targetId === sourceId) {
    return NextResponse.json({ error: 'Cannot merge a variant into itself' }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();

  const { data: variants, error: lookupError } = await supabase
    .from('ingredient_variants')
    .select('id, concept_id, is_default')
    .in('id', [sourceId, targetId]);

  if (lookupError) {
    return NextResponse.json({ error: lookupError.message }, { status: 500 });
  }

  const source = variants?.find(v => v.id === sourceId);
  const target = variants?.find(v => v.id === targetId);
  if (!source || !target) {
    return NextResponse.json({ error: 'Source or target variant not found' }, { status: 404 });
  }
  if (source.concept_id !== target.concept_id) {
    return NextResponse.json(
      { error: 'Merge targets must belong to the same concept' },
      { status: 409 }
    );
  }
  if (source.is_default) {
    return NextResponse.json(
      { error: 'Cannot merge the default variant. Assign a different default first.' },
      { status: 409 }
    );
  }

  // Reassign dish_ingredients pointers before deleting the source. Done in
  // two steps (update then delete) because PostgREST has no transaction
  // primitive — if the UPDATE succeeds and the DELETE fails, the variant
  // is still merge-safe: admins can retry the DELETE via the standard
  // delete action (no refs remain).
  const { error: updateError } = await supabase
    .from('dish_ingredients')
    .update({ variant_id: targetId })
    .eq('variant_id', sourceId);

  if (updateError) {
    console.error('[ingredient-variants/merge] update failed:', updateError);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const { error: deleteError } = await supabase
    .from('ingredient_variants')
    .delete()
    .eq('id', sourceId);

  if (deleteError) {
    console.error('[ingredient-variants/merge] delete failed:', deleteError);
    return NextResponse.json(
      {
        error: `References reassigned to target, but deleting the source failed: ${deleteError.message}`,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
