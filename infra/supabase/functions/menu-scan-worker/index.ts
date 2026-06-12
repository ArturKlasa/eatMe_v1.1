// menu-scan-worker/index.ts
// Supabase Edge Function — claims pending menu_scan_jobs, downloads images from
// Storage, calls OpenAI GPT-4o with Vision + Structured Outputs, writes result
// back via complete_menu_scan_job.
//
// Invocation: direct POST from adminCreateMenuScanJob (apps/admin/.../actions/
// menuScan.ts) immediately after the row is created. The pg_cron sweep
// 'menu-scan-worker-tick' (migration 116b) was disabled 2026-05-03 — see that
// migration's header for the recovery tradeoff.
import { createClient } from 'npm:@supabase/supabase-js@2';
import OpenAI from 'npm:openai@4';
import { zodResponseFormat } from 'npm:openai@4/helpers/zod';
import { z } from 'npm:zod@3';

// ── v2 MenuExtractionSchema (local bundle — Deno cannot import workspace packages) ──
// Canonical source: packages/shared/src/validation/menuScan.ts

export const PRIMARY_PROTEINS = [
  'chicken',
  'turkey',
  'beef',
  'pork',
  'lamb',
  'goat',
  'other_meat',
  'fish',
  'shellfish',
  'eggs',
  'vegetarian',
  'vegan',
] as const;

// Dining-format hint for dishes that are dining experiences rather than plates.
// Null for standard dishes. Persisted to dishes.dining_format by the confirm RPC.
export const DINING_FORMATS = [
  'buffet',
  'course_menu',
  'interactive_table',
  'shared_plates',
  'sampler',
] as const;

// Modifier-group schemas: parallel to packages/shared validation (Phase 3
// canonicalises them). Kept locally because Deno can't import workspace
// packages.
export const modifierOptionSchema = z.object({
  name: z.string(),
  price_delta: z.number(),
  // Non-linear quantity pricing (e.g. "12 wings for $45" — 12-wing option has
  // price_override=45). When set, replaces the base price; otherwise price_delta
  // adds to base.
  price_override: z.number().nullable(),
  // Override base primary_protein when the option changes the protein source.
  // Null when the option doesn't touch protein (size choice, dressing choice).
  primary_protein: z.enum(PRIMARY_PROTEINS).nullable(),
  // Headcount change. 0 when no change.
  serves_delta: z.number().int(),
  // Marks the standard / cheapest option in a required group.
  is_default: z.boolean(),
});

export const modifierGroupSchema = z.object({
  name: z.string(),
  selection_type: z.enum(['single', 'multiple']),
  // 0 = optional group; ≥1 = required (must pick at least N).
  min_selections: z.number().int().min(0),
  max_selections: z.number().int().min(1),
  // True ONLY for groups whose selected option meaningfully changes the dish
  // identity in a one-line description (e.g. protein on Pad Thai → "with chicken").
  // False for size/dressing/drink choices.
  display_in_card: z.boolean(),
  options: z.array(modifierOptionSchema),
});

const bundledItemSchema = z.object({
  name: z.string(),
  note: z.string().nullable(),
});

const menuExtractionDishSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  price: z.number().nonnegative().nullable(),
  // NEW: explicit portion size when written on the menu (e.g. "250g", "0.5L",
  // "8 oz", "6 szt."). Metric normalized to base units (kg→g, L→ml); ounces
  // kept as 'oz' (migration 148). Both null when the menu doesn't show an
  // explicit portion. Persisted to dishes.portion_amount + dishes.portion_unit
  // (migration 145); DB CHECK enforces both-or-neither.
  portion_amount: z.number().int().positive().nullable(),
  portion_unit: z.enum(['g', 'ml', 'pcs', 'oz']).nullable(),
  // Verbatim printed size substring the model lifted the portion from (e.g.
  // "1.5kg", "0.5L", "8 oz", "6 szt.") — the ORIGINAL text, not the normalized
  // value, so the worker can strip it from the name for ANY unit (kg/L lose
  // their printed form once normalized to g/ml). Worker-internal: used at
  // extraction time to clean the name, never a dishes column. Null when
  // portion_amount is null.
  portion_source_text: z.string().nullable(),
  // Kept through the Phase 2→4 window so the existing admin review UI keeps
  // rendering. Phase 4 migrates the review UI to consume modifier_groups; Phase 7
  // drops dish_kind from the worker schema.
  dish_kind: z.enum(['standard', 'bundle', 'configurable', 'course_menu', 'buffet']),
  // NEW: dining-experience hint, null for standard dishes.
  dining_format: z.enum(DINING_FORMATS).nullable(),
  // NEW: pre-included items the customer doesn't pick (combo meal, prix-fixe
  // included sides). Empty array when no bundling.
  bundled_items: z.array(bundledItemSchema),
  // NEW: customer choices ("choose your X", "add Y for $Z", size variants).
  // Empty array when the dish has no choices.
  modifier_groups: z.array(modifierGroupSchema),
  primary_protein: z.enum(PRIMARY_PROTEINS),
  // Verbatim section text from the menu, in the source language. Kept for v2
  // owner-portal back-compat; also doubles as the custom-category name when
  // canonical_category_slug is null.
  suggested_category_name: z.string().nullable(),
  // AI's match against the seeded canonical taxonomy (slug). Null when no
  // clean match — admin will create a custom menu_category from
  // suggested_category_name in that case.
  canonical_category_slug: z.string().nullable(),
  // Verbatim section description from the menu, in the source language.
  // E.g. "Hot Dogs" header followed by "2 hot dogs de salchicha de pavo con
  // papas" → that subtitle. Null if the section has no description.
  // Restaurant-specific (describes what THIS restaurant serves under that
  // section), so it's stored on the per-restaurant menu_category row, not on
  // the canonical taxonomy.
  suggested_category_description: z.string().nullable(),
  // Free-text dish-classification name (e.g. "Hot Dog", "Bánh Mì",
  // "Cheeseburger", "Pad Thai"). Maps to the global dish_categories taxonomy
  // (~800 seeded entries) which drives mobile filtering/recommendation.
  // Server fuzzy-matches this against dish_categories.name. Null if the AI
  // can't classify — admin will pick from the dropdown.
  suggested_dish_category: z.string().nullable(),
  source_image_index: z.number().int().min(0),
  confidence: z.number().min(0).max(1),
});

