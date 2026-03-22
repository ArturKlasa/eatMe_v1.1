// enrich-dish/index.ts
// POST /functions/v1/enrich-dish
//
// Triggered by a Supabase Database Webhook on INSERT/UPDATE of dishes.
// Also callable directly for manual re-enrichment or batch processing.
//
// Request body (Webhook envelope OR direct call):
//   Webhook:  { type: 'INSERT'|'UPDATE', table: 'dishes', record: { id: string, ... } }
//   Direct:   { dish_id: string }
//
// What it does:
//   1. Loads the dish + its canonical ingredients + option group/option names
//   2. Evaluates completeness: complete / partial / sparse
//   3. If sparse or partial: calls GPT-4o-mini for AI enrichment (stored in
//      enrichment_payload; NEVER written to allergens/dietary_tags — audit-only)
//   4. Builds embedding_input (structured text string)
//   5. Calls OpenAI text-embedding-3-small
//   6. Saves embedding, embedding_input, enrichment_status/source/confidence
//   7. Calls update_restaurant_vector RPC to recompute the restaurant centroid
//
// Environment variables required (set in Supabase Dashboard → Edge Functions → Secrets):
//   SUPABASE_URL              (auto-injected)
//   SUPABASE_SERVICE_ROLE_KEY (auto-injected)
//   OPENAI_API_KEY

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── Constants ─────────────────────────────────────────────────────────────────

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMS = 1536;
const ENRICHMENT_MODEL = 'gpt-4o-mini';

/** Minimum ingredient count to be considered "complete" without AI enrichment */
const COMPLETE_INGREDIENT_THRESHOLD = 3;

/** Debounce: skip if dish was updated less than this many seconds ago
 *  (prevents redundant calls from rapid multi-field saves). */
const DEBOUNCE_SECONDS = 8;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Supabase client (service role — bypasses RLS) ─────────────────────────────

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// ── Types ─────────────────────────────────────────────────────────────────────

type Completeness = 'complete' | 'partial' | 'sparse';
type EnrichmentSource = 'none' | 'ai' | 'manual';
type EnrichmentConfidence = 'high' | 'medium' | 'low';

interface DishRow {
  id: string;
  restaurant_id: string;
  name: string;
  description: string | null;
  dish_kind: string;
  enrichment_status: string;
  updated_at: string;
}

interface EnrichmentPayload {
  inferred_ingredients?: string[];
  inferred_dish_type?: string;
  notes?: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
}

// ── OpenAI helpers ────────────────────────────────────────────────────────────

async function getEmbedding(text: string): Promise<number[]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input: text, model: EMBEDDING_MODEL, dimensions: EMBEDDING_DIMS }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI embeddings error ${res.status}: ${err}`);
  }
  const json = await res.json();
  console.log('[enrich-dish] Embedding tokens used:', json.usage?.total_tokens);
  return json.data[0].embedding as number[];
}

async function enrichWithAI(
  name: string,
  description: string | null
): Promise<EnrichmentPayload | null> {
  const systemPrompt = `You are a culinary assistant helping to enrich restaurant menu data.
Given a dish name and optional description, infer the most likely:
1. Main ingredients (max 8 canonical names, common English)
2. Dish type (e.g. "grilled meat", "pasta", "salad", "soup", "dessert", "drink")
3. Any notes about cuisine or preparation

Respond ONLY with valid JSON in this exact schema:
{
  "inferred_ingredients": ["string"],
  "inferred_dish_type": "string",
  "notes": "string or null"
}

