/**
 * POST /api/menu-scan
 *
 * AI-powered menu extraction endpoint. Accepts a base64-encoded menu image,
 * sends it to the OpenAI Vision API, and returns structured dish data enriched
 * with matched ingredients and dietary hints for admin review.
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { createServerSupabaseClient, verifyAdminRequest } from '@/lib/supabase-server';
import {
  mergeExtractionResults,
  mapDietaryHints,
  getCurrencyForRestaurant,
  type RawExtractionResult,
  type RawExtractedDish,
  type MatchedIngredient,
  type EnrichedResult,
  type EnrichedMenu,
  type EnrichedCategory,
  type EnrichedDish,
  type FlaggedDuplicate,
} from '@/lib/menu-scan';

// ---------------------------------------------------------------------------
// Zod schema for Structured Outputs (GPT-4o Vision)
// ---------------------------------------------------------------------------

const DishSchema: z.ZodType<unknown> = z.lazy(() =>
  z.object({
    name: z.string(),
    price: z.number().nullable(),
    description: z.string().nullable(),
    raw_ingredients: z.array(z.string()).nullable(),
    dietary_hints: z.array(z.string()),
    spice_level: z.union([z.literal(0), z.literal(1), z.literal(3)]).nullable(),
    calories: z.number().nullable(),
    confidence: z.number(),
    is_parent: z.boolean(),
    dish_kind: z.enum(['standard', 'template', 'combo', 'experience']),
    serves: z.number().nullable(),
    display_price_prefix: z.enum(['exact', 'from', 'per_person', 'market_price', 'ask_server']),
    variants: z.array(DishSchema).nullable(),
  })
);

const MenuExtractionSchema = z.object({
  menus: z.array(
    z.object({
      name: z.string().nullable(),
      menu_type: z.enum(['food', 'drink']),
      categories: z.array(
        z.object({
          name: z.string().nullable(),
          dishes: z.array(DishSchema),
        })
      ),
    })
  ),
});

// ---------------------------------------------------------------------------
// GPT-4o Vision system prompt — decision tree + few-shot examples
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a menu data extraction specialist. Analyze the restaurant menu image and extract all dishes into structured JSON matching the provided schema.

STRICT RULES:
1. Do NOT hallucinate. If a field is not clearly visible, set it to null.
2. Do NOT extract or guess currency. Omit currency entirely.
3. DEFAULT: output exactly ONE food menu (menu_type: "food") and at most ONE drink menu (menu_type: "drink").
   - Time-of-day labels (Desayunos, Comidas, Cenas, Breakfast, Lunch, Dinner, Brunch) → use as CATEGORY name, NOT a separate menu.
   - Course labels (Entradas, Sopas, Ensaladas, Platos Fuertes, Pastas, Postres, Sides) → use as CATEGORY name.
   - Only create a second food menu when the physical document is explicitly a separate titled menu (e.g. "Menú de Degustación", "Kids Menu") with its own branding/cover.
4. All section and sub-section headers inside a food menu go as category "name" under that single food menu.
5. If no section headers exist, set name to null for menus and/or categories.
6. Detect dietary symbols: V/vegetariano/a → ["vegetarian"], VG/vegano/a → ["vegan"], GF/sin gluten → ["gluten_free"], H/halal → ["halal"], K/kosher → ["kosher"].
7. Detect spice indicators (🌶, "picante", "spicy") → spice_level: 1 (mild) or 3 (very spicy). null = no indicator, 0 = explicitly non-spicy.
8. Extract ingredients ONLY when explicitly listed on the menu. If not listed, set raw_ingredients to null.
9. confidence: 1.0 = perfectly legible, 0.7 = slightly unclear, 0.5 = partially obscured, 0.3 = mostly guessing.
10. Keep all names in their original language (Spanish, English, etc.).
11. For "menu_type": use "drink" only for a clearly separate beverage page/section. A "Bebidas" subsection at the bottom of a food page → category inside the food menu.

DISH PATTERN DETECTION — apply in this priority order:
1. TEMPLATE (build-your-own): "Choose your protein/base", "Build your bowl", "Pick a base" → dish_kind="template", is_parent=true, display_price_prefix="from", variants[] = each option as a child dish.
2. COMBO/BUNDLE: "Lunch combo", "Set menu", "Includes X + Y + Z", fixed meal deal → dish_kind="combo", is_parent=true, variants[] = included items.
3. EXPERIENCE: "All-you-can-eat", "Hot pot", "BBQ", "Tasting menu", per-person pricing → dish_kind="experience", is_parent=true, display_price_prefix="per_person", serves=number of people.
4. SIZE VARIANTS: S/M/L, "Small/Regular/Large", "Chico/Mediano/Grande" → dish_kind="standard", is_parent=true, display_price_prefix="from", variants[] = each size with its price.
5. MARKET PRICE: "MP", "Market price", "Precio de mercado" → price=null, display_price_prefix="market_price".
6. FAMILY/SHARING: "For 2-3", "Para compartir", "Feeds 4" → serves=N (number of people), dish_kind="standard".
7. STANDARD: everything else → dish_kind="standard", is_parent=false, serves=1, display_price_prefix="exact".

PARENT-CHILD RULES:
- Parent: is_parent=true, price=0 (display-only container), variants[] = child dishes.
- Each child: is_parent=false, its own price, dietary_hints, raw_ingredients.
- If unsure, default to standard single dish (is_parent=false, no variants).

SERVES FIELD: Number of people this dish feeds. Default 1. Set higher for sharing/family plates.
DISPLAY_PRICE_PREFIX: How the price is displayed — "exact" (default), "from" (starting at), "per_person", "market_price", "ask_server".

MULTI-PAGE NOTE: This menu may be extracted across multiple pages. Each page is processed independently. Categories will be merged later, so use consistent category names across pages.

FEW-SHOT EXAMPLES:

Example 1 — Standard dishes:
Menu showing "Tacos" section with "Taco al Pastor $45" and "Taco de Bistec $50":
→ Two standard dishes: dish_kind="standard", is_parent=false, serves=1, display_price_prefix="exact"

Example 2 — Template with variants:
Menu showing "Poke Bowl" with options "Salmon $189", "Tofu $159", "Shrimp $179":
→ Parent: name="Poke Bowl", dish_kind="template", is_parent=true, price=0, display_price_prefix="from"
→ Variants: [{name:"Poke Bowl — Salmon", price:189}, {name:"Poke Bowl — Tofu", price:159}, {name:"Poke Bowl — Shrimp", price:179}]

Example 3 — Combo:
Menu showing "Lunch Special $129 — includes soup, main course, and drink":
→ Parent: name="Lunch Special", dish_kind="combo", is_parent=true, price=0, display_price_prefix="exact"
→ Variants: [{name:"Lunch Special — Soup"}, {name:"Lunch Special — Main Course"}, {name:"Lunch Special — Drink"}]`;

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
// Call GPT-4o Vision for a single base64-encoded image (Structured Outputs)
// ---------------------------------------------------------------------------

async function extractMenuFromImage(
  openai: OpenAI,
  base64Data: string,
  mimeType: string
): Promise<RawExtractionResult> {
  const completion = await openai.chat.completions.create({
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
            text: 'Extract all dishes from this menu image.',
          },
        ],
      },
    ],
    response_format: zodResponseFormat(MenuExtractionSchema, 'menu_extraction'),
    max_tokens: 16384,
  });

  const choice = completion.choices[0];

  if (choice.finish_reason === 'length') {
    console.warn('[MenuScan] GPT-4o truncated (finish_reason=length) — response may be incomplete');
  }

  const content = choice?.message?.content;
  if (!content) {
    throw new Error('GPT-4o returned empty response');
  }

  // Structured Outputs guarantees valid JSON matching the schema
  const parsed = JSON.parse(content) as RawExtractionResult;

  // Apply defaults for fields GPT may have set to null within valid schema
  for (const menu of parsed.menus) {
    for (const cat of menu.categories) {
      for (const dish of cat.dishes) {
        applyDishDefaults(dish);
      }
    }
  }

  return parsed;
}

/** Apply sensible defaults for optional fields. */
function applyDishDefaults(dish: RawExtractedDish): void {
  if (!dish.dish_kind) dish.dish_kind = 'standard';
  if (dish.is_parent === undefined || dish.is_parent === null) dish.is_parent = false;
  if (!dish.display_price_prefix) dish.display_price_prefix = 'exact';
  if (dish.serves === undefined) dish.serves = null;
  if (!dish.variants) dish.variants = null;

  // Recursively apply to variants
  if (dish.variants) {
    for (const variant of dish.variants) {
      applyDishDefaults(variant);
      variant.is_parent = false; // variants are never parents
    }
  }
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

  // Escape ILIKE metacharacters to prevent wildcard injection
  const escapedTerm = term.replace(/[%_\\]/g, c => `\\${c}`);

  // Exact match
  const { data: exact } = await supabase
    .from('ingredient_aliases')
    .select(SELECT)
    .ilike('display_name', escapedTerm)
    .limit(1);

  if (exact && exact.length > 0) return exact[0] as unknown as AliasRow;

  // Partial match
  const { data: partial } = await supabase
    .from('ingredient_aliases')
    .select(SELECT)
    .ilike('display_name', `%${escapedTerm}%`)
    .limit(1);

  return partial && partial.length > 0 ? (partial[0] as unknown as AliasRow) : null;
}

