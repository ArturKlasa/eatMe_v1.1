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

const ExtractionNoteSchema = z.object({
  type: z.enum([
    'likely_ocr_error',
    'price_outlier',
    'unreadable_section',
    'ingredient_mismatch',
    'dish_category_mismatch',
  ]),
  path: z.string(),
  message: z.string(),
  suggestion: z.string().nullable(),
});

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
  extraction_notes: z.array(ExtractionNoteSchema),
});

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
6. Detect dietary symbols and map to canonical codes in dietary_hints[]:
   - V/vegetariano/a → "vegetarian"; VG/vegano/a → "vegan"; pescatarian → "pescatarian"
   - GF/sin gluten → "gluten_free"; DF/sin lácteos → "dairy_free"; nut-free → "nut_free"; egg-free → "egg_free"; soy-free → "soy_free"
   - H/halal → "halal"; K/kosher → "kosher"; hindu → "hindu"; jain → "jain"
   - keto → "keto"; paleo → "paleo"; low-carb → "low_carb"; low-sodium → "low_sodium"; diabetic-friendly → "diabetic_friendly"; organic → "organic"
   Only use these exact canonical codes. If a hint doesn't fit, omit it.
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
→ Variants: [{name:"Lunch Special — Soup"}, {name:"Lunch Special — Main Course"}, {name:"Lunch Special — Drink"}]

INGREDIENT EXTRACTION — when populating raw_ingredients, include only ingredients you can read confidently. If you are guessing, omit the ingredient rather than fabricate it. Prefer null over a partial/guessed list.

QUALITY SELF-REPORT — after extraction, populate extraction_notes with issues YOU observed. This is a self-review step to help the admin verify accuracy.
Note types:
- likely_ocr_error: a dish name or description appears garbled or partially corrupted (e.g. "Mrghrtta Pzz" → likely "Margherita Pizza")
- price_outlier: a price is wildly inconsistent with nearby dishes on the same menu (possible decimal/comma error, e.g. $1,200 among $8–15 dishes)
- unreadable_section: a portion of the image was too obscured to extract confidently (use path "page_1", "page_2", etc.)
- ingredient_mismatch: a dish description mentions ingredients that don't match the dish name (e.g. "Pizza" description mentions noodles)
- dish_category_mismatch: a dish appears to be in the wrong category (e.g. "Caesar Salad" under "Desserts")

