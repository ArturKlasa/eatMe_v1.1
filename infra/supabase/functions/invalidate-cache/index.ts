// invalidate-cache — Supabase DB webhook handler
//
// Invoked by Supabase webhooks on UPDATE events for restaurants, menus, and dishes.
// Deletes relevant Redis cache keys to prevent stale feed responses.
//
// Webhook payload shape (Supabase DB webhook):
// {
//   type: 'UPDATE',
//   table: 'restaurants' | 'menus' | 'dishes',
//   schema: 'public',
//   record: { id: string, restaurant_id?: string, ... },
//   old_record: { ... }
// }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Redis } from 'https://esm.sh/@upstash/redis@latest';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getRedis(): Redis | null {
  const url = Deno.env.get('UPSTASH_REDIS_REST_URL');
  const token = Deno.env.get('UPSTASH_REDIS_REST_TOKEN');
  if (!url || !token) return null;
  return new Redis({ url, token });
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    const table: string = body.table ?? '';
    const record: Record<string, any> = body.record ?? {};

    const redis = getRedis();
    if (!redis) {
      console.warn('[invalidate-cache] Redis not configured — skipping invalidation');
      return new Response(JSON.stringify({ skipped: true, reason: 'redis_not_configured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let restaurantId: string | null = null;

    if (table === 'restaurants') {
      // Direct restaurant update
      restaurantId = record.id;
    } else if (table === 'menus') {
      // Menu update — restaurant_id is a direct column
      restaurantId = record.restaurant_id ?? null;
    } else if (table === 'dishes') {
      // Dish update — resolve restaurant_id via menu_category → menu
      const dishId: string = record.id;
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data } = await supabase
        .from('dishes')
        .select('menu_category:menu_categories(menu:menus(restaurant_id))')
        .eq('id', dishId)
        .single();

      restaurantId = (data as any)?.menu_category?.menu?.restaurant_id ?? null;
    } else {
      console.warn('[invalidate-cache] Unknown table:', table);
      return new Response(JSON.stringify({ skipped: true, reason: 'unknown_table', table }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!restaurantId) {
      console.warn('[invalidate-cache] Could not resolve restaurantId for', { table, record });
      return new Response(JSON.stringify({ skipped: true, reason: 'restaurant_id_not_resolved' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Delete known Redis key patterns for this restaurant.
    // NOTE: The feed/index.ts function does not yet write Redis keys — Redis caching
    // in the feed is planned but not yet implemented. These key patterns are the
    // anticipated names for restaurant-level cache entries once it is. Redis DEL
    // on non-existent keys is a no-op (returns 0), so this is safe to run now.
    // When Redis caching is added to the feed, the keys written there MUST match
    // these patterns exactly.
    const keysToDelete = [`restaurant:${restaurantId}`, `restaurant:cuisines:${restaurantId}`];

    await Promise.all(keysToDelete.map(key => redis.del(key)));

    console.log('[invalidate-cache] Deleted keys:', keysToDelete, 'for', { table, restaurantId });

    return new Response(JSON.stringify({ deleted: keysToDelete, restaurantId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[invalidate-cache] Error:', error);
    return new Response(JSON.stringify({ error: error?.message ?? 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
