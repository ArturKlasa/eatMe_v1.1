#!/usr/bin/env ts-node
/**
 * infra/scripts/backfill-restaurant-timezone.ts
 *
 * Backfill for docs/plans/feed-open-now-timezone.md.
 *
 * Migration 149 backfilled restaurants.timezone from country_code, but rows with
 * a NULL/unmapped country_code were left null — and the feed then falls through
 * to its lenient "unknown zone → show anyway" branch, so a closed restaurant's
 * dishes leak onto the map regardless of hours. This script fills those rows by
 * deriving a lat/lng-precise IANA zone from the restaurant's coordinates (the
 * same tz-lookup the admin import now uses), so open-now is evaluated correctly.
 *
 * Usage (from infra/scripts/):
 *   ts-node backfill-restaurant-timezone.ts             # preview null-tz rows (DEFAULT dry-run, no writes)
 *   ts-node backfill-restaurant-timezone.ts --apply     # apply (writes to LIVE prod)
 *   ts-node backfill-restaurant-timezone.ts --all       # also re-derive non-null rows (precision upgrade preview)
 *
 * CLI contract (SEC-03, shared prod-guard): this script now DEFAULTS to dry-run.
 * No flag means no writes — it requires the explicit `--apply` flag to mutate
 * prod. `--dry-run` is still accepted as an affirming no-op (never errors). The
 * resolved target project ref (from SUPABASE_URL) is announced before any write.
 *
 * Flags:
 *   --apply       Required to write. Absent it, the run is a no-write preview.
 *   --dry-run     Accepted no-op — re-affirms the default; writes nothing.
 *   --all         Re-derive EVERY restaurant from coords (upgrade country-approx
 *                 → lat/lng-precise). Default: only rows with a null timezone.
 *   --limit=N     Process only the first N candidates (0 = all).
 *
 * Env (infra/scripts/.env): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { parseGuard, announceTarget } from './lib/prod-guard';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const tzlookup = require('tz-lookup') as (lat: number, lon: number) => string;

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
// Default dry-run via the shared prod-guard (SEC-03): writes require --apply.
const { dryRun: DRY_RUN, projectRef, limit: LIMIT } = parseGuard();
const ALL = process.argv.includes('--all');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌  Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface Row {
  id: string;
  name: string;
  status: string;
  location: { lat?: number; lng?: number } | null;
  timezone: string | null;
}

function coordsOf(loc: Row['location']): { lat: number; lng: number } | null {
  if (!loc || typeof loc.lat !== 'number' || typeof loc.lng !== 'number') return null;
  if (loc.lat < -90 || loc.lat > 90 || loc.lng < -180 || loc.lng > 180) return null;
  return { lat: loc.lat, lng: loc.lng };
}

function deriveTimezone(loc: Row['location']): string | null {
  const c = coordsOf(loc);
  if (!c) return null;
  try {
    return tzlookup(c.lat, c.lng);
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  console.log('🚀  Restaurant timezone backfill (open-now fix)');
  announceTarget({ dryRun: DRY_RUN, projectRef });
  console.log(`   Scope:  ${ALL ? 'ALL rows (re-derive from coords)' : 'rows with NULL timezone'}`);
  console.log(`   Limit:  ${LIMIT > 0 ? LIMIT : 'all'}\n`);

  let query = supabase.from('restaurants').select('id, name, status, location, timezone');
  if (!ALL) query = query.is('timezone', null);
  const { data, error } = await query;
  if (error) {
    console.error('❌  Failed to fetch restaurants:', error.message);
    process.exit(1);
  }

  let rows = (data ?? []) as Row[];
  if (LIMIT > 0) rows = rows.slice(0, LIMIT);

  let changed = 0;
  let unchanged = 0;
  let noCoords = 0;
  let failed = 0;

  for (const r of rows) {
    const next = deriveTimezone(r.location);
    if (!next) {
      noCoords++;
      console.log(`  ⚠ ${r.name} (${r.status}) — no usable coordinates, skipped`);
      continue;
    }
    if (next === r.timezone) {
      unchanged++;
      continue; // already precise (e.g. --all on a correct row)
    }

    if (!DRY_RUN) {
      const { error: upErr } = await supabase
        .from('restaurants')
        .update({ timezone: next })
        .eq('id', r.id);
      if (upErr) {
        failed++;
        console.error(`  ✗ ${r.name} — ${upErr.message}`);
        continue;
      }
    }
    changed++;
    const verb = DRY_RUN ? 'would set' : 'set';
    console.log(
      `  ✓ ${r.name} (${r.status}) — ${verb} ${next}${r.timezone ? ` (was ${r.timezone})` : ''}`
    );
  }

  console.log('\n' + '─'.repeat(60));
  console.log(`✅  ${DRY_RUN ? 'Dry run' : 'Backfill'} complete`);
  console.log(`   Candidates:  ${rows.length}`);
  console.log(`   ${DRY_RUN ? 'Would set' : 'Set'}:    ${changed}`);
  if (unchanged > 0) console.log(`   Unchanged:   ${unchanged}`);
  if (noCoords > 0) console.log(`   No coords:   ${noCoords}`);
  if (failed > 0) console.log(`   Failed:      ${failed}`);
  if (DRY_RUN) console.log('\n   Re-run with --apply to write.');
}

main().catch(err => {
  console.error('❌  Fatal error:', err);
  process.exit(1);
});