Format: { type, path ("Menu Name > Category > Dish Name" or "page_X"), message, suggestion (proposed fix or null) }.
Report ONLY high-confidence issues. Do not flag stylistic choices, minor spelling quirks, or anything you're uncertain about.
Return an empty array if the menu looks clean.`;

function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

interface ExtractionResult {
  result: RawExtractionResult;
  promptTokens: number;
  completionTokens: number;
}

async function extractMenuFromImage(
  openai: OpenAI,
  base64Data: string,
  mimeType: string,
  pageNumber: number = 1,
  totalPages: number = 1
): Promise<ExtractionResult> {
  const pageContext =
    totalPages > 1
      ? `Extract all dishes from this menu image (page ${pageNumber} of ${totalPages}).`
      : 'Extract all dishes from this menu image.';

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
            text: pageContext,
          },
        ],
      },
    ],
    response_format: zodResponseFormat(MenuExtractionSchema, 'menu_extraction'),
    max_tokens: 16384,
    temperature: 0.1,
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

  // If GPT-4o hit the token limit, inject a visible extraction note so the
  // admin sees the warning in the review UI rather than a silent console log.
  if (choice.finish_reason === 'length') {
    parsed.extraction_notes = parsed.extraction_notes ?? [];
    parsed.extraction_notes.push({
      type: 'unreadable_section',
      path: '(full menu)',
      message:
        'AI response was cut off due to token limit — some dishes near the end of the menu may be missing.',
      suggestion: 'Re-scan the menu in smaller sections or split across multiple images.',
    });
  }

  // Apply defaults for fields GPT may have set to null within valid schema
  for (const menu of parsed.menus) {
    for (const cat of menu.categories) {
      for (const dish of cat.dishes) {
        applyDishDefaults(dish);
      }
    }
  }

  return {
    result: parsed,
    promptTokens: completion.usage?.prompt_tokens ?? 0,
    completionTokens: completion.usage?.completion_tokens ?? 0,
  };
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

const COUNTRY_LANGUAGE_MAP: Record<string, string> = {
  MX: 'es',
  ES: 'es',
  AR: 'es',
  CO: 'es',
  PE: 'es',
  CL: 'es',
  FR: 'fr',
  DE: 'de',
  IT: 'it',
  PT: 'pt',
  BR: 'pt',
  PL: 'pl',
  JP: 'ja',
  CN: 'zh',
  US: 'en',
  GB: 'en',
  AU: 'en',
  CA: 'en',
};

function getMenuLanguage(countryCode: string | null | undefined): string {
  if (!countryCode) return 'und'; // undetermined
  return COUNTRY_LANGUAGE_MAP[countryCode.toUpperCase()] ?? 'und';
}

type AliasRow = {
  canonical_ingredient_id: string;
  display_name: string;
  canonical_ingredient: { canonical_name: string } | null;
};

const ALIAS_SELECT =
  'display_name, canonical_ingredient_id, canonical_ingredient:canonical_ingredients(canonical_name)';

/** Bulk-lookup ingredient names against ingredient_aliases (exact then partial ilike). */
async function bulkLookupAliases(
  names: string[],
  supabase: ReturnType<typeof createServerSupabaseClient>
): Promise<Map<string, AliasRow>> {
  const resultMap = new Map<string, AliasRow>();
  if (names.length === 0) return resultMap;

  // Strip characters that break PostgREST OR-filter parsing: commas (value delimiter),
  // percent signs (unintended wildcards), and dots/parens (field.op.value syntax).
  const sanitize = (n: string) => n.replace(/[,%.()\[\]]/g, '');

  // Pass A: exact ilike for all names in one OR query
  const exactOr = names.map(n => `display_name.ilike.${sanitize(n)}`).join(',');
  const { data: exactRows } = await supabase
    .from('ingredient_aliases')
    .select(ALIAS_SELECT)
    .or(exactOr);

  for (const row of exactRows ?? []) {
    const r = row as unknown as AliasRow;
    const key = r.display_name.toLowerCase().trim();
    if (!resultMap.has(key)) resultMap.set(key, r);
  }

  // Pass B: partial ilike for names that got no exact hit
  const unmatched = names.filter(n => !resultMap.has(n.toLowerCase().trim()));
  if (unmatched.length > 0) {
    const partialOr = unmatched.map(n => `display_name.ilike.%${sanitize(n)}%`).join(',');
    const { data: partialRows } = await supabase
      .from('ingredient_aliases')
      .select(ALIAS_SELECT)
      .or(partialOr);

    for (const row of partialRows ?? []) {
      const r = row as unknown as AliasRow;
      const displayLower = r.display_name.toLowerCase();
      for (const name of unmatched) {
        const key = name.toLowerCase().trim();
        if (!resultMap.has(key) && (displayLower.includes(key) || key.includes(displayLower))) {
          resultMap.set(key, r);
        }
      }
    }
  }

  return resultMap;
}

async function translateIngredients(
  terms: string[],
  openai: OpenAI,
  menuLanguage: string = 'und'
): Promise<{ translations: Record<string, string>; error?: boolean }> {
  if (terms.length === 0) return { translations: {} };
  const langHint =
    menuLanguage !== 'und' && menuLanguage !== 'en'
      ? ` The ingredient names are in ${menuLanguage}.`
      : ' The ingredient names may be in any language.';
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a culinary ingredient translator.${langHint} Given a JSON array of food ingredient names, return a JSON object mapping each original name to its standard English culinary name. Keep the output minimal: only ingredient names, no explanations. If a name is already a well-known culinary term in English (e.g. "pierogi", "tofu", "naan"), return it unchanged.`,
        },
        {
          role: 'user',
          content: JSON.stringify(terms),
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 512,
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return { translations: {}, error: true };

    const parsed = JSON.parse(content) as Record<string, unknown>;
    const raw =
      typeof parsed.translations === 'object' && parsed.translations !== null
        ? (parsed.translations as Record<string, string>)
        : (parsed as Record<string, string>);

    return {
      translations: Object.fromEntries(
        Object.entries(raw).map(([k, v]) => [k, typeof v === 'string' ? v : k])
      ),
    };
  } catch (err) {
    console.error('[MenuScan] Translation fallback failed:', err);
    return { translations: {}, error: true };
  }
}

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

