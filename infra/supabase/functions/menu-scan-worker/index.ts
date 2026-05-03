// menu-scan-worker/index.ts
// Supabase Edge Function — invoked by pg_cron every minute via pg_net.http_post.
// Claims pending menu_scan_jobs, downloads images from Storage, calls OpenAI GPT-4o
// with Vision + Structured Outputs, writes result back via complete_menu_scan_job.
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
  'duck',
  'other_meat',
  'fish',
  'shellfish',
  'eggs',
  'vegetarian',
  'vegan',
] as const;

const menuExtractionDishSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  price: z.number().nonnegative().nullable(),
  dish_kind: z.enum(['standard', 'bundle', 'configurable', 'course_menu', 'buffet']),
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
- dish_kind: classify as one of:
    standard       — single fixed item
    bundle         — N items sold together at one price
    configurable   — customer selects from options/slots
    course_menu    — multi-course sequenced meal (starter, main, dessert pattern)
    buffet         — flat-rate unlimited access
- primary_protein: the main protein source — exactly one of:
    chicken | beef | pork | lamb | duck | other_meat | fish | shellfish | eggs | vegetarian | vegan
    Use "vegetarian" for plant-based dishes, "vegan" only when the dish is fully vegan.
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