const MenuExtractionSchema = z.object({
  dishes: z.array(menuExtractionDishSchema),
  // ISO-639-1 code (en/es/pl/fr/it/de/...) detected from menu text. Null if
  // mixed/uncertain. Used by admin review to flag mismatch with country-derived
  // source language.
  detected_language: z.string().nullable(),
  // Restaurant-level cuisine inferred from THIS page's dishes (Phase 3b). 1–3
  // canonical values from ALL_CUISINES; empty when the page gives no clear
  // signal (e.g. a drinks-only page). Unioned across pages in runExtraction,
  // normalized, then written to restaurants.cuisine_types only when it is empty.
  cuisine_types: z.array(z.string()),
});

type MenuExtractionResult = z.infer<typeof MenuExtractionSchema>;

// Thrown when a job's input has no images — treated as a permanent bad-request failure.
export class NoImagesError extends Error {
  constructor() {
    super('Job has no images in input');
  }
}

// ── Currency (inlined — Deno edge runtime can't import workspace packages) ───
//
// Mirror of the relevant rows from @eatme/shared/logic/currency.ts. Keep in
// lockstep — if you add a 13th currency to the shared module, mirror it here.

interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
}

const CURRENCY_NAMES: Record<string, { name: string; symbol: string }> = {
  USD: { name: 'US Dollar', symbol: '$' },
  MXN: { name: 'Mexican Peso', symbol: '$' },
  PLN: { name: 'Polish Złoty', symbol: 'zł' },
  EUR: { name: 'Euro', symbol: '€' },
  GBP: { name: 'British Pound', symbol: '£' },
  CAD: { name: 'Canadian Dollar', symbol: '$' },
  AUD: { name: 'Australian Dollar', symbol: '$' },
  BRL: { name: 'Brazilian Real', symbol: 'R$' },
  JPY: { name: 'Japanese Yen', symbol: '¥' },
  COP: { name: 'Colombian Peso', symbol: '$' },
  ARS: { name: 'Argentine Peso', symbol: '$' },
  CLP: { name: 'Chilean Peso', symbol: '$' },
};

function resolveCurrency(code: string | null | undefined): CurrencyInfo {
  const fallback: CurrencyInfo = { code: 'USD', name: 'US Dollar', symbol: '$' };
  if (!code) return fallback;
  const upper = code.toUpperCase();
  const info = CURRENCY_NAMES[upper];
  if (!info) return fallback;
  return { code: upper, name: info.name, symbol: info.symbol };
}

// ── Cuisine (inlined — Deno edge runtime can't import workspace packages) ─────
//
// Mirror of packages/shared/src/constants/cuisine.ts (ALL_CUISINES +
// normalizeCuisines). Keep in lockstep — if you add a cuisine to the shared
// module, mirror it here. Used to (a) constrain the extraction prompt to
// canonical values and (b) gate what gets written to restaurants.cuisine_types.

const ALL_CUISINES = [
  'Afghan',
  'African',
  'American',
  'Argentine',
  'Asian',
  'BBQ',
  'Bakery',
  'Brazilian',
  'Breakfast',
  'British',
  'Café',
  'Cajun',
  'Caribbean',
  'Chinese',
  'Colombian',
  'Comfort Food',
  'Cuban',
  'Deli',
  'Desserts',
  'Ethiopian',
  'Fast Food',
  'Filipino',
  'Fine Dining',
  'French',
  'Fusion',
  'German',
  'Greek',
  'Halal',
  'Hawaiian',
  'Healthy',
  'Indian',
  'Indonesian',
  'International',
  'Irish',
  'Italian',
  'Jamaican',
  'Japanese',
  'Korean',
  'Kosher',
  'Latin American',
  'Lebanese',
  'Malaysian',
  'Mediterranean',
  'Mexican',
  'Middle Eastern',
  'Moroccan',
  'Nepalese',
  'Pakistani',
  'Peruvian',
  'Pizza',
  'Polish',
  'Portuguese',
  'Russian',
  'Salad',
  'Sandwiches',
  'Seafood',
  'Soul Food',
  'Southern',
  'Spanish',
  'Steakhouse',
  'Sushi',
  'Taiwanese',
  'Tapas',
  'Thai',
  'Turkish',
  'Vegan',
  'Vegetarian',
  'Vietnamese',
  'Other',
] as const;

const CUISINE_DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g');
const foldCuisine = (s: string): string =>
  s.normalize('NFD').replace(CUISINE_DIACRITICS, '').trim().toLowerCase();
const CANONICAL_BY_FOLD = new Map<string, string>(ALL_CUISINES.map(c => [foldCuisine(c), c]));

