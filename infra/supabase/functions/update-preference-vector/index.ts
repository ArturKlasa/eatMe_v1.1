// update-preference-vector/index.ts
// Phase 6: Behaviour Profile Pipeline
//
// Computes and stores the user's preference_vector from their interaction history.
//
// Input (POST body):
//   { user_id: string }
//
// Algorithm:
//   1. Load all user_dish_interactions for this user
//   2. Load dish embeddings for interacted dishes
//   3. Compute time-decayed weighted average:
//        weight = base_weight × e^(-0.01 × days_since_interaction)
//        base weights: saved=3.0, liked=1.5, viewed=0.5, disliked=-1.0
//   4. Normalise to unit vector (cosine space)
//   5. Write back to user_behavior_profiles + compute aggregate fields
//
// Debounce: skips recomputation if preference_vector_updated_at < 5 minutes ago
//           (avoids thrashing on rapid interactions)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// ── Interaction weights ───────────────────────────────────────────────────────

const INTERACTION_WEIGHT: Record<string, number> = {
  saved: 3.0,
  liked: 1.5,
  viewed: 0.5,
  ordered: 2.0,
  // 'disliked' is deliberately absent:
  // disliking a dish at one restaurant reflects execution quality, not category
  // preference. Disliked dishes are excluded from the feed via generate_candidates
  // but do not pull the preference vector in any direction.
};

const DEBOUNCE_MINUTES = 5;
const DIMS = 1536;

// ── Vector helpers ────────────────────────────────────────────────────────────

function addWeighted(acc: Float64Array, vec: number[], weight: number): void {
  for (let i = 0; i < DIMS; i++) acc[i] += vec[i] * weight;
}

function normalise(vec: Float64Array): number[] {
  let mag = 0;
  for (let i = 0; i < DIMS; i++) mag += vec[i] * vec[i];
  mag = Math.sqrt(mag);
  if (mag === 0) return Array(DIMS).fill(0);
  const out: number[] = new Array(DIMS);
  for (let i = 0; i < DIMS; i++) out[i] = vec[i] / mag;
  return out;
}

function timeDekay(createdAt: string): number {
  const days = (Date.now() - new Date(createdAt).getTime()) / 86_400_000;
  return Math.exp(-0.01 * days);
}

