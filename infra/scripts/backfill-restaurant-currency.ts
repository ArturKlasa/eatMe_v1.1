#!/usr/bin/env ts-node
/**
 * infra/scripts/backfill-restaurant-currency.ts
 *
 * Backfill for operator issue #4 (docs/plans/menu-scan-operator-issues-triage.md).
 *
 * Migration 147 derived restaurants.currency_code from country_code for rows
 * that existed at migration time, but the Places/CSV imports never set
 * country_code or currency_code — so every restaurant imported since landed on
 * the column default 'USD'. The imports now set both (commit pending); this
 * script fixes the rows created in between.
 *
 * All current restaurants are in Mexico (operator, 2026-06-09), so eligible
 * rows get country_code='MX' + currency_code='MXN'. Defensive scoping: only
 * rows still on the 'USD' default AND with a NULL or already-'MX' country are
 * touched — a row whose country was explicitly set to anything else is listed
 * but skipped, so a deliberately-US restaurant can never be clobbered.
 *
 * Usage (from infra/scripts/):
 *   ts-node backfill-restaurant-currency.ts              # preview (DEFAULT dry-run, writes nothing)
 *   ts-node backfill-restaurant-currency.ts --limit=10   # preview first N eligible rows (DEFAULT dry-run)
 *   ts-node backfill-restaurant-currency.ts --apply      # apply (writes to LIVE prod)
 *
 * CLI contract (SEC-03, shared prod-guard): this script now DEFAULTS to dry-run.
 * No flag means no writes — it requires the explicit `--apply` flag to mutate
 * prod. `--dry-run` is still accepted as an affirming no-op (never errors). The
 * resolved target project ref (from SUPABASE_URL) is announced before any write.
 *
 * Env (infra/scripts/.env): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { parseGuard, announceTarget } from './lib/prod-guard';

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
// Default dry-run via the shared prod-guard (SEC-03): writes require --apply.
const { dryRun: DRY_RUN, projectRef, limit: LIMIT } = parseGuard();

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌  Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface Row {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
  status: string;
  country_code: string | null;
  currency_code: string;
}

async function main(): Promise<void> {
  console.log('🚀  Restaurant currency backfill (USD default → MX/MXN)');
  announceTarget({ dryRun: DRY_RUN, projectRef });
  console.log(`   Limit:  ${LIMIT > 0 ? LIMIT : 'all'}\n`);

  // Every row still on the USD default — partitioned client-side so the
  // skipped (explicitly foreign) rows are visible in the report too.
  const { data, error } = await supabase
    .from('restaurants')
    .select('id, name, city, address, status, country_code, currency_code')
    .eq('currency_code', 'USD');
  if (error) {
    console.error('❌  Failed to fetch restaurants:', error.message);
    process.exit(1);
  }

  const rows = (data ?? []) as Row[];
  const eligible: Row[] = [];
  const skippedForeign: Row[] = [];
  for (const r of rows) {
    const cc = r.country_code?.trim().toUpperCase() ?? null;
    if (cc === null || cc === '' || cc === 'MX') eligible.push(r);
    else skippedForeign.push(r);
  }

  const targets = LIMIT > 0 ? eligible.slice(0, LIMIT) : eligible;

  let changed = 0;
  let failed = 0;

  for (const r of targets) {
    if (!DRY_RUN) {
      const { error: upErr } = await supabase
        .from('restaurants')
        .update({ country_code: 'MX', currency_code: 'MXN' })
        .eq('id', r.id);
      if (upErr) {
        failed++;
        console.error(`  ✗ ${r.name} — ${upErr.message}`);
        continue;
      }
    }
    changed++;
    const verb = DRY_RUN ? 'would set' : 'set';
    const where = [r.address, r.city].filter(Boolean).join(', ') || 'no address';
    console.log(
      `  ✓ ${r.name} (${r.status}; ${where}) — ${verb} MX/MXN` +
        (r.country_code ? '' : ' (country was null)')
    );
  }

  if (skippedForeign.length > 0) {
    console.log('\n  Skipped — USD but explicitly non-MX country (review by hand if wrong):');
    for (const r of skippedForeign) {
      console.log(`  ⚠ ${r.name} (${r.status}) — country_code=${r.country_code}`);
    }
  }

  console.log('\n' + '─'.repeat(60));
  console.log(`✅  ${DRY_RUN ? 'Dry run' : 'Backfill'} complete`);
  console.log(`   USD rows found:   ${rows.length}`);
  console.log(`   ${DRY_RUN ? 'Would set' : 'Set'} MX/MXN:  ${changed}`);
  if (skippedForeign.length > 0) console.log(`   Skipped foreign:  ${skippedForeign.length}`);
  if (failed > 0) console.log(`   Failed:           ${failed}`);
  if (DRY_RUN) console.log('\n   Re-run with --apply to write.');
}

main().catch(err => {
  console.error('❌  Fatal error:', err);
  process.exit(1);
});