// Canonicalize arbitrary cuisine strings: accent/case-insensitive, order-preserving,
// deduplicated; unknown values dropped. The single gate every cuisine write runs through.
function normalizeCuisines(input: readonly string[] | null | undefined): string[] {
  const out: string[] = [];
  for (const raw of input ?? []) {
    if (typeof raw !== 'string') continue;
    const canonical = CANONICAL_BY_FOLD.get(foldCuisine(raw));
    if (canonical && !out.includes(canonical)) out.push(canonical);
  }
  return out;
}

// ── Prompt ───────────────────────────────────────────────────────────────────

interface CanonicalSlug {
  slug: string;
  english_name: string;
}

function buildExtractionPrompt(
  canonicalSlugs: CanonicalSlug[],
  currency: CurrencyInfo,
  includeCuisine: boolean
): string {
  const slugList = canonicalSlugs.map(c => `  - ${c.slug} (${c.english_name})`).join('\n');

  // Cuisine is a whole-restaurant property, so only page 1 is asked to infer it.
  // Pages 2..N of a multi-page menu skip the 70-item list + the secondary
  // classification task entirely, keeping the model's attention on dishes.
  const cuisineBlock = includeCuisine
    ? `- cuisine_types: 1–3 cuisines that best describe THIS restaurant overall, inferred from the
    dishes, ordered most representative first. Choose ONLY from this exact list, copied verbatim
    (case-sensitive, keep accents):
    ${ALL_CUISINES.join(', ')}
    Prefer a specific national cuisine (e.g. "Mexican", "Italian", "Lebanese") over a broad one
    ("International", "Other", "Asian") when the dishes clearly point to it. Output an empty array
    when the dishes give no clear cuisine signal (e.g. a page of only drinks) — do NOT guess.`
    : `- cuisine_types: output an empty array []. (Restaurant cuisine is inferred from the first page only.)`;

  return `You are a menu-extraction assistant. Extract every dish from the provided menu image(s).

This restaurant's prices are in ${currency.name} (${currency.symbol}, ISO code: ${currency.code}). Extract numeric values only — strip the "${currency.symbol}" symbol (and any other currency markers) if they appear next to a price.

For each dish output exactly these fields:
- name: the dish name as printed, EXCEPT when printed in ALL CAPITALS — then
    convert to natural title case (capitalize principal words; keep articles,
    conjunctions and short prepositions lowercase unless first). Preserve
    acronyms and brand names in caps (BBQ, BLT, IPA, NY). Adjust capitalization
    ONLY — never translate, reorder, add or drop words. E.g.
    "GRILLED SEA BASS" → "Grilled Sea Bass"; "BBQ PORK RIBS" → "BBQ Pork Ribs".
- description: brief description if shown. Output null when there is no
    description — never output a placeholder such as ".", ":", "-", or "N/A".
- price: numeric price (no currency symbol), null if not shown
- portion_amount + portion_unit: explicit portion size shown on the menu.
    Extract ONLY when explicitly visible in the dish name or description.
    Units: metric weight → "g", metric volume → "ml", count → "pcs",
    imperial weight → "oz". Normalize metric to base units (kg→g, L→ml); keep
    ounces as "oz" — do NOT convert oz↔g. Pieces cover "X szt." / "X uds." too.
      "250g" / "250 g"             → {amount: 250,  unit: "g"}
      "1.5kg" / "1,5 kg"           → {amount: 1500, unit: "g"}
      "0.5L" / "500ml"             → {amount: 500,  unit: "ml"}
      "8 oz" / "8oz"               → {amount: 8,    unit: "oz"}
      "6 pcs" / "6 szt." / "6 uds" → {amount: 6,    unit: "pcs"}
    Copy the printed text verbatim: do NOT delete the size from the name or
    description when you set portion_amount/portion_unit, and NEVER add the
    size to a field where it is not printed (a size printed only in the name
    must not appear in the description). The app removes the duplicated size
    from the displayed text itself (it uses portion_source_text below to do so).
    Return BOTH null when:
      - no size is shown
      - the size uses a unit other than g / ml / pcs / oz (e.g. pint, fl oz,
        cup, quart, lb) — we don't store those; leave the text in the name and
        set portion_source_text null
      - size is a range ("200–250g") — avoid false precision
      - size is vague ("small", "medium", "large", "regular", "house portion")
      - size refers to a garnish or side note, not the dish itself
    Either both fields are set together or both are null.
- portion_source_text: the EXACT size substring you read, copied VERBATIM from
    the name/description — the ORIGINAL printed text, NOT the normalized value.
    So for "1.5kg" output "1.5kg" here even though portion_amount is 1500; for
    "0.5L" output "0.5L" even though portion_amount is 500. Examples: "250g",
    "1.5kg", "0.5L", "8 oz", "6 szt.". Null whenever portion_amount is null.
- dish_kind: classify as one of:
    standard       — single fixed item
    bundle         — N items sold together at one price
    configurable   — customer selects from options/slots
    course_menu    — multi-course sequenced meal (starter, main, dessert pattern)
    buffet         — flat-rate unlimited access
- dining_format: when the listing is a dining EXPERIENCE rather than a regular plated dish,
    set to one of:
      'buffet'             — flat-rate unlimited access
      'course_menu'        — multi-course sequenced meal (tasting menus, prix-fixe)
      'interactive_table'  — interactive cooking at the table (hot pot, Korean BBQ, fondue)
      'shared_plates'      — small plates designed for sharing (tapas, dim sum, izakaya)
      'sampler'            — fixed selection presented as one item (mixed grill, charcuterie board)
    Otherwise output null.
- bundled_items: items pre-included with the dish that the customer does NOT pick from a list.
    Use this for combo meals and fixed accompaniments. Decide by the WORDING, not the format:
      - Inclusion / accompaniment language → bundled_items, even when written as a sentence:
        "incluye arroz y frijoles", "viene con papas", "acompañado de ensalada",
        "includes side salad", "served with fries", "+ papas y refresco".
      - Composition / preparation language → description ONLY, never bundled_items:
        "preparados con tocino y chorizo", "a base de maíz", "con salsa de chipotle" —
        ingredients the dish is made of are NOT bundled items.
    Examples:
      "Burger meal: burger + fries + drink" → [{"name":"burger","note":null},{"name":"fries","note":null},{"name":"drink","note":null}]
      "Steak frites (includes side salad)"  → [{"name":"side salad","note":null}]
      "Tacos preparados con tocino y chorizo" → [] (composition — keep it in the description)
    Output an empty array [] when the dish has no bundled items. Each item is {name, note?}.
    Do NOT use bundled_items for customer choices — use modifier_groups for those.
- modifier_groups: customer-selectable choices. Extract one group per "choose your X",
    "add Y for $Z", "+$N upgrade", "size: S/M/L", protein choice, dressing choice, course
    choice, etc. Use an empty array [] when the dish has no choices.
    Group fields:
      name: short label as printed on the menu (e.g. "Choose your protein", "Size", "Add-ons")
      selection_type: 'single' (pick exactly one) or 'multiple' (may pick several)
      min_selections: 0 for optional groups; ≥1 for required groups (must pick at least N)
      max_selections: max picks allowed (1 for 'single' unless tasting menu)
      display_in_card: set true ONLY for groups whose selected option meaningfully changes
        the dish identity in a one-line description (e.g. protein choice on Pad Thai →
        "Pad Thai with chicken"). Set false (default) for size, dressing, drink, side choices.
        When in doubt, set false.
      options: list of choices (each with the fields below)
    Option fields:
      name: the choice label exactly as printed
      price_delta: signed surcharge in the menu's currency. When an option has its own
        printed price next to it, capture that price — NEVER default a printed price to 0.
        Use 0 ONLY when the menu shows no price for the option or marks it as included at
        no extra charge (e.g. the base option of a required group).
      price_override: when the option's printed price REPLACES the base price instead of
        adding to it (e.g. non-linear quantity pricing: "12 wings for $45" → the 12-wing
        option has price_override=45, price_delta=0). Otherwise null — NEVER 0. An option
        without its own replacing price has price_override=null; 0 would mean picking the
        option makes the dish free.
      primary_protein: only when the option CHANGES the dish's protein source
        (e.g. Pad Thai "with chicken" → 'chicken'). Otherwise null.
      serves_delta: only for options that change headcount (rare). 0 otherwise.
      is_default: set TRUE on exactly one option in each required group — the cheapest /
        standard choice. FALSE for all options in optional groups.
- primary_protein: the main protein source of the BASE dish — exactly one of:
    chicken | turkey | beef | pork | lamb | goat | other_meat | fish | shellfish | eggs | vegetarian | vegan
    Use "vegetarian" for plant-based dishes, "vegan" only when the dish is fully vegan.
    Turkey is its own value — classify pavo/turkey dishes (e.g. "Pechuga de Pavo")
    as "turkey", NEVER as "chicken".
    When the dish has a required protein choice, use the cheapest/default option's protein
    (modifier_groups[].options[].primary_protein will override at feed-time).
- suggested_category_name: the menu section this dish belongs to, written exactly as it appears
    on the menu (verbatim, in the source language). A dish belongs to the NEAREST section
    header printed above it — before carrying the previous dish's section forward, check
    whether a new header (often small, stylized, or ALL-CAPS text) is printed between the two
    dishes. Every distinct printed header starts its own section: NEVER merge two different
    headers into one section, even when they are semantically close (e.g. "Tostadas" printed
    after "Entradas" is its own section, not part of "Entradas"). Null if no section header
    is shown.
- canonical_category_slug: if the section maps cleanly to one of the canonical slugs listed
    below, output that slug exactly. Otherwise output null. Match conservatively — when
    uncertain, prefer null. The slug list is in English but the menu may be in any language;
    match by meaning, not by spelling. Two DIFFERENT printed headers must never share one
    slug: if two sections on this page would map to the same slug, give the slug to the
    closer match and output null for the other — its printed header is preserved via
    suggested_category_name.
- suggested_category_description: if the section has a brief subtitle / description on the
    menu (e.g. under a "Hot Dogs" header you see "2 hot dogs de salchicha de pavo con papas"),
    extract it verbatim in the source language. Null if no section description is shown.
    Use the SAME description for every dish that belongs to the same section — admins will
    deduplicate per category.
- suggested_dish_category: a short English noun naming the dish's class — what KIND of food
    this is, in standard culinary terminology (e.g. "Hot Dog", "Cheeseburger", "Bánh Mì",
    "Pad Thai", "Ceviche", "Pierogi", "Pizza", "Caesar Salad"). Use the singular form. This
    is independent of menu section: the same "Hot Dog" classification applies whether the
    menu lists it under "Sandwiches", "Hot Dogs", or "Snacks". Null only when the dish
    truly defies classification.
- source_image_index: 0-based index of the image this dish was found in
- confidence: 0.0–1.0 indicating your extraction confidence for this dish

After extracting all dishes, also output:
- detected_language: ISO-639-1 code of the menu's primary language (e.g. "en", "es", "pl",
    "fr", "it", "de", "pt", "ja", "zh"). Use null if the menu mixes languages or the language
    is unclear from the text.
${cuisineBlock}

Canonical menu-category slugs:
${slugList}

Do NOT include ingredients, calorie counts, is_template, or any
fields beyond those listed above.`;
}

