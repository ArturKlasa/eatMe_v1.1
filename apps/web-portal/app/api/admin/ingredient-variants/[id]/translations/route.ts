import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, verifyAdminRequest } from '@/lib/supabase-server';

/**
 * PUT /api/admin/ingredient-variants/[id]/translations
 * Body: { language: string, name: string }
 *
 * Upserts a variant translation. Empty/missing name deletes the row —
 * mirrors the concept_translations endpoint for UI consistency.
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifyAdminRequest(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id: variantId } = await params;
  if (!variantId) return NextResponse.json({ error: 'variant id required' }, { status: 400 });

  let body: { language?: string; name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const language = body.language?.trim().toLowerCase();
  const name = body.name?.trim();
  if (!language || language.length !== 2) {
    return NextResponse.json(
      { error: 'language is required and must be a 2-letter code' },
      { status: 400 }
    );
  }

  const supabase = createServerSupabaseClient();

  if (!name) {
    const { error } = await supabase
      .from('variant_translations')
      .delete()
      .eq('variant_id', variantId)
      .eq('language', language);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, deleted: true });
  }

  const { error } = await supabase
    .from('variant_translations')
    .upsert({ variant_id: variantId, language, name }, { onConflict: 'variant_id,language' });

  if (error) {
    console.error('[variant_translations UPSERT] failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
