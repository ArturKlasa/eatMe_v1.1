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

// ---------------------------------------------------------------------------
// Attempt to repair JSON that was truncated mid-stream (finish_reason=length).
// Strategy: find the last complete dish object, close all open arrays/objects.
// ---------------------------------------------------------------------------

function repairTruncatedJson(raw: string): string {
  // Try progressively shorter substrings until we get valid JSON
  // Work backwards from the end, closing at array/object boundaries
  let s = raw.trimEnd();

  // Remove trailing incomplete key-value (e.g. `,"name":`)
  s = s.replace(/,\s*"[^"]*"\s*:\s*$/, '');
  s = s.replace(/,\s*"[^"]*"\s*$/, '');

  // Count open brackets to determine how many closers we need
  const stack: string[] = [];
  let inString = false;
  let escape = false;

  for (const ch of s) {
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\' && inString) {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{' || ch === '[') stack.push(ch);
    else if (ch === '}' || ch === ']') stack.pop();
  }

  // Remove trailing comma before we close
  s = s.replace(/,\s*$/, '');

  // Close all open structures in reverse order
  for (let i = stack.length - 1; i >= 0; i--) {
    s += stack[i] === '{' ? '}' : ']';
  }

  return s;
}

// ---------------------------------------------------------------------------
// Parse the raw GPT string, attempting repair if needed.
// Returns null if unparseable after repair.
// ---------------------------------------------------------------------------

function parseGptResponse(raw: string): RawExtractionResult | null {
  // Strip markdown code fences
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  // Attempt 1: parse as-is
  try {
    const parsed = JSON.parse(stripped);
    if (Array.isArray(parsed.menus)) return parsed as RawExtractionResult;
    // GPT wrapped the array in a different key
    const firstArray = Object.values(parsed).find(Array.isArray);
    if (firstArray) return { menus: firstArray as RawExtractionResult['menus'] };
    return { menus: [] };
  } catch {
    // fall through to repair
  }

  // Attempt 2: repair truncated JSON
  try {
    const repaired = repairTruncatedJson(stripped);
    const parsed = JSON.parse(repaired);
    if (Array.isArray(parsed.menus)) return parsed as RawExtractionResult;
    const firstArray = Object.values(parsed).find(Array.isArray);
    if (firstArray) return { menus: firstArray as RawExtractionResult['menus'] };
    return { menus: [] };
  } catch {
    return null;
  }
}

