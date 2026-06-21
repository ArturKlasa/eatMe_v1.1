// invalidate-cache — Supabase DB webhook handler
//
// Invoked by the tracked migration-176 trigger (and/or a dashboard webhook) on
// INSERT, UPDATE, and DELETE events for restaurants, menus, and dishes.
// Deletes relevant Redis cache keys to prevent stale feed responses.
//
// Webhook payload shape (Supabase DB webhook):
// {
//   type: 'INSERT' | 'UPDATE' | 'DELETE',
//   table: 'restaurants' | 'menus' | 'dishes',
//   schema: 'public',
//   record: { id: string, restaurant_id?: string, ... } | null,   // null on DELETE
//   old_record: { ... } | null                                     // null on INSERT
// }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { Redis } from 'https://esm.sh/@upstash/redis@1.38.0';
import { buildCorsHeaders } from '../_shared/cors.ts';

function getRedis(): Redis | null {
  const url = Deno.env.get('UPSTASH_REDIS_REST_URL');
  const token = Deno.env.get('UPSTASH_REDIS_REST_TOKEN');
  if (!url || !token) return null;
  return new Redis({ url, token });
}

/**
 * Delete every key matching a glob via SCAN (cursor-paged, non-blocking).
 * Returns the number of keys deleted. Safe on an empty namespace (returns 0).
 */
async function deleteByPattern(redis: Redis, pattern: string): Promise<number> {
  let cursor = '0';
  let deleted = 0;
  do {
    const [next, keys] = await redis.scan(cursor, { match: pattern, count: 200 });
    cursor = String(next);
    if (keys.length > 0) {
      await redis.del(...keys);
      deleted += keys.length;
    }
  } while (cursor !== '0');
  return deleted;
}

Deno.serve(async (req: Request) => {
  const corsHeaders = buildCorsHeaders(req.headers.get('Origin'));
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    const table: string = body.table ?? '';
    // DELETE webhooks carry the changed row in `old_record` (record is null), so
    // fall back to old_record for the best-effort per-restaurant key resolution.
    const record: Record<string, any> = body.record ?? body.old_record ?? {};

    const redis = getRedis();
    if (!redis) {
      console.warn('[invalidate-cache] Redis not configured — skipping invalidation');
      return new Response(JSON.stringify({ skipped: true, reason: 'redis_not_configured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Only restaurants / menus / dishes affect feed output.
    if (table !== 'restaurants' && table !== 'menus' && table !== 'dishes') {
      console.warn('[invalidate-cache] Unknown table:', table);
      return new Response(JSON.stringify({ skipped: true, reason: 'unknown_table', table }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Flush-all is a DELIBERATE choice (D-08), not the "never flush-all" SC#4 anti-pattern:
    // the feed cache key is feed:v2:{user}:{geo}:{filters} — restaurant-agnostic (no
    // restaurant_id to target), so a single restaurant's edit can't be scoped to specific
    // keys. Writes here are operator-rare (one operator editing menus), the 5-min TTL bounds
    // worst-case staleness, and entries recompute lazily on the next feed request. This
    // flush runs unconditionally for every event type (INSERT/UPDATE/DELETE) — it is the
    // correctness guarantee; the per-restaurant block below is purely best-effort.
    const feedKeysDeleted = await deleteByPattern(redis, 'feed:v2:*');

    // Best-effort: also clear any per-restaurant keys (legacy / other cache paths).
    let restaurantId: string | null = null;
    if (table === 'restaurants') {
      restaurantId = record.id ?? null;
    } else if (table === 'menus') {
      restaurantId = record.restaurant_id ?? null;
    } else {
      // dishes — resolve restaurant_id via menu_category → menu
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );
      const { data } = await supabase
        .from('dishes')
        .select('menu_category:menu_categories(menu:menus(restaurant_id))')
        .eq('id', record.id)
        .single();
      restaurantId = (data as any)?.menu_category?.menu?.restaurant_id ?? null;
    }

    const restaurantKeys = restaurantId
      ? [`restaurant:${restaurantId}`, `restaurant:cuisines:${restaurantId}`]
      : [];
    if (restaurantKeys.length > 0) {
      await Promise.all(restaurantKeys.map(k => redis.del(k)));
    }

    console.log('[invalidate-cache] Cleared', {
      table,
      restaurantId,
      feedKeysDeleted,
      restaurantKeys,
    });

    return new Response(JSON.stringify({ feedKeysDeleted, restaurantKeys, restaurantId, table }), {
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
