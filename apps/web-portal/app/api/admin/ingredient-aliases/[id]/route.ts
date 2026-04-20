import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, verifyAdminRequest } from '@/lib/supabase-server';

/**
 * DELETE /api/admin/ingredient-aliases/[id]
 *
 * Drops a single alias row from ingredient_aliases_v2. Aliases are cheap to
 * lose — worst case the resolver falls back to translate+retry — so we
 * don't require a confirmation blast-radius check here.
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
  if (!id) return NextResponse.json({ error: 'alias id required' }, { status: 400 });

  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from('ingredient_aliases_v2').delete().eq('id', id);

  if (error) {
    console.error('[ingredient-aliases DELETE] failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
