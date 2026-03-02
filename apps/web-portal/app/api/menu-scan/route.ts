import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createServerSupabaseClient, verifyAdminRequest } from '@/lib/supabase-server';
import {
  mergeExtractionResults,
  mapDietaryHints,
  getCurrencyForRestaurant,
  type RawExtractionResult,
  type MatchedIngredient,
  type EnrichedResult,
  type EnrichedMenu,
  type EnrichedCategory,
  type EnrichedDish,
} from '@/lib/menu-scan';

// ---------------------------------------------------------------------------
// GPT-4o Vision system prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a menu data extraction specialist. Analyze the restaurant menu image and extract all dishes into structured JSON.

STRICT RULES:
1. Return ONLY valid JSON matching the schema below. No prose, no markdown fences.
2. Do NOT hallucinate. If a field is not clearly visible, set it to null.
3. Do NOT extract or guess currency. Omit currency entirely.
4. Menu section headers (e.g. "Lunch", "Comidas", "Desayunos", "Bebidas") → use as menu "name".
5. Sub-section headers within a menu (e.g. "Entradas", "Sopas", "Postres", "Pastas") → use as category "name".
6. If no section headers exist, set name to null for menus and/or categories.
7. Detect dietary symbols and words:
   - V, (V), "vegetariano/a" → dietary_hints: ["vegetarian"]
   - VG, (VG), "vegano/a" → dietary_hints: ["vegan"]
   - GF, "sin gluten", "gluten-free" → dietary_hints: ["gluten_free"]
   - H, "halal" → dietary_hints: ["halal"]
   - K, "kosher" → dietary_hints: ["kosher"]
8. Detect spice indicators (🌶, "picante", "spicy", ★) → spice_level: 2. Use null otherwise.
9. Extract ingredients ONLY when explicitly listed on the menu (typically in parentheses after the dish name). If not listed, set raw_ingredients to null.
10. confidence: 1.0 = perfectly legible text, 0.7 = slightly unclear, 0.5 = partially obscured, 0.3 = mostly guessing.
11. Menus may be in Spanish or English. Keep all names in their original language.
12. For "menu_type": use "drink" only for clearly beverage sections (Bebidas, Drinks, Cocktails, Vinos). Use "food" for everything else.

JSON SCHEMA (return exactly this structure):
{
  "menus": [
    {
      "name": string | null,
      "menu_type": "food" | "drink",
      "categories": [
        {
          "name": string | null,
          "dishes": [
            {
              "name": string,
              "price": number | null,
              "description": string | null,
              "raw_ingredients": string[] | null,
              "dietary_hints": string[],
              "spice_level": 0 | 1 | 2 | 3 | 4 | null,
              "calories": number | null,
              "confidence": number
            }
          ]
        }
      ]
    }
  ]
}`;

// ---------------------------------------------------------------------------
// OpenAI client (lazy init to avoid crashing at import time if key missing)
// ---------------------------------------------------------------------------

function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// ---------------------------------------------------------------------------
// Call GPT-4o Vision for a single base64-encoded image
// ---------------------------------------------------------------------------

async function extractMenuFromImage(
  openai: OpenAI,
  base64Data: string,
  mimeType: string
): Promise<RawExtractionResult> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${base64Data}`,
              detail: 'high',
            },
          },
          {
            type: 'text',
            text: 'Extract all dishes from this menu image. Return only the JSON.',
          },
        ],
      },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 4096,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('Empty response from GPT-4o');

  try {
    const parsed = JSON.parse(content);
    // Ensure the structure has a menus array
    if (!Array.isArray(parsed.menus)) {
      return { menus: [] };
    }
    return parsed as RawExtractionResult;
  } catch {
    console.error('[MenuScan] Failed to parse GPT-4o response:', content.slice(0, 500));
    throw new Error('GPT-4o returned invalid JSON');
  }
}

// ---------------------------------------------------------------------------
// Match raw ingredient strings against ingredient_aliases in the DB
// ---------------------------------------------------------------------------

