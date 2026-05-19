// Smoke test for the integration-test infrastructure (Phase 4.1).
//
// Confirms that local Supabase is reachable AND that the modifier-model schema
// from migrations 140/141 is in place. Phase 4.2 will replace these placeholders
// with real tests of admin_confirm_menu_scan (migration 144) — specifically the
// partial-failure / rollback semantics that can't be exercised against mocked
// Supabase.

import { describe, it, expect } from 'vitest';
import { makeLocalServiceClient } from './setup';

describe('integration scaffold smoke test', () => {
  it('connects to local Supabase and lists option_groups (empty or otherwise)', async () => {
    const supa = makeLocalServiceClient();
    const { error } = await supa.from('option_groups').select('id').limit(1);
    expect(error).toBeNull();
  });

  it('option_groups exposes display_in_card column (migration 140)', async () => {
    const supa = makeLocalServiceClient();
    const { error } = await supa
      .from('option_groups')
      .select('id, display_in_card, selection_type')
      .limit(0);
    expect(error).toBeNull();
  });

  it('options exposes the 7 new modifier columns (migration 140)', async () => {
    const supa = makeLocalServiceClient();
    const { error } = await supa
      .from('options')
      .select(
        'id, price_override, primary_protein, adds_dietary_tags, removes_dietary_tags, adds_allergens, serves_delta, is_default'
      )
      .limit(0);
    expect(error).toBeNull();
  });

  it('dishes exposes dining_format + bundled_items + availability columns (migration 141)', async () => {
    const supa = makeLocalServiceClient();
    const { error } = await supa
      .from('dishes')
      .select(
        'id, dining_format, bundled_items, available_days, available_hours_start, available_hours_end, available_from, available_until'
      )
      .limit(0);
    expect(error).toBeNull();
  });

  it('app_config table exists with seed row (migration 141a)', async () => {
    const supa = makeLocalServiceClient();
    const { data, error } = await supa
      .from('app_config')
      .select('min_supported_mobile_version, latest_mobile_version')
      .limit(1);
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    // app_config is a single-row table; the seed row should exist.
    expect(data?.length ?? 0).toBeGreaterThan(0);
  });
});
