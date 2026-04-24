/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Release-safety Test B: Published-data parity across all consumer endpoints.
 *
 * Snapshots consumer endpoint responses against fixtures/parity-baseline.json.
 * Runs pre-Phase-4 (migrations 116a–122 applied, every row still 'published')
 * and post-Phase-4 — diff must be empty modulo non-deterministic fields.
 *
 * Run:
 *   SUPABASE_STAGING_URL=https://... \
 *   SUPABASE_STAGING_SERVICE_KEY=... \
 *   SUPABASE_STAGING_ANON_KEY=... \
 *   SUPABASE_STAGING_FUNCTIONS_URL=https://.../functions/v1 \
 *   TEST_LAT=52.2 TEST_LNG=21.0 \
 *   [UPDATE_BASELINE=1] \
 *   vitest run tests/integration/consumer-endpoints-published-parity.test.ts
 *
 * Set UPDATE_BASELINE=1 on first run (or after intentional baseline refresh) to
 * regenerate fixtures/parity-baseline.json from the live staging snapshot.
 */

import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const STAGING_URL = process.env.SUPABASE_STAGING_URL ?? '';
const ANON_KEY = process.env.SUPABASE_STAGING_ANON_KEY ?? '';
const FUNCTIONS_URL = process.env.SUPABASE_STAGING_FUNCTIONS_URL ?? '';
const UPDATE_BASELINE = process.env.UPDATE_BASELINE === '1';

const isIntegration = Boolean(STAGING_URL && ANON_KEY && FUNCTIONS_URL);
const describeIntegration = isIntegration ? describe : describe.skip;

const LAT = parseFloat(process.env.TEST_LAT ?? '52.2297');
const LNG = parseFloat(process.env.TEST_LNG ?? '21.0122');
const RADIUS_M = 50_000;

const BASELINE_PATH = join(__dirname, 'fixtures/parity-baseline.json');

// Fields that legitimately vary between runs (order-breaking ties, floating-point
// distance calculations) — strip before diffing.
function normalise(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(normalise);
  if (obj && typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === 'distance_m' || k === 'distance_km' || k === 'processingTime') continue;
      out[k] = normalise(v);
    }
    // Canonicalise arrays of objects by sorting on 'id' so order doesn't matter
    for (const [k, v] of Object.entries(out)) {
      if (
        Array.isArray(v) &&
        v.length > 0 &&
        typeof v[0] === 'object' &&
        v[0] !== null &&
        'id' in v[0]
      ) {
        out[k] = [...v].sort((a: any, b: any) => (a.id < b.id ? -1 : 1));
      }
    }
    return out;
  }
  return obj;
}

async function fetchNearbyRestaurants() {
  const res = await fetch(`${FUNCTIONS_URL}/nearby-restaurants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ANON_KEY}` },
    body: JSON.stringify({ latitude: LAT, longitude: LNG, radiusKm: RADIUS_M / 1000, limit: 20 }),
  });
  return res.json();
}

async function fetchFeed() {
  const res = await fetch(`${FUNCTIONS_URL}/feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ANON_KEY}` },
    body: JSON.stringify({
      location: { lat: LAT, lng: LNG },
      radius: RADIUS_M / 1000,
      mode: 'combined',
      filters: {},
      limit: 20,
    }),
  });
  return res.json();
}

async function fetchGroupCandidates() {
  const anon = createClient(STAGING_URL, ANON_KEY);
  const { data } = await anon.rpc('get_group_candidates', {
    p_lat: LAT,
    p_lng: LNG,
    p_radius_m: RADIUS_M,
    p_limit: 20,
  });
  return data;
}

async function fetchCandidates() {
  const anon = createClient(STAGING_URL, ANON_KEY);
  const { data } = await anon.rpc('generate_candidates', {
    p_lat: LAT,
    p_lng: LNG,
    p_radius_m: RADIUS_M,
    p_limit: 20,
  });
  return data;
}

describeIntegration('published-data parity across consumer endpoints', () => {
  it('snapshots match baseline (or writes baseline when UPDATE_BASELINE=1)', async () => {
    const [nearbyRaw, feedRaw, groupRaw, candidatesRaw] = await Promise.all([
      fetchNearbyRestaurants(),
      fetchFeed(),
      fetchGroupCandidates(),
      fetchCandidates(),
    ]);

    const snapshot = {
      nearby_restaurants: normalise(nearbyRaw),
      feed: normalise(feedRaw),
      group_candidates: normalise(groupRaw),
      candidates: normalise(candidatesRaw),
    };

    if (UPDATE_BASELINE) {
      writeFileSync(BASELINE_PATH, JSON.stringify(snapshot, null, 2));
      console.log('[parity] Baseline written to', BASELINE_PATH);
      expect(true).toBe(true);
      return;
    }

    let baseline: typeof snapshot;
    try {
      baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf-8'));
    } catch {
      throw new Error(
        'parity-baseline.json not found or unreadable. Run with UPDATE_BASELINE=1 to generate it.'
      );
    }

    expect(JSON.stringify(snapshot, null, 2)).toBe(JSON.stringify(baseline, null, 2));
  });

  it('negative control: baseline contains at least one restaurant id (non-vacuous)', () => {
    let baseline: any;
    try {
      baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf-8'));
    } catch {
      // Baseline not yet written — this check is vacuously skipped.
      expect(true).toBe(true);
      return;
    }

    const nearbyRids: string[] = (baseline.nearby_restaurants?.restaurants ?? []).map(
      (r: any) => r.id
    );
    const candidateRids: string[] = Array.from(
      new Set<string>((baseline.candidates ?? []).map((d: any) => d.restaurant_id as string))
    );
    const allIds = [...nearbyRids, ...candidateRids];

    expect(allIds.length).toBeGreaterThan(0);
  });
});