async function matchIngredients(
  rawIngredients: string[],
  supabase: ReturnType<typeof createServerSupabaseClient>
): Promise<MatchedIngredient[]> {
  if (!rawIngredients || rawIngredients.length === 0) return [];

  const results: MatchedIngredient[] = [];

  for (const raw of rawIngredients) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    // Try exact match first, then partial
    const { data: exact } = await supabase
      .from('ingredient_aliases')
      .select(
        'id, display_name, canonical_ingredient_id, canonical_ingredient:canonical_ingredients(canonical_name)'
      )
      .ilike('display_name', trimmed)
      .limit(1);

    if (exact && exact.length > 0) {
      const m = exact[0] as any;
      results.push({
        raw_text: raw,
        status: 'matched',
        canonical_ingredient_id: m.canonical_ingredient_id,
        canonical_name: m.canonical_ingredient?.canonical_name,
        display_name: m.display_name,
      });
      continue;
    }

    // Partial match
    const { data: partial } = await supabase
      .from('ingredient_aliases')
      .select(
        'id, display_name, canonical_ingredient_id, canonical_ingredient:canonical_ingredients(canonical_name)'
      )
      .ilike('display_name', `%${trimmed}%`)
      .limit(1);

    if (partial && partial.length > 0) {
      const m = partial[0] as any;
      results.push({
        raw_text: raw,
        status: 'matched',
        canonical_ingredient_id: m.canonical_ingredient_id,
        canonical_name: m.canonical_ingredient?.canonical_name,
        display_name: m.display_name,
      });
    } else {
      results.push({ raw_text: raw, status: 'unmatched' });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Enrich a raw extraction result with ingredient matches + dietary tag codes
// ---------------------------------------------------------------------------

async function enrichResult(
  raw: RawExtractionResult,
  supabase: ReturnType<typeof createServerSupabaseClient>
): Promise<Pick<EnrichedResult, 'menus'>> {
  const enrichedMenus: EnrichedMenu[] = [];

  for (const menu of raw.menus) {
    const enrichedCategories: EnrichedCategory[] = [];

    for (const cat of menu.categories) {
      const enrichedDishes: EnrichedDish[] = [];

      for (const dish of cat.dishes) {
        const matched = await matchIngredients(dish.raw_ingredients ?? [], supabase);

        enrichedDishes.push({
          ...dish,
          matched_ingredients: matched,
          mapped_dietary_tags: mapDietaryHints(dish.dietary_hints ?? []),
        });
      }

      enrichedCategories.push({ name: cat.name, dishes: enrichedDishes });
    }

    enrichedMenus.push({
      name: menu.name,
      menu_type: menu.menu_type,
      categories: enrichedCategories,
    });
  }

  return { menus: enrichedMenus };
}

// ---------------------------------------------------------------------------
// POST /api/menu-scan
// Body: { restaurant_id: string, images: Array<{ name: string, mime_type: string, data: string }> }
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  // 1. Verify admin
  const auth = await verifyAdminRequest(request);
  if (auth.error || !auth.user) {
    return NextResponse.json(
      { error: auth.error ?? 'Unauthorized' },
      { status: (auth as any).status ?? 401 }
    );
  }
  const user = auth.user;

  // 2. Parse JSON body
  let body: {
    restaurant_id: string;
    images: Array<{ name: string; mime_type: string; data: string }>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { restaurant_id, images } = body;

  if (!restaurant_id) {
    return NextResponse.json({ error: 'restaurant_id is required' }, { status: 400 });
  }
  if (!images || images.length === 0) {
    return NextResponse.json({ error: 'At least one image is required' }, { status: 400 });
  }
  if (images.length > 10) {
    return NextResponse.json({ error: 'Maximum 10 images per scan' }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();
  const openai = getOpenAIClient();

  // 3. Load restaurant for currency (select only guaranteed columns)
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('country_code, name')
    .eq('id', restaurant_id)
    .single();

  const currency = getCurrencyForRestaurant(null, restaurant?.country_code);

  // 4. Create the job record (status: processing)
  const startTime = Date.now();
  const imageFilenames = images.map(img => img.name);

  const { data: job, error: jobError } = await supabase
    .from('menu_scan_jobs')
    .insert({
      restaurant_id,
      created_by: user.id,
      image_count: images.length,
      image_filenames: imageFilenames,
      status: 'processing',
    })
    .select()
    .single();

  if (jobError || !job) {
    console.error('[MenuScan] Failed to create job record:', jobError);
    return NextResponse.json({ error: 'Failed to create scan job' }, { status: 500 });
  }

  try {
    // 5. Upload images to Supabase Storage for audit trail + call GPT-4o in parallel
    const storageUploadPromises = images.map(async (img, i) => {
      const buffer = Buffer.from(img.data, 'base64');
      const storagePath = `${restaurant_id}/${job.id}/${i + 1}_${img.name}`;
      await supabase.storage.from('menu-scans').upload(storagePath, buffer, {
        contentType: img.mime_type,
        upsert: true,
      });
      return storagePath;
    });

    const gptExtractionPromises = images.map(img =>
      extractMenuFromImage(openai, img.data, img.mime_type)
    );

    // Run storage uploads and GPT-4o extractions in parallel
    const [storagePathsSettled, rawResults] = await Promise.all([
      Promise.allSettled(storageUploadPromises),
      Promise.all(gptExtractionPromises),
    ]);

    const imagePaths = storagePathsSettled.map((r, i) =>
      r.status === 'fulfilled' ? r.value : `${restaurant_id}/${job.id}/${i + 1}_${images[i].name}`
    );

    // 6. Merge multi-page results
    const merged = mergeExtractionResults(rawResults);

    // 7. Enrich with ingredient matches + dietary tag codes
    const { menus: enrichedMenus } = await enrichResult(merged, supabase);

    const fullResult: EnrichedResult = { menus: enrichedMenus, currency };

    const dishCount = enrichedMenus.reduce(
      (total, menu) => total + menu.categories.reduce((sum, cat) => sum + cat.dishes.length, 0),
      0
    );

    const processingMs = Date.now() - startTime;

    // 8. Save enriched result to DB
    await supabase
      .from('menu_scan_jobs')
      .update({
        status: 'needs_review',
        result_json: fullResult,
        image_storage_paths: imagePaths,
        dishes_found: dishCount,
        processing_ms: processingMs,
      })
      .eq('id', job.id);

    console.log(
      `[MenuScan] Job ${job.id} completed: ${dishCount} dishes found in ${processingMs}ms`
    );

    return NextResponse.json({
      jobId: job.id,
      currency,
      result: fullResult,
      dishCount,
      processingMs,
    });
  } catch (error: any) {
    console.error('[MenuScan] Processing failed:', error);

    await supabase
      .from('menu_scan_jobs')
      .update({
        status: 'failed',
        error_message: error.message ?? 'Unknown error',
      })
      .eq('id', job.id);

    return NextResponse.json(
      { error: error.message ?? 'Menu processing failed', jobId: job.id },
      { status: 500 }
    );
  }
}
