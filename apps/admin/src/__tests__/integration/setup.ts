// Vitest globalSetup for integration tests against LOCAL Supabase.
//
// Responsibilities:
//   1. Verify a local Supabase stack is reachable at LOCAL_SUPABASE_URL
//      (default 127.0.0.1:54321). Fails fast with a clear message if not —
//      better than a flood of cryptic connection errors per test.
//   2. Smoke-check that migration 140/141 columns exist on the local DB by
//      attempting to SELECT them. If the local DB is behind, the developer
//      needs to run `supabase db reset` from infra/supabase/ to re-apply
//      migrations.
//
// What this DOESN'T do (intentional):
//   - Start `supabase start` for you. Doing that from a test setup hides the
//     ~30s startup cost and surprises users when CI is slow. Document it as a
//     prerequisite instead.
//   - Truncate tables. Each test file is responsible for its own cleanup
//     (per-test BEGIN/ROLLBACK savepoint pattern is the recommended approach
//     for Phase 4.2's RPC tests).
//
// Phase 4.1 ships only the smoke check. Phase 4.2 will add the
// admin_confirm_menu_scan RPC test that uses this scaffolding.

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Local Supabase defaults from `supabase start` output. Override via env vars
// when running against a non-default config (e.g. CI with port mappings).
const LOCAL_SUPABASE_URL = process.env.LOCAL_SUPABASE_URL ?? 'http://127.0.0.1:54321';
// The local service-role JWT is a well-known constant printed by `supabase start`
// (and committed to supabase-js examples). It is NOT a secret. We hard-code the
// dev one so contributors don't need to copy it manually.
const LOCAL_SERVICE_ROLE_KEY =
  process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

export default async function globalSetup(): Promise<void> {
  // (1) Reachability check via PostgREST root.
  const healthUrl = `${LOCAL_SUPABASE_URL}/rest/v1/`;
  try {
    const res = await fetch(healthUrl, {
      method: 'GET',
      headers: { apikey: LOCAL_SERVICE_ROLE_KEY },
    });
    // PostgREST returns 200 with OpenAPI spec; some versions return 404 on /.
    if (!res.ok && res.status !== 404) {
      throw new Error(`Local Supabase at ${LOCAL_SUPABASE_URL} returned HTTP ${res.status}`);
    }
  } catch (err) {
    throw new Error(
      `Cannot reach local Supabase at ${LOCAL_SUPABASE_URL}.\n` +
        `Prerequisites:\n` +
        `  1. Docker Desktop running.\n` +
        `  2. cd infra/supabase && supabase start\n` +
        `Original error: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // (2) Schema sanity check: SELECT the new modifier-model columns. If the
  // local DB is missing them, PostgREST returns a "column does not exist" error
  // that's clearer than waiting until a real test attempts an INSERT.
  const supa: SupabaseClient = createClient(LOCAL_SUPABASE_URL, LOCAL_SERVICE_ROLE_KEY);

  // limit(0) returns no rows but still validates the columns exist in the schema.
  const { error: dishesErr } = await supa
    .from('dishes')
    .select('id, dining_format, bundled_items, available_days')
    .limit(0);
  if (dishesErr) {
    throw new Error(
      `Local DB schema check failed for dishes: ${dishesErr.message}\n` +
        `Migrations 141/141a probably not applied. Re-apply: cd infra/supabase && supabase db reset`
    );
  }

  const { error: optErr } = await supa
    .from('options')
    .select('id, price_override, primary_protein, adds_allergens, is_default')
    .limit(0);
  if (optErr) {
    throw new Error(
      `Local DB schema check failed for options: ${optErr.message}\n` +
        `Migration 140 probably not applied. Re-apply: cd infra/supabase && supabase db reset`
    );
  }
}

// Convenience client factory for individual test files. Tests should create
// their own client (not share a module-level singleton) so each test owns its
// connection state.
export function makeLocalServiceClient(): SupabaseClient {
  return createClient(LOCAL_SUPABASE_URL, LOCAL_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const LOCAL_SUPABASE = {
  url: LOCAL_SUPABASE_URL,
  serviceRoleKey: LOCAL_SERVICE_ROLE_KEY,
};