async function matchIngredients(
  rawIngredients: string[],
  supabase: ReturnType<typeof createServerSupabaseClient>,
  openai: OpenAI,
  menuLanguage: string
): Promise<MatchedIngredient[]> {
  if (!rawIngredients || rawIngredients.length === 0) return [];

  const trimmedInputs = rawIngredients.map(r => r.trim());

  function rowToMatch(raw: string, row: AliasRow): MatchedIngredient {
    return {
      raw_text: raw,
      status: 'matched',
      canonical_ingredient_id: row.canonical_ingredient_id,
      canonical_name: row.canonical_ingredient?.canonical_name,
      display_name: row.display_name,
    };
  }

  // ---- Pass 1: bulk DB lookup for all ingredients (≤2 queries) ----
  const lookupMap = await bulkLookupAliases(trimmedInputs.filter(Boolean), supabase);

  const results: MatchedIngredient[] = trimmedInputs.map((t, i) => {
    const raw = rawIngredients[i];
    if (!t) return { raw_text: raw, status: 'unmatched' };
    const row = lookupMap.get(t.toLowerCase().trim()) ?? null;
    return row ? rowToMatch(raw, row) : { raw_text: raw, status: 'unmatched' };
  });

  // ---- Pass 2: batch-translate unmatched terms (1 LLM call + ≤2 DB queries) ----
  const needsTranslation = trimmedInputs.filter((t, i) => t && results[i].status === 'unmatched');
  if (needsTranslation.length === 0) return results;

  const { translations, error: translationError } = await translateIngredients(
    needsTranslation,
    openai,
    menuLanguage
  );

  if (translationError) {
    console.warn('[MenuScan] Ingredient translation failed — some ingredients may be unmatched');
  }

  // Collect unique translated names that differ from the originals
  const translatedTerms: string[] = [];
  const seenTranslations = new Set<string>();
  for (const t of needsTranslation) {
    const eng = translations[t];
    if (eng && eng.toLowerCase() !== t.toLowerCase() && !seenTranslations.has(eng.toLowerCase())) {
      seenTranslations.add(eng.toLowerCase());
      translatedTerms.push(eng);
    }
  }

  if (translatedTerms.length === 0) return results;

  const translatedMap = await bulkLookupAliases(translatedTerms, supabase);

  for (let i = 0; i < results.length; i++) {
    if (results[i].status !== 'unmatched') continue;
    const t = trimmedInputs[i];
    if (!t) continue;
    const englishName = translations[t];
    if (!englishName || englishName.toLowerCase() === t.toLowerCase()) continue;
    const row = translatedMap.get(englishName.toLowerCase().trim()) ?? null;
    if (row) {
      results[i] = rowToMatch(rawIngredients[i], row);
      void saveNewAlias(t, menuLanguage, row.canonical_ingredient_id, supabase);
    }
  }

  return results;
}

type UnmappedHintEntry = { dishName: string; hints: string[] };

async function enrichDish(
  dish: RawExtractedDish,
  supabase: ReturnType<typeof createServerSupabaseClient>,
  openai: OpenAI,
  menuLanguage: string,
  unmappedCollector?: UnmappedHintEntry[]
): Promise<EnrichedDish> {
  const matched = await matchIngredients(
    dish.raw_ingredients ?? [],
    supabase,
    openai,
    menuLanguage
  );

  // Normalise LLM-returned spice_level to the allowed set {0, 1, 3}.
  const rawSpice: number | null = dish.spice_level ?? null;
  const normalisedSpice: 0 | 1 | 3 | null =
    rawSpice === null ? null : rawSpice <= 0 ? 0 : rawSpice <= 1 ? 1 : rawSpice === 2 ? 1 : 3;

  // Recursively enrich variants
  let enrichedVariants: EnrichedDish[] | null = null;
  if (dish.variants && dish.variants.length > 0) {
    enrichedVariants = [];
    for (const variant of dish.variants) {
      enrichedVariants.push(
        await enrichDish(variant, supabase, openai, menuLanguage, unmappedCollector)
      );
    }
  }

  const { codes, unmapped } = mapDietaryHints(dish.dietary_hints ?? []);
  if (unmapped.length > 0 && unmappedCollector) {
    unmappedCollector.push({ dishName: dish.name, hints: unmapped });
  }

  return {
    ...dish,
    spice_level: normalisedSpice,
    matched_ingredients: matched,
    mapped_dietary_tags: codes,
    variants: enrichedVariants as RawExtractedDish[] | null,
  };
}

