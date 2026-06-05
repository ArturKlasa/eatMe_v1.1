#!/usr/bin/env ts-node
/**
 * diagnose-no-dishes.ts — READ-ONLY (no writes).
 *
 * Figures out why the app shows no dishes. Checks, against live prod:
 *   1. raw dish / restaurant counts (is the data even there?)
 *   2. which recent migrations applied (schema probes via error-on-missing)
 *   3. the feed's generate_candidates RPC — does it error or return rows?
 *
 * Hits live prod via infra/scripts/.env service-role creds.
 *
 * Usage:
 *   pnpm --filter @eatme/infra-scripts exec ts-node diagnose-no-dishes.ts
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const supa = createClient(SUPABASE_URL, SERVICE_ROLE);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supa as any;

async function count(table: string, filter?: (q: any) => any): Promise<string> {
  let q = sb.from(table).select('id', { count: 'exact', head: true });
  if (filter) q = filter(q);
  const { count: c, error } = await q;
  return error ? `ERROR: ${error.message}` : String(c);
}

/** Probe a column/table: select it; report whether it still exists. */
async function probe(table: string, column: string): Promise<string> {
  const { error } = await sb.from(table).select(column).limit(1);
  if (!error) return 'EXISTS';
  if (/does not exist|could not find|schema cache/i.test(error.message)) return 'DROPPED';
  return `? (${error.message})`;
}

(async () => {
  console.log('── diagnose-no-dishes (READ-ONLY) ──\n');

  console.log('1) DATA COUNTS');
  console.log(`   restaurants total:              ${await count('restaurants')}`);
  console.log(`   dishes total:                   ${await count('dishes')}`);
  console.log(
    `   dishes published:               ${await count('dishes', q => q.eq('status', 'published'))}`
  );
  console.log(
    `   dishes published+available:     ${await count('dishes', q => q.eq('status', 'published').eq('is_available', true))}`
  );

  console.log('\n2) MIGRATION STATE (schema probes)');
  console.log(`   dishes.allergens (preserved):           ${await probe('dishes', 'allergens')}`);
  console.log(
    `   dishes.allergens_override (153 drops):  ${await probe('dishes', 'allergens_override')}`
  );
  console.log(
    `   dishes.dietary_tags_override (153):     ${await probe('dishes', 'dietary_tags_override')}`
  );
  console.log(
    `   options.canonical_ingredient_id (153):  ${await probe('options', 'canonical_ingredient_id')}`
  );
  console.log(
    `   table dish_ingredients (152 drops):     ${await probe('dish_ingredients', 'dish_id')}`
  );
  console.log(
    `   table canonical_ingredients (152):      ${await probe('canonical_ingredients', 'id')}`
  );

  console.log('\n3) feed RPC: generate_candidates');
  // Sample a real restaurant location so the geo filter has something to match.
  const { data: rsample } = await sb
    .from('restaurants')
    .select('id, name, location, lat, lng')
    .limit(1)
    .maybeSingle();
  console.log(`   sample restaurant: ${rsample ? `${rsample.name}` : '(none found)'}`);
  if (rsample)
    console.log(
      `   sample.location raw: ${JSON.stringify(rsample.location)}  lat=${rsample.lat} lng=${rsample.lng}`
    );

  // CDMX center fallback (all current data is CDMX per migration 149).
  const lat = rsample?.lat ?? 19.4326;
  const lng = rsample?.lng ?? -99.1332;

  const { data: candidates, error: rpcErr } = await sb.rpc('generate_candidates', {
    p_lat: lat,
    p_lng: lng,
    p_radius_m: 100000,
    p_preference_vector: null,
    p_disliked_dish_ids: null,
    p_allergens: null,
    p_diet_tag: null,
    p_religious_tags: null,
    p_exclude_families: null,
    p_exclude_spicy: false,
    p_limit: 200,
    p_current_time: null,
    p_current_day: null,
    p_schedule_type: null,
    p_group_meals: false,
  });

  if (rpcErr) {
    console.log(`   ❌ generate_candidates ERROR: ${rpcErr.message}`);
    console.log(`      code=${rpcErr.code} details=${rpcErr.details} hint=${rpcErr.hint}`);
  } else {
    console.log(
      `   ✅ generate_candidates returned ${candidates?.length ?? 0} candidates (lat=${lat}, lng=${lng}, r=100km)`
    );
    if (candidates?.length) {
      console.log(
        `      first: ${candidates[0].name ?? candidates[0].dish_name ?? '(unknown field)'} `
      );
    }
  }

  console.log('\n4) feed EDGE FUNCTION (the HTTP endpoint the app actually calls)');
  try {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/feed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
      },
      body: JSON.stringify({
        location: { lat, lng },
        radius: 100,
        mode: 'combined',
        filters: {},
        limit: 20,
      }),
    });
    const text = await resp.text();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* non-JSON body */
    }
    const dishCount = Array.isArray(parsed?.dishes)
      ? parsed.dishes.length
      : Array.isArray(parsed)
        ? parsed.length
        : Array.isArray(parsed?.data)
          ? parsed.data.length
          : null;
    console.log(`   HTTP ${resp.status} ${resp.statusText}`);
    if (dishCount !== null) {
      console.log(`   ${dishCount > 0 ? '✅' : '⚠️ '} feed returned ${dishCount} dishes`);
    } else {
      console.log(`   body (first 600 chars): ${text.slice(0, 600)}`);
    }
  } catch (e) {
    console.log(`   ❌ feed fetch threw: ${(e as Error).message}`);
  }
})();