// ── Image helpers ─────────────────────────────────────────────────────────────

interface ImageRef {
  bucket: string;
  path: string;
  page: number;
}

// deno-lint-ignore no-explicit-any
async function downloadImageAsBase64(supa: any, img: ImageRef): Promise<string> {
  const { data, error } = await supa.storage.from(img.bucket).download(img.path);
  if (error || !data) {
    throw new Error(`Storage download failed for ${img.path}: ${error?.message ?? 'no data'}`);
  }
  const arrayBuffer = await (data as Blob).arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

// ── OpenAI extraction ─────────────────────────────────────────────────────────

// gpt-5.4-mini: modern patch-based vision + low-effort reasoning. Reads small,
// low-resolution menu text materially better than gpt-4o while costing less.
// Escalate to 'gpt-5.5' here (a one-line change) if the hardest low-res scans
// still misread. FALLBACK_MODEL is used ONLY to relieve rate-limit pressure
// (see extractOneImageWithFallback) — it must stay a gpt-5.x reasoning model so
// the reasoning_effort / max_completion_tokens params below remain valid.
const PRIMARY_MODEL = 'gpt-5.4-mini';
const FALLBACK_MODEL = 'gpt-5-mini';

// Single-image extraction. v2 used to bundle all images into one call, but
// GPT-4o reliably under-attends to images after the first when sent together
// with detail:'high' — pages 2..N would come back empty. Mirroring v1's
// per-image pattern (apps/web-portal/app/api/menu-scan/route.ts) gives each
// page the model's full attention.
// Per-page extraction outcome: the parsed result plus whether the output hit
// the completion-token ceiling (some dishes may be missing from that page).
interface PageExtraction {
  result: MenuExtractionResult;
  truncated: boolean;
}

async function callExtraction(
  openai: OpenAI,
  model: string,
  base64: string,
  pageNumber: number,
  totalPages: number,
  prompt: string
): Promise<PageExtraction> {
  const pageContext =
    totalPages > 1
      ? `This is page ${pageNumber} of ${totalPages}. Extract every dish on THIS page only.`
      : 'Extract every dish from this menu image.';

  const completion = await openai.beta.chat.completions.parse({
    model,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'text', text: pageContext },
          {
            type: 'image_url' as const,
            image_url: {
              url: `data:image/jpeg;base64,${base64}`,
              // 'original' = full-resolution patches (≤6000px / 10k patches),
              // the highest-fidelity detail level — best for dense, small-text
              // menus. On the gpt-5.4 line `auto` resolves to `high`, so we ask
              // for `original` explicitly. The literal is newer than the SDK's
              // detail union, hence the cast.
              detail: 'original' as unknown as 'high',
            },
          },
        ],
      },
    ],
    response_format: zodResponseFormat(MenuExtractionSchema, 'menu_extraction'),
    // Reasoning models require max_completion_tokens (not max_tokens), and the
    // budget is shared with hidden reasoning tokens — keep it generous so a dense
    // page (70+ dishes ≈ 9k visible tokens) plus reasoning never truncates.
    max_completion_tokens: 32768,
    // 'low' reasoning is the sweet spot for transcription: enough to disambiguate
    // hard reads, not so much that the model reasons its way into a plausible-but-
    // wrong guess (e.g. inventing a brand name). Reasoning models reject
    // temperature, so the old temperature: 0.1 is dropped.
    reasoning_effort: 'low',
  });

  const choice = completion.choices[0];
  const truncated = choice?.finish_reason === 'length';
  if (truncated) {
    // Not promoted to error — partial dishes are still better than nothing for
    // that page. Surfaced via truncated_pages in result_json so the review UI
    // can warn the operator that dishes may be missing.
    console.warn(
      `Page ${pageNumber}/${totalPages} truncated at max_completion_tokens — some dishes may be missing`
    );
  }

  const parsed = choice?.message?.parsed;
  if (!parsed) throw new Error('OpenAI returned no parsed result');
  return { result: parsed, truncated };
}