async function enrichResult(
  raw: RawExtractionResult,
  supabase: ReturnType<typeof createServerSupabaseClient>,
  openai: OpenAI,
  menuLanguage: string
): Promise<{ menus: EnrichedMenu[]; unmappedHints: UnmappedHintEntry[] }> {
  const enrichedMenus: EnrichedMenu[] = [];
  const unmappedHints: UnmappedHintEntry[] = [];

  for (const menu of raw.menus) {
    const enrichedCategories: EnrichedCategory[] = [];

    for (const cat of menu.categories) {
      const enrichedDishes: EnrichedDish[] = [];

      for (const dish of cat.dishes) {
        enrichedDishes.push(await enrichDish(dish, supabase, openai, menuLanguage, unmappedHints));
      }

      enrichedCategories.push({ name: cat.name, dishes: enrichedDishes });
    }

    enrichedMenus.push({
      name: menu.name,
      menu_type: menu.menu_type,
      categories: enrichedCategories,
    });
  }

  return { menus: enrichedMenus, unmappedHints };
}

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
  const menuLanguage = getMenuLanguage(restaurant?.country_code);

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

    const gptExtractionPromises = images.map((img, i) =>
      extractMenuFromImage(openai, img.data, img.mime_type, i + 1, images.length)
    );

    // Run storage uploads and GPT-4o extractions in parallel.
    // allSettled for both: one page failure must not discard successfully extracted pages.
    const [storagePathsSettled, gptSettled] = await Promise.all([
      Promise.allSettled(storageUploadPromises),
      Promise.allSettled(gptExtractionPromises),
    ]);

    // Only include paths for uploads that actually succeeded — no phantom paths.
    const imagePaths = storagePathsSettled
      .map(r => (r.status === 'fulfilled' ? r.value : null))
      .filter((p): p is string => p !== null);

    // Collect successful GPT extractions; warn about failed pages.
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    const rawResults = gptSettled
      .map((r, i) => {
        if (r.status === 'fulfilled') {
          totalPromptTokens += r.value.promptTokens;
          totalCompletionTokens += r.value.completionTokens;
          return r.value.result;
        }
        console.warn(`[MenuScan] GPT extraction failed for page ${i + 1}:`, r.reason);
        return null;
      })
      .filter((r): r is RawExtractionResult => r !== null);

    if (rawResults.length === 0) {
      throw new Error('All page extractions failed — no results to process.');
    }

    const failedPageCount = gptSettled.filter(r => r.status === 'rejected').length;

    // 6. Merge multi-page results (with 3-layer fuzzy matching)
    const { merged, flaggedDuplicates, extractionNotes } = mergeExtractionResults(rawResults);

    if (flaggedDuplicates.length > 0) {
      // Variant grouping detected — flagged for user review in review step
    }

    // 7. Enrich with ingredient matches + dietary tag codes
    const { menus: enrichedMenus, unmappedHints } = await enrichResult(
      merged,
      supabase,
      openai,
      menuLanguage
    );

    // Surface unmapped dietary hints so admins can review rather than silently dropping.
    for (const entry of unmappedHints) {
      extractionNotes.push({
        type: 'ingredient_mismatch',
        path: entry.dishName,
        message: `Unrecognised dietary hint(s): ${entry.hints.join(', ')}. These were not mapped to any canonical dietary tag.`,
        suggestion: null,
      });
    }

    // Inject a visible warning for any pages that failed GPT extraction.
    if (failedPageCount > 0) {
      extractionNotes.push({
        type: 'unreadable_section',
        path: `(${failedPageCount} of ${images.length} pages)`,
        message: `${failedPageCount} page(s) could not be extracted due to an AI processing error. Results shown are from the remaining ${rawResults.length} page(s).`,
        suggestion: 'Re-scan the failed pages individually.',
      });
    }

    const fullResult: EnrichedResult = {
      menus: enrichedMenus,
      currency,
      extractionNotes: extractionNotes.length > 0 ? extractionNotes : undefined,
    };

    const dishCount = enrichedMenus.reduce(
      (total, menu) => total + menu.categories.reduce((sum, cat) => sum + cat.dishes.length, 0),
      0
    );

    const processingMs = Date.now() - startTime;

    // 8. Save enriched result to DB — retry once on failure (DR-11)
    const updatePayload = {
      status: 'needs_review' as const,
      result_json: {
        ...fullResult,
        flaggedDuplicates: flaggedDuplicates.length > 0 ? flaggedDuplicates : undefined,
      },
      image_storage_paths: imagePaths,
      dishes_found: dishCount,
      processing_ms: processingMs,
      extraction_model: 'gpt-4o',
      extraction_prompt_tokens: totalPromptTokens,
      extraction_completion_tokens: totalCompletionTokens,
    };

    let { error: updateError } = await supabase
      .from('menu_scan_jobs')
      .update(updatePayload)
      .eq('id', job.id);

    if (updateError) {
      console.warn('[MenuScan] Final status update failed — retrying once:', updateError);
      ({ error: updateError } = await supabase
        .from('menu_scan_jobs')
        .update(updatePayload)
        .eq('id', job.id));
    }

    if (updateError) {
      console.error(
        '[MenuScan] Final status update failed after retry — job stuck in processing:',
        updateError
      );
      return NextResponse.json(
        {
          error: 'Processing succeeded but failed to save result — check job status',
          jobId: job.id,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      jobId: job.id,
      currency,
      result: fullResult,
      dishCount,
      processingMs,
      flaggedDuplicates: flaggedDuplicates.length > 0 ? flaggedDuplicates : undefined,
      extractionNotes: extractionNotes.length > 0 ? extractionNotes : undefined,
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
