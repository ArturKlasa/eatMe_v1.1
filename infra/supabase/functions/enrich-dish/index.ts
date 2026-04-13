// enrich-dish/index.ts
// POST /functions/v1/enrich-dish
//
// Triggered by a Supabase Database Webhook on INSERT/UPDATE of dishes.
// Also callable directly for manual re-enrichment or batch processing.
//
// What it does:
//   1. Loads the dish + its canonical ingredients + option groups/options
//   2. Loads restaurant cuisine_types for embedding context
//   3. For child variants, loads parent name + ingredients
//   4. Evaluates completeness (dish_kind-aware)
//   5. If sparse or partial: calls GPT-4o-mini for AI enrichment
//      (includes inferred_allergens + inferred_dish_category)
//   6. Builds embedding_input (labeled NL format, 60-120 tokens)
//   7. Calls OpenAI text-embedding-3-small
//   8. Saves embedding, embedding_input, enrichment_status/source/confidence
//   9. Sets enrichment_review_status = 'pending_review' when AI data exists
//  10. Calls update_restaurant_vector RPC to recompute the restaurant centroid

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── Constants ─────────────────────────────────────────────────────────────────

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMS = 1536;
const ENRICHMENT_MODEL = 'gpt-4o-mini';

/** Minimum ingredient count to be considered "complete" for standard dishes */
const COMPLETE_INGREDIENT_THRESHOLD = 3;

/** Debounce: skip if dish was updated less than this many seconds ago */
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
  is_parent: boolean;
  parent_dish_id: string | null;
}

interface EnrichmentPayload {
  inferred_ingredients?: string[];
  inferred_dish_type?: string;
  notes?: string;
  inferred_allergens?: string[];
  inferred_dish_category?: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
}