// Per-image call wrapper. Always runs the primary model — including on retries.
// (A retry previously downgraded to a weaker mini once jobAttempts >= 2, which
// traded the misread we were retrying for an even weaker reader; retries now
// re-run the primary.) The cheaper FALLBACK_MODEL is used ONLY to relieve genuine
// rate-limit pressure, never as a quality fallback.
async function extractOneImageWithFallback(
  openai: OpenAI,
  base64: string,
  pageNumber: number,
  totalPages: number,
  prompt: string
): Promise<PageExtraction> {
  try {
    return await callExtraction(openai, PRIMARY_MODEL, base64, pageNumber, totalPages, prompt);
  } catch (e) {
    if (e instanceof OpenAI.RateLimitError) {
      console.warn(
        `Page ${pageNumber}/${totalPages}: primary rate-limited; falling back to ${FALLBACK_MODEL}`
      );
      return await callExtraction(openai, FALLBACK_MODEL, base64, pageNumber, totalPages, prompt);
    }
    throw e;
  }
}

// Normalize an AI-emitted free-text field: trim, drop a leading stray
// punctuation token, and collapse to null any string that contains no letter
// or digit. The model keeps shifting its placeholder for "no value" (".",
// then ":") as the prompt forbids each one, so the no-value check must be
// generic — anything without real content is a placeholder — rather than a
// list of known placeholder characters.
function normalizeText(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  if (!/[\p{L}\p{N}]/u.test(raw)) return null;
  const s = raw
    .trim()
    .replace(/^[.,:;\-–—·•]+\s*/, '')
    .trim();
  return s === '' ? null : s;
}

