import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createServerSupabaseClient, verifyAdminRequest } from '@/lib/supabase-server';
import type { MatchedIngredient } from '@/lib/menu-scan';

// ---------------------------------------------------------------------------
// POST /api/menu-scan/suggest-ingredients
//
// Given a dish name + optional description, uses GPT-4o-mini to infer:
//   - likely ingredients (matched against ingredient_aliases DB)
//   - dietary tags  (vegetarian, vegan, gluten_free, halal, kosher …)
//   - allergens     (milk, eggs, gluten, shellfish …)
//   - spice_level   (0 | 1 | 3 | null)
//
// Body:     { dish_name: string; description?: string }
// Response: { ingredients: MatchedIngredient[]; dietary_tags: string[];
//             allergens: string[]; spice_level: 0|1|3|null }
// ---------------------------------------------------------------------------

function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set');
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// Valid code sets — mirror apps/web-portal/lib/constants.ts + lib/icons.ts
const VALID_DIETARY_TAGS = new Set([
  'vegetarian',
  'vegan',
  'pescatarian',
  'keto',
  'paleo',
  'low_carb',
  'gluten_free',
  'dairy_free',
  'halal',
  'kosher',
  'hindu',
  'jain',
  'organic',
  'raw',
  'diabetic_friendly',
  'heart_healthy',
]);

const VALID_ALLERGENS = new Set([
  'milk',
  'eggs',
  'fish',
  'shellfish',
  'tree_nuts',
  'peanuts',
  'wheat',
  'soybeans',
  'sesame',
  'gluten',
  'lactose',
  'sulfites',
  'mustard',
  'celery',
]);

interface DishAnalysis {
  ingredients: string[];
  dietary_tags: string[];
  allergens: string[];
  spice_level: 0 | 1 | 3 | null;
}

// ---------------------------------------------------------------------------
// Single AI call — returns ingredients + dietary/allergen/spice suggestions
// ---------------------------------------------------------------------------
async function analyseDish(
  dishName: string,
  description: string | null,
  openai: OpenAI
): Promise<DishAnalysis> {
  const descPart = description?.trim() ? `\nDescription: "${description.trim()}"` : '';

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          'You are a professional chef and food safety expert. Analyse a dish and return a JSON object with exactly these keys:\n' +
          '  "ingredients": string[]  — 6-12 key ingredients, lowercase English singular form (e.g. "chicken breast")\n' +
          '  "dietary_tags": string[] — applicable codes from: vegetarian, vegan, pescatarian, keto, paleo, low_carb, gluten_free, dairy_free, halal, kosher, hindu, jain, organic, diabetic_friendly, heart_healthy\n' +
          '  "allergens": string[]    — applicable codes from: milk, eggs, fish, shellfish, tree_nuts, peanuts, wheat, soybeans, sesame, gluten, lactose, sulfites, mustard, celery\n' +
          '  "spice_level": 0|1|3|null — 0=not spicy, 1=mildly spicy, 3=very spicy, null=unknown\n' +
          'Use only the exact code values listed above. Return empty arrays when nothing applies.',
      },
      {
        role: 'user',
        content: `Dish: "${dishName}"${descPart}`,
      },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 400,
  });

  try {
    const parsed = JSON.parse(response.choices[0]?.message?.content ?? '{}') as Record<
      string,
      unknown
    >;

    const ingredients = (Array.isArray(parsed.ingredients) ? parsed.ingredients : []).filter(
      (s): s is string => typeof s === 'string'
    );

    const dietary_tags = (Array.isArray(parsed.dietary_tags) ? parsed.dietary_tags : []).filter(
      (s): s is string => typeof s === 'string' && VALID_DIETARY_TAGS.has(s)
    );

    const allergens = (Array.isArray(parsed.allergens) ? parsed.allergens : []).filter(
      (s): s is string => typeof s === 'string' && VALID_ALLERGENS.has(s)
    );

    const rawSpice = parsed.spice_level;
    const spice_level: 0 | 1 | 3 | null =
      rawSpice === 0 ? 0 : rawSpice === 1 ? 1 : rawSpice === 3 ? 3 : null;

    return { ingredients, dietary_tags, allergens, spice_level };
  } catch {
    return { ingredients: [], dietary_tags: [], allergens: [], spice_level: null };
  }
}

