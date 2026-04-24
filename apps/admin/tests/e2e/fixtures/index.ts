/**
 * Shared E2E fixtures for admin gold-path suites.
 *
 * Mirrors the web-portal-v2 fixtures pattern so teardown uses the same
 * E2E_TAG value (TEST_RUN_ID env var shared in CI).
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL + E2E_SERVICE_ROLE_KEY for DB operations.
 */

import { createClient } from '@supabase/supabase-js';

/** Unique per invocation; CI sets TEST_RUN_ID per shard to match web-portal-v2. */
export const TEST_RUN_ID = process.env.TEST_RUN_ID ?? `run-${Date.now()}`;
export const E2E_TAG = `e2e-${TEST_RUN_ID}`;

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.E2E_SERVICE_ROLE_KEY ?? '';
  if (!url || !key)
    throw new Error('E2E_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL are required for fixture ops');
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Delete all rows seeded by this run (restaurants whose name starts with E2E_TAG).
 * Safe to call repeatedly; cascades via FK to menus/dishes.
 */
export async function resetAdminDb(): Promise<void> {
  if (!process.env.E2E_SERVICE_ROLE_KEY) return;
  const client = serviceClient();
  await client.from('restaurants').delete().like('name', `${E2E_TAG}%`);
}