// Normalized key for comparing printed section headers: trim, lowercase, strip
// diacritics — "ENTRADAS", "Entradas" and "entradas" are the same printed
// section restated (e.g. on a later page), not two different sections.
function sectionKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

// Deterministic backstop for the category-merge bug (operator issue #1): two
// DIFFERENT printed headers must never share a canonical slug, or the review
// UI — which groups dishes by slug — silently collapses one section into the
// other ("Tostadas" swallowed by "Entradas"). The prompt forbids this per
// page, but each model call sees a single image, so cross-page collisions can
// only be caught here. The first section (menu order) to claim a slug keeps
// it; a LATER, DIFFERENT header claiming the same slug loses the slug — its
// verbatim header survives in suggested_category_name, so the review UI falls
// back to creating a custom category instead of merging. Headerless dishes are
// skipped: they carry no printed section identity to lose, and nulling their
// slug would dump them in "uncategorized", which is worse than a merge.
function resolveCategorySlugCollisions(dishes: MenuExtractionResult['dishes']): void {
  const slugOwner = new Map<string, string>(); // slug → sectionKey of first claimant
  for (const d of dishes) {
    if (!d.canonical_category_slug || !d.suggested_category_name) continue;
    const key = sectionKey(d.suggested_category_name);
    if (!key) continue;
    const owner = slugOwner.get(d.canonical_category_slug);
    if (owner === undefined) {
      slugOwner.set(d.canonical_category_slug, key);
    } else if (owner !== key) {
      console.warn(
        `category-slug collision: section "${d.suggested_category_name}" also mapped to ` +
          `"${d.canonical_category_slug}" — keeping the slug on the earlier section and ` +
          `falling back to a custom category here`
      );
      d.canonical_category_slug = null;
    }
  }
}

// Deterministic backstop for the zero price_override bug (operator-reported
// 2026-06-12): in practice the model almost never emits null for
// price_override — options with no own replacing price arrive as 0, which the
// review UI renders as a literal "0" the admin must clear on every option,
// and which (when missed) the consumer app shows as the option's absolute
// price ("MX$0"). A zero override is never a real menu intent — an option
// that adds nothing is price_delta 0 + override null — so collapse 0 → null
// here rather than trusting prompt wording alone.
function normalizeModifierPriceOverrides(dishes: MenuExtractionResult['dishes']): void {
  for (const d of dishes) {
    for (const g of d.modifier_groups ?? []) {
      for (const o of g.options ?? []) {
        if (o.price_override === 0) o.price_override = null;
      }
    }
  }
}

// Escape a string for safe literal use inside a RegExp.
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Remove the size from the END of a dish name by stripping the model's VERBATIM
// portion_source_text (e.g. "1.5kg", "0.5L", "8 oz") — the exact printed
// substring, so this works for every unit including kg/L/pints, which lose their
// printed form once portion_amount/portion_unit are normalized. Replaces the old
// prompt-side "rewrite the name" instruction that let the model edit
// identity-bearing names. Conservative: only a trailing match (optionally wrapped
// in ()/[] and preceded by a separator) is removed, so an interior or absent size
// — and identity names like "Quarter Chicken" or '12" Sub' — is left untouched.
// Returns the original name if there's no source text or stripping would empty it.
function stripPortionSourceText(name: string, sourceText: string | null | undefined): string {
  const tok = sourceText?.trim();
  if (!tok) return name;
  const stripped = stripTrailingPortionToken(name, tok);
  return stripped != null && stripped.length > 0 ? stripped : name;
}

// Strip a verbatim portion token from the END of `text` (optionally wrapped in
// ()/[] and preceded by a separator). Returns the cleaned string — possibly ''
// when the token was the whole text — or null when there is no trailing match.
function stripTrailingPortionToken(text: string, tok: string): string | null {
  const core = escapeRegExp(tok).replace(/\s+/g, '\\s*');
  const re = new RegExp(`[\\s,;·•\\-–—]*[(\\[]?\\s*${core}\\s*[)\\]]?\\s*$`, 'i');
  if (!re.test(text)) return null;
  return text
    .replace(re, '')
    .replace(/[(\[]\s*[)\]]\s*$/, '') // tidy a now-empty bracket pair
    .replace(/[\s,;·•\-–—]+$/, '') // tidy a dangling separator
    .trim();
}

// Same trailing strip for the description. Unlike a name, a description may
// legitimately become empty once the size is removed (the model copied "250g"
// as the entire description) — that collapses to null. A size sitting
// mid-sentence ("250g de arrachera con…") is NOT touched: removing it would
// break the sentence. runExtraction instead drops the structured portion
// fields whenever the size text stays visible, so the UI's portion chip can
// never show a size the customer already reads in the text.
function stripPortionFromDescription(
  description: string | null,
  sourceText: string | null | undefined
): string | null {
  if (description == null) return null;
  const tok = sourceText?.trim();
  if (!tok) return description;
  const stripped = stripTrailingPortionToken(description, tok);
  if (stripped == null) return description;
  return stripped.length > 0 ? stripped : null;
}

// True when the portion token still appears in the name or description after
// the trailing strips — i.e. it sits mid-text where stripping would mangle the
// sentence.
function portionStillVisible(
  sourceText: string | null | undefined,
  name: string,
  description: string | null
): boolean {
  const tok = sourceText?.trim();
  if (!tok) return false;
  const re = new RegExp(escapeRegExp(tok).replace(/\s+/g, '\\s*'), 'i');
  return re.test(name) || (description != null && re.test(description));
}

