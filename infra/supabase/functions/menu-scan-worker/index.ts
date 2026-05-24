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
  // Tags removed from base when selected (e.g. ['vegetarian','vegan'] for adding
  // meat to a salad). Empty array when no change.
  removes_dietary_tags: z.array(z.string()),
  // Allergens added beyond what the base dish carries. Empty array when none.
  adds_allergens: z.array(z.string()),
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
  // "6 szt."). Normalized to base units (kg→g, L→ml). Both null when the menu
  // doesn't show an explicit portion. Persisted to dishes.portion_amount +
  // dishes.portion_unit (migration 145); DB CHECK enforces both-or-neither.
  portion_amount: z.number().int().positive().nullable(),
  portion_unit: z.enum(['g', 'ml', 'pcs']).nullable(),
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
});

type MenuExtractionResult = z.infer<typeof MenuExtractionSchema>;

// Thrown when a job's input has no images — treated as a permanent bad-request failure.
export class NoImagesError extends Error {
  constructor() {
    super('Job has no images in input');
  }
}

// ── Prompt ───────────────────────────────────────────────────────────────────

interface CanonicalSlug {
  slug: string;
  english_name: string;
}

function buildExtractionPrompt(canonicalSlugs: CanonicalSlug[]): string {
  const slugList = canonicalSlugs.map(c => `  - ${c.slug} (${c.english_name})`).join('\n');

  return `You are a menu-extraction assistant. Extract every dish from the provided menu image(s).

For each dish output exactly these fields:
- name: dish name exactly as written on the menu
- description: brief description if shown, otherwise null
- price: numeric price (no currency symbol), null if not shown
- portion_amount + portion_unit: explicit portion size shown on the menu.
    Extract ONLY when explicitly visible in the dish name or description.
    Normalize to base units (kg→g, L→ml; pieces cover "X szt." / "X uds." too):
      "250g" / "250 g"             → {amount: 250,  unit: "g"}
      "1.5kg" / "1,5 kg"           → {amount: 1500, unit: "g"}
      "0.5L" / "500ml"             → {amount: 500,  unit: "ml"}
      "6 pcs" / "6 szt." / "6 uds" → {amount: 6,    unit: "pcs"}
    Return BOTH null when:
      - no size is shown
      - size is a range ("200–250g") — avoid false precision
      - size is vague ("small", "medium", "large", "regular", "house portion")
      - size refers to a garnish or side note, not the dish itself
    Either both fields are set together or both are null.
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
    Use this for combo meals and fixed accompaniments. Examples:
      "Burger meal: burger + fries + drink" → [{"name":"burger","note":null},{"name":"fries","note":null},{"name":"drink","note":null}]
      "Steak frites (includes side salad)"  → [{"name":"side salad","note":null}]
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
      price_delta: signed surcharge in the menu's currency (0 for the base/included option)
      price_override: ONLY for non-linear quantity pricing (e.g. "12 wings for $45" → the
        12-wing option has price_override=45, price_delta=0). Otherwise null.
      primary_protein: only when the option CHANGES the dish's protein source
        (e.g. Pad Thai "with chicken" → 'chicken'). Otherwise null.
      removes_dietary_tags: include ['vegetarian'] when adding meat/fish to a vegetarian base;
        include ['vegan'] when adding dairy/eggs/honey to a vegan base. Empty array otherwise.
      adds_allergens: e.g. ['shellfish'] when option adds shrimp, ['dairy'] for adding cheese.
        Use the standard allergen taxonomy (shellfish, dairy, eggs, peanuts, tree_nuts,
        gluten, soy, fish, sesame). Empty array otherwise.
      serves_delta: only for options that change headcount (rare). 0 otherwise.
      is_default: set TRUE on exactly one option in each required group — the cheapest /
        standard choice. FALSE for all options in optional groups.
- primary_protein: the main protein source of the BASE dish — exactly one of:
    chicken | beef | pork | lamb | goat | other_meat | fish | shellfish | eggs | vegetarian | vegan
    Use "vegetarian" for plant-based dishes, "vegan" only when the dish is fully vegan.
    When the dish has a required protein choice, use the cheapest/default option's protein
    (modifier_groups[].options[].primary_protein will override at feed-time).
- suggested_category_name: the menu section this dish belongs to, written exactly as it appears
    on the menu (verbatim, in the source language). Null if no section header is shown.
- canonical_category_slug: if the section maps cleanly to one of the canonical slugs listed
    below, output that slug exactly. Otherwise output null. Match conservatively — when
    uncertain, prefer null. The slug list is in English but the menu may be in any language;
    match by meaning, not by spelling.
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

Canonical menu-category slugs:
${slugList}

Do NOT include allergens, dietary tags, ingredients, calorie counts, is_template, or any
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

const PRIMARY_MODEL = 'gpt-4o-2024-11-20';
const FALLBACK_MODEL = 'gpt-4o-mini';

// Single-image extraction. v2 used to bundle all images into one call, but
// GPT-4o reliably under-attends to images after the first when sent together
// with detail:'high' — pages 2..N would come back empty. Mirroring v1's
// per-image pattern (apps/web-portal/app/api/menu-scan/route.ts) gives each
// page the model's full attention.
async function callExtraction(
  openai: OpenAI,
  model: string,
  base64: string,
  pageNumber: number,
  totalPages: number,
  prompt: string
): Promise<MenuExtractionResult> {
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
              detail: 'high' as const,
            },
          },
        ],
      },
    ],
    response_format: zodResponseFormat(MenuExtractionSchema, 'menu_extraction'),
    max_tokens: 16384,
    temperature: 0.1,
  });

  const choice = completion.choices[0];
  if (choice?.finish_reason === 'length') {
    // Single-image output rarely hits 16K tokens, but log if it does so we
    // can spot a truncation pattern. Not promoted to error — partial dishes
    // are still better than nothing for that page.
    console.warn(
      `Page ${pageNumber}/${totalPages} truncated at max_tokens — some dishes may be missing`
    );
  }

  const parsed = choice?.message?.parsed;
  if (!parsed) throw new Error('OpenAI returned no parsed result');
  return parsed;
}

// Per-image call wrapper that mirrors the existing primary→mini fallback
// behaviour but applies it independently per image instead of per job.
async function extractOneImageWithFallback(
  openai: OpenAI,
  jobAttempts: number,
  base64: string,
  pageNumber: number,
  totalPages: number,
  prompt: string
): Promise<MenuExtractionResult> {
  const startWithFallback = jobAttempts >= 2;
  if (startWithFallback) {
    return await callExtraction(openai, FALLBACK_MODEL, base64, pageNumber, totalPages, prompt);
  }
  try {
    return await callExtraction(openai, PRIMARY_MODEL, base64, pageNumber, totalPages, prompt);
  } catch (e) {
    if (e instanceof OpenAI.RateLimitError) {
      console.warn(
        `Page ${pageNumber}/${totalPages}: primary rate-limited; falling back to gpt-4o-mini`
      );
      return await callExtraction(openai, FALLBACK_MODEL, base64, pageNumber, totalPages, prompt);
    }
    throw e;
  }
}

async function runExtraction(
  openai: OpenAI,
  jobAttempts: number,
  imageBase64List: string[],
  prompt: string
): Promise<MenuExtractionResult> {
  // Fan out one OpenAI call per image. allSettled so a single page failure
  // (BadRequestError, RateLimitError after fallback, etc.) doesn't discard
  // the other pages' successful extractions.
  const settled = await Promise.allSettled(
    imageBase64List.map((b64, idx) =>
      extractOneImageWithFallback(openai, jobAttempts, b64, idx + 1, imageBase64List.length, prompt)
    )
  );

  const dishes: MenuExtractionResult['dishes'] = [];
  let detectedLanguage: string | null = null;
  let failedPages = 0;

  for (let idx = 0; idx < settled.length; idx++) {
    const r = settled[idx];
    if (r.status === 'fulfilled') {
      // Override source_image_index from the loop, never trust the AI's value.
      // Each call sees only one image so the model's guess is meaningless;
      // this also fixes the long-standing class of bugs where every dish
      // came back tagged as page 0.
      for (const d of r.value.dishes) {
        dishes.push({ ...d, source_image_index: idx });
      }
      if (!detectedLanguage && r.value.detected_language) {
        detectedLanguage = r.value.detected_language;
      }
    } else {
      failedPages++;
      const errMsg = r.reason instanceof Error ? r.reason.message : String(r.reason);
      console.warn(`Page ${idx + 1} extraction failed:`, errMsg);
    }
  }

  // Total failure → propagate so the existing fail_menu_scan_job path handles
  // retry vs terminal failure (BadRequestError still gets max_attempts=1 in
  // processJobs's catch block).
  if (dishes.length === 0 && failedPages === settled.length) {
    const firstReject = settled.find(r => r.status === 'rejected') as PromiseRejectedResult;
    throw firstReject.reason;
  }

  return { dishes, detected_language: detectedLanguage };
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
  const canonicalSlugs = await fetchCanonicalSlugs(supa);
  const prompt = buildExtractionPrompt(canonicalSlugs);

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

      // Download all images for this job
      const imageBase64List: string[] = [];
      for (const imgRef of input.images) {
        imageBase64List.push(await downloadImageAsBase64(supa, imgRef));
      }

      const result = await runExtraction(openai, job.attempts, imageBase64List, prompt);

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
