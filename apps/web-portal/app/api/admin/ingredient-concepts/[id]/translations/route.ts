import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, verifyAdminRequest } from '@/lib/supabase-server';

/**
 * PUT /api/admin/ingredient-concepts/[id]/translations
 * Body: { language: string, name: string }
 *
 * Upserts a concept translation for (concept_id, language). Passing an empty
 * string as name is treated as a delete — a blank translation entry is more
 * confusing than a missing one, and the detail UI uses that signal.
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifyAdminRequest(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id: conceptId } = await params;
  if (!conceptId) return NextResponse.json({ error: 'concept id required' }, { status: 400 });

  let body: { language?: string; name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const language = body.language?.trim().toLowerCase();
  const name = body.name?.trim();
  if (!language) {
    return NextResponse.json({ error: 'language is required' }, { status: 400 });
  }
  if (language.length !== 2) {
    return NextResponse.json({ error: 'language must be a 2-letter code' }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();

  if (!name) {
    const { error } = await supabase
      .from('concept_translations')
      .delete()
      .eq('concept_id', conceptId)
      .eq('language', language);
    if (error) {
      console.error('[concept_translations DELETE] failed:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, deleted: true });
  }

  const { error } = await supabase
    .from('concept_translations')
    .upsert({ concept_id: conceptId, language, name }, { onConflict: 'concept_id,language' });

  if (error) {
    console.error('[concept_translations UPSERT] failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
