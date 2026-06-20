#!/usr/bin/env ts-node
/**
 * infra/scripts/backfill-open-hours.ts
 *
 * One-time (and repeatable) script to backfill `restaurants.open_hours` for
 * restaurants that have an empty/NULL `open_hours` but DO have a
 * `google_place_id`.
 *
 * Why this matters: the feed Edge Function treats a restaurant with empty
 * open_hours as permanently closed and excludes ALL of its dishes from the
 * mobile feed. Restaurants imported from Google Places before the import
 * captured opening hours have empty open_hours and are therefore invisible.
 *
 * It fetches `regularOpeningHours` from the Google Places Details API for each
 * affected restaurant and writes the mapped hours back.
 *
 * Usage (from project root):
 *   pnpm --filter @eatme/infra-scripts exec ts-node backfill-open-hours.ts
 *   # or, from infra/scripts/:
 *   ts-node backfill-open-hours.ts            # DEFAULT dry-run preview (no writes)
 *   ts-node backfill-open-hours.ts --apply    # apply (writes to LIVE prod)
 *
 * CLI contract (SEC-03, shared prod-guard): this script now DEFAULTS to dry-run.
 * No flag means no writes — it requires the explicit `--apply` flag to mutate
 * prod. `--dry-run` is still accepted as an affirming no-op (never errors). The
 * resolved target project ref (from SUPABASE_URL) is announced before any write.
 *
 * Flags:
 *   --apply     Required to write. Absent it, the run is a no-write preview.
 *   --dry-run   Accepted no-op — re-affirms the default; writes nothing.
 *
 * Environment variables (infra/scripts/.env, or the project root .env):
 *   SUPABASE_URL              — e.g. https://abcdefgh.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY — service role key (bypasses RLS)
 *   GOOGLE_PLACES_API_KEY     — same key used by the admin Places import
 *   BATCH_CONCURRENCY         — parallel Places lookups per tick (default: 5)
 *   BATCH_DELAY_MS            — ms between batches (default: 500)
 *
 * The open_hours mapping logic below is a deliberate copy of
 * `apps/admin/src/lib/google/openingHours.ts` — this standalone ts-node script
 * cannot import from the admin app. Keep the two in sync.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { parseGuard, announceTarget } from './lib/prod-guard';

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY ?? '';
const BATCH_CONCURRENCY = parseInt(process.env.BATCH_CONCURRENCY ?? '5', 10);
const BATCH_DELAY_MS = parseInt(process.env.BATCH_DELAY_MS ?? '500', 10);
// Default dry-run via the shared prod-guard (SEC-03): writes require --apply.
const { dryRun: DRY_RUN, projectRef } = parseGuard();

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !GOOGLE_PLACES_API_KEY) {
  console.error(
    '❌  Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_PLACES_API_KEY'
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ── open_hours mapping (copy of apps/admin/src/lib/google/openingHours.ts) ─────

interface GoogleRegularOpeningHours {
  periods?: Array<{
    open?: { day?: number; hour?: number; minute?: number };
    close?: { day?: number; hour?: number; minute?: number };
  }>;
}

type OpenHours = Record<string, { open: string; close: string }>;

// Google's `day` is 0 = Sunday ... 6 = Saturday.
const DAY_NAMES = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

function fmtTime(hour = 0, minute = 0): string {
  return `${String(hour % 24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function mapGoogleOpeningHours(
  regularOpeningHours: GoogleRegularOpeningHours | null | undefined
): OpenHours {
  const periods = regularOpeningHours?.periods;
  if (!periods || periods.length === 0) return {};

  const result: OpenHours = {};
  for (const period of periods) {
    const openPoint = period?.open;
    if (!openPoint || openPoint.day == null) continue;
    const dayName = DAY_NAMES[openPoint.day];
    if (!dayName) continue;

    if (!period.close) {
      result[dayName] = { open: '00:00', close: '23:59' };
      continue;
    }

    const open = fmtTime(openPoint.hour, openPoint.minute);
    const close = fmtTime(period.close.hour, period.close.minute);
    const existing = result[dayName];
    if (!existing) {
      result[dayName] = { open, close };
    } else {
      if (open < existing.open) existing.open = open;
      if (close > existing.close) existing.close = close;
    }
  }
  return result;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface RestaurantRow {
  id: string;
  name: string;
  google_place_id: string;
  open_hours: Record<string, unknown> | null;
}

function hasNoHours(openHours: Record<string, unknown> | null): boolean {
  return openHours == null || Object.keys(openHours).length === 0;
}

type BackfillOutcome = 'updated' | 'no_hours' | 'failed';

interface BackfillResult {
  id: string;
  name: string;
  outcome: BackfillOutcome;
  days?: number;
  error?: string;
}

async function fetchPlaceHours(placeId: string): Promise<GoogleRegularOpeningHours | null> {
  const res = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
    {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask': 'regularOpeningHours',
      },
    }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Places Details HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { regularOpeningHours?: GoogleRegularOpeningHours };
  return json.regularOpeningHours ?? null;
}

async function backfillOne(row: RestaurantRow): Promise<BackfillResult> {
  try {
    const hours = await fetchPlaceHours(row.google_place_id);
    const openHours = mapGoogleOpeningHours(hours);
    const dayCount = Object.keys(openHours).length;

    if (dayCount === 0) {
      return { id: row.id, name: row.name, outcome: 'no_hours' };
    }

    if (!DRY_RUN) {
      const { error } = await supabase
        .from('restaurants')
        .update({ open_hours: openHours })
        .eq('id', row.id);
      if (error) {
        return { id: row.id, name: row.name, outcome: 'failed', error: error.message };
      }
    }
    return { id: row.id, name: row.name, outcome: 'updated', days: dayCount };
  } catch (err) {
    return { id: row.id, name: row.name, outcome: 'failed', error: String(err) };
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('🚀  EatMe open_hours backfill starting');
  announceTarget({ dryRun: DRY_RUN, projectRef });
  console.log(`   Concurrency: ${BATCH_CONCURRENCY}`);
  console.log(`   Batch delay: ${BATCH_DELAY_MS}ms\n`);

  // Fetch every restaurant that has a Google Place ID, then filter in JS for
  // empty/NULL open_hours (PostgREST cannot cleanly test "empty jsonb").
  const { data, error } = await supabase
    .from('restaurants')
    .select('id, name, google_place_id, open_hours')
    .not('google_place_id', 'is', null)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('❌  Failed to fetch restaurants:', error.message);
    process.exit(1);
  }

  const candidates = ((data ?? []) as RestaurantRow[]).filter(r => hasNoHours(r.open_hours));
  const total = candidates.length;

  if (total === 0) {
    console.log('✅  No restaurants need an open_hours backfill — nothing to do.');
    return;
  }

  console.log(`📋  ${total} restaurant(s) with a Place ID and empty open_hours\n`);

  let updated = 0;
  let noHours = 0;
  let failed = 0;
  const startTime = Date.now();

  for (let i = 0; i < total; i += BATCH_CONCURRENCY) {
    const batch = candidates.slice(i, i + BATCH_CONCURRENCY);
    const batchNum = Math.floor(i / BATCH_CONCURRENCY) + 1;
    const totalBatches = Math.ceil(total / BATCH_CONCURRENCY);
    console.log(`Batch ${batchNum}/${totalBatches} (${batch.length}):`);

    const results = await Promise.all(batch.map(backfillOne));

    for (const result of results) {
      if (result.outcome === 'updated') {
        updated++;
        const verb = DRY_RUN ? 'would set' : 'set';
        console.log(`  ✓ ${result.name} — ${verb} ${result.days} day(s)`);
      } else if (result.outcome === 'no_hours') {
        noHours++;
        console.log(`  – ${result.name} — Google has no opening hours`);
      } else {
        failed++;
        console.error(`  ✗ ${result.name} — ${result.error}`);
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `  Progress: ${updated + noHours + failed}/${total} | ✓ ${updated} – ${noHours} ✗ ${failed} | ${elapsed}s\n`
    );

    if (i + BATCH_CONCURRENCY < total) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('─'.repeat(60));
  console.log(`✅  Backfill ${DRY_RUN ? '(dry run) ' : ''}complete in ${totalElapsed}s`);
  console.log(`   Updated:           ${updated}/${total}`);
  console.log(`   No hours on Google: ${noHours}/${total}`);
  if (failed > 0) console.log(`   Failed:            ${failed}/${total}`);
  if (DRY_RUN) console.log('\n   Re-run with --apply to write these changes.');
}

main().catch(err => {
  console.error('❌  Fatal error:', err);
  process.exit(1);
});
