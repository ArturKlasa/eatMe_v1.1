#!/usr/bin/env ts-node
/**
 * verify-phase7.ts — READ-ONLY. Confirms whether migration 163 (the Phase 7
 * coordinated drop) is live in prod and that the rewritten RPCs work.
 *
 * Usage:  cd infra/scripts && pnpm exec ts-node verify-phase7.ts
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) as any;

// Mexico City — where most of the prod restaurants are.
const LAT = 19.4326;
const LNG = -99.1332;

async function main() {
  console.log(`\n=== Phase 7 verification (read-only) — ${process.env.SUPABASE_URL} ===\n`);

  // 1. Doomed columns should be GONE (selecting them must error).
  let applied = true;
  for (const col of [
    'dish_kind',
    'parent_dish_id',
    'is_parent',
    'is_template',
    'price_per_person',
  ]) {
    const { error } = await sb.from('dishes').select(col).limit(1);
    console.log(`dishes.${col.padEnd(17)}: ${error ? 'GONE ✓' : 'STILL EXISTS ✗'}`);
    if (!error) applied = false;
  }

  // 2. Doomed tables should be GONE.
  for (const t of ['dish_courses', 'dish_course_items']) {
    const { error } = await sb.from(t).select('id').limit(1);
    console.log(`table ${t.padEnd(18)}: ${error ? 'GONE ✓' : 'STILL EXISTS ✗'}`);
    if (!error) applied = false;
  }

  console.log(
    applied ? '\n→ Migration 163 IS LIVE in prod.\n' : '\n→ NOT applied (or partially applied).\n'
  );
  if (!applied) return;

  // 3. Rewritten generate_candidates returns rows without the dropped fields.
  const { data: cands, error: gcErr } = await sb.rpc('generate_candidates', {
    p_lat: LAT,
    p_lng: LNG,
    p_radius_m: 5000, // 50km cold-queries past the statement timeout; 5km is plenty for CDMX
    p_limit: 5,
  });
  if (gcErr) {
    console.log(`generate_candidates: ERROR ✗ — ${gcErr.message}`);
    return;
  }
  const row = cands?.[0] ?? {};
  const leaked = ['dish_kind', 'parent_dish_id', 'price_per_person'].filter(k => k in row);
  console.log(
    `generate_candidates: ${cands?.length ?? 0} rows ✓ · dropped fields leaked: ${leaked.length ? leaked.join(',') + ' ✗' : 'none ✓'} · has dining_format key: ${'dining_format' in row ? '✓' : '✗'} · has modifier_groups key: ${'modifier_groups' in row ? '✓' : '✗'}`
  );

  // 4. Rewritten get_group_candidates still answers.
  const { data: groups, error: ggErr } = await sb.rpc('get_group_candidates', {
    p_lat: LAT,
    p_lng: LNG,
    p_radius_m: 5000,
    p_limit: 3,
  });
  console.log(
    ggErr
      ? `get_group_candidates: ERROR ✗ — ${ggErr.message}`
      : `get_group_candidates: ${groups?.length ?? 0} restaurants ✓ (0 is OK if none open right now)`
  );

  // 5. Legacy confirm_menu_scan should be gone; admin RPCs should exist.
  //    (Calling with garbage args: "function not found" vs any other error.)
  const { error: oldErr } = await sb.rpc('confirm_menu_scan', {
    p_job_id: '00000000-0000-0000-0000-000000000000',
    p_payload: {},
    p_idempotency_key: 'x',
  });
  const oldGone =
    oldErr && /could not find|does not exist|PGRST202/i.test(oldErr.message + (oldErr.code ?? ''));
  console.log(
    `legacy confirm_menu_scan: ${oldGone ? 'GONE ✓' : `still callable / unexpected: ${oldErr?.message ?? 'no error'} ✗`}`
  );

  const { error: acErr } = await sb.rpc('admin_confirm_menu_scan', {
    p_job_id: '00000000-0000-0000-0000-000000000000',
    p_admin_id: '00000000-0000-0000-0000-000000000000',
    p_admin_email: 'verify@phase7',
    p_payload: {},
  });
  // Expect NOT_FOUND (P0002) from the job lookup — proves the function body runs.
  const acOk = acErr && /NOT_FOUND/.test(acErr.message);
  console.log(
    `admin_confirm_menu_scan: ${acOk ? 'rewritten body responds (NOT_FOUND as expected) ✓' : `unexpected: ${acErr?.message ?? 'no error'} ✗`}`
  );

  const { error: cpErr } = await sb.rpc('admin_copy_restaurant_menu', {
    p_source_restaurant_id: '00000000-0000-0000-0000-000000000000',
    p_target_restaurant_id: '00000000-0000-0000-0000-000000000001',
  });
  const cpOk = cpErr && /SOURCE_NOT_FOUND/.test(cpErr.message);
  console.log(
    `admin_copy_restaurant_menu: ${cpOk ? 'rewritten body responds (SOURCE_NOT_FOUND as expected) ✓' : `unexpected: ${cpErr?.message ?? 'no error'} ✗`}`
  );

  console.log('\n(read-only — nothing written)');
}

main();
