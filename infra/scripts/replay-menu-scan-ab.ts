#!/usr/bin/env ts-node
/**
 * replay-menu-scan-ab.ts — DIAGNOSTIC replay of a menu-scan job's image(s)
 * against several prompt variants, to separate "prompt/task overload" from
 * "raw gpt-4o vision-fidelity limit" as the cause of transcription
 * hallucinations (e.g. "Espagueti" → "Esparagus", "boing" → "Bonaqua").
 *
 * It does NOT write anything. It reads the job + its source images from prod
 * Storage (service-role) and calls OpenAI directly. It re-runs the SAME image
 * with three prompts and prints the dish name/description each returns, so you
 * can eyeball which prompt reads the menu faithfully:
 *
 *   heavy      — reproduces the production load: full field set + the English
 *                dish-category task + the 70-item cuisine classification.
 *   noclass    — transcription + portion only; drops cuisine / dish-category /
 *                canonical-category (this is the "2B" hypothesis).
 *   transcribe — minimal: name / description / price, verbatim, nothing else.
 *
 * If `transcribe` (and/or `noclass`) reads the words correctly while `heavy`
 * mangles them → it's prompt overload, fix = move classification off the
 * vision pass. If all three mangle them → it's the model/image, prompt work
 * won't help.
 *
 * Same model + temperature + image detail as the worker, so the only variable
 * is the prompt. gpt-4o at temp 0.1 isn't fully deterministic, so each variant
 * runs --runs times (default 2).
 *
 * Usage (dry-run prints the plan + a cost estimate, spends nothing):
 *   pnpm --filter @eatme/infra-scripts replay-ab <jobId>
 *   pnpm --filter @eatme/infra-scripts replay-ab <jobId> --runs 3 --live
 *
 * Reads infra/scripts/.env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY.
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env');
  process.exit(1);
}

const MODEL = 'gpt-4o-2024-11-20'; // same primary model the worker uses
const TEMPERATURE = 0.1;

// ── args ──────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const jobId = argv.find(a => !a.startsWith('--'));
const live = argv.includes('--live');
const runsArg = argv[argv.indexOf('--runs') + 1];
const RUNS = argv.includes('--runs') && runsArg ? Math.max(1, parseInt(runsArg, 10)) : 2;
// --page N: limit to a single 1-based image (the bad dish usually sits on one
// page; cuts cost ~Nx). Omitted → all pages.
const pageArg = argv[argv.indexOf('--page') + 1];
const ONLY_PAGE = argv.includes('--page') && pageArg ? Math.max(1, parseInt(pageArg, 10)) : null;

if (!jobId) {
  console.error('Usage: ts-node replay-menu-scan-ab.ts <jobId> [--runs N] [--live]');
  process.exit(1);
}

const supa = createClient(SUPABASE_URL, SERVICE_ROLE);

// ── cuisine list (mirror of the worker, for the heavy prompt) ─────────────────
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
];

// ── prompt variants ───────────────────────────────────────────────────────────
// All three say "JSON" (required by response_format json_object) and ask for a
// { "dishes": [...] } shape we can read name/description from.

function promptHeavy(): string {
  return `You are a menu-extraction assistant. Extract EVERY dish from the menu image and return JSON.
For each dish output: name (exactly as written), description (verbatim or null), price (number or null),
portion_amount + portion_unit (g/ml/pcs/oz or null), dish_kind (standard/bundle/configurable/course_menu/buffet),
dining_format (or null), bundled_items (array), modifier_groups (array of choose-your-X groups with options),
primary_protein (chicken/beef/pork/lamb/goat/other_meat/fish/shellfish/eggs/vegetarian/vegan),
suggested_category_name (verbatim menu section), canonical_category_slug (or null),
suggested_dish_category (a short ENGLISH culinary term naming the dish class, e.g. "Hot Dog", "Ceviche"),
confidence (0..1).
After the dishes, also output detected_language (ISO-639-1) and cuisine_types: 1-3 cuisines describing the
restaurant, chosen ONLY from this list: ${ALL_CUISINES.join(', ')}.
Return JSON shaped { "dishes": [ { ...fields } ], "detected_language": "..", "cuisine_types": [..] }.`;
}

function promptNoClass(): string {
  return `You are a menu-extraction assistant. Extract EVERY dish from the menu image and return JSON.
For each dish output: name (exactly as written on the menu), description (verbatim or null),
price (number or null), portion_amount + portion_unit (g/ml/pcs/oz or null).
Do NOT classify cuisine, dish category, or menu section. Just read the dishes.
Return JSON shaped { "dishes": [ { "name": "..", "description": ".."|null, "price": 0 } ] }.`;
}

function promptTranscribe(): string {
  return `You are a faithful menu transcriber. Read EVERY dish from the image and return JSON.
Transcribe text EXACTLY as printed. Do NOT translate, correct spelling, or replace a word with a
similar-sounding or more common one. If a word is unclear, copy the characters you see — never guess
a different word. Output only: name, description (verbatim or null), price (number or null).
Return JSON shaped { "dishes": [ { "name": "..", "description": ".."|null, "price": 0 } ] }.`;
}

const VARIANTS: Array<{ key: string; prompt: () => string }> = [
  { key: 'heavy', prompt: promptHeavy },
  { key: 'noclass', prompt: promptNoClass },
  { key: 'transcribe', prompt: promptTranscribe },
];

// ── helpers ───────────────────────────────────────────────────────────────────
interface ImageRef {
  bucket: string;
  path: string;
  page?: number;
}

async function downloadBase64(img: ImageRef): Promise<string> {
  const { data, error } = await supa.storage.from(img.bucket).download(img.path);
  if (error || !data)
    throw new Error(`download failed for ${img.path}: ${error?.message ?? 'no data'}`);
  const buf = Buffer.from(await data.arrayBuffer());
  return buf.toString('base64');
}

async function callOpenAI(
  prompt: string,
  base64: string
): Promise<{ name: string; description: string | null }[]> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: MODEL,
      temperature: TEMPERATURE,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${base64}`, detail: 'high' },
            },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(content);
  const dishes = Array.isArray(parsed.dishes) ? parsed.dishes : [];
  return dishes.map((d: Record<string, unknown>) => ({
    name: String(d.name ?? ''),
    description: d.description == null ? null : String(d.description),
  }));
}

function printDishes(label: string, dishes: { name: string; description: string | null }[]) {
  console.log(`\n  ── ${label} (${dishes.length} dishes) ──`);
  for (const d of dishes) {
    console.log(`   • ${d.name}${d.description ? `  —  ${d.description}` : ''}`);
  }
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  const { data: job, error } = await supa
    .from('menu_scan_jobs')
    .select('id, restaurant_id, status, attempts, input, result_json')
    .eq('id', jobId)
    .single();
  if (error || !job) throw new Error(`job ${jobId} not found: ${error?.message}`);

  const allImages: ImageRef[] = (job.input as { images?: ImageRef[] })?.images ?? [];
  if (!allImages.length) throw new Error('job has no input.images');
  if (ONLY_PAGE && ONLY_PAGE > allImages.length) {
    throw new Error(`--page ${ONLY_PAGE} out of range (job has ${allImages.length} images)`);
  }
  const images = ONLY_PAGE ? [allImages[ONLY_PAGE - 1]] : allImages;

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  MENU-SCAN REPLAY A/B (read-only; OpenAI calls only with --live)');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`job:        ${job.id}  (status=${job.status}, attempts=${job.attempts})`);
  console.log(`restaurant: ${job.restaurant_id}`);
  console.log(
    `images:     ${images.length}${ONLY_PAGE ? ` (page ${ONLY_PAGE} of ${allImages.length})` : ''}`
  );
  console.log(`model:      ${MODEL} @ temp ${TEMPERATURE}, detail=high`);
  console.log(`variants:   ${VARIANTS.map(v => v.key).join(', ')}  ×  ${RUNS} run(s)`);

  // Production transcription, for reference (with the 1-based page each dish
  // came from, so you know which --page to target).
  const prodRaw =
    (
      job.result_json as {
        dishes?: Array<{ name?: string; description?: string | null; source_image_index?: number }>;
      }
    )?.dishes ?? [];
  console.log(`\n  ── PRODUCTION result_json (what shipped) (${prodRaw.length} dishes) ──`);
  for (const d of prodRaw) {
    const page = typeof d.source_image_index === 'number' ? d.source_image_index + 1 : '?';
    console.log(
      `   [p${page}] ${String(d.name ?? '')}${d.description ? `  —  ${d.description}` : ''}`
    );
  }

  const totalCalls = images.length * VARIANTS.length * RUNS;
  if (!live) {
    console.log(
      `\n[dry-run] would make ${totalCalls} OpenAI vision call(s) ` +
        `(${images.length} img × ${VARIANTS.length} variants × ${RUNS} runs).`
    );
    console.log('[dry-run] re-run with --live to actually call OpenAI and compare.');
    return;
  }

  for (let i = 0; i < images.length; i++) {
    const base64 = await downloadBase64(images[i]);
    console.log(`\n\n########## IMAGE ${i + 1}/${images.length} (${images[i].path}) ##########`);
    for (const variant of VARIANTS) {
      for (let run = 1; run <= RUNS; run++) {
        try {
          const dishes = await callOpenAI(variant.prompt(), base64);
          printDishes(`${variant.key}  run ${run}`, dishes);
        } catch (e) {
          console.error(
            `   ! ${variant.key} run ${run} failed:`,
            e instanceof Error ? e.message : e
          );
        }
      }
    }
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
