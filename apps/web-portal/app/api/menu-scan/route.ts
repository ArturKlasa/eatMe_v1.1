import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { createServerSupabaseClient, verifyAdminRequest } from '@/lib/supabase-server';
import {
  mergeExtractionResults,
  mapDietaryHints,
  mapAllergenHints,
  getCurrencyForRestaurant,
  type RawExtractionResult,
  type RawExtractedDish,
  type EnrichedResult,
  type EnrichedMenu,
  type EnrichedCategory,
  type EnrichedDish,
  type FlaggedDuplicate,
} from '@/lib/menu-scan';
import { resolveIngredients } from '@/lib/ingredient-resolver';

const RawIngredientSchema = z.object({
  base: z.string(),
  modifier: z.string().nullable(),
});

const CourseItemSchema = z.object({
  option_label: z.string(),
  price_delta: z.number().default(0),
});

const CourseSchema = z.object({
  course_number: z.number().int().min(1),
  course_name: z.string().nullable(),
  choice_type: z.enum(['fixed', 'one_of']),
  items: z.array(CourseItemSchema),
});

const DishSchema: z.ZodType<unknown> = z.lazy(() =>
  z.object({
    name: z.string(),
    price: z.number().nullable(),
    description: z.string().nullable(),
    raw_ingredients: z.array(RawIngredientSchema).nullable(),
    dietary_hints: z.array(z.string()),
    allergen_hints: z.array(z.string()),
    primary_protein: z
      .enum([
        'chicken',
        'beef',
        'pork',
        'lamb',
        'duck',
        'other_meat',
        'fish',
        'shellfish',
        'eggs',
        'vegetarian',
        'vegan',
      ])
      .nullable(),
    spice_level: z.union([z.literal(0), z.literal(1), z.literal(3)]).nullable(),
    calories: z.number().nullable(),
    dish_category: z.string().nullable(),
    confidence: z.number(),
    is_parent: z.boolean(),
    dish_kind: z.enum(['standard', 'bundle', 'configurable', 'course_menu', 'buffet']),
    serves: z.number().nullable(),
    display_price_prefix: z.enum(['exact', 'from', 'per_person', 'market_price', 'ask_server']),
    variants: z.array(DishSchema).nullable(),
    courses: z.array(CourseSchema).optional(),
  })
);

