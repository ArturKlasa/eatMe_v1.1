#!/usr/bin/env ts-node
/**
 * diagnose-s3-open-hours.ts — READ-ONLY (no writes).
 *
 * Pinpoints the "no dishes on the map" regression after §S3. Checks, against live prod:
 *   1. restaurants table: do rows actually carry open_hours / timezone / country_code?
 *   2. generate_candidates RPC: does it RETURN open_hours/timezone/country_code on each row?
 *      (If the migration-167 columns are absent here, the feed reads undefined → every dish
 *       is treated as closed → empty dish list.)
 *   3. feed edge function: dishes vs restaurants count + how many restaurants report is_open.
 *      The smoking gun for this bug = restaurants > 0 but dishes = 0 and is_open = 0.
 *
 * Hits live prod via infra/scripts/.env service-role creds. Run from infra/scripts/.
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = createClient(SUPABASE_URL, SERVICE_ROLE) as any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function cnt(table: string, filter?: (q: any) => any): Promise<string> {
  let q = sb.from(table).select('id', { count: 'exact', head: true });
  if (filter) q = filter(q);
  const { count: c, error } = await q;
  return error ? `ERR(${error.message.slice(0, 20)})` : String(c);
}

(async () => {
  console.log('── diagnose-s3-open-hours (READ-ONLY) ──\n');

  // 1) Does the underlying data carry open_hours/timezone? Get a REAL location.
  console.log('1) restaurants table sample (published):');
  const { data: rs, error: rErr } = await sb
    .from('restaurants')
    .select('id, name, location, open_hours, timezone, country_code')
    .eq('status', 'published')
    .limit(3);
  if (rErr) console.log(`   ERROR: ${rErr.message}`);
  for (const r of rs ?? []) {
    const oh = r.open_hours ? `present(${Object.keys(r.open_hours).join(',')})` : 'NULL';
    console.log(`   ${r.name}: tz=${r.timezone}  cc=${r.country_code}  open_hours=${oh}`);
  }
  const r0 = rs?.[0];
  // location is GeoJSON { type:'Point', coordinates:[lng,lat] } or a POINT string.
  let lng = -99.1332;
  let lat = 19.4326; // CDMX fallback
  const loc = r0?.location;
  if (loc && typeof loc === 'object' && Array.isArray(loc.coordinates)) {
    lng = loc.coordinates[0];
    lat = loc.coordinates[1];
  } else if (typeof loc === 'string') {
    const m = loc.match(/POINT\(([^ ]+) ([^ ]+)\)/);
    if (m) {
      lng = parseFloat(m[1]);
      lat = parseFloat(m[2]);
    }
  }
  console.log(`   using location: lat=${lat} lng=${lng} (from ${r0?.name ?? 'fallback'})`);

  console.log(
    `\n   counts: published dishes=${await cnt('dishes', (q: any) => q.eq('status', 'published'))}  published restaurants=${await cnt('restaurants', (q: any) => q.eq('status', 'published'))}  option_groups=${await cnt('option_groups')}  options=${await cnt('options')}`
  );

  // 2) Where does it time out — is the lever radius (scan size) or p_limit (select-list work)?
  console.log('\n2) generate_candidates RPC — timed across (radius, limit):');
  const combos: Array<[number, number]> = [
    [1000, 200],
    [3000, 200],
    [5000, 200],
    [5000, 40],
    [8000, 40],
  ];
  for (const [radiusM, lim] of combos) {
    const t0 = Date.now();
    const { data: cands, error: rpcErr } = await sb.rpc('generate_candidates', {
      p_lat: lat,
      p_lng: lng,
      p_radius_m: radiusM,
      p_preference_vector: null,
      p_disliked_dish_ids: null,
      p_diet_tag: null,
      p_exclude_families: null,
      p_exclude_spicy: false,
      p_limit: lim,
      p_current_time: null,
      p_current_day: null,
      p_schedule_type: null,
      p_group_meals: false,
    });
    const ms = Date.now() - t0;
    if (rpcErr) {
      console.log(
        `   r=${radiusM / 1000}km limit=${lim}: ❌ ${rpcErr.message.slice(0, 40)} [${ms}ms]`
      );
    } else {
      console.log(
        `   r=${radiusM / 1000}km limit=${lim}: ✅ ${cands?.length ?? 0} candidates [${ms}ms]`
      );
      if (cands?.length && radiusM === 1000) {
        const c = cands[0];
        console.log(
          `      open_hours key=${'open_hours' in c} value=${c.open_hours ? 'present' : c.open_hours} tz=${c.timezone}`
        );
      }
    }
  }

  // 3) feed edge function — dishes vs restaurants (the real endpoint the app calls)
  console.log('\n3) feed edge function (mode=combined):');
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
        radius: 5,
        mode: 'combined',
        filters: {},
        limit: 20,
      }),
    });
    const txt = await resp.text();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let p: any = null;
    try {
      p = JSON.parse(txt);
    } catch {
      /* non-JSON */
    }
    console.log(`   HTTP ${resp.status} ${resp.statusText}`);
    if (resp.status !== 200) {
      console.log(`   error body: ${txt.slice(0, 500)}`);
    } else if (p) {
      const dishes = p.dishes?.length ?? 0;
      const rests = p.restaurants?.length ?? 0;
      const openRests = (p.restaurants ?? []).filter((x: any) => x.is_open).length;
      console.log(
        `   dishes=${dishes}   restaurants=${rests}   restaurants_with_is_open=${openRests}`
      );
      console.log(
        dishes === 0 && rests > 0
          ? '   → SIGNATURE MATCH: restaurants present but 0 dishes (open-now filter dropped them all)'
          : '   → dishes present (or no restaurants at all — different cause)'
      );
    } else {
      console.log(`   body (first 400): ${txt.slice(0, 400)}`);
    }
  } catch (e) {
    console.log(`   ❌ feed fetch threw: ${(e as Error).message}`);
  }
})();