// What complete_menu_scan_job stores as result_json: the merged extraction plus
// per-page health. failed_pages / truncated_pages are 1-based page numbers the
// review UI uses to warn the operator that dishes may be missing (previously
// these were console.warn-only and a half-empty scan looked like a clean one).
type MenuScanJobResult = MenuExtractionResult & {
  failed_pages: number[];
  truncated_pages: number[];
};

async function runExtraction(
  openai: OpenAI,
  imageBase64List: string[],
  promptForPage: (pageIndex: number) => string
): Promise<MenuScanJobResult> {
  // Fan out one OpenAI call per image. allSettled so a single page failure
  // (BadRequestError, RateLimitError after fallback, etc.) doesn't discard
  // the other pages' successful extractions.
  const settled = await Promise.allSettled(
    imageBase64List.map((b64, idx) =>
      extractOneImageWithFallback(openai, b64, idx + 1, imageBase64List.length, promptForPage(idx))
    )
  );

  const dishes: MenuExtractionResult['dishes'] = [];
  let detectedLanguage: string | null = null;
  // Cuisine is a whole-restaurant property taken from page 1 only — the only
  // page given the cuisine-inference instruction (see buildExtractionPrompt's
  // includeCuisine gate). Pages 2..N are told to emit [].
  let pageOneCuisine: string[] = [];
  const failedPages: number[] = [];
  const truncatedPages: number[] = [];

  for (let idx = 0; idx < settled.length; idx++) {
    const r = settled[idx];
    if (r.status === 'fulfilled') {
      const page = r.value.result;
      if (r.value.truncated) truncatedPages.push(idx + 1);
      // Override source_image_index from the loop, never trust the AI's value.
      // Each call sees only one image so the model's guess is meaningless;
      // this also fixes the long-standing class of bugs where every dish
      // came back tagged as page 0.
      for (const d of page.dishes) {
        // Clean the free-text fields: names stay verbatim (trimmed, never null)
        // with only the model's exact portion_source_text stripped off the tail —
        // the model no longer rewrites names. Placeholder descriptions ("." / "")
        // collapse to null so they don't reach the review UI or the DB.
        const name = stripPortionSourceText(d.name.trim(), d.portion_source_text);
        const description = stripPortionFromDescription(
          normalizeText(d.description),
          d.portion_source_text
        );
        // The portion chip renders only when the size text was actually removed
        // from view. If it survives mid-sentence after the trailing strips, drop
        // the structured portion so the size never shows twice (operator-reported
        // doubling, 2026-06-09).
        const visible = portionStillVisible(d.portion_source_text, name, description);
        dishes.push({
          ...d,
          name,
          description,
          portion_amount: visible ? null : d.portion_amount,
          portion_unit: visible ? null : d.portion_unit,
          portion_source_text: visible ? null : d.portion_source_text,
          suggested_category_description: normalizeText(d.suggested_category_description),
          source_image_index: idx,
        });
      }
      if (!detectedLanguage && page.detected_language) {
        detectedLanguage = page.detected_language;
      }
      // Cuisine: page 1 only (pages 2..N are prompted to emit []).
      if (idx === 0) {
        pageOneCuisine = page.cuisine_types ?? [];
      }
    } else {
      failedPages.push(idx + 1);
      const errMsg = r.reason instanceof Error ? r.reason.message : String(r.reason);
      console.warn(`Page ${idx + 1} extraction failed:`, errMsg);
    }
  }

  // Total failure → propagate so the existing fail_menu_scan_job path handles
  // retry vs terminal failure (BadRequestError still gets max_attempts=1 in
  // processJobs's catch block).
  if (dishes.length === 0 && failedPages.length === settled.length) {
    const firstReject = settled.find(r => r.status === 'rejected') as PromiseRejectedResult;
    throw firstReject.reason;
  }

  // Operator issue #1 backstop: the prompt forbids two different printed
  // headers sharing a slug, but only within one page — enforce it across the
  // whole menu so distinct sections can never merge in the review UI.
  resolveCategorySlugCollisions(dishes);

  // Zero-override backstop: the prompt says "null, NEVER 0" but the model
  // reliably fills 0 anyway — collapse it before the result is stored.
  normalizeModifierPriceOverrides(dishes);

  return {
    dishes,
    detected_language: detectedLanguage,
    cuisine_types: normalizeCuisines(pageOneCuisine).slice(0, 3),
    failed_pages: failedPages,
    truncated_pages: truncatedPages,
  };
}

// deno-lint-ignore no-explicit-any
async function fetchCanonicalSlugs(supa: any): Promise<CanonicalSlug[]> {
  const { data, error } = await supa
    .from('canonical_menu_categories')
    .select('slug, names')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error) {
    console.warn('fetchCanonicalSlugs failed; falling back to empty list:', error.message);
    return [];
  }
  return (data ?? []).map((r: { slug: string; names: Record<string, string> }) => ({
    slug: r.slug,
    english_name: r.names?.en ?? r.slug,
  }));
}

// Fetched once per job (not per page) to inject the restaurant's currency
// into the extraction prompt. Failures fall back to USD silently — the
// admin review screen catches anything obviously wrong.
// deno-lint-ignore no-explicit-any
async function fetchRestaurantCurrency(supa: any, restaurantId: string): Promise<CurrencyInfo> {
  const { data, error } = await supa
    .from('restaurants')
    .select('currency_code')
    .eq('id', restaurantId)
    .single();
  if (error || !data) {
    console.warn(
      `fetchRestaurantCurrency failed for ${restaurantId}; using USD:`,
      error?.message ?? 'no data'
    );
    return resolveCurrency('USD');
  }
  return resolveCurrency(data.currency_code);
}

