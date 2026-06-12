'use server';

import { z } from 'zod';
import { PRIMARY_PROTEINS, getCurrencyInfo, isSupportedCurrency } from '@eatme/shared';
import { withAdminAuth, type ActionResult } from '@/lib/auth/wrappers';

// adminScanModifierExtras (operator issue #12): synchronous supplementary scan
// during menu-scan review. The operator photographs/screenshots a modifier
// section ("choose your protein", toppings list, combo contents) that the main
// per-page scan missed or garbled, and this action extracts ONLY modifier
// groups + bundled items from it. The result is merged into client-side review
// state (useReviewState.applyAttachScannedExtras) and persisted on the normal
// confirm — nothing is written here, so no audit log.
//
// Unlike the main scan this is a direct OpenAI call from the admin app (no
// worker/job): the image arrives as base64 (next.config.ts raises the server
// action body limit to 20mb; the client compresses to ≤6MB first), same model
// + params as menu-scan-worker so extraction quality matches.

const MODEL = 'gpt-5.4-mini';

// Mirrors menu-scan-worker's modifierGroupSchema / bundledItemSchema (the wire
// shapes the review UI already consumes). min/max constraints are enforced by
// sanitize() below rather than Zod so one out-of-range number from the model
// degrades gracefully instead of failing the whole scan.
const scannedOptionSchema = z.object({
  name: z.string(),
  price_delta: z.number(),
  price_override: z.number().nullable(),
  primary_protein: z.enum(PRIMARY_PROTEINS).nullable(),
  serves_delta: z.number().int(),
  is_default: z.boolean(),
});

const scannedGroupSchema = z.object({
  name: z.string(),
  selection_type: z.enum(['single', 'multiple']),
  min_selections: z.number().int(),
  max_selections: z.number().int(),
  display_in_card: z.boolean(),
  options: z.array(scannedOptionSchema),
});

const scannedBundledItemSchema = z.object({
  name: z.string(),
  note: z.string().nullable(),
});

const extractionSchema = z.object({
  modifier_groups: z.array(scannedGroupSchema),
  bundled_items: z.array(scannedBundledItemSchema),
});

export type ScannedExtras = z.infer<typeof extractionSchema>;

// Strict structured-outputs JSON schema, hand-written because the admin app
// doesn't carry the OpenAI SDK (the worker uses zodResponseFormat). Strict mode
// requires every field in `required` and additionalProperties:false; numeric
// range keywords are unsupported, hence sanitize().
const EXTRACTION_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['modifier_groups', 'bundled_items'],
  properties: {
    modifier_groups: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'name',
          'selection_type',
          'min_selections',
          'max_selections',
          'display_in_card',
          'options',
        ],
        properties: {
          name: { type: 'string' },
          selection_type: { type: 'string', enum: ['single', 'multiple'] },
          min_selections: { type: 'integer' },
          max_selections: { type: 'integer' },
          display_in_card: { type: 'boolean' },
          options: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: [
                'name',
                'price_delta',
                'price_override',
                'primary_protein',
                'serves_delta',
                'is_default',
              ],
              properties: {
                name: { type: 'string' },
                price_delta: { type: 'number' },
                price_override: { type: ['number', 'null'] },
                primary_protein: {
                  anyOf: [{ type: 'string', enum: [...PRIMARY_PROTEINS] }, { type: 'null' }],
                },
                serves_delta: { type: 'integer' },
                is_default: { type: 'boolean' },
              },
            },
          },
        },
      },
    },
    bundled_items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'note'],
        properties: {
          name: { type: 'string' },
          note: { type: ['string', 'null'] },
        },
      },
    },
  },
} as const;

