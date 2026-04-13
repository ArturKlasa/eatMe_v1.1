import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
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

// Zod schema for Structured Outputs — guarantees arrays are arrays and spice is numeric.
// We keep allergen/dietary_tag filtering below for defence-in-depth.
const DishAnalysisSchema = z.object({
  ingredients: z.array(z.string()),
  dietary_tags: z.array(z.string()),
  allergens: z.array(z.string()),
  spice_level: z.union([z.literal(0), z.literal(1), z.literal(3), z.null()]),
  dish_category: z.string().nullable(),
});

interface DishAnalysis {
  ingredients: string[];
  dietary_tags: string[];
  allergens: string[];
  spice_level: 'none' | 'mild' | 'hot' | null;
  dish_category: string | null;
  /** True when the AI call failed — caller should surface "unavailable" rather than showing empty data */
  aiError?: boolean;
}

// ---------------------------------------------------------------------------
// Single AI call — returns ingredients + dietary/allergen/spice suggestions
// ---------------------------------------------------------------------------
async function analyseDish(
  dishName: string,
  description: string | null,
  openai: OpenAI,
  categoryNames: string[] = []
): Promise<DishAnalysis> {
  const defaults: DishAnalysis = {
    ingredients: [], dietary_tags: [], allergens: [], spice_level: null, dish_category: null, aiError: true,
  };
  try {
  const descPart = description?.trim() ? `\nDescription: "${description.trim()}"` : '';
  const categoryHint =
    categoryNames.length > 0
      ? `\n  "dish_category": string|null — pick the single best match from this list: ${JSON.stringify(categoryNames)}. If none fit, return a short new category name (English, title-case, max 3 words). Return null only if truly uncategorisable.`
      : '';

  const response = await openai.chat.completions.parse({
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
          categoryHint +
          '\nUse only the exact code values listed above. Return empty arrays when nothing applies.',
      },
      // Few-shot examples — cover standard, spicy, dietary edge case, and ambiguous dishes.
      {
        role: 'user',
        content: 'Dish: "Margherita Pizza"',
      },
      {
        role: 'assistant',
        content: JSON.stringify({
          ingredients: ['pizza dough', 'tomato sauce', 'mozzarella', 'fresh basil', 'olive oil'],
          dietary_tags: ['vegetarian'],
          allergens: ['wheat', 'milk'],
          spice_level: 0,
          dish_category: 'Pizza',
        }),
      },
      {
        role: 'user',
        content: 'Dish: "Pad Kra Pao"\nDescription: "Stir-fried minced pork with Thai basil, chili, garlic, oyster sauce"',
      },
      {
        role: 'assistant',
        content: JSON.stringify({
          ingredients: ['minced pork', 'thai basil', 'red chili', 'garlic', 'oyster sauce', 'fish sauce', 'jasmine rice'],
          dietary_tags: [],
          allergens: ['fish', 'wheat', 'soybeans'],
          spice_level: 3,
          dish_category: 'Stir Fry',
        }),
      },
      {
        role: 'user',
        content: 'Dish: "Beyond Burger"\nDescription: "Plant-based patty, lettuce, tomato, pickles, vegan mayo on brioche bun"',
      },
      {
        role: 'assistant',
        content: JSON.stringify({
          ingredients: ['plant-based patty', 'brioche bun', 'lettuce', 'tomato', 'pickle', 'vegan mayonnaise'],
          dietary_tags: ['vegan', 'vegetarian'],
          allergens: ['wheat', 'soybeans'],
          spice_level: 0,
          dish_category: 'Burger',
        }),
      },
      {
        role: 'user',
        content: `Dish: "${dishName}"${descPart}`,
      },
    ],
    response_format: zodResponseFormat(DishAnalysisSchema, 'dish_analysis'),
    max_tokens: 500,
    temperature: 0.1,
  });

  // Structured Outputs guarantees schema conformance — no need to defensively reshape arrays.
  // Still filter allergens/dietary_tags against valid sets as defence-in-depth.
  const raw = response.choices[0]?.message?.parsed;
  if (!raw) return defaults;

  const dietary_tags = raw.dietary_tags.filter((s: string) => VALID_DIETARY_TAGS.has(s));
  const allergens = raw.allergens.filter((s: string) => VALID_ALLERGENS.has(s));

  const spice_level: 'none' | 'mild' | 'hot' | null =
    raw.spice_level == null ? null : raw.spice_level === 0 ? 'none' : raw.spice_level === 1 ? 'mild' : 'hot';

  const dish_category = raw.dish_category?.trim() || null;

  return { ingredients: raw.ingredients, dietary_tags, allergens, spice_level, dish_category };
  } catch (err) {
    console.error('[suggest-ingredients] AI call failed:', err);
    return defaults;
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
  const sanitize = (n: string) => n.replace(/[,%.()\[\]]/g, '');
  const exactOr = names.map(n => `display_name.ilike.${sanitize(n)}`).join(',');
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
      .map(n => `display_name.ilike.%${sanitize(n)}%`)
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
        if (!partialMap.has(key) && (displayLower.includes(key) || key.includes(displayLower))) {
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
  let dish_category_names: string[] = [];
  try {
    const body = await request.json();
    dish_name = body.dish_name?.trim();
    description = body.description ?? null;
    if (Array.isArray(body.dish_category_names)) {
      dish_category_names = body.dish_category_names.filter(
        (n: unknown): n is string => typeof n === 'string'
      );
    }
    if (!dish_name) throw new Error('dish_name is required');
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  const openai = getOpenAIClient();
  const supabase = createServerSupabaseClient();

  // 1. Single AI call — ingredients + dietary/allergen/spice + dish category in one shot
  const analysis = await analyseDish(dish_name, description, openai, dish_category_names);

  // 2. Batch-match ingredient names against the DB (2 queries total)
  const ingredients = await matchNames(analysis.ingredients, supabase);

  // 3. Resolve dish_category to an ID
  let dish_category_id: string | null = null;
  let dish_category_name: string | null = analysis.dish_category;

  if (analysis.dish_category) {
    // Try exact match first (case-insensitive)
    const { data: existing } = await supabase
      .from('dish_categories')
      .select('id, name')
      .ilike('name', analysis.dish_category)
      .eq('is_active', true)
      .limit(1)
      .single();

    if (existing) {
      dish_category_id = existing.id;
      dish_category_name = existing.name;
    } else {
      // Create new category
      const { data: created } = await supabase
        .from('dish_categories')
        .insert({ name: analysis.dish_category, is_drink: false, is_active: true })
        .select('id, name')
        .single();
      if (created) {
        dish_category_id = created.id;
        dish_category_name = created.name;
      }
    }
  }

  return NextResponse.json({
    ingredients,
    dietary_tags: analysis.dietary_tags,
    allergens: analysis.allergens,
    spice_level: analysis.spice_level,
    dish_category_id,
    dish_category_name,
    ...(analysis.aiError ? { ai_error: true } : {}),
  });
}