const ExtractionNoteSchema = z.object({
  type: z.enum([
    'likely_ocr_error',
    'price_outlier',
    'unreadable_section',
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
   - H/halal → "halal"; K/kosher → "kosher"; hindu → "hindu"; jain → "jain"; buddhist → "buddhist"
   - keto → "keto"; paleo → "paleo"; low-carb → "low_carb"; low-sodium → "low_sodium"; diabetic-friendly → "diabetic_friendly"; organic → "organic"
   - non-alcoholic/sin alcohol/alcohol-free/NA → "non_alcoholic" (use for mocktails, NA beer, virgin cocktails, dealcoholised wine)
   Only use these exact canonical codes. If a hint doesn't fit, omit it.
6a. ALLERGENS — populate allergen_hints[] when a dish's OWN text (name, description, ingredient list, dish-specific badge) names or directly implies an allergen. Canonical codes:
   - "lactose" — milk, cream, cheese, butter, yoghurt, dairy
   - "gluten" — wheat, barley, rye, semolina, seitan, most bread/pasta
   - "peanuts" — peanut, groundnut, satay sauce
   - "nuts" — almond, walnut, hazelnut, pecan, cashew, pistachio, pine nut (tree nuts)
   - "soy" — soy, soybean, tofu, edamame, soy sauce, tempeh
   - "sesame" — sesame seed, tahini, sesame oil
   - "eggs" — egg, mayo, aioli, meringue, custard, egg wash
   - "fish" — salmon, tuna, cod, anchovy, sardine, fish sauce (NOT shellfish)
   - "shellfish" — shrimp, prawn, crab, lobster, scallop, oyster, mussel, clam, squid, octopus
   IGNORE menu-wide "may contain" / "produced in a facility" / "*all dishes" disclaimers. Those are legal boilerplate, not dish-specific data. Only extract allergens that are specifically claimed or obviously present in a given dish.
   When unsure, omit the allergen. Under-claiming is safer than over-claiming.
7. Detect spice indicators (🌶, "picante", "spicy") → spice_level: 1 (mild) or 3 (very spicy). null = no indicator, 0 = explicitly non-spicy.
8. raw_ingredients: always return an empty array []. Do NOT extract individual ingredients — we only need the primary_protein (see below).
9. confidence: 1.0 = perfectly legible, 0.7 = slightly unclear, 0.5 = partially obscured, 0.3 = mostly guessing.
10. Keep all names in their original language (Spanish, English, etc.).
11. For "menu_type": use "drink" only for a clearly separate beverage page/section. A "Bebidas" subsection at the bottom of a food page → category inside the food menu.

DISH PATTERN DETECTION — apply in this priority order:
1. CONFIGURABLE (build-your-own): "Choose your protein/base", "Build your bowl", "Pick a base" → dish_kind="configurable", is_parent=true, display_price_prefix="from", variants[] = each option as a child dish.
2. BUNDLE: "Lunch combo", "Set menu", "Includes X + Y + Z", fixed meal deal → dish_kind="bundle", is_parent=true, price=<the single bundled price shown on the menu>, display_price_prefix="exact", variants[] = included items with price=null (bundles have one price on the parent, not per-item).
3. COURSE MENU (multi-course sequenced): "Tasting menu", "Prix fixe", "Menú de Degustación", "Omakase" → dish_kind="course_menu", is_parent=true, display_price_prefix="per_person", serves=number of people, courses[] = ordered list of courses each with items.
4. BUFFET (flat-rate unlimited): "All-you-can-eat", "AYCE", "Hot pot" (when unlimited), "BBQ buffet", per-person unlimited access → dish_kind="buffet", is_parent=false, display_price_prefix="per_person", price=the flat rate, serves=1.
5. SIZE VARIANTS: S/M/L, "Small/Regular/Large", "Chico/Mediano/Grande" → dish_kind="standard", is_parent=true, display_price_prefix="from", variants[] = each size with its price.
6. MARKET PRICE: "MP", "Market price", "Precio de mercado" → price=null, display_price_prefix="market_price".
7. FAMILY/SHARING: "For 2-3", "Para compartir", "Feeds 4" → serves=N (number of people), dish_kind="standard".
8. STANDARD: everything else → dish_kind="standard", is_parent=false, serves=1, display_price_prefix="exact".

COURSE MENU RULES (dish_kind="course_menu"):
- The parent dish is_parent=true; variants[] = null (use courses[] instead).
- courses[] must list each course in order: course_number (1, 2, 3…), course_name (e.g. "Starter", "Main", "Dessert"), choice_type:
  - "fixed" when the course has exactly one item (no diner choice).
  - "one_of" when the diner selects one item from multiple options.
- Each course has items[]: option_label (dish name or description) and price_delta (default 0; non-zero when upgrades carry a surcharge).
- If the menu shows a tasting menu without listing individual courses, create one course (course_number=1, choice_type="fixed") with a single item.

PARENT-CHILD RULES:
- Parent: is_parent=true, variants[] = child dishes.
  - dish_kind="bundle": parent.price = the bundled price from the menu; each child.price = null (children share the bundle price).
  - dish_kind="configurable" | "standard" (size variants): parent.price = 0 (display-only container); each child has its own price.
  - dish_kind="course_menu": parent.price = the total prix-fixe price; variants[] = null; use courses[] instead.
- Each child: is_parent=false, its own dietary_hints and primary_protein. Child price follows the rule above.
- If unsure, default to standard single dish (is_parent=false, no variants).

SERVES FIELD: Number of people this dish feeds. Default 1. Set higher for sharing/family plates.
DISPLAY_PRICE_PREFIX: How the price is displayed — "exact" (default), "from" (starting at), "per_person", "market_price", "ask_server".

MULTI-PAGE NOTE: This menu may be extracted across multiple pages. Each page is processed independently. Categories will be merged later, so use consistent category names across pages.

FEW-SHOT EXAMPLES:

Example 1 — Standard dishes:
Menu showing "Tacos" section with "Taco al Pastor $45" and "Taco de Bistec $50":
→ Two standard dishes: dish_kind="standard", is_parent=false, serves=1, display_price_prefix="exact"

Example 2 — Configurable with variants:
Menu showing "Poke Bowl" with options "Salmon $189", "Tofu $159", "Shrimp $179":
→ Parent: name="Poke Bowl", dish_kind="configurable", is_parent=true, price=0, display_price_prefix="from"
→ Variants: [{name:"Poke Bowl — Salmon", price:189}, {name:"Poke Bowl — Tofu", price:159}, {name:"Poke Bowl — Shrimp", price:179}]

Example 3 — Bundle:
Menu showing "Lunch Special $129 — includes soup, main course, and drink":
→ Parent: name="Lunch Special", dish_kind="bundle", is_parent=true, price=129, display_price_prefix="exact"
→ Variants: [{name:"Lunch Special — Soup", price:null}, {name:"Lunch Special — Main Course", price:null}, {name:"Lunch Special — Drink", price:null}]

Example 4 — Course menu (tasting / prix-fixe):
Menu showing "Chef's Tasting Menu $850/person — Starter (choose: Oysters / Tartare), Main (Wagyu only), Dessert (choose: Tart / Ice Cream)":
→ Parent: name="Chef's Tasting Menu", dish_kind="course_menu", is_parent=true, price=850, display_price_prefix="per_person", serves=1, variants=null
→ courses: [
    {course_number:1, course_name:"Starter", choice_type:"one_of", items:[{option_label:"Oysters", price_delta:0},{option_label:"Tartare", price_delta:0}]},
    {course_number:2, course_name:"Main", choice_type:"fixed", items:[{option_label:"Wagyu", price_delta:0}]},
    {course_number:3, course_name:"Dessert", choice_type:"one_of", items:[{option_label:"Tart", price_delta:0},{option_label:"Ice Cream", price_delta:0}]}
  ]

Example 5 — Buffet:
Menu showing "Korean BBQ Buffet $299/person — unlimited meat selections":
→ name="Korean BBQ Buffet", dish_kind="buffet", is_parent=false, price=299, display_price_prefix="per_person", serves=1

PRIMARY PROTEIN — infer the dominant protein for each dish and set primary_protein to one of: chicken, beef, pork, lamb, duck, other_meat, fish, shellfish, eggs, vegetarian, vegan.
- Use "vegetarian" or "vegan" when the dish has no animal protein (and is not a drink).
- Use null ONLY when you genuinely cannot determine the protein (e.g. parent containers, drinks, unknown ingredients). Do not guess when confidence is low.
- For parent dishes (is_parent=true), set primary_protein=null on the parent; infer it on each child variant.

DISH CATEGORY — set dish_category to a short canonical name describing what kind of dish this is (e.g. "Pizza", "Taco", "Ramen", "Caesar Salad", "Pad Thai", "Cheesecake").
- A canonical list is provided in the user message. STRONGLY PREFER an exact match from that list — copy the name verbatim (case-sensitive) when one fits.
- If no listed category fits, propose a new short name (English, title-case, max 3 words). Examples of good new names: "Bao Buns", "Beef Stew", "Stuffed Squid".
- Be specific when possible: "Pad Thai" is better than "Noodles"; "Carne Asada" is better than "Beef Dish"; "Eggs Benedict" is better than "Breakfast".
- For parent dishes with size variants (same dish, different sizes), set the same dish_category on parent and children.
- For combos and templates where children are different dish types, set dish_category=null on the parent and a specific dish_category on each child.
- Only set null when the dish is genuinely uncategorisable.

QUALITY SELF-REPORT — after extraction, populate extraction_notes with issues YOU observed. This is a self-review step to help the admin verify accuracy.
Note types:
- likely_ocr_error: a dish name or description appears garbled or partially corrupted (e.g. "Mrghrtta Pzz" → likely "Margherita Pizza")
- price_outlier: a price is wildly inconsistent with nearby dishes on the same menu (possible decimal/comma error, e.g. $1,200 among $8–15 dishes)
- unreadable_section: a portion of the image was too obscured to extract confidently (use path "page_1", "page_2", etc.)
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
  canonicalCategoryNames: string[],
  pageNumber: number = 1,
  totalPages: number = 1
): Promise<ExtractionResult> {
  const pageContext =
    totalPages > 1
      ? `Extract all dishes from this menu image (page ${pageNumber} of ${totalPages}).`
      : 'Extract all dishes from this menu image.';

  const categoryList =
    canonicalCategoryNames.length > 0
      ? `\n\nCanonical dish_category list (prefer exact match, copy verbatim):\n${JSON.stringify(canonicalCategoryNames)}`
      : '';

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
            text: pageContext + categoryList,
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

  // Apply defaults and tag each dish with its 0-based source image index.
  const imageIndex = pageNumber - 1;
  for (const menu of parsed.menus) {
    for (const cat of menu.categories) {
      for (const dish of cat.dishes) {
        applyDishDefaults(dish);
        tagSourceImageIndex(dish, imageIndex);
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
  if (!dish.courses) dish.courses = undefined;

  // Recursively apply to variants
  if (dish.variants) {
    for (const variant of dish.variants) {
      applyDishDefaults(variant);
      variant.is_parent = false; // variants are never parents
    }
  }
}

/** Tag all dishes (and their variants) with the 0-based source image index. */
function tagSourceImageIndex(dish: RawExtractedDish, imageIndex: number): void {
  dish.source_image_index = imageIndex;
  if (dish.variants) {
    for (const variant of dish.variants) {
      tagSourceImageIndex(variant, imageIndex);
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

type UnmappedHintEntry = { dishName: string; kind: 'dietary' | 'allergen'; hints: string[] };

async function enrichDish(
  dish: RawExtractedDish,
  supabase: ReturnType<typeof createServerSupabaseClient>,
  openai: OpenAI,
  menuLanguage: string,
  unmappedCollector?: UnmappedHintEntry[]
): Promise<EnrichedDish> {
  const matched = await resolveIngredients(
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

  const { codes: dietaryCodes, unmapped: unmappedDietary } = mapDietaryHints(
    dish.dietary_hints ?? []
  );
  const { codes: allergenCodes, unmapped: unmappedAllergen } = mapAllergenHints(
    dish.allergen_hints ?? []
  );

  if (unmappedCollector) {
    if (unmappedDietary.length > 0) {
      unmappedCollector.push({ dishName: dish.name, kind: 'dietary', hints: unmappedDietary });
    }
    if (unmappedAllergen.length > 0) {
      unmappedCollector.push({ dishName: dish.name, kind: 'allergen', hints: unmappedAllergen });
    }
  }

  // Resolve dish_category text → dish_category_id (match by name, insert new if absent).
  const dishCategoryId = await resolveDishCategoryId(dish.dish_category, supabase);

  return {
    ...dish,
    spice_level: normalisedSpice,
    matched_ingredients: matched,
    mapped_dietary_tags: dietaryCodes,
    mapped_allergens: allergenCodes,
    dish_category_id: dishCategoryId,
    variants: enrichedVariants as RawExtractedDish[] | null,
  };
}

async function resolveDishCategoryId(
  rawName: string | null | undefined,
  supabase: ReturnType<typeof createServerSupabaseClient>
): Promise<string | null> {
  const name = rawName?.trim();
  if (!name) return null;

  const { data: existing } = await supabase
    .from('dish_categories')
    .select('id')
    .ilike('name', name)
    .eq('is_active', true)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: created } = await supabase
    .from('dish_categories')
    .insert({ name, is_drink: false, is_active: true })
    .select('id')
    .single();
  return created?.id ?? null;
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

    // Pre-fetch canonical dish categories so GPT can pick from the curated list.
    const { data: categoryRows } = await supabase
      .from('dish_categories')
      .select('name')
      .eq('is_active', true)
      .eq('is_drink', false)
      .order('name', { ascending: true });
    const canonicalCategoryNames = (categoryRows ?? []).map(r => r.name);

    const gptExtractionPromises = images.map((img, i) =>
      extractMenuFromImage(
        openai,
        img.data,
        img.mime_type,
        canonicalCategoryNames,
        i + 1,
        images.length
      )
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

    // Surface unmapped hints (dietary + allergen) so admins can review
    // instead of silently dropping codes the AI returned.
    for (const entry of unmappedHints) {
      extractionNotes.push({
        type: 'ingredient_mismatch',
        path: entry.dishName,
        message:
          entry.kind === 'dietary'
            ? `Unrecognised dietary hint(s): ${entry.hints.join(', ')}. These were not mapped to any canonical dietary tag.`
            : `Unrecognised allergen hint(s): ${entry.hints.join(', ')}. These were not mapped to any canonical allergen.`,
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
