import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, verifyAdminRequest } from '@/lib/supabase-server';

/**
 * POST /api/admin/ingredient-concepts/[id]/aliases
 * Body: { alias_text: string, language: string, variant_id?: string | null }
 *
 * Adds a new alias in ingredient_aliases_v2. alias_text is lowercased for
 * matching consistency with the resolver; the UNIQUE (alias_text, language)
 * constraint surfaces as a 409.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifyAdminRequest(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id: conceptId } = await params;
  if (!conceptId) return NextResponse.json({ error: 'concept id required' }, { status: 400 });

  let body: { alias_text?: string; language?: string; variant_id?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const aliasText = body.alias_text?.trim().toLowerCase();
  const language = body.language?.trim().toLowerCase();
  const variantId = body.variant_id ?? null;

  if (!aliasText) {
    return NextResponse.json({ error: 'alias_text is required' }, { status: 400 });
  }
  if (!language || language.length !== 2) {
    return NextResponse.json(
      { error: 'language is required and must be a 2-letter code' },
      { status: 400 }
    );
  }

  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('ingredient_aliases_v2')
    .insert({
      alias_text: aliasText,
      language,
      concept_id: conceptId,
      variant_id: variantId,
    })
    .select('id, alias_text, language, variant_id')
    .single();

  if (error) {
    const status = error.code === '23505' ? 409 : 500;
    console.error('[aliases POST] insert failed:', error);
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({ alias: data });
}