// Self-heal a restaurant's cuisine from an extraction (Phase 3b). Writes
// restaurants.cuisine_types ONLY when it is currently empty — never overwrites a
// human- or import-set value. Canonical-gated via normalizeCuisines. Best-effort:
// any failure is logged and swallowed so it can never fail an otherwise-good scan.
// deno-lint-ignore no-explicit-any
async function maybeWriteRestaurantCuisine(
  supa: any,
  restaurantId: string,
  inferred: string[]
): Promise<void> {
  try {
    const canonical = normalizeCuisines(inferred).slice(0, 3);
    if (canonical.length === 0) return; // nothing canonical to write

    const { data, error } = await supa
      .from('restaurants')
      .select('cuisine_types')
      .eq('id', restaurantId)
      .single();
    if (error || !data) return;

    const existing = Array.isArray(data.cuisine_types) ? data.cuisine_types : [];
    if (existing.length > 0) return; // never overwrite an existing cuisine

    const { error: upErr } = await supa
      .from('restaurants')
      .update({ cuisine_types: canonical })
      .eq('id', restaurantId);
    if (upErr) {
      console.warn(`cuisine self-heal failed for ${restaurantId}: ${upErr.message}`);
    } else {
      console.log(`cuisine self-heal: set ${JSON.stringify(canonical)} for ${restaurantId}`);
    }
  } catch (e) {
    console.warn(
      `cuisine self-heal threw for ${restaurantId}:`,
      e instanceof Error ? e.message : String(e)
    );
  }
}

// ── Core worker logic ─────────────────────────────────────────────────────────

export const MAX_PER_TICK = 3;

export interface WorkerDeps {
  // deno-lint-ignore no-explicit-any
  supa: any;
  openai: OpenAI;
}

export interface ProcessResult {
  processed: string[];
  errors: Array<{ id: string; error: string }>;
}

export async function processJobs(deps: WorkerDeps): Promise<ProcessResult> {
  const { supa, openai } = deps;
  const processed: string[] = [];
  const errors: Array<{ id: string; error: string }> = [];

  // Fetch canonical-category slugs once per tick — they're injected into the
  // prompt so the AI can match menu sections against the seeded taxonomy.
  // (The slug list is restaurant-independent; the per-job prompt is built
  //  inside the loop because currency varies by restaurant.)
  const canonicalSlugs = await fetchCanonicalSlugs(supa);

  for (let i = 0; i < MAX_PER_TICK; i++) {
    const { data: job, error: claimError } = await supa.rpc('claim_menu_scan_job', {
      p_lock_seconds: 180,
    });
    if (claimError) {
      console.error('claim_menu_scan_job failed:', claimError.message);
      break;
    }
    if (!job?.id) break; // no more pending jobs

    console.log(`Processing job ${job.id} (attempt ${job.attempts})`);

    try {
      const input = job.input as { images?: ImageRef[] } | null;
      if (!input?.images?.length) throw new NoImagesError();

      // Fetch this restaurant's currency once (shared across all pages of
      // the job) and bake it into the per-job prompt. USD fallback on miss.
      const currency = await fetchRestaurantCurrency(supa, job.restaurant_id);
      // Page 1 carries the cuisine-inference instruction; later pages don't
      // (cuisine is a whole-restaurant property — keeps pages 2..N lean so the
      // model's attention stays on dish extraction).
      const firstPagePrompt = buildExtractionPrompt(canonicalSlugs, currency, true);
      const otherPagesPrompt = buildExtractionPrompt(canonicalSlugs, currency, false);

      // Download all images for this job
      const imageBase64List: string[] = [];
      for (const imgRef of input.images) {
        imageBase64List.push(await downloadImageAsBase64(supa, imgRef));
      }

      const result = await runExtraction(openai, imageBase64List, idx =>
        idx === 0 ? firstPagePrompt : otherPagesPrompt
      );

      // Phase 3b: self-heal this restaurant's cuisine from the scan when it has
      // none yet (gated empty, canonical-only, best-effort — never fails the job).
      await maybeWriteRestaurantCuisine(supa, job.restaurant_id, result.cuisine_types);

      const { error: completeError } = await supa.rpc('complete_menu_scan_job', {
        p_id: job.id,
        p_result: result,
      });
      if (completeError) throw new Error(`complete_menu_scan_job failed: ${completeError.message}`);

      processed.push(job.id);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      const isBadRequest = e instanceof OpenAI.BadRequestError || e instanceof NoImagesError;

      console.error(`Job ${job.id} error (badRequest=${isBadRequest}):`, errMsg);

      // BadRequestError (schema violation, context exceeded) → immediate terminal failure.
      // All other errors → re-queue until attempts >= 3.
      await supa.rpc('fail_menu_scan_job', {
        p_id: job.id,
        p_error: errMsg,
        p_max_attempts: isBadRequest ? 1 : 3,
      });
      errors.push({ id: job.id, error: errMsg });
    }
  }

  return { processed, errors };
}

// ── Entry point ───────────────────────────────────────────────────────────────

// Exported for unit-testing the auth check without a live Deno env.
export async function handleRequest(
  req: Request,
  serviceRoleKey: string,
  deps: WorkerDeps
): Promise<Response> {
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== `Bearer ${serviceRoleKey}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  try {
    const result = await processJobs(deps);
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('Worker tick fatal error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

Deno.serve(async req => {
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supa = createClient(Deno.env.get('SUPABASE_URL')!, serviceRoleKey);
  const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY')! });
  return handleRequest(req, serviceRoleKey, { supa, openai });
});