// ---------------------------------------------------------------------------
// Batch-translate non-English ingredient names using GPT-4o-mini.
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

    const parsed = JSON.parse(content) as Record<string, unknown>;
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
// Persist newly discovered (translated) aliases
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
    if (!englishName || englishName === trimmed) continue;

    const alias = await queryAlias(englishName, supabase);
    if (alias) {
      results[i] = {
        raw_text: r.raw_text,
        status: 'matched',
        canonical_ingredient_id: alias.canonical_ingredient_id,
        canonical_name: alias.canonical_ingredient?.canonical_name,
        display_name: alias.display_name,
      };

      void saveNewAlias(trimmed, 'es', alias.canonical_ingredient_id, supabase);
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Enrich a raw extraction result with ingredient matches + dietary tag codes
// ---------------------------------------------------------------------------

async function enrichDish(
  dish: RawExtractedDish,
  supabase: ReturnType<typeof createServerSupabaseClient>,
  openai: OpenAI
): Promise<EnrichedDish> {
  const matched = await matchIngredients(dish.raw_ingredients ?? [], supabase, openai);

  // Normalise LLM-returned spice_level to the allowed set {0, 1, 3}.
  const rawSpice: number | null = dish.spice_level ?? null;
  const normalisedSpice: 0 | 1 | 3 | null =
    rawSpice === null ? null : rawSpice <= 0 ? 0 : rawSpice <= 1 ? 1 : rawSpice === 2 ? 1 : 3;

  // Recursively enrich variants
  let enrichedVariants: EnrichedDish[] | null = null;
  if (dish.variants && dish.variants.length > 0) {
    enrichedVariants = [];
    for (const variant of dish.variants) {
      enrichedVariants.push(await enrichDish(variant, supabase, openai));
    }
  }

  return {
    ...dish,
    spice_level: normalisedSpice,
    matched_ingredients: matched,
    mapped_dietary_tags: mapDietaryHints(dish.dietary_hints ?? []),
    variants: enrichedVariants as RawExtractedDish[] | null,
  };
}

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
        enrichedDishes.push(await enrichDish(dish, supabase, openai));
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
    return NextResponse.json({ error: auth.error ?? 'Unauthorized' }, { status: 401 });
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
  if (images.length > 20) {
    return NextResponse.json({ error: 'Maximum 20 images per scan' }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();
  const openai = getOpenAIClient();

  // 3. Load restaurant for currency
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

    // 6. Merge multi-page results (with 3-layer fuzzy matching)
    const { merged, flaggedDuplicates } = mergeExtractionResults(rawResults);

    if (flaggedDuplicates.length > 0) {
      // Variant grouping detected — flagged for user review in review step
    }

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

    return NextResponse.json({
      jobId: job.id,
      currency,
      result: fullResult,
      dishCount,
      processingMs,
      flaggedDuplicates: flaggedDuplicates.length > 0 ? flaggedDuplicates : undefined,
    });
  } catch (error: unknown) {
    console.error('[MenuScan] Processing failed:', error);

    await supabase
      .from('menu_scan_jobs')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      })
      .eq('id', job.id);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Menu processing failed', jobId: job.id },
      { status: 500 }
    );
  }
}
