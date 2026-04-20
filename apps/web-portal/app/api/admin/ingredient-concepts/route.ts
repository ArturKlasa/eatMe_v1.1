import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, verifyAdminRequest } from '@/lib/supabase-server';

/**
 * GET /api/admin/ingredient-concepts
 *
 * Query params:
 *   q        — search string matched against ingredient_aliases_v2.alias_text
 *              (any language) via trigram similarity
 *   family   — filter by ingredient_concepts.family
 *   page     — 1-based
 *   pageSize — default 25
 *
 * Returns concepts with:
 *   - EN primary translation (falls back to slug)
 *   - family, slug
 *   - variant_count, alias_count
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdminRequest(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim() ?? '';
  const family = searchParams.get('family')?.trim() ?? '';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get('pageSize') ?? '25', 10) || 25)
  );

  const supabase = createServerSupabaseClient();

  // When q is present, resolve the matching concept_ids via aliases first.
  // This lets us search by any language's alias text (e.g. "łosoś", "jitomate")
  // without joining from the concepts side.
  let conceptIdFilter: string[] | null = null;
  if (q.length > 0) {
    const likePattern = `%${q.toLowerCase()}%`;
    const { data: aliasMatches } = await supabase
      .from('ingredient_aliases_v2')
      .select('concept_id')
      .ilike('alias_text', likePattern)
      .limit(500);
    conceptIdFilter = [...new Set((aliasMatches ?? []).map(r => r.concept_id))];
    if (conceptIdFilter.length === 0) {
      return NextResponse.json({ concepts: [], total: 0, page, pageSize });
    }
  }

  let query = supabase
    .from('ingredient_concepts')
    .select('id, slug, family, is_vegetarian, is_vegan, allergens', { count: 'exact' });
  if (family) query = query.eq('family', family);
  if (conceptIdFilter) query = query.in('id', conceptIdFilter);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data: concepts, count, error } = await query.order('slug').range(from, to);

  if (error) {
    console.error('[ingredient-concepts GET] failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type ConceptRow = {
    id: string;
    slug: string;
    family: string;
    is_vegetarian: boolean;
    is_vegan: boolean;
    allergens: string[];
  };
  const rows = (concepts ?? []) as ConceptRow[];
  if (rows.length === 0) {
    return NextResponse.json({ concepts: [], total: count ?? 0, page, pageSize });
  }

  const ids = rows.map(c => c.id);

  const [enRes, variantRes, aliasRes] = await Promise.all([
    supabase
      .from('concept_translations')
      .select('concept_id, name')
      .eq('language', 'en')
      .in('concept_id', ids),
    supabase.from('ingredient_variants').select('concept_id').in('concept_id', ids),
    supabase.from('ingredient_aliases_v2').select('concept_id').in('concept_id', ids),
  ]);

  const enByConcept = new Map<string, string>();
  for (const row of (enRes.data ?? []) as Array<{ concept_id: string; name: string }>) {
    enByConcept.set(row.concept_id, row.name);
  }

  const variantCounts = new Map<string, number>();
  for (const row of (variantRes.data ?? []) as Array<{ concept_id: string }>) {
    variantCounts.set(row.concept_id, (variantCounts.get(row.concept_id) ?? 0) + 1);
  }
  const aliasCounts = new Map<string, number>();
  for (const row of (aliasRes.data ?? []) as Array<{ concept_id: string }>) {
    aliasCounts.set(row.concept_id, (aliasCounts.get(row.concept_id) ?? 0) + 1);
  }

  const result = rows.map(c => ({
    id: c.id,
    slug: c.slug,
    family: c.family,
    is_vegetarian: c.is_vegetarian,
    is_vegan: c.is_vegan,
    allergens: c.allergens,
    name_en: enByConcept.get(c.id) ?? null,
    variant_count: variantCounts.get(c.id) ?? 0,
    alias_count: aliasCounts.get(c.id) ?? 0,
  }));

  return NextResponse.json({ concepts: result, total: count ?? 0, page, pageSize });
}