// ---------------------------------------------------------------------------
// Batch DB lookup — exact then partial, 2 queries total instead of N*2
// ---------------------------------------------------------------------------
type SupabaseClient = ReturnType<typeof createServerSupabaseClient>;

interface AliasRow {
  display_name: string;
  canonical_ingredient_id: string;
  canonical_ingredient: { canonical_name: string } | { canonical_name: string }[] | null;
}

function canonicalName(row: AliasRow): string | undefined {
  const ci = row.canonical_ingredient;
  if (!ci) return undefined;
  if (Array.isArray(ci)) return ci[0]?.canonical_name;
  return ci.canonical_name;
}

async function matchNames(names: string[], supabase: SupabaseClient): Promise<MatchedIngredient[]> {
  if (names.length === 0) return [];

  const SELECT =
    'display_name, canonical_ingredient_id, canonical_ingredient:canonical_ingredients(canonical_name)';

  // ---- Pass 1: exact ilike match for all names in one OR query ----
  const exactOr = names.map(n => `display_name.ilike.${n.replace(/[,%]/g, '')}`).join(',');
  const { data: exactRows } = await supabase.from('ingredient_aliases').select(SELECT).or(exactOr);

  const exactMap = new Map<string, AliasRow>();
  for (const row of exactRows ?? []) {
    const r = row as AliasRow;
    const key = r.display_name.toLowerCase().trim();
    if (!exactMap.has(key)) exactMap.set(key, r);
  }

  // ---- Pass 2: partial ilike for names that got no exact hit ----
  const unmatched = names.filter(n => !exactMap.has(n.toLowerCase().trim()));
  const partialMap = new Map<string, AliasRow>();

  if (unmatched.length > 0) {
    const partialOr = unmatched
      .map(n => `display_name.ilike.%${n.replace(/[,%]/g, '')}%`)
      .join(',');
    const { data: partialRows } = await supabase
      .from('ingredient_aliases')
      .select(SELECT)
      .or(partialOr);

    for (const row of partialRows ?? []) {
      const r = row as AliasRow;
      const displayLower = r.display_name.toLowerCase();
      for (const name of unmatched) {
        const key = name.toLowerCase().trim();
        if (!partialMap.has(key) && displayLower.includes(key)) {
          partialMap.set(key, r);
        }
      }
    }
  }

  // ---- Build results preserving input order ----
  return names.map(name => {
    const key = name.toLowerCase().trim();
    const row = exactMap.get(key) ?? partialMap.get(key) ?? null;
    if (!row) return { raw_text: name, status: 'unmatched' };
    return {
      raw_text: name,
      status: 'matched',
      canonical_ingredient_id: row.canonical_ingredient_id,
      canonical_name: canonicalName(row),
      display_name: row.display_name,
    };
  });
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  const auth = await verifyAdminRequest(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let dish_name: string;
  let description: string | null;
  try {
    const body = await request.json();
    dish_name = body.dish_name?.trim();
    description = body.description ?? null;
    if (!dish_name) throw new Error('dish_name is required');
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  const openai = getOpenAIClient();
  const supabase = createServerSupabaseClient();

  // 1. Single AI call — ingredients + dietary/allergen/spice in one shot
  const analysis = await analyseDish(dish_name, description, openai);

  // 2. Batch-match ingredient names against the DB (2 queries total)
  const ingredients = await matchNames(analysis.ingredients, supabase);

  return NextResponse.json({
    ingredients,
    dietary_tags: analysis.dietary_tags,
    allergens: analysis.allergens,
    spice_level: analysis.spice_level,
  });
}