// Focused subset of the worker's extraction prompt: only the modifier-group and
// bundled-item rules (kept in lockstep with menu-scan-worker/index.ts
// buildExtractionPrompt — update both when the rules change).
function buildPrompt(currencyCode: string): string {
  const currency = getCurrencyInfo(isSupportedCurrency(currencyCode) ? currencyCode : 'USD');
  return `You are extracting CUSTOMER CHOICES from a photo or screenshot of part of a restaurant menu (e.g. a modifier section, toppings list, combo description, or options panel from an ordering app).

This restaurant's prices are in ${currency.name} (${currency.symbol}, ISO code: ${currency.code}). Extract numeric values only — strip the "${currency.symbol}" symbol (and any other currency markers) if they appear next to a price.

Transcribe all text VERBATIM in the source language — never translate, reorder, add or drop words, and never invent names that are not printed in the image.

Output exactly two arrays:

- modifier_groups: customer-selectable choices. Extract one group per "choose your X",
    "add Y for $Z", "+$N upgrade", "size: S/M/L", protein choice, dressing choice, course
    choice, etc. Use an empty array [] when the image shows no choices.
    Group fields:
      name: short label as printed (e.g. "Choose your protein", "Size", "Add-ons")
      selection_type: 'single' (pick exactly one) or 'multiple' (may pick several)
      min_selections: 0 for optional groups; >=1 for required groups (must pick at least N)
      max_selections: max picks allowed (1 for 'single')
      display_in_card: set true ONLY for groups whose selected option meaningfully changes
        the dish identity in a one-line description (e.g. protein choice on Pad Thai ->
        "Pad Thai with chicken"). Set false (default) for size, dressing, drink, side choices.
        When in doubt, set false.
      options: list of choices (each with the fields below)
    Option fields:
      name: the choice label exactly as printed
      price_delta: signed surcharge in the menu's currency. When an option has its own
        printed price next to it, capture that price — NEVER default a printed price to 0.
        Use 0 ONLY when the image shows no price for the option or marks it as included at
        no extra charge (e.g. the base option of a required group).
      price_override: when the option's printed price REPLACES the base price instead of
        adding to it (e.g. non-linear quantity pricing: "12 wings for $45" -> the 12-wing
        option has price_override=45, price_delta=0). Otherwise null — NEVER 0. An option
        without its own replacing price has price_override=null; 0 would mean picking the
        option makes the dish free.
      primary_protein: only when the option CHANGES the dish's protein source
        (e.g. "with chicken" -> 'chicken'). Otherwise null. One of:
        ${PRIMARY_PROTEINS.join(' | ')}
      serves_delta: only for options that change headcount (rare). 0 otherwise.
      is_default: set TRUE on exactly one option in each required group — the cheapest /
        standard choice. FALSE for all options in optional groups.

- bundled_items: items pre-included with a dish that the customer does NOT pick from a list.
    Use this for combo meals and fixed accompaniments. Decide by the WORDING, not the format:
      - Inclusion / accompaniment language -> bundled_items, even when written as a sentence:
        "incluye arroz y frijoles", "viene con papas", "acompañado de ensalada",
        "includes side salad", "served with fries", "+ papas y refresco".
      - Composition / preparation language -> NOT bundled items ("preparados con tocino y
        chorizo", "a base de maíz", "con salsa de chipotle" — ingredients the dish is made
        of are NOT bundled items; skip them entirely here).
    Each item is {name, note}. Output an empty array [] when no included items are shown.
    Do NOT use bundled_items for customer choices — use modifier_groups for those.

If the image shows neither customer choices nor included items, output two empty arrays.`;
}

// Clamp numeric fields the JSON schema can't constrain (strict mode rejects
// minimum/maximum keywords) so a single odd number from the model can't produce
// an unsaveable group.
function sanitize(extras: ScannedExtras): ScannedExtras {
  return {
    modifier_groups: extras.modifier_groups.map(g => {
      const max = Math.max(1, g.selection_type === 'single' ? 1 : g.max_selections);
      return {
        ...g,
        min_selections: Math.min(Math.max(0, g.min_selections), max),
        max_selections: max,
        // The model fills 0 instead of null for options with no replacing
        // price despite the prompt; a 0 override would render as a literal
        // "0" in the editor and price the option at 0 for consumers. Same
        // backstop as the menu-scan worker.
        options: g.options.map(o => ({
          ...o,
          price_override: o.price_override === 0 ? null : o.price_override,
        })),
      };
    }),
    bundled_items: extras.bundled_items,
  };
}

// ~12MB of base64 ≈ 9MB of image — comfortably above the client's 6MB
// compression target, below the 20mb action body limit.
const MAX_BASE64_LENGTH = 16_000_000;

const inputSchema = z.object({
  imageBase64: z.string().min(100).max(MAX_BASE64_LENGTH),
  currencyCode: z.string(),
});

export const adminScanModifierExtras = withAdminAuth(
  async (
    _ctx,
    input: { imageBase64: string; currencyCode: string }
  ): Promise<ActionResult<ScannedExtras>> => {
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) return { ok: false, formError: 'VALIDATION' };

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return { ok: false, formError: 'NO_API_KEY' };

    // Tolerate a full data URL from the client; OpenAI wants the bare payload.
    const base64 = parsed.data.imageBase64.replace(/^data:image\/[a-z+.-]+;base64,/i, '');

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: buildPrompt(parsed.data.currencyCode) },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64}`,
                  // Full-resolution patches — same rationale as the worker:
                  // modifier sections are dense small text.
                  detail: 'original',
                },
              },
            ],
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'modifier_extraction',
            strict: true,
            schema: EXTRACTION_JSON_SCHEMA,
          },
        },
        // Reasoning-model params, mirroring the worker. A single modifier
        // section is far smaller than a full page, so half the worker budget.
        max_completion_tokens: 16384,
        reasoning_effort: 'low',
      }),
    }).catch(() => null);

    if (!res || !res.ok) {
      const detail = res ? await res.text().catch(() => '') : '';
      console.error('[adminScanModifierExtras] OpenAI error:', res?.status, detail.slice(0, 500));
      return { ok: false, formError: 'OPENAI_ERROR' };
    }

    const json = (await res.json().catch(() => null)) as {
      choices?: Array<{ finish_reason?: string; message?: { content?: string | null } }>;
    } | null;

    const choice = json?.choices?.[0];
    if (choice?.finish_reason === 'length') {
      return { ok: false, formError: 'TRUNCATED' };
    }
    const content = choice?.message?.content;
    if (!content) return { ok: false, formError: 'EMPTY_RESPONSE' };

    let raw: unknown;
    try {
      raw = JSON.parse(content);
    } catch {
      return { ok: false, formError: 'PARSE_FAILED' };
    }
    const validated = extractionSchema.safeParse(raw);
    if (!validated.success) {
      console.error('[adminScanModifierExtras] schema mismatch:', validated.error.message);
      return { ok: false, formError: 'PARSE_FAILED' };
    }

    return { ok: true, data: sanitize(validated.data) };
  }
);
