/**
 * interactionService.ts
 *
 * Phase 6 — Behaviour Profile Pipeline
 *
 * Single entry point for recording dish interactions and triggering
 * preference vector recomputation. All writes go through here so
 * callers never need to know about debouncing or the Edge Function URL.
 *
 * Usage:
 *   await recordInteraction(userId, dishId, 'liked', sessionId);
 */

import { supabase } from '../lib/supabase';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
const UPDATE_VECTOR_URL = `${SUPABASE_URL}/functions/v1/update-preference-vector`;

export type InteractionType = 'viewed' | 'liked' | 'disliked' | 'saved';

/**
 * Records a dish interaction and asynchronously triggers preference vector
 * recomputation. Duplicate interactions for the same user+dish+type on the
 * same day are silently ignored (DB unique index 057).
 *
 * Fire-and-forget for the vector update — never awaited by callers.
 */
export async function recordInteraction(
  userId: string,
  dishId: string,
  interactionType: InteractionType,
  sessionId?: string
): Promise<void> {
  if (!userId || userId === 'anonymous') return;

  // 1. Write the interaction row (non-fatal on duplicate)
  const { error } = await supabase.from('user_dish_interactions').insert({
    user_id: userId,
    dish_id: dishId,
    interaction_type: interactionType,
    session_id: sessionId ?? null,
  });

  if (error) {
    // 23505 = unique_violation → duplicate on same day, silently ignore
    if (error.code !== '23505') {
      console.error('[Interaction] Insert failed:', error.message);
    }
    return;
  }

  // 2. Trigger preference vector recomputation (fire-and-forget, debounced server-side)
  triggerVectorUpdate(userId);
}

/**
 * Fires the update-preference-vector Edge Function without blocking the caller.
 * The Edge Function handles its own 5-minute debounce.
 */
function triggerVectorUpdate(userId: string): void {
  fetch(UPDATE_VECTOR_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ user_id: userId }),
  }).catch(err => {
    // Non-fatal — feed still works without an up-to-date vector
    console.warn('[Interaction] Vector update trigger failed (non-fatal):', err?.message);
  });
}
