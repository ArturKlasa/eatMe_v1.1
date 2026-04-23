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
  suggested_category_name: z.string().nullable(),
  source_image_index: z.number().int().min(0),
  confidence: z.number().min(0).max(1),
});

const MenuExtractionSchema = z.object({
  dishes: z.array(menuExtractionDishSchema),
});

type MenuExtractionResult = z.infer<typeof MenuExtractionSchema>;

// ── Prompt ───────────────────────────────────────────────────────────────────

const EXTRACTION_PROMPT = `You are a menu-extraction assistant. Extract every dish from the provided menu image(s).

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
- suggested_category_name: the menu section this dish belongs to (e.g. "Appetizers", "Mains",
    "Desserts", "Drinks", "Specials"), null if not clear from context
- source_image_index: 0-based index of the image this dish was found in
- confidence: 0.0–1.0 indicating your extraction confidence for this dish

Do NOT include allergens, dietary tags, ingredients, calorie counts, is_template, or any fields beyond those listed above.`;

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

async function callExtraction(
  openai: OpenAI,
  model: string,
  imageBase64List: string[]
): Promise<MenuExtractionResult> {
  const completion = await openai.beta.chat.completions.parse({
    model,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: EXTRACTION_PROMPT },
          ...imageBase64List.map(b64 => ({
            type: 'image_url' as const,
            image_url: {
              url: `data:image/jpeg;base64,${b64}`,
              detail: 'high' as const,
            },
          })),
        ],
      },
    ],
    response_format: zodResponseFormat(MenuExtractionSchema, 'menu_extraction'),
    max_tokens: 16384,
    temperature: 0.1,
  });
  const parsed = completion.choices[0]?.message?.parsed;
  if (!parsed) throw new Error('OpenAI returned no parsed result');
  return parsed;
}

async function runExtraction(
  openai: OpenAI,
  jobAttempts: number,
  imageBase64List: string[]
): Promise<MenuExtractionResult> {
  // Use fallback model when already on second+ attempt or on 429 from primary.
  const primaryModel = jobAttempts >= 2 ? FALLBACK_MODEL : PRIMARY_MODEL;

  if (primaryModel === PRIMARY_MODEL) {
    try {
      return await callExtraction(openai, PRIMARY_MODEL, imageBase64List);
    } catch (e) {
      if (e instanceof OpenAI.RateLimitError) {
        // 429 on primary → immediately retry with fallback
        console.warn('Primary model rate-limited; falling back to gpt-4o-mini');
        return await callExtraction(openai, FALLBACK_MODEL, imageBase64List);
      }
      throw e;
    }
  } else {
    return await callExtraction(openai, FALLBACK_MODEL, imageBase64List);
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
      if (!input?.images?.length) throw new Error('Job has no images in input');

      // Download all images for this job
      const imageBase64List: string[] = [];
      for (const imgRef of input.images) {
        imageBase64List.push(await downloadImageAsBase64(supa, imgRef));
      }

      const result = await runExtraction(openai, job.attempts, imageBase64List);

      const { error: completeError } = await supa.rpc('complete_menu_scan_job', {
        p_id: job.id,
        p_result: result,
      });
      if (completeError) throw new Error(`complete_menu_scan_job failed: ${completeError.message}`);

      processed.push(job.id);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      const isBadRequest = e instanceof OpenAI.BadRequestError;

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

Deno.serve(async _req => {
  const supa = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY')! });

  try {
    const result = await processJobs({ supa, openai });
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
});
