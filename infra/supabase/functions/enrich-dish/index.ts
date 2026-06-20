// enrich-dish/index.ts
// POST /functions/v1/enrich-dish
//
// Generates a text-embedding-3-small vector for a dish and writes it to
// dishes.embedding. Callers must authenticate with the project's service-role
// JWT.
//
// Called by:
//   - _trg_notify_enrich_dish trigger on dish/option_group writes
//   - embed-recovery-tick cron for dishes stuck at pending/failed
//   - infra/scripts/batch-embed.ts for one-off bulk operations
//
// Pipeline:
//   1. Load dish + option groups + restaurant cuisine
//   2. Build embedding text (labeled NL format, 60-120 tokens)
//   3. Call OpenAI text-embedding-3-small (1536 dims)
//   4. Write embedding + enrichment_status='completed'
//
// The downstream _trg_after_dish_embedded trigger handles recomputing the
// restaurant centroid when embedding changes — not this function's concern.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { buildCorsHeaders } from '../_shared/cors.ts';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMS = 1536;
const DEBOUNCE_SECONDS = 8;

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

interface DishRow {
  id: string;
  restaurant_id: string;
  name: string;
  description: string | null;
  enrichment_status: string;
  updated_at: string;
  primary_protein: string | null;
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
  optionGroups: OptionGroupData[];
  cuisineTypes: string[];
  primaryProtein: string | null;
}): string {
  const { name, description, optionGroups, cuisineTypes, primaryProtein } = params;

  const parts: string[] = [];

  parts.push(name);

  if (cuisineTypes.length > 0) {
    parts.push(cuisineTypes.join(', '));
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

  return parts.join('. ');
}

Deno.serve(async (req: Request) => {
  const corsHeaders = buildCorsHeaders(req.headers.get('Origin'));
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
        'id, restaurant_id, name, description, enrichment_status, updated_at, primary_protein'
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

    const ageSeconds = (Date.now() - new Date(dish.updated_at).getTime()) / 1000;
    if (dish.enrichment_status === 'completed' && ageSeconds < DEBOUNCE_SECONDS) {
      console.log(`[enrich-dish] Already completed ${ageSeconds.toFixed(1)}s ago — skipping`);
      return new Response(JSON.stringify({ skipped: true, reason: 'recently_completed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const [{ data: optionGroupRows }, { data: restaurantRow }] = await Promise.all([
      supabase
        .from('option_groups')
        .select('name, options(name)')
        .eq('dish_id', dishId)
        .eq('is_active', true),
      supabase.from('restaurants').select('cuisine_types').eq('id', dish.restaurant_id).single(),
    ]);

    const optionGroups: OptionGroupData[] = (optionGroupRows ?? []).map((g: any) => ({
      groupName: g.name,
      optionNames: (g.options ?? []).map((o: any) => o.name).filter(Boolean),
    }));

    const cuisineTypes: string[] = (restaurantRow?.cuisine_types as string[]) ?? [];

    const embeddingInput = buildEmbeddingInput({
      name: dish.name,
      description: dish.description,
      optionGroups,
      cuisineTypes,
      primaryProtein: dish.primary_protein,
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
