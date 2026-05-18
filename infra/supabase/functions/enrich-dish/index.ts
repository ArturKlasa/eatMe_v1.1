// enrich-dish/index.ts
// POST /functions/v1/enrich-dish
//
// Generates a text-embedding-3-small vector for a dish and writes it to
// dishes.embedding. Callers must authenticate with the project's service-role
// JWT.
//
// Called by:
//   - _trg_notify_enrich_dish trigger on dish/ingredient/option_group writes
//   - embed-recovery-tick cron for dishes stuck at pending/failed
//   - infra/scripts/batch-embed.ts for one-off bulk operations
//
// Pipeline:
//   1. Load dish + ingredients + option groups + restaurant cuisine
//      + parent dish (when this is a variant) + parent ingredients
//   2. Build embedding text (labeled NL format, 60-120 tokens)
//   3. Call OpenAI text-embedding-3-small (1536 dims)
//   4. Write embedding + enrichment_status='completed'
//
// The downstream _trg_after_dish_embedded trigger handles recomputing the
// restaurant centroid when embedding changes — not this function's concern.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMS = 1536;
const DEBOUNCE_SECONDS = 8;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

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
  primary_protein: string | null;
  allergens: string[] | null;
}

interface OptionGroupData {
  groupName: string;
  optionNames: string[];
}

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

function buildEmbeddingInput(params: {
  name: string;
  description: string | null;
  dishKind: string;
  optionGroups: OptionGroupData[];
  cuisineTypes: string[];
  parentName: string | null;
  primaryProtein: string | null;
  // Union of dish.allergens with every option.adds_allergens. Surfaces the full
  // "what this dish can contain" set to semantic search (e.g. queries like
  // "shellfish-free" benefit from knowing Pad Thai's shrimp option carries
  // shellfish).
  allergenUnion: string[];
}): string {
  const {
    name,
    description,
    dishKind,
    optionGroups,
    cuisineTypes,
    parentName,
    primaryProtein,
    allergenUnion,
  } = params;

  const parts: string[] = [];

  if (parentName) {
    parts.push(`${parentName} — ${name}`);
  } else {
    parts.push(name);
  }

  const dishType = dishKind !== 'standard' ? dishKind : null;
  const cuisineStr = cuisineTypes.length > 0 ? cuisineTypes.join(', ') : null;
  if (dishType || cuisineStr) {
    parts.push([dishType, cuisineStr].filter(Boolean).join(', '));
  }

  if (description) parts.push(description.slice(0, 300));

  if (primaryProtein) {
    parts.push(`Protein: ${primaryProtein}`);
  }

  if (optionGroups.length > 0) {
    const optStr = optionGroups
      .slice(0, 5)
      .map(g => `${g.groupName}: ${g.optionNames.slice(0, 8).join(', ')}`)
      .join('. ');
    parts.push(optStr);
  }

  if (allergenUnion.length > 0) {
    parts.push(`Contains: ${allergenUnion.slice(0, 10).join(', ')}`);
  }

  return parts.join('. ');
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authHeader = req.headers.get('authorization') ?? '';
  const expectedKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!authHeader.startsWith('Bearer ') || authHeader.slice(7) !== expectedKey) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();

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

    const { data: dish, error: dishError } = (await supabase
      .from('dishes')
      .select(
        'id, restaurant_id, name, description, dish_kind, enrichment_status, updated_at, is_parent, parent_dish_id, primary_protein, allergens'
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

    // is_parent skip removed: post-Phase 6 no parent rows exist, and pre-Phase 6
    // the parent rows are dishes.is_parent=true which carry their own embedding-
    // worthy metadata (cuisine, category) — re-embedding them is harmless.

    const ageSeconds = (Date.now() - new Date(dish.updated_at).getTime()) / 1000;
    if (dish.enrichment_status === 'completed' && ageSeconds < DEBOUNCE_SECONDS) {
      console.log(`[enrich-dish] Already completed ${ageSeconds.toFixed(1)}s ago — skipping`);
      return new Response(JSON.stringify({ skipped: true, reason: 'recently_completed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const [{ data: optionGroupRows }, { data: restaurantRow }, { data: parentDish }] =
      await Promise.all([
        supabase
          .from('option_groups')
          .select('name, options(name, adds_allergens)')
          .eq('dish_id', dishId)
          .eq('is_active', true),
        supabase.from('restaurants').select('cuisine_types').eq('id', dish.restaurant_id).single(),
        dish.parent_dish_id
          ? supabase.from('dishes').select('name').eq('id', dish.parent_dish_id).single()
          : Promise.resolve({ data: null, error: null }),
      ]);

    const optionGroups: OptionGroupData[] = (optionGroupRows ?? []).map((g: any) => ({
      groupName: g.name,
      optionNames: (g.options ?? []).map((o: any) => o.name).filter(Boolean),
    }));

    // Union of base-dish allergens with every option's adds_allergens. Phase 1
    // migration 140 added `options.adds_allergens text[] DEFAULT '{}'` so the
    // column is always present.
    const baseAllergens: string[] = Array.isArray(dish.allergens) ? dish.allergens : [];
    const optionAllergens: string[] = (optionGroupRows ?? []).flatMap((g: any) =>
      (g.options ?? []).flatMap((o: any) =>
        Array.isArray(o.adds_allergens) ? (o.adds_allergens as string[]) : []
      )
    );
    const allergenUnion = [...new Set([...baseAllergens, ...optionAllergens])];

    const cuisineTypes: string[] = (restaurantRow?.cuisine_types as string[]) ?? [];

    const parentName: string | null = dish.parent_dish_id && parentDish ? parentDish.name : null;

    const embeddingInput = buildEmbeddingInput({
      name: dish.name,
      description: dish.description,
      dishKind: dish.dish_kind,
      optionGroups,
      cuisineTypes,
      parentName,
      primaryProtein: dish.primary_protein,
      allergenUnion,
    });

    console.log('[enrich-dish] Embedding input:', embeddingInput.slice(0, 200));

    const embedding = await getEmbedding(embeddingInput);

    const { error: updateError } = await supabase
      .from('dishes')
      .update({
        embedding: JSON.stringify(embedding),
        enrichment_status: 'completed',
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

    console.log('[enrich-dish] Completed:', dishId);

    return new Response(JSON.stringify({ dish_id: dishId, embedded: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[enrich-dish] Unhandled error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
