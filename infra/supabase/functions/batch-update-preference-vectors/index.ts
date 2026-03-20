// batch-update-preference-vectors/index.ts
// Phase 6: Behaviour Profile Pipeline — daily batch fallback
//
// Called by a pg_cron job once per day (migration 058).
// Recomputes preference vectors for all users whose:
//   - preference_vector_updated_at is older than 24 hours (or NULL), AND
//   - they have at least one interaction newer than preference_vector_updated_at
//
// This ensures no user is permanently stuck on a stale vector even if the
// real-time trigger (update-preference-vector) was skipped (e.g. device offline).
//
// The function calls update-preference-vector for each eligible user sequentially
// with a small delay to avoid hammering the DB with parallel vector computations.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const UPDATE_VECTOR_URL = `${SUPABASE_URL}/functions/v1/update-preference-vector`;

// Max users to process per run — prevents runaway execution on large datasets.
const BATCH_LIMIT = 200;

// Delay between calls (ms) to avoid overwhelming the vector function.
const CALL_DELAY_MS = 200;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Accept requests from pg_cron (no auth header) or internal callers.
  // In production, restrict this via network policy — not exposed publicly.

  try {
    console.log('[BatchPrefVector] Starting batch run');

    // Find users with stale or missing preference vectors who have recent interactions.
    const { data: staleUsers, error } = await supabase.rpc('get_users_needing_vector_update', {
      p_limit: BATCH_LIMIT,
    });

    if (error) throw error;

    if (!staleUsers || staleUsers.length === 0) {
      console.log('[BatchPrefVector] No users need updating');
      return new Response(JSON.stringify({ ok: true, processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[BatchPrefVector] Processing ${staleUsers.length} users`);

    let processed = 0;
    let skipped = 0;
    let errors = 0;

    for (const row of staleUsers) {
      try {
        const res = await fetch(UPDATE_VECTOR_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: ANON_KEY,
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({ user_id: row.user_id }),
        });

        if (!res.ok) {
          console.error(`[BatchPrefVector] Failed for ${row.user_id}: ${res.status}`);
          errors++;
        } else {
          const body = await res.json();
          if (body.skipped) skipped++;
          else processed++;
        }
      } catch (e: any) {
        console.error(`[BatchPrefVector] Error for ${row.user_id}:`, e?.message);
        errors++;
      }

      await sleep(CALL_DELAY_MS);
    }

    console.log(
      `[BatchPrefVector] Done — processed: ${processed}, skipped: ${skipped}, errors: ${errors}`
    );

    return new Response(
      JSON.stringify({ ok: true, processed, skipped, errors, total: staleUsers.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[BatchPrefVector] Fatal error:', error);
    return new Response(JSON.stringify({ error: error?.message ?? 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
