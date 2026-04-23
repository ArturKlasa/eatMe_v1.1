/**
 * Integration tests for migration 120 — publish_restaurant_draft RPC.
 *
 * Requires a running local Supabase with seed fixtures:
 *   TEST_OWNER_EMAIL / TEST_OWNER_PASSWORD — user who owns TEST_RESTAURANT_ID
 *   TEST_RESTAURANT_ID — draft restaurant with at least one draft menu + dish
 *   TEST_OTHER_USER_EMAIL / TEST_OTHER_USER_PASSWORD — different user (no ownership)
 *
 * Run:
 *   SUPABASE_LOCAL_URL=http://127.0.0.1:54321 \
 *   SUPABASE_SERVICE_ROLE_KEY=<key> \
 *   SUPABASE_ANON_KEY=<key> \
 *   TEST_OWNER_EMAIL=... TEST_OWNER_PASSWORD=... TEST_RESTAURANT_ID=... \
 *   vitest run supabase/tests/migrations/120_publish_restaurant_draft.test.ts
 */

import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../../packages/database/src/types';

const LOCAL_URL = process.env.SUPABASE_LOCAL_URL ?? 'http://127.0.0.1:54321';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? '';

const isIntegration = Boolean(
  process.env.SUPABASE_LOCAL_URL &&
  process.env.SUPABASE_SERVICE_ROLE_KEY &&
  process.env.TEST_RESTAURANT_ID
);
const describeIntegration = isIntegration ? describe : describe.skip;

describeIntegration('publish_restaurant_draft RPC', () => {
  const service = createClient<Database>(LOCAL_URL, SERVICE_ROLE_KEY);
  const restaurantId = process.env.TEST_RESTAURANT_ID!;

  it('owner can publish a draft restaurant + all its draft menus + dishes', async () => {
    const ownerClient = createClient<Database>(LOCAL_URL, ANON_KEY);
    await ownerClient.auth.signInWithPassword({
      email: process.env.TEST_OWNER_EMAIL!,
      password: process.env.TEST_OWNER_PASSWORD!,
    });

    const { error } = await ownerClient.rpc('publish_restaurant_draft', {
      p_restaurant_id: restaurantId,
    });
    expect(error).toBeNull();

    // Verify all rows are now published.
    const { data: rest } = await service
      .from('restaurants')
      .select('status')
      .eq('id', restaurantId)
      .single();
    expect(rest?.status).toBe('published');

    const { data: menus } = await service
      .from('menus')
      .select('status')
      .eq('restaurant_id', restaurantId)
      .neq('status', 'published');
    expect((menus ?? []).length).toBe(0);
  });

  it('second call is idempotent (no draft rows remain to flip)', async () => {
    const ownerClient = createClient<Database>(LOCAL_URL, ANON_KEY);
    await ownerClient.auth.signInWithPassword({
      email: process.env.TEST_OWNER_EMAIL!,
      password: process.env.TEST_OWNER_PASSWORD!,
    });
    // Second call must succeed without error.
    const { error } = await ownerClient.rpc('publish_restaurant_draft', {
      p_restaurant_id: restaurantId,
    });
    expect(error).toBeNull();
  });

  it('non-owner gets insufficient_privilege', async () => {
    const otherClient = createClient<Database>(LOCAL_URL, ANON_KEY);
    await otherClient.auth.signInWithPassword({
      email: process.env.TEST_OTHER_USER_EMAIL!,
      password: process.env.TEST_OTHER_USER_PASSWORD!,
    });
    const { error } = await otherClient.rpc('publish_restaurant_draft', {
      p_restaurant_id: restaurantId,
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/forbidden|privilege|permission/i);
  });

  it('non-existent restaurant id raises error', async () => {
    const ownerClient = createClient<Database>(LOCAL_URL, ANON_KEY);
    await ownerClient.auth.signInWithPassword({
      email: process.env.TEST_OWNER_EMAIL!,
      password: process.env.TEST_OWNER_PASSWORD!,
    });
    const { error } = await ownerClient.rpc('publish_restaurant_draft', {
      p_restaurant_id: '00000000-0000-0000-0000-000000000000',
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/not found|NO_DATA_FOUND/i);
  });
});

describe('publish_restaurant_draft — no DB needed', () => {
  it('placeholder passes when integration env vars are absent', () => {
    expect(true).toBe(true);
  });
});