async function extractMenuFromImage(
  openai: OpenAI,
  base64Data: string,
  mimeType: string
): Promise<RawExtractionResult> {
  const callApi = (maxTokens: number) =>
    openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${base64Data}`, detail: 'high' },
            },
            {
              type: 'text',
              text: 'Extract all dishes from this menu image. Return only the JSON.',
            },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: maxTokens,
    });

  // First attempt with full token budget
  let completion = await callApi(16384);
  let choice = completion.choices[0];
  let content = choice?.message?.content ?? '';

  if (choice.finish_reason === 'length') {
    console.warn('[MenuScan] GPT-4o truncated (finish_reason=length) — attempting repair');
  }

  let result = parseGptResponse(content);

  // If still null, retry once with reduced detail to get a shorter response
  if (!result) {
    console.warn('[MenuScan] Parse failed on first attempt — retrying with lower detail');
    completion = await callApi(16384);
    choice = completion.choices[0];
    content = choice?.message?.content ?? '';
    result = parseGptResponse(content);
  }

  if (!result) {
    console.error(
      '[MenuScan] Both attempts failed. finish_reason:',
      choice.finish_reason,
      '— raw (first 1000):',
      content.slice(0, 1000)
    );
    throw new Error('GPT-4o returned invalid JSON');
  }

  return result;
}

// ---------------------------------------------------------------------------
// Query helper — exact then partial ilike against ingredient_aliases
// ---------------------------------------------------------------------------

type AliasRow = {
  canonical_ingredient_id: string;
  display_name: string;
  canonical_ingredient: { canonical_name: string } | null;
};

async function queryAlias(
  term: string,
  supabase: ReturnType<typeof createServerSupabaseClient>
): Promise<AliasRow | null> {
  const SELECT =
    'id, display_name, canonical_ingredient_id, canonical_ingredient:canonical_ingredients(canonical_name)';

  // Exact match
  const { data: exact } = await supabase
    .from('ingredient_aliases')
    .select(SELECT)
    .ilike('display_name', term)
    .limit(1);

  if (exact && exact.length > 0) return exact[0] as unknown as AliasRow;

  // Partial match
  const { data: partial } = await supabase
    .from('ingredient_aliases')
    .select(SELECT)
    .ilike('display_name', `%${term}%`)
    .limit(1);

  return partial && partial.length > 0 ? (partial[0] as unknown as AliasRow) : null;
}

// ---------------------------------------------------------------------------
// Batch-translate non-English ingredient names using GPT-4o-mini.
// Returns a map of original → English translation.
// Only called when terms remain unmatched after the DB lookup.
// ---------------------------------------------------------------------------

async function translateIngredients(
  terms: string[],
  openai: OpenAI
): Promise<Record<string, string>> {
  if (terms.length === 0) return {};
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are a culinary ingredient translator. Given a JSON array of food ingredient names (which may be in any language, primarily Spanish), return a JSON object mapping each original name to its standard English culinary name. Keep the output minimal: only ingredient names, no explanations. If a name is already English or has no translation, return it unchanged.',
        },
        {
          role: 'user',
          content: JSON.stringify(terms),
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 512,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return {};

    // GPT returns { "original": "english", ... } — wrap in a container key if needed
    const parsed = JSON.parse(content) as Record<string, unknown>;
    // Handle both { "translations": {...} } and flat { "original": "english" }
    const translations =
      typeof parsed.translations === 'object' && parsed.translations !== null
        ? (parsed.translations as Record<string, string>)
        : (parsed as Record<string, string>);

    return Object.fromEntries(
      Object.entries(translations).map(([k, v]) => [k, typeof v === 'string' ? v : k])
    );
  } catch (err) {
    console.error('[MenuScan] Translation fallback failed:', err);
    return {};
  }
}

// ---------------------------------------------------------------------------
// Persist newly discovered (translated) aliases so future scans find them
// directly in the DB without calling the AI again.
// ---------------------------------------------------------------------------

async function saveNewAlias(
  displayName: string,
  language: string,
  canonicalIngredientId: string,
  supabase: ReturnType<typeof createServerSupabaseClient>
): Promise<void> {
  try {
    await supabase
      .from('ingredient_aliases')
      .insert({
        display_name: displayName,
        language,
        canonical_ingredient_id: canonicalIngredientId,
      })
      .select()
      .single();
  } catch {
    // ON CONFLICT — alias already exists; not an error
  }
}

// ---------------------------------------------------------------------------
// Match raw ingredient strings against ingredient_aliases in the DB.
// Falls back to AI batch-translation for unmatched terms, then saves
// new aliases so the DB grows over time and AI is called less often.
// ---------------------------------------------------------------------------

async function matchIngredients(
  rawIngredients: string[],
  supabase: ReturnType<typeof createServerSupabaseClient>,
  openai: OpenAI
): Promise<MatchedIngredient[]> {
  if (!rawIngredients || rawIngredients.length === 0) return [];

  const results: MatchedIngredient[] = [];
  const needsTranslation: string[] = [];

  // ---- Pass 1: DB lookup ----
  for (const raw of rawIngredients) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const alias = await queryAlias(trimmed, supabase);
    if (alias) {
      results.push({
        raw_text: raw,
        status: 'matched',
        canonical_ingredient_id: alias.canonical_ingredient_id,
        canonical_name: alias.canonical_ingredient?.canonical_name,
        display_name: alias.display_name,
      });
    } else {
      results.push({ raw_text: raw, status: 'unmatched' });
      needsTranslation.push(trimmed);
    }
  }

  if (needsTranslation.length === 0) return results;

  // ---- Pass 2: translate unmatched terms in one batch AI call ----
  const translations = await translateIngredients(needsTranslation, openai);

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status !== 'unmatched') continue;

    const trimmed = r.raw_text.trim();
    const englishName = translations[trimmed];
    if (!englishName || englishName === trimmed) continue; // no useful translation

    const alias = await queryAlias(englishName, supabase);
    if (alias) {
      results[i] = {
        raw_text: r.raw_text,
        status: 'matched',
        canonical_ingredient_id: alias.canonical_ingredient_id,
        canonical_name: alias.canonical_ingredient?.canonical_name,
        display_name: alias.display_name,
      };

      // Persist the original (non-English) term as a new alias so next time
      // it's found directly in the DB without calling the AI.
      void saveNewAlias(trimmed, 'es', alias.canonical_ingredient_id, supabase);
    }
    // If still no match after translation: leave as 'unmatched' — user resolves manually
  }

  return results;
}

// ---------------------------------------------------------------------------
// Enrich a raw extraction result with ingredient matches + dietary tag codes
// ---------------------------------------------------------------------------

async function enrichResult(
  raw: RawExtractionResult,
  supabase: ReturnType<typeof createServerSupabaseClient>,
  openai: OpenAI
): Promise<Pick<EnrichedResult, 'menus'>> {
  const enrichedMenus: EnrichedMenu[] = [];

  for (const menu of raw.menus) {
    const enrichedCategories: EnrichedCategory[] = [];

    for (const cat of menu.categories) {
      const enrichedDishes: EnrichedDish[] = [];

      for (const dish of cat.dishes) {
        const matched = await matchIngredients(dish.raw_ingredients ?? [], supabase, openai);

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
    const { menus: enrichedMenus } = await enrichResult(merged, supabase, openai);

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
