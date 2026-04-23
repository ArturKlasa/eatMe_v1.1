/**
 * Release-safety Test A: Drafts are never visible to consumers.
 *
 * Requires a staging Supabase with migrations 116a–122 applied and
 * Edge Function patches from Step 11 deployed.
 *
 * Run:
 *   SUPABASE_STAGING_URL=https://... \
 *   SUPABASE_STAGING_SERVICE_KEY=... \
 *   SUPABASE_STAGING_ANON_KEY=... \
 *   SUPABASE_STAGING_FUNCTIONS_URL=https://.../functions/v1 \
 *   TEST_LAT=52.2 TEST_LNG=21.0 \
 *   vitest run tests/integration/consumer-endpoints-hide-drafts.test.ts
 */

import { describe, it, expect, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const STAGING_URL = process.env.SUPABASE_STAGING_URL ?? 'http://127.0.0.1:54321';
const SERVICE_KEY = process.env.SUPABASE_STAGING_SERVICE_KEY ?? 'placeholder';
const ANON_KEY = process.env.SUPABASE_STAGING_ANON_KEY ?? 'placeholder';
const FUNCTIONS_URL = process.env.SUPABASE_STAGING_FUNCTIONS_URL ?? '';

const isIntegration = Boolean(STAGING_URL && SERVICE_KEY && ANON_KEY && FUNCTIONS_URL);
const describeIntegration = isIntegration ? describe : describe.skip;

const LAT = parseFloat(process.env.TEST_LAT ?? '52.2297');
const LNG = parseFloat(process.env.TEST_LNG ?? '21.0122');
const RADIUS_M = 50_000;

// Seed UUIDs — stable across test run so cleanup is idempotent
const DRAFT_OWNER_ID = '00000000-0000-0000-0000-000000000099';

describeIntegration('drafts are never visible to consumers', () => {
  const service = createClient(STAGING_URL, SERVICE_KEY);
  const anon = createClient(STAGING_URL, ANON_KEY);

  let draftRestaurantId: string;
  let draftMenuId: string;
  let draftDishId: string;

  // ── Setup ──────────────────────────────────────────────────────────────────

  it('setup: seed a draft restaurant + menu + dish', async () => {
    const { data: r, error: re } = await service
      .from('restaurants')
      .insert({
        name: '__release_safety_draft_restaurant__',
        status: 'draft',
        is_active: true,
        owner_id: DRAFT_OWNER_ID,
        location_point: `SRID=4326;POINT(${LNG} ${LAT})`,
        cuisine_types: ['test'],
      })
      .select('id')
      .single();
    expect(re).toBeNull();
    draftRestaurantId = r!.id;

    const { data: m, error: me } = await service
      .from('menus')
      .insert({
        restaurant_id: draftRestaurantId,
        name: '__draft_menu__',
        status: 'draft',
        menu_type: 'food',
      })
      .select('id')
      .single();
    expect(me).toBeNull();
    draftMenuId = m!.id;

    const { data: mc } = await service
      .from('menu_categories')
      .insert({ menu_id: draftMenuId, name: 'Test Category' })
      .select('id')
      .single();

    const { data: d, error: de } = await service
      .from('dishes')
      .insert({
        restaurant_id: draftRestaurantId,
        menu_category_id: mc!.id,
        name: '__draft_dish__',
        status: 'draft',
        is_available: true,
        price: 10,
        dish_kind: 'standard',
        primary_protein: 'other',
        allergens: [],
        dietary_tags: [],
      })
      .select('id')
      .single();
    expect(de).toBeNull();
    draftDishId = d!.id;
  });

  // ── Negative controls: draft is invisible ──────────────────────────────────

  it('nearby-restaurants Edge Function: draft restaurant is absent', async () => {
    const res = await fetch(`${FUNCTIONS_URL}/nearby-restaurants`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify({ latitude: LAT, longitude: LNG, radiusKm: RADIUS_M / 1000 }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    const ids = (body.restaurants ?? []).map((r: any) => r.id);
    expect(ids).not.toContain(draftRestaurantId);
  });

  it('feed Edge Function: draft dish is absent', async () => {
    const res = await fetch(`${FUNCTIONS_URL}/feed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify({
        location: { lat: LAT, lng: LNG },
        radius: RADIUS_M / 1000,
        mode: 'combined',
        filters: {},
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    const dishIds = (body.dishes ?? []).map((d: any) => d.id);
    const restIds = (body.restaurants ?? []).map((r: any) => r.id);
    expect(dishIds).not.toContain(draftDishId);
    expect(restIds).not.toContain(draftRestaurantId);
  });

  it('generate_candidates RPC: draft dish is absent', async () => {
    const { data, error } = await anon.rpc('generate_candidates', {
      p_lat: LAT,
      p_lng: LNG,
      p_radius_m: RADIUS_M,
    });
    expect(error).toBeNull();
    const ids = (data ?? []).map((d: any) => d.id);
    expect(ids).not.toContain(draftDishId);
  });

  it('get_group_candidates RPC: draft restaurant is absent', async () => {
    const { data, error } = await anon.rpc('get_group_candidates', {
      p_lat: LAT,
      p_lng: LNG,
      p_radius_m: RADIUS_M,
    });
    expect(error).toBeNull();
    const ids = (data ?? []).map((r: any) => r.id);
    expect(ids).not.toContain(draftRestaurantId);
  });

  it('direct restaurants table query: anon cannot read draft row', async () => {
    const { data } = await anon.from('restaurants').select('id').eq('id', draftRestaurantId);
    // RLS should hide the draft row from anon
    expect((data ?? []).length).toBe(0);
  });

  // ── Positive control: published row becomes visible ────────────────────────

  it('positive control: flipping to published makes row visible in generate_candidates', async () => {
    await service.from('restaurants').update({ status: 'published' }).eq('id', draftRestaurantId);
    await service.from('menus').update({ status: 'published' }).eq('id', draftMenuId);
    await service.from('dishes').update({ status: 'published' }).eq('id', draftDishId);

    const { data, error } = await anon.rpc('generate_candidates', {
      p_lat: LAT,
      p_lng: LNG,
      p_radius_m: RADIUS_M,
    });
    expect(error).toBeNull();
    const ids = (data ?? []).map((d: any) => d.id);
    expect(ids).toContain(draftDishId);
  });

  // ── Cleanup ────────────────────────────────────────────────────────────────

  afterAll(async () => {
    if (draftRestaurantId) {
      await service.from('restaurants').delete().eq('id', draftRestaurantId);
    }
  });
});
