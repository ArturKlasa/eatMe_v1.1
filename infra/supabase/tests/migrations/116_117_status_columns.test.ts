/**
 * Integration tests for migrations 116 + 117 (status columns on restaurants + menus).
 *
 * Requires a running local Supabase (supabase start && supabase db reset).
 *
 * Run:
 *   SUPABASE_LOCAL_URL=http://127.0.0.1:54321 \
 *   SUPABASE_SERVICE_ROLE_KEY=<key> \
 *   vitest run supabase/tests/migrations/116_117_status_columns.test.ts
 */

import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../../packages/database/src/types';

const LOCAL_URL = process.env.SUPABASE_LOCAL_URL ?? 'http://127.0.0.1:54321';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

const isIntegration = Boolean(
  process.env.SUPABASE_LOCAL_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
);
const describeIntegration = isIntegration ? describe : describe.skip;

describeIntegration('migrations 116+117 — status columns', () => {
  const service = createClient<Database>(LOCAL_URL, SERVICE_ROLE_KEY);

  it('all existing restaurants default to status=published', async () => {
    const { data, error } = await service
      .from('restaurants')
      .select('status')
      .neq('status', 'published');
    expect(error).toBeNull();
    expect((data ?? []).length).toBe(0);
  });

  it('all existing menus default to status=published', async () => {
    const { data, error } = await service.from('menus').select('status').neq('status', 'published');
    expect(error).toBeNull();
    expect((data ?? []).length).toBe(0);
  });

  it('restaurants rejects invalid status via CHECK constraint', async () => {
    const { error } = await service
      .from('restaurants')
      .insert({ name: 'Test', address: '1 Main St', location: {}, status: 'bogus' as never });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/check|constraint/i);
  });

  it('menus rejects invalid status via CHECK constraint', async () => {
    const { error } = await service.from('menus').insert({
      name: 'Menu',
      restaurant_id: '00000000-0000-0000-0000-000000000001',
      status: 'bogus' as never,
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/check|constraint/i);
  });
});

// ── TypeScript compile-time check (no DB needed) ────────────────────────────

describe('status column type parity (compile-time)', () => {
  it('Tables<restaurants>.Row includes status literal union', () => {
    type RestaurantRow = Database['public']['Tables']['restaurants']['Row'];
    type StatusType = RestaurantRow['status'];
    // If this line compiles, the type is correct.
    const _: StatusType = 'published';
    const _draft: StatusType = 'draft';
    const _archived: StatusType = 'archived';
    (void _, _draft, _archived);
    expect(true).toBe(true);
  });

  it('Tables<menus>.Row includes status literal union', () => {
    type MenuRow = Database['public']['Tables']['menus']['Row'];
    type StatusType = MenuRow['status'];
    const _: StatusType = 'published';
    const _draft: StatusType = 'draft';
    const _archived: StatusType = 'archived';
    (void _, _draft, _archived);
    expect(true).toBe(true);
  });
});