// ── Main handler ─────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { user_id } = (await req.json()) as { user_id: string };

    if (!user_id) {
      return new Response(JSON.stringify({ error: 'user_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Debounce check ────────────────────────────────────────────────────────

    const { data: profile } = await supabase
      .from('user_behavior_profiles')
      .select('preference_vector_updated_at')
      .eq('user_id', user_id)
      .maybeSingle();

    if (profile?.preference_vector_updated_at) {
      const age = (Date.now() - new Date(profile.preference_vector_updated_at).getTime()) / 60_000;
      if (age < DEBOUNCE_MINUTES) {
        console.log(`[PrefVector] Debounced for ${user_id} (updated ${age.toFixed(1)}m ago)`);
        return new Response(
          JSON.stringify({
            skipped: true,
            reason: 'debounce',
            updated_at: profile.preference_vector_updated_at,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ── Load interactions ─────────────────────────────────────────────────────

    const { data: interactions, error: intErr } = await supabase
      .from('user_dish_interactions')
      .select('dish_id, interaction_type, created_at')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })
      .limit(500); // cap to last 500 interactions

    if (intErr) throw intErr;

    if (!interactions || interactions.length === 0) {
      return new Response(JSON.stringify({ skipped: true, reason: 'no_interactions' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[PrefVector] ${interactions.length} interactions for ${user_id}`);

    // Collect unique dish IDs (only positive signal types need embeddings)
    const dishIds = [
      ...new Set(
        interactions
          .filter(i => INTERACTION_WEIGHT[i.interaction_type] !== undefined)
          .map(i => i.dish_id)
      ),
    ];

    // ── Load dish embeddings + restaurant info ────────────────────────────────

    const { data: dishes, error: dishErr } = await supabase
      .from('dishes')
      .select('id, embedding, price, restaurant:restaurants(cuisine_types)')
      .in('id', dishIds)
      .not('embedding', 'is', null);

    if (dishErr) throw dishErr;

    const dishMap = new Map<
      string,
      { embedding: number[]; price: number | null; cuisines: string[] }
    >();
    for (const d of dishes ?? []) {
      const raw = d.embedding;
      const vec: number[] = typeof raw === 'string' ? JSON.parse(raw) : raw;
      dishMap.set(d.id, {
        embedding: vec,
        price: d.price ?? null,
        cuisines: (d.restaurant as any)?.cuisine_types ?? [],
      });
    }

    if (dishMap.size === 0) {
      return new Response(JSON.stringify({ skipped: true, reason: 'no_embeddings' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Compute weighted average ──────────────────────────────────────────────

    const acc = new Float64Array(DIMS);
    let totalWeight = 0;

    // Cuisine frequency and price collection (for aggregate fields)
    const cuisineCount: Record<string, number> = {};
    const likedPrices: number[] = [];

    for (const interaction of interactions) {
      const baseWeight = INTERACTION_WEIGHT[interaction.interaction_type];
      if (baseWeight === undefined) continue;

      const dish = dishMap.get(interaction.dish_id);
      if (!dish) continue;

      const decay = timeDekay(interaction.created_at);
      const weight = baseWeight * decay;

      if (weight > 0) {
        addWeighted(acc, dish.embedding, weight);
        totalWeight += weight;

        // Aggregate fields: only positive interactions
        for (const c of dish.cuisines) {
          cuisineCount[c] = (cuisineCount[c] ?? 0) + weight;
        }
        if (
          dish.price !== null &&
          (interaction.interaction_type === 'liked' || interaction.interaction_type === 'saved')
        ) {
          likedPrices.push(dish.price);
        }
      } else if (weight < 0) {
        // Disliked: subtract
        addWeighted(acc, dish.embedding, weight);
        // Don't add to totalWeight for normalisation (negative contributions)
      }
    }

    if (totalWeight === 0) {
      return new Response(JSON.stringify({ skipped: true, reason: 'zero_weight' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Normalise
    const preferenceVector = normalise(acc);

    // ── Compute aggregate fields ──────────────────────────────────────────────

    // preferred_cuisines: top 5 by weighted frequency
    const preferredCuisines = Object.entries(cuisineCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([c]) => c);

    // preferred_price_range: [median - 0.5 std, median + 0.5 std]
    let preferredPriceRange: number[] | null = null;
    if (likedPrices.length >= 3) {
      const sorted = [...likedPrices].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      const mean = sorted.reduce((s, p) => s + p, 0) / sorted.length;
      const std = Math.sqrt(sorted.reduce((s, p) => s + (p - mean) ** 2, 0) / sorted.length);
      preferredPriceRange = [Math.max(0, median - std * 0.5), median + std * 0.5];
    }

    const interactionRate = interactions.length;

    // ── Upsert user_behavior_profiles ────────────────────────────────────────

    const { error: upsertErr } = await supabase.from('user_behavior_profiles').upsert(
      {
        user_id,
        preference_vector: JSON.stringify(preferenceVector),
        preference_vector_updated_at: new Date().toISOString(),
        preferred_cuisines: preferredCuisines,
        ...(preferredPriceRange && { preferred_price_range: preferredPriceRange }),
        last_active_at: new Date().toISOString(),
        profile_updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

    if (upsertErr) throw upsertErr;

    console.log(
      `[PrefVector] Updated for ${user_id}: ${dishMap.size} dishes, ${preferredCuisines.length} cuisines`
    );

    return new Response(
      JSON.stringify({
        ok: true,
        dishes_used: dishMap.size,
        total_interactions: interactions.length,
        preferred_cuisines: preferredCuisines,
        preferred_price_range: preferredPriceRange,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[PrefVector] Error:', error);
    return new Response(JSON.stringify({ error: error?.message ?? 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
