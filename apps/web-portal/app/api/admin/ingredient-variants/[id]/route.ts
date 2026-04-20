import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, verifyAdminRequest } from '@/lib/supabase-server';

/**
 * PATCH /api/admin/ingredient-variants/[id]
 * Body: { needs_review?: boolean, modifier?: string | null, is_default?: boolean }
 *
 * Partial update of a variant. Supported fields:
 *   - needs_review: used by the review-queue "Accept" action
 *   - modifier:     rename the variant's modifier text
 *   - is_default:   promote this variant to default (demotes the previous one)
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifyAdminRequest(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'variant id required' }, { status: 400 });

  let body: { needs_review?: boolean; modifier?: string | null; is_default?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (typeof body.needs_review === 'boolean') update.needs_review = body.needs_review;
  if ('modifier' in body) {
    update.modifier = body.modifier === null ? null : body.modifier?.toString().trim() || null;
  }
  const promoteToDefault = body.is_default === true;
  if (typeof body.is_default === 'boolean') update.is_default = body.is_default;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No updatable fields in body' }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();

  // Enforce the single-default invariant: if the caller is promoting this
  // variant to default, clear the flag on the previous holder for the same
  // concept first. Demoting (is_default=false) is a no-op on siblings — the
  // concept can briefly have zero defaults until the admin picks a new one.
  if (promoteToDefault) {
    const { data: current } = await supabase
      .from('ingredient_variants')
      .select('concept_id')
      .eq('id', id)
      .maybeSingle();
    if (current) {
      await supabase
        .from('ingredient_variants')
        .update({ is_default: false })
        .eq('concept_id', current.concept_id)
        .neq('id', id)
        .eq('is_default', true);
    }
  }

  const { error } = await supabase.from('ingredient_variants').update(update).eq('id', id);

  if (error) {
    console.error('[ingredient-variants PATCH] failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/admin/ingredient-variants/[id]
 *
 * Deletes the variant. Migration 102 set dish_ingredients.variant_id to
 * ON DELETE SET NULL, so existing dish rows lose the variant specialization
 * but retain their concept-level ingredient link. Default variants cannot
 * be deleted — the concept would be left without one and the resolver
 * would fall back to a null variant_id on every new ingestion.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdminRequest(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'variant id required' }, { status: 400 });

  const supabase = createServerSupabaseClient();

  const { data: variant, error: lookupError } = await supabase
    .from('ingredient_variants')
    .select('id, is_default')
    .eq('id', id)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json({ error: lookupError.message }, { status: 500 });
  }
  if (!variant) {
    return NextResponse.json({ error: 'Variant not found' }, { status: 404 });
  }
  if (variant.is_default) {
    return NextResponse.json(
      { error: 'Cannot delete a default variant. Assign a different default first.' },
      { status: 409 }
    );
  }

  const { error: delError } = await supabase.from('ingredient_variants').delete().eq('id', id);

  if (delError) {
    console.error('[ingredient-variants DELETE] failed:', delError);
    return NextResponse.json({ error: delError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
