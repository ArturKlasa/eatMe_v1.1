// Integration tests for migration 144's admin_confirm_menu_scan RPC.
//
// These cover the transactional guarantees that the previous JS-side multi-pass
// insert flow couldn't make — specifically: any exception inside the RPC rolls
// back the entire batch, leaving no orphan dishes / option_groups / options.
//
// Fixtures live entirely in the local Supabase. Each test creates its own
// restaurant + scan job to isolate from siblings and from any data already
// loaded via prod schema dump. Cleanup runs in afterEach.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeLocalServiceClient } from './setup';

const supa = makeLocalServiceClient();

// Generate a unique restaurant slug per test run so concurrent runs (or stale
// fixtures from a crashed previous run) don't collide.
function uniqueTestId(): string {
  return `phase42-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

interface Fixture {
  adminId: string;
  restaurantId: string;
  jobId: string;
  testId: string;
}

async function createFixture(): Promise<Fixture> {
  const testId = uniqueTestId();

  // Service-role bypasses RLS — we can write straight to auth.users via the
  // admin sub-schema. The admin_audit_log FK requires admin_id to be a real
  // auth.users row.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: userData, error: userErr } = await (supa.auth as any).admin.createUser({
    email: `${testId}@test.local`,
    password: 'integration-test-only-not-secret',
    email_confirm: true,
    app_metadata: { role: 'admin' },
  });
  if (userErr) throw new Error(`createUser failed: ${userErr.message}`);
  const adminId = userData?.user?.id as string;

  // Minimum NOT-NULL columns for restaurants. location_point is computed via
  // GENERATED ALWAYS from address geocoding triggers in prod — for local tests
  // it stays null (none of our RPC code paths touch it).
  const { data: restaurant, error: restErr } = await supa
    .from('restaurants')
    .insert({
      name: `Test ${testId}`,
      country_code: 'US',
      address: '1 Test Way',
      location: { lat: 0, lng: 0 },
    })
    .select('id')
    .single();
  if (restErr) throw new Error(`restaurant insert failed: ${restErr.message}`);
  const restaurantId = (restaurant as { id: string }).id;

  const { data: job, error: jobErr } = await supa
    .from('menu_scan_jobs')
    .insert({
      restaurant_id: restaurantId,
      created_by: adminId,
      status: 'needs_review',
      input: { images: [{ bucket: 'menu-scan-uploads', path: 'test.jpg', page: 1 }] },
      result_json: { dishes: [] },
    })
    .select('id')
    .single();
  if (jobErr) throw new Error(`job insert failed: ${jobErr.message}`);
  const jobId = (job as { id: string }).id;

  return { adminId, restaurantId, jobId, testId };
}

async function cleanupFixture(fx: Fixture | undefined): Promise<void> {
  // Defensive: when beforeEach throws partway through createFixture, fx is
  // never assigned. Just bail out — there's nothing to clean.
  if (!fx) return;
  // Cascade: deleting the restaurant drops dishes (FK ON DELETE CASCADE).
  await supa.from('menu_scan_jobs').delete().eq('id', fx.jobId);
  await supa.from('restaurants').delete().eq('id', fx.restaurantId);
  await supa.from('admin_audit_log').delete().eq('admin_id', fx.adminId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supa.auth as any).admin.deleteUser(fx.adminId);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('admin_confirm_menu_scan RPC (migration 144)', () => {
  let fx: Fixture;

  beforeEach(async () => {
    fx = await createFixture();
  });

  afterEach(async () => {
    await cleanupFixture(fx);
  });

  it('rejects NOT_FOUND when job UUID does not exist', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supa as any).rpc('admin_confirm_menu_scan', {
      p_job_id: '00000000-0000-0000-0000-000000000000',
      p_admin_id: fx.adminId,
      p_admin_email: `${fx.testId}@test.local`,
      p_payload: { dishes: [], source_language_code: 'en' },
    });
    expect(error).not.toBeNull();
    expect(error!.message).toContain('NOT_FOUND');
  });

  it('happy path: single standalone dish lands and job transitions to completed', async () => {
    const payload = {
      dishes: [
        {
          name: `Test Pad Thai ${fx.testId}`,
          description: 'Wok-fried rice noodles',
          price: 14.5,
          primary_protein: 'chicken',
          source_image_index: 0,
          category_existing_id: null,
          category_canonical_slug: null,
          category_custom_name: 'Mains',
          dish_category_id: null,
          display_price_prefix: 'exact',
          serves: 1,
        },
      ],
      source_language_code: 'en',
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supa as any).rpc('admin_confirm_menu_scan', {
      p_job_id: fx.jobId,
      p_admin_id: fx.adminId,
      p_admin_email: `${fx.testId}@test.local`,
      p_payload: payload,
    });

    expect(error).toBeNull();
    expect(data).toMatchObject({
      inserted_count: 1,
      menu_created: true,
      categories_created: 1,
      modifier_groups_count: 0,
    });

    // Verify side effects
    const { data: dishes } = await supa
      .from('dishes')
      .select('id, name')
      .eq('restaurant_id', fx.restaurantId);
    expect(dishes?.length).toBe(1);
    expect(dishes?.[0].name).toContain('Pad Thai');

    const { data: job } = await supa
      .from('menu_scan_jobs')
      .select('status, saved_dish_ids')
      .eq('id', fx.jobId)
      .single();
    expect((job as { status: string }).status).toBe('completed');
    expect(((job as { saved_dish_ids: string[] }).saved_dish_ids ?? []).length).toBe(1);
  });

  it('new shape: modifier_groups + options are persisted with display_order', async () => {
    const payload = {
      dishes: [
        {
          name: `Pad Thai with protein choice ${fx.testId}`,
          description: null,
          price: 14.0,
          primary_protein: 'chicken',
          source_image_index: 0,
          category_existing_id: null,
          category_canonical_slug: null,
          category_custom_name: 'Mains',
          dish_category_id: null,
          display_price_prefix: 'exact',
          serves: 1,
          modifier_groups: [
            {
              name: 'Choose your protein',
              selection_type: 'single',
              min_selections: 1,
              max_selections: 1,
              display_in_card: true,
              options: [
                {
                  name: 'Chicken',
                  price_delta: 0,
                  price_override: null,
                  primary_protein: 'chicken',
                  serves_delta: 0,
                  is_default: true,
                },
                {
                  name: 'Shrimp',
                  price_delta: 3,
                  price_override: null,
                  primary_protein: 'shellfish',
                  serves_delta: 0,
                  is_default: false,
                },
              ],
            },
          ],
        },
      ],
      source_language_code: 'en',
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supa as any).rpc('admin_confirm_menu_scan', {
      p_job_id: fx.jobId,
      p_admin_id: fx.adminId,
      p_admin_email: `${fx.testId}@test.local`,
      p_payload: payload,
    });

    expect(error).toBeNull();
    expect(data).toMatchObject({
      inserted_count: 1,
      modifier_groups_count: 1,
      modifier_options_count: 2,
    });

    // Resolve dish + assert group/options structure
    const { data: dishes } = await supa
      .from('dishes')
      .select('id')
      .eq('restaurant_id', fx.restaurantId);
    const dishId = (dishes as Array<{ id: string }>)[0].id;

    const { data: groups } = await supa
      .from('option_groups')
      .select('id, name, selection_type, min_selections, max_selections, display_in_card')
      .eq('dish_id', dishId);
    expect(groups?.length).toBe(1);
    expect(groups?.[0]).toMatchObject({
      name: 'Choose your protein',
      selection_type: 'single',
      min_selections: 1,
      display_in_card: true,
    });
    const groupId = (groups as Array<{ id: string }>)[0].id;

    const { data: options } = await supa
      .from('options')
      .select('name, price_delta, primary_protein, is_default, display_order')
      .eq('option_group_id', groupId)
      .order('display_order');
    expect(options?.length).toBe(2);
    expect(options?.[0]).toMatchObject({
      name: 'Chicken',
      primary_protein: 'chicken',
      is_default: true,
      display_order: 0,
    });
    expect(options?.[1]).toMatchObject({
      name: 'Shrimp',
      primary_protein: 'shellfish',
      is_default: false,
      display_order: 1,
    });
  });

  it('ALREADY_COMPLETED: rejects a second confirm on the same job', async () => {
    const payload = {
      dishes: [
        {
          name: `First save ${fx.testId}`,
          description: null,
          price: 10,
          primary_protein: 'vegetarian',
          source_image_index: 0,
          category_existing_id: null,
          category_canonical_slug: null,
          category_custom_name: 'Mains',
          dish_category_id: null,
          display_price_prefix: 'exact',
          serves: 1,
        },
      ],
      source_language_code: 'en',
    };

    // First call succeeds
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: firstErr } = await (supa as any).rpc('admin_confirm_menu_scan', {
      p_job_id: fx.jobId,
      p_admin_id: fx.adminId,
      p_admin_email: `${fx.testId}@test.local`,
      p_payload: payload,
    });
    expect(firstErr).toBeNull();

    // Second call must fail with ALREADY_COMPLETED
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: secondErr } = await (supa as any).rpc('admin_confirm_menu_scan', {
      p_job_id: fx.jobId,
      p_admin_id: fx.adminId,
      p_admin_email: `${fx.testId}@test.local`,
      p_payload: payload,
    });
    expect(secondErr).not.toBeNull();
    expect(secondErr!.message).toContain('ALREADY_COMPLETED');
  });

  it('transactional rollback: invalid selection_type on group #2 undoes group #1 insert', async () => {
    // Build a payload where the first dish has a VALID modifier group and the
    // second dish has an INVALID selection_type that fails the CHECK constraint
    // on option_groups. Without transaction wrapping, the first dish + group
    // would persist and we'd have an orphan.
    const payload = {
      dishes: [
        {
          name: `Good dish ${fx.testId}`,
          description: null,
          price: 12,
          primary_protein: 'chicken',
          source_image_index: 0,
          category_existing_id: null,
          category_canonical_slug: null,
          category_custom_name: 'Mains',
          dish_category_id: null,
          display_price_prefix: 'exact',
          serves: 1,
          modifier_groups: [
            {
              name: 'Add-ons',
              selection_type: 'multiple',
              min_selections: 0,
              max_selections: 3,
              display_in_card: false,
              options: [
                {
                  name: 'Extra cheese',
                  price_delta: 1,
                  price_override: null,
                  primary_protein: null,
                  serves_delta: 0,
                  is_default: false,
                },
              ],
            },
          ],
        },
        {
          name: `Bad dish ${fx.testId}`,
          description: null,
          price: 14,
          primary_protein: 'beef',
          source_image_index: 0,
          category_existing_id: null,
          category_canonical_slug: null,
          category_custom_name: 'Mains',
          dish_category_id: null,
          display_price_prefix: 'exact',
          serves: 1,
          modifier_groups: [
            {
              name: 'Bad group',
              selection_type: 'invalid', // CHECK constraint fails here
              min_selections: 1,
              max_selections: 1,
              display_in_card: false,
              options: [
                {
                  name: 'X',
                  price_delta: 0,
                  price_override: null,
                  primary_protein: null,
                  serves_delta: 0,
                  is_default: true,
                },
              ],
            },
          ],
        },
      ],
      source_language_code: 'en',
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supa as any).rpc('admin_confirm_menu_scan', {
      p_job_id: fx.jobId,
      p_admin_id: fx.adminId,
      p_admin_email: `${fx.testId}@test.local`,
      p_payload: payload,
    });
    expect(error).not.toBeNull();

    // Assert: zero dishes, zero option_groups, zero options. Job still
    // in 'needs_review' state (NOT completed).
    const { count: dishCount } = await supa
      .from('dishes')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', fx.restaurantId);
    expect(dishCount).toBe(0);

    const { data: groups } = await supa
      .from('option_groups')
      .select('id')
      .eq('restaurant_id', fx.restaurantId);
    expect(groups?.length ?? 0).toBe(0);

    const { data: job } = await supa
      .from('menu_scan_jobs')
      .select('status')
      .eq('id', fx.jobId)
      .single();
    expect((job as { status: string }).status).toBe('needs_review');
  });
});

describe('admin_replace_dish_modifiers RPC (migration 144)', () => {
  let fx: Fixture;
  let dishId: string;

  beforeEach(async () => {
    fx = await createFixture();
    // Create a bare dish (no modifier groups) to use as the target.
    const { data: dish, error: dishErr } = await supa
      .from('dishes')
      .insert({
        restaurant_id: fx.restaurantId,
        name: `Target ${fx.testId}`,
        price: 10,
        primary_protein: 'chicken',
        status: 'draft',
      })
      .select('id')
      .single();
    if (dishErr) throw new Error(`dish insert failed: ${dishErr.message}`);
    dishId = (dish as { id: string }).id;
  });

  afterEach(async () => {
    await cleanupFixture(fx);
  });

  it('DISH_NOT_FOUND when dish UUID is unknown', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supa as any).rpc('admin_replace_dish_modifiers', {
      p_dish_id: '00000000-0000-0000-0000-000000000000',
      p_groups: [],
    });
    expect(error).not.toBeNull();
    expect(error!.message).toContain('DISH_NOT_FOUND');
  });

  it('empty groups: removes all existing option_groups for the dish', async () => {
    // Pre-seed two groups
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supa as any).rpc('admin_replace_dish_modifiers', {
      p_dish_id: dishId,
      p_groups: [
        {
          name: 'G1',
          selection_type: 'single',
          min_selections: 1,
          max_selections: 1,
          display_in_card: false,
          options: [
            {
              name: 'A',
              price_delta: 0,
              price_override: null,
              primary_protein: null,
              serves_delta: 0,
              is_default: true,
            },
          ],
        },
      ],
    });

    // Confirm one group exists
    const { count: before } = await supa
      .from('option_groups')
      .select('id', { count: 'exact', head: true })
      .eq('dish_id', dishId);
    expect(before).toBe(1);

    // Replace with empty array
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supa as any).rpc('admin_replace_dish_modifiers', {
      p_dish_id: dishId,
      p_groups: [],
    });
    expect(error).toBeNull();
    expect(data).toEqual({ group_count: 0, option_count: 0 });

    const { count: after } = await supa
      .from('option_groups')
      .select('id', { count: 'exact', head: true })
      .eq('dish_id', dishId);
    expect(after).toBe(0);
  });

  it('two-group replace persists all groups and options atomically', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supa as any).rpc('admin_replace_dish_modifiers', {
      p_dish_id: dishId,
      p_groups: [
        {
          name: 'Size',
          selection_type: 'single',
          min_selections: 1,
          max_selections: 1,
          display_in_card: false,
          options: [
            {
              name: 'S',
              price_delta: 0,
              price_override: null,
              primary_protein: null,
              serves_delta: 0,
              is_default: true,
            },
            {
              name: 'L',
              price_delta: 3,
              price_override: null,
              primary_protein: null,
              serves_delta: 1,
              is_default: false,
            },
          ],
        },
        {
          name: 'Add-ons',
          selection_type: 'multiple',
          min_selections: 0,
          max_selections: 5,
          display_in_card: false,
          options: [
            {
              name: 'Cheese',
              price_delta: 1,
              price_override: null,
              primary_protein: null,
              serves_delta: 0,
              is_default: false,
            },
          ],
        },
      ],
    });
    expect(error).toBeNull();
    expect(data).toEqual({ group_count: 2, option_count: 3 });

    const { data: groups } = await supa
      .from('option_groups')
      .select('id, name, display_order')
      .eq('dish_id', dishId)
      .order('display_order');
    expect(groups?.length).toBe(2);
    expect((groups as Array<{ name: string }>)[0].name).toBe('Size');
    expect((groups as Array<{ name: string }>)[1].name).toBe('Add-ons');
  });
});