CRITICAL: Do NOT include allergen or dietary restriction fields.
These will be computed separately from the canonical ingredient database.`;

  const userPrompt = `Dish name: "${name}"${description ? `\nDescription: "${description}"` : ''}`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: ENRICHMENT_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 256,
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[enrich-dish] GPT error:', err);
      return null;
    }

    const json = await res.json();
    const content = json.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);
    console.log('[enrich-dish] Enrichment tokens:', json.usage);
    return {
      ...parsed,
      model: ENRICHMENT_MODEL,
      prompt_tokens: json.usage?.prompt_tokens ?? 0,
      completion_tokens: json.usage?.completion_tokens ?? 0,
    };
  } catch (err) {
    console.error('[enrich-dish] AI enrichment failed:', err);
    return null;
  }
}

// ── Completeness evaluation ───────────────────────────────────────────────────

function evaluateCompleteness(ingredientNames: string[], hasDescription: boolean): Completeness {
  if (ingredientNames.length >= COMPLETE_INGREDIENT_THRESHOLD) return 'complete';
  if (ingredientNames.length > 0 || hasDescription) return 'partial';
  return 'sparse';
}

function evaluateConfidence(completeness: Completeness, aiEnriched: boolean): EnrichmentConfidence {
  if (completeness === 'complete') return 'high';
  if (completeness === 'partial') return aiEnriched ? 'medium' : 'low';
  return aiEnriched ? 'low' : 'low';
}

// ── embedding_input builder ───────────────────────────────────────────────────

function buildEmbeddingInput(params: {
  name: string;
  description: string | null;
  dishKind: string;
  ingredientNames: string[];
  optionNames: string[];
  enrichmentPayload: EnrichmentPayload | null;
  completeness: Completeness;
}): string {
  const {
    name,
    description,
    dishKind,
    ingredientNames,
    optionNames,
    enrichmentPayload,
    completeness,
  } = params;

  // completeness drives ingredient sourcing: complete = DB only; else supplement with AI inferred
  const allIngredients =
    completeness === 'complete'
      ? ingredientNames
      : [
          ...ingredientNames,
          ...(enrichmentPayload?.inferred_ingredients ?? []).slice(
            0,
            COMPLETE_INGREDIENT_THRESHOLD - ingredientNames.length
          ),
        ];

  const parts: string[] = [name];

  if (enrichmentPayload?.inferred_dish_type) {
    parts.push(enrichmentPayload.inferred_dish_type);
  } else if (dishKind !== 'standard') {
    parts.push(dishKind);
  }

  if (description) {
    parts.push(description.slice(0, 120));
  }

  if (allIngredients.length > 0) {
    parts.push(allIngredients.join(', '));
  }

  if (optionNames.length > 0) {
    parts.push(optionNames.slice(0, 20).join(', '));
  }

  return parts.join('; ');
}

// ── Main handler ─────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // Support both Database Webhook envelope and direct call
    let dishId: string;
    if (body.record?.id) {
      // Webhook envelope: { type, table, record: { id, ... } }
      dishId = body.record.id;
    } else if (body.dish_id) {
      // Direct call: { dish_id: string }
      dishId = body.dish_id;
    } else {
      return new Response(JSON.stringify({ error: 'Missing dish_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[enrich-dish] Processing dish:', dishId);

    // ── Load dish ─────────────────────────────────────────────────────────────

    const { data: dish, error: dishError } = (await supabase
      .from('dishes')
      .select('id, restaurant_id, name, description, dish_kind, enrichment_status, updated_at')
      .eq('id', dishId)
      .single()) as { data: DishRow | null; error: unknown };

    if (dishError || !dish) {
      console.error('[enrich-dish] Dish not found:', dishError);
      return new Response(JSON.stringify({ error: 'Dish not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Note: debounce guard was removed because the trigger (_trg_notify_enrich_dish)
    // now sets enrichment_status='pending' AND updates updated_at before calling
    // this function. The old guard (pending + age < 8s) would always evaluate true,
    // causing every call to be skipped.
    //
    // Duplicate protection: if a dish is already 'completed' and updated_at is
    // very recent, skip re-enrichment to avoid redundant OpenAI calls from
    // rapid back-to-back trigger firings.
    const updatedAt = new Date(dish.updated_at).getTime();
    const ageSeconds = (Date.now() - updatedAt) / 1000;
    if (dish.enrichment_status === 'completed' && ageSeconds < DEBOUNCE_SECONDS) {
      console.log(`[enrich-dish] Already completed ${ageSeconds.toFixed(1)}s ago — skipping`);
      return new Response(JSON.stringify({ skipped: true, reason: 'recently_completed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mark as pending (may already be pending from trigger, but ensures consistency)
    await supabase.from('dishes').update({ enrichment_status: 'pending' }).eq('id', dishId);

    // ── Load canonical ingredients ────────────────────────────────────────────

    const { data: ingredientRows } = await supabase
      .from('dish_ingredients')
      .select('canonical_ingredient:canonical_ingredients(canonical_name)')
      .eq('dish_id', dishId);

    const ingredientNames: string[] = (ingredientRows ?? [])
      .map((r: any) => r.canonical_ingredient?.canonical_name)
      .filter(Boolean) as string[];

    // ── Load option names (template / experience dishes) ──────────────────────

    const { data: optionRows } = await supabase
      .from('options')
      .select('name, option_group:option_groups!inner(name)')
      .eq('option_groups.dish_id', dishId)
      .eq('is_available', true);

    const optionNames: string[] = (optionRows ?? []).map((r: any) => r.name).filter(Boolean);

    // ── Evaluate completeness ─────────────────────────────────────────────────

    const completeness = evaluateCompleteness(ingredientNames, !!dish.description);
    console.log(
      '[enrich-dish] Completeness:',
      completeness,
      `(${ingredientNames.length} ingredients)`
    );

    // ── AI enrichment (sparse / partial only) ────────────────────────────────

    let enrichmentPayload: EnrichmentPayload | null = null;
    let enrichmentSource: EnrichmentSource = 'none';

    if (completeness !== 'complete') {
      enrichmentPayload = await enrichWithAI(dish.name, dish.description);
      if (enrichmentPayload) {
        enrichmentSource = 'ai';
        console.log(
          '[enrich-dish] AI inferred',
          enrichmentPayload.inferred_ingredients?.length ?? 0,
          'ingredients'
        );
      }
    }

    // ── Build embedding input ─────────────────────────────────────────────────

    const embeddingInput = buildEmbeddingInput({
      name: dish.name,
      description: dish.description,
      dishKind: dish.dish_kind,
      ingredientNames,
      optionNames,
      enrichmentPayload,
      completeness,
    });

    console.log('[enrich-dish] Embedding input:', embeddingInput.slice(0, 120));

    // ── Generate embedding ────────────────────────────────────────────────────

    const embedding = await getEmbedding(embeddingInput);
    const confidence = evaluateConfidence(completeness, enrichmentSource === 'ai');

    // ── Persist to DB ─────────────────────────────────────────────────────────

    const { error: updateError } = await supabase
      .from('dishes')
      .update({
        embedding: JSON.stringify(embedding), // pgvector accepts JSON array string
        embedding_input: embeddingInput,
        enrichment_status: 'completed',
        enrichment_source: enrichmentSource,
        enrichment_confidence: confidence,
        enrichment_payload: enrichmentPayload ?? null,
      })
      .eq('id', dishId);

    if (updateError) {
      console.error('[enrich-dish] Failed to save embedding:', updateError);
      await supabase.from('dishes').update({ enrichment_status: 'failed' }).eq('id', dishId);
      return new Response(JSON.stringify({ error: 'Failed to save embedding' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Update restaurant vector ──────────────────────────────────────────────

    const { error: rpcError } = await supabase.rpc('update_restaurant_vector', {
      p_restaurant_id: dish.restaurant_id,
    });
    if (rpcError) {
      // Non-fatal: log but don't fail the request
      console.error('[enrich-dish] update_restaurant_vector failed (non-fatal):', rpcError);
    }

    console.log('[enrich-dish] ✓ Completed:', dishId, `(${confidence} confidence)`);

    return new Response(
      JSON.stringify({
        dish_id: dishId,
        enrichment_source: enrichmentSource,
        enrichment_confidence: confidence,
        embedding_input: embeddingInput,
        completeness,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[enrich-dish] Unhandled error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