interface OptionGroupData {
  groupName: string;
  optionNames: string[];
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
4. Likely allergens (from: dairy, eggs, fish, shellfish, tree_nuts, peanuts, wheat, soy, sesame)
5. A dish category (e.g. "Pizza", "Burger", "Salad", "Soup", "Taco", "Bowl", "Sandwich", "Pasta", "Dessert")

Respond ONLY with valid JSON in this exact schema:
{
  "inferred_ingredients": ["string"],
  "inferred_dish_type": "string",
  "notes": "string or null",
  "inferred_allergens": ["string"],
  "inferred_dish_category": "string"
}

CRITICAL: Allergen inference is for SUGGESTION only (admin review required). Be conservative — only include allergens you are reasonably confident about based on the dish name and description.`;

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
        max_tokens: 512,
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[enrich-dish] GPT error:', err);
      return null;
    }

    const json = await res.json();
    const choice = json.choices?.[0];
    const content = choice?.message?.content;
    if (!content) return null;

    if (choice?.finish_reason === 'length') {
      console.warn('[enrich-dish] GPT response truncated (finish_reason=length) — enrichment may be incomplete for dish:', name);
    }

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

// ── Completeness evaluation (dish_kind-aware) ───────────────────────────────

function evaluateCompleteness(
  ingredientNames: string[],
  hasDescription: boolean,
  descriptionLength: number,
  dishKind: string,
  optionCount: number
): Completeness {
  // Template/experience: completeness comes from options, not ingredients
  if ((dishKind === 'template' || dishKind === 'experience') && optionCount >= 3) {
    return 'complete';
  }

  // Combo: complete if has child items
  if (dishKind === 'combo' && optionCount >= 2) {
    return 'complete';
  }

  // Standard: ingredient-based with description boost
  if (ingredientNames.length >= COMPLETE_INGREDIENT_THRESHOLD) return 'complete';
  if (ingredientNames.length >= 1 && descriptionLength >= 100) return 'complete';
  if (ingredientNames.length > 0 || hasDescription) return 'partial';
  return 'sparse';
}

function evaluateConfidence(completeness: Completeness, aiEnriched: boolean): EnrichmentConfidence {
  if (completeness === 'complete') return 'high';
  if (completeness === 'partial') return aiEnriched ? 'medium' : 'low';
  return aiEnriched ? 'low' : 'low';
}

// ── embedding_input builder (labeled NL format, 60-120 tokens) ──────────────

function buildEmbeddingInput(params: {
  name: string;
  description: string | null;
  dishKind: string;
  ingredientNames: string[];
  optionGroups: OptionGroupData[];
  enrichmentPayload: EnrichmentPayload | null;
  completeness: Completeness;
  cuisineTypes: string[];
  parentName: string | null;
  parentIngredients: string[];
}): string {
  const {
    name,
    description,
    dishKind,
    ingredientNames,
    optionGroups,
    enrichmentPayload,
    completeness,
    cuisineTypes,
    parentName,
    parentIngredients,
  } = params;

  const parts: string[] = [];

  // Parent context for variants
  if (parentName) {
    parts.push(`${parentName} — ${name}`);
  } else {
    parts.push(name);
  }

  // Dish type + cuisine
  const dishType =
    enrichmentPayload?.inferred_dish_type ?? (dishKind !== 'standard' ? dishKind : null);
  const cuisineStr = cuisineTypes.length > 0 ? cuisineTypes.join(', ') : null;
  if (dishType || cuisineStr) {
    parts.push([dishType, cuisineStr].filter(Boolean).join(', '));
  }

  // Description (300 chars, up from 120)
  if (description) parts.push(description.slice(0, 300));

  // AI notes (cuisine/preparation context)
  if (enrichmentPayload?.notes) parts.push(enrichmentPayload.notes);

  // Ingredients (DB + parent + AI supplemental)
  const allIngredients = [
    ...parentIngredients,
    ...ingredientNames,
    ...(completeness !== 'complete'
      ? (enrichmentPayload?.inferred_ingredients ?? []).slice(
          0,
          Math.max(0, COMPLETE_INGREDIENT_THRESHOLD - ingredientNames.length)
        )
      : []),
  ];
  if (allIngredients.length > 0) parts.push(`Ingredients: ${allIngredients.join(', ')}`);

  // Structured options (grouped, not flat)
  if (optionGroups.length > 0) {
    const optStr = optionGroups
      .slice(0, 5) // max 5 groups
      .map(g => `${g.groupName}: ${g.optionNames.slice(0, 8).join(', ')}`)
      .join('. ');
    parts.push(optStr);
  }

  return parts.join('. ');
}

// ── Main handler ─────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // ── Authenticate caller ───────────────────────────────────────────────────
  // Accepts either:
  //   - Database Webhook: x-webhook-secret header matching WEBHOOK_SECRET env var
  //   - Supabase service-role JWT in Authorization header (for manual admin calls)
  const webhookSecret = Deno.env.get('WEBHOOK_SECRET');
  if (webhookSecret) {
    const providedSecret = req.headers.get('x-webhook-secret');
    const authHeader = req.headers.get('authorization') ?? '';
    const isServiceRole =
      authHeader.startsWith('Bearer ') &&
      authHeader.slice(7) === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (providedSecret !== webhookSecret && !isServiceRole) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  try {
    const body = await req.json();

    // Support both Database Webhook envelope and direct call
    let dishId: string;
    if (body.record?.id) {
      dishId = body.record.id;
    } else if (body.dish_id) {
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
      .select(
        'id, restaurant_id, name, description, dish_kind, enrichment_status, updated_at, is_parent, parent_dish_id'
      )
      .eq('id', dishId)
      .single()) as { data: DishRow | null; error: unknown };

    if (dishError || !dish) {
      console.error('[enrich-dish] Dish not found:', dishError);
      return new Response(JSON.stringify({ error: 'Dish not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parent dishes are display-only containers with no embedding — skip enrichment.
    if (dish.is_parent) {
      console.log('[enrich-dish] Dish is a parent (display-only) — skipping enrichment:', dishId);
      return new Response(JSON.stringify({ skipped: true, reason: 'is_parent' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Debounce: skip if recently completed
    const updatedAt = new Date(dish.updated_at).getTime();
    const ageSeconds = (Date.now() - updatedAt) / 1000;
    if (dish.enrichment_status === 'completed' && ageSeconds < DEBOUNCE_SECONDS) {
      console.log(`[enrich-dish] Already completed ${ageSeconds.toFixed(1)}s ago — skipping`);
      return new Response(JSON.stringify({ skipped: true, reason: 'recently_completed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mark as pending
    await supabase.from('dishes').update({ enrichment_status: 'pending' }).eq('id', dishId);

    // ── Load all independent data in parallel ────────────────────────────────
    const parallelStart = Date.now();

    const [
      { data: ingredientRows },
      { data: optionGroupRows },
      { data: restaurantRow },
      { data: parentDish },
    ] = await Promise.all([
      supabase
        .from('dish_ingredients')
        .select('canonical_ingredient:canonical_ingredients(canonical_name)')
        .eq('dish_id', dishId),
      supabase
        .from('option_groups')
        .select('name, options(name)')
        .eq('dish_id', dishId)
        .eq('is_active', true),
      supabase
        .from('restaurants')
        .select('cuisine_types')
        .eq('id', dish.restaurant_id)
        .single(),
      dish.parent_dish_id
        ? supabase.from('dishes').select('name').eq('id', dish.parent_dish_id).single()
        : Promise.resolve({ data: null, error: null }),
    ]);

    console.log(`[enrich-dish] Parallel fetch took ${Date.now() - parallelStart}ms`);

    const ingredientNames: string[] = (ingredientRows ?? [])
      .map((r: any) => r.canonical_ingredient?.canonical_name)
      .filter(Boolean) as string[];

    const optionGroups: OptionGroupData[] = (optionGroupRows ?? []).map((g: any) => ({
      groupName: g.name,
      optionNames: (g.options ?? []).map((o: any) => o.name).filter(Boolean),
    }));

    const optionCount = optionGroups.reduce((sum, g) => sum + g.optionNames.length, 0);

    const cuisineTypes: string[] = (restaurantRow?.cuisine_types as string[]) ?? [];

    // ── Load parent ingredients (depends on parentDish result) ───────────────

    let parentName: string | null = null;
    let parentIngredients: string[] = [];

    if (dish.parent_dish_id) {
      if (parentDish) {
        parentName = parentDish.name;

        const { data: parentIngRows } = await supabase
          .from('dish_ingredients')
          .select('canonical_ingredient:canonical_ingredients(canonical_name)')
          .eq('dish_id', dish.parent_dish_id);

        parentIngredients = (parentIngRows ?? [])
          .map((r: any) => r.canonical_ingredient?.canonical_name)
          .filter(Boolean) as string[];
      } else {
        console.warn('[enrich-dish] Parent dish not found for child:', dish.parent_dish_id);
      }
    }

    // ── Evaluate completeness (dish_kind-aware) ──────────────────────────────

    const completeness = evaluateCompleteness(
      ingredientNames,
      !!dish.description,
      dish.description?.length ?? 0,
      dish.dish_kind,
      optionCount
    );
    console.log(
      '[enrich-dish] Completeness:',
      completeness,
      `(${ingredientNames.length} ingredients, ${optionCount} options, kind=${dish.dish_kind})`
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
          'ingredients,',
          enrichmentPayload.inferred_allergens?.length ?? 0,
          'allergens'
        );
      } else {
        // AI call failed — mark as failed so the dish is visible for retry,
        // rather than silently completing with low-confidence/empty data.
        console.warn('[enrich-dish] AI enrichment returned null — marking dish as failed:', dishId);
        await supabase
          .from('dishes')
          .update({ enrichment_status: 'failed' })
          .eq('id', dishId);
        return new Response(JSON.stringify({ error: 'AI enrichment failed', dish_id: dishId }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ── Build embedding input (labeled NL format) ────────────────────────────

    const embeddingInput = buildEmbeddingInput({
      name: dish.name,
      description: dish.description,
      dishKind: dish.dish_kind,
      ingredientNames,
      optionGroups,
      enrichmentPayload,
      completeness,
      cuisineTypes,
      parentName,
      parentIngredients,
    });

    console.log('[enrich-dish] Embedding input:', embeddingInput.slice(0, 200));

    // ── Generate embedding ────────────────────────────────────────────────────

    const embedding = await getEmbedding(embeddingInput);
    const confidence = evaluateConfidence(completeness, enrichmentSource === 'ai');

    // ── Persist to DB ─────────────────────────────────────────────────────────

    const updatePayload: Record<string, unknown> = {
      embedding: JSON.stringify(embedding),
      embedding_input: embeddingInput,
      enrichment_status: 'completed',
      enrichment_source: enrichmentSource,
      enrichment_confidence: confidence,
      enrichment_payload: enrichmentPayload ?? null,
    };

    // Set enrichment_review_status when AI data exists
    if (enrichmentPayload) {
      updatePayload.enrichment_review_status = 'pending_review';
    }

    const { error: updateError } = await supabase
      .from('dishes')
      .update(updatePayload)
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
    // Only recompute when the embedding carries new AI-enriched signal.
    // Skipping for non-AI enrichments avoids redundant RPC calls when bulk
    // confirming menus (one call per dish would otherwise flood the endpoint).

    if (enrichmentSource !== 'none') {
      const { error: rpcError } = await supabase.rpc('update_restaurant_vector', {
        p_restaurant_id: dish.restaurant_id,
      });
      if (rpcError) {
        console.error('[enrich-dish] update_restaurant_vector failed (non-fatal):', rpcError);
      }
    } else {
      console.log('[enrich-dish] Skipping update_restaurant_vector — no AI enrichment this run');
    }

    console.log('[enrich-dish] Completed:', dishId, `(${confidence} confidence)`);

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
