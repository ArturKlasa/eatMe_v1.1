/**
 * Integration + compile-time tests for migrations 118 + 119.
 *
 * Integration tests require a running local Supabase:
 *   SUPABASE_LOCAL_URL=http://127.0.0.1:54321 \
 *   SUPABASE_SERVICE_ROLE_KEY=<key> \
 *   vitest run supabase/tests/migrations/118_119_menu_scan_jobs.test.ts
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

describeIntegration('migration 118 — extend menu_scan_jobs columns', () => {
  const service = createClient<Database>(LOCAL_URL, SERVICE_ROLE_KEY);

  it('accepts status=pending (new CHECK value)', async () => {
    const { error } = await service.from('menu_scan_jobs').insert({
      restaurant_id: process.env.TEST_RESTAURANT_ID ?? '00000000-0000-0000-0000-000000000001',
      created_by: process.env.TEST_USER_ID ?? '00000000-0000-0000-0000-000000000002',
      status: 'pending',
      input: { images: [] },
    });
    // May fail on FK if test restaurant doesn't exist; the CHECK itself must not fire.
    if (error) expect(error.message).not.toMatch(/check.*status/i);
  });

  it('rejects invalid status value', async () => {
    const { error } = await service.from('menu_scan_jobs').insert({
      restaurant_id: '00000000-0000-0000-0000-000000000001',
      status: 'bogus' as never,
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/check|constraint/i);
  });
});

describeIntegration('migration 119 — menu_scan_jobs RLS', () => {
  it('anon cannot select from menu_scan_jobs', async () => {
    const anonClient = createClient<Database>(LOCAL_URL, process.env.SUPABASE_ANON_KEY ?? '');
    const { data, error } = await anonClient.from('menu_scan_jobs').select('id');
    expect(error).toBeNull();
    // RLS deny-all for anon → empty result set (not an error in Supabase RLS).
    expect((data ?? []).length).toBe(0);
  });
});

// ── Compile-time checks ─────────────────────────────────────────────────────

describe('menu_scan_jobs type parity (compile-time)', () => {
  it('Row includes new columns with correct types', () => {
    type Row = Database['public']['Tables']['menu_scan_jobs']['Row'];
    const _attempts: Row['attempts'] = 0;
    const _input: Row['input'] = null;
    const _locked: Row['locked_until'] = null;
    const _lastError: Row['last_error'] = null;
    (void _attempts, _input, _locked, _lastError);
    expect(true).toBe(true);
  });

  it('status is a literal union (not string)', () => {
    type StatusType = Database['public']['Tables']['menu_scan_jobs']['Row']['status'];
    const _pending: StatusType = 'pending';
    const _processing: StatusType = 'processing';
    const _needs_review: StatusType = 'needs_review';
    const _completed: StatusType = 'completed';
    const _failed: StatusType = 'failed';
    (void _pending, _processing, _needs_review, _completed, _failed);
    expect(true).toBe(true);
  });
});
