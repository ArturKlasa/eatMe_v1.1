#!/usr/bin/env ts-node
/**
 * diagnose-open-now.ts — READ-ONLY (no writes).
 *
 * Confirms the feed's timezone-correct open-now logic against live data at the
 * current instant. Mirrors feed/index.ts isOpenNow + COUNTRY_TO_TZ. Reports how
 * many published restaurants are open RIGHT NOW (in their own zone) — i.e. how
 * many will contribute dish pins to the map at this moment.
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const supa = createClient(SUPABASE_URL, SERVICE_ROLE);

// Mirror of feed/index.ts COUNTRY_TO_TZ (migration 149).
const COUNTRY_TO_TZ: Record<string, string> = {
  MX: 'America/Mexico_City',
  US: 'America/New_York',
  CA: 'America/Toronto',
  BR: 'America/Sao_Paulo',
  CO: 'America/Bogota',
  AR: 'America/Argentina/Buenos_Aires',
  CL: 'America/Santiago',
  EC: 'America/Guayaquil',
  SV: 'America/El_Salvador',
  PA: 'America/Panama',
  GB: 'Europe/London',
  IE: 'Europe/Dublin',
  PT: 'Europe/Lisbon',
  ES: 'Europe/Madrid',
  FR: 'Europe/Paris',
  DE: 'Europe/Berlin',
  IT: 'Europe/Rome',
  NL: 'Europe/Amsterdam',
  BE: 'Europe/Brussels',
  AT: 'Europe/Vienna',
  GR: 'Europe/Athens',
  FI: 'Europe/Helsinki',
  PL: 'Europe/Warsaw',
  AU: 'Australia/Sydney',
  JP: 'Asia/Tokyo',
};

type Hours = Record<string, { open: string; close: string }>;

function resolveTz(timezone: string | null, country: string | null): string | null {
  return timezone ?? COUNTRY_TO_TZ[(country ?? '').toUpperCase()] ?? null;
}

function localNowInZone(tz: string): { weekday: string; minutes: number; label: string } | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date());
    const weekday = parts.find(p => p.type === 'weekday')?.value.toLowerCase() ?? '';
    let hh = Number(parts.find(p => p.type === 'hour')?.value ?? '0');
    const mm = Number(parts.find(p => p.type === 'minute')?.value ?? '0');
    if (hh === 24) hh = 0;
    if (!weekday || Number.isNaN(hh) || Number.isNaN(mm)) return null;
    return {
      weekday,
      minutes: hh * 60 + mm,
      label: `${weekday} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`,
    };
  } catch {
    return null;
  }
}

function isOpenNow(openHours: Hours | null, tz: string | null): boolean {
  if (!openHours || Object.keys(openHours).length === 0) return false;
  if (!tz) return true;
  const now = localNowInZone(tz);
  if (!now) return true;
  const entry = openHours[now.weekday];
  if (!entry) return false;
  const [oh, om] = entry.open.split(':').map(Number);
  const [ch, cm] = entry.close.split(':').map(Number);
  const openMin = oh * 60 + om;
  const closeMin = ch * 60 + cm;
  if (closeMin < openMin) return now.minutes >= openMin || now.minutes < closeMin;
  return now.minutes >= openMin && now.minutes < closeMin;
}

async function main() {
  const { data, error } = await supa
    .from('restaurants')
    .select('id, name, open_hours, timezone, country_code')
    .eq('status', 'published');
  if (error) throw error;
  const rows = data ?? [];

  const withTz = rows.filter(r => resolveTz(r.timezone, r.country_code));
  const withHours = rows.filter(r => r.open_hours && Object.keys(r.open_hours).length > 0);
  const openRows = rows.filter(r =>
    isOpenNow(r.open_hours as Hours | null, resolveTz(r.timezone, r.country_code))
  );

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  OPEN-NOW DIAGNOSTIC (read-only, timezone-correct)');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Published restaurants:          ${rows.length}`);
  console.log(`  with a resolvable timezone:   ${withTz.length}`);
  console.log(`  with open_hours data:         ${withHours.length}`);
  console.log(`  OPEN RIGHT NOW (→ dish pins):  ${openRows.length}`);
  console.log('───────────────────────────────────────────────────────────');
  const sample = withHours.slice(0, 10);
  for (const r of sample) {
    const tz = resolveTz(r.timezone, r.country_code);
    const now = tz ? localNowInZone(tz) : null;
    const open = isOpenNow(r.open_hours as Hours | null, tz);
    const today = (r.open_hours as Hours)?.[now?.weekday ?? ''];
    const hrs = today ? `${today.open}-${today.close}` : 'closed today';
    console.log(
      `  ${open ? '🟢' : '⚪'} ${r.name}  [${tz ?? 'no-tz'} ${now?.label ?? '?'}]  hours: ${hrs}`
    );
  }
  console.log('═══════════════════════════════════════════════════════════');
}

main().catch(e => {
  console.error('Diagnostic failed:', e);
  process.exit(1);
});
