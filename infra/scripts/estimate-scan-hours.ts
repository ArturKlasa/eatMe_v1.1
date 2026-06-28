#!/usr/bin/env ts-node
/**
 * estimate-scan-hours.ts — READ-ONLY work-hour estimator.
 *
 * Estimates how many hours were worked based on menu_scan_jobs timestamps.
 * Rule: assume at most 1 scan per 20 min of work — so each inter-scan gap is
 * capped at 20 min, and the last scan in a session credits 20 min.
 *
 * A "session" ends when two consecutive scans are more than SESSION_BREAK_MIN
 * apart (default 30 min). Large idle gaps don't inflate the count.
 *
 * Work day = 7:00am → 6:59am (next calendar day) in Mexico City time.
 * Scans before 7am are attributed to the previous shift day.
 *
 * Output: per-shift-day table + ASCII timeline.
 *   Timeline cells are 15 min each:
 *     ▪  scan happened in this slot
 *     ─  in-session gap (working, no scan yet)
 *     ·  idle / out of session
 *
 * Usage:
 *   pnpm --filter @eatme/infra-scripts run estimate-scan-hours
 *   cd infra/scripts && npx ts-node estimate-scan-hours.ts [--days 90] [--break 30]
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}
const supa = createClient(SUPABASE_URL, SERVICE_ROLE);

const argv = process.argv.slice(2);
const numArg = (flag: string, def: number) => {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? Number(argv[i + 1]) : def;
};

const DAYS = numArg('--days', 90);
const SESSION_BREAK_MIN = numArg('--break', 30);
const CREDIT_PER_SCAN_MIN = 20;
const TZ = 'America/Mexico_City';
const SLOT_MIN = 15;
const SLOTS_PER_HOUR = 60 / SLOT_MIN; // 4
const SHIFT_START_HOUR = 7; // work day starts at 7:00am
const TOTAL_SHIFT_SLOTS = 24 * SLOTS_PER_HOUR; // 96 slots per shift day

// ── Timezone helpers ───────────────────────────────────────────────────────────

const tzFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function localParts(ts: number): { date: string; hour: number; minute: number } {
  const parts = tzFmt.formatToParts(new Date(ts));
  const get = (t: string) => parts.find(p => p.type === t)!.value;
  const h = Number(get('hour'));
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    hour: h === 24 ? 0 : h,
    minute: Number(get('minute')),
  };
}

// Returns the ISO date string for the calendar day before the given YYYY-MM-DD string.
function prevDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) - 86_400_000).toISOString().slice(0, 10);
}

// The "shift date" a timestamp belongs to: scans before 7am roll back to yesterday.
function shiftDate(ts: number): string {
  const { date, hour } = localParts(ts);
  return hour < SHIFT_START_HOUR ? prevDate(date) : date;
}

// Slot index within a 7am-anchored 24-h shift window.
// Slot 0 = 7:00am, slot 4 = 8:00am, ..., slot 68 = midnight, slot 80 = 4:00am.
function toShiftSlot(ts: number): number {
  const { hour, minute } = localParts(ts);
  const shiftHour =
    hour >= SHIFT_START_HOUR ? hour - SHIFT_START_HOUR : hour + 24 - SHIFT_START_HOUR;
  return shiftHour * SLOTS_PER_HOUR + Math.floor(minute / SLOT_MIN);
}

// Wall-clock hour that corresponds to a given shift slot index.
function slotToWallHour(slot: number): number {
  return (Math.floor(slot / SLOTS_PER_HOUR) + SHIFT_START_HOUR) % 24;
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supa
    .from('menu_scan_jobs')
    .select('created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Query failed:', error.message);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.log(`No menu scans found in the last ${DAYS} days.`);
    return;
  }

  const timestamps = data.map(r => new Date(r.created_at).getTime());

  // ── Group into sessions ──────────────────────────────────────────────────────
  type Session = { start: number; end: number; scanTs: number[]; creditMin: number };
  const sessions: Session[] = [];
  let cur: Session = {
    start: timestamps[0],
    end: timestamps[0],
    scanTs: [timestamps[0]],
    creditMin: 0,
  };

  for (let i = 1; i < timestamps.length; i++) {
    const gapMin = (timestamps[i] - timestamps[i - 1]) / 60_000;
    if (gapMin > SESSION_BREAK_MIN) {
      cur.creditMin += CREDIT_PER_SCAN_MIN;
      sessions.push(cur);
      cur = { start: timestamps[i], end: timestamps[i], scanTs: [timestamps[i]], creditMin: 0 };
    } else {
      cur.creditMin += Math.min(gapMin, CREDIT_PER_SCAN_MIN);
      cur.end = timestamps[i];
      cur.scanTs.push(timestamps[i]);
    }
  }
  cur.creditMin += CREDIT_PER_SCAN_MIN;
  sessions.push(cur);

  // ── Per-shift-day aggregation ────────────────────────────────────────────────
  // A session belongs to the shift day of its first scan.
  const byDay = new Map<string, { sessions: number; scans: number; creditMin: number }>();
  for (const s of sessions) {
    const day = shiftDate(s.start);
    const row = byDay.get(day) ?? { sessions: 0, scans: 0, creditMin: 0 };
    row.sessions++;
    row.scans += s.scanTs.length;
    row.creditMin += s.creditMin;
    byDay.set(day, row);
  }

  // ── Summary table ────────────────────────────────────────────────────────────
  console.log(`\nMenu-scan work estimate — last ${DAYS} days (${TZ})`);
  console.log(
    `Work day: 7:00am → 6:59am  |  Session break: ${SESSION_BREAK_MIN} min  |  Credit cap: ${CREDIT_PER_SCAN_MIN} min\n`
  );

  const pad = (s: string, n: number) => s.padEnd(n);
  console.log(
    `${pad('Shift day', 12)} ${pad('Sessions', 9)} ${pad('Scans', 7)} ${'Hours'.padStart(7)}`
  );
  console.log('─'.repeat(38));

  let totalScans = 0;
  let totalCreditMin = 0;

  for (const [day, row] of [...byDay.entries()].sort()) {
    console.log(
      `${pad(day, 12)} ${pad(String(row.sessions), 9)} ${pad(String(row.scans), 7)} ${(row.creditMin / 60).toFixed(2).padStart(7)}h`
    );
    totalScans += row.scans;
    totalCreditMin += row.creditMin;
  }

  console.log('─'.repeat(38));
  console.log(
    `${pad('TOTAL', 12)} ${pad(String(sessions.length), 9)} ${pad(String(totalScans), 7)} ${(totalCreditMin / 60).toFixed(2).padStart(7)}h`
  );
  console.log(
    `\nNaive ceiling (${totalScans} scans × ${CREDIT_PER_SCAN_MIN} min): ${((totalScans * CREDIT_PER_SCAN_MIN) / 60).toFixed(2)}h`
  );
  console.log(
    `Timing-adjusted estimate:                         ${(totalCreditMin / 60).toFixed(2)}h`
  );

  // ── ASCII timeline ───────────────────────────────────────────────────────────

  // Find the used slot range (in shift-slot space) across all scans.
  let minSlot = TOTAL_SHIFT_SLOTS - 1;
  let maxSlot = 0;
  for (const ts of timestamps) {
    const slot = toShiftSlot(ts);
    if (slot < minSlot) minSlot = slot;
    if (slot > maxSlot) maxSlot = slot;
  }
  // Extend by 1 hour on each side for readability.
  minSlot = Math.max(0, minSlot - SLOTS_PER_HOUR);
  maxSlot = Math.min(TOTAL_SHIFT_SLOTS - 1, maxSlot + SLOTS_PER_HOUR);

  const displaySlots = maxSlot - minSlot + 1;
  const DATE_WIDTH = 12;

  // Build header: exactly 1 char per slot so data rows always align.
  // 2-digit hours (10-23) spread across the first two slots of that hour.
  let hourLabels = ' '.repeat(DATE_WIDTH + 1);
  let hourTicks = ' '.repeat(DATE_WIDTH + 1);
  for (let slot = minSlot; slot <= maxSlot; slot++) {
    const posInHour = slot % SLOTS_PER_HOUR;
    const label = String(slotToWallHour(slot));
    if (posInHour === 0) {
      hourLabels += label[0];
      hourTicks += '|';
    } else if (posInHour === 1 && label.length > 1) {
      hourLabels += label[1];
      hourTicks += '·';
    } else {
      hourLabels += ' ';
      hourTicks += '·';
    }
  }

  console.log(`\n${'─'.repeat(DATE_WIDTH + 1 + displaySlots)}`);
  console.log(`Timeline  (${TZ}, each cell = ${SLOT_MIN} min, day = 7am→6:59am)\n`);
  console.log(hourLabels);
  console.log(hourTicks);

  const sortedDays = [...byDay.keys()].sort();

  for (const day of sortedDays) {
    const slots = new Array<string>(displaySlots).fill('·');

    for (const s of sessions) {
      if (shiftDate(s.start) !== day) continue;

      // Fill session range (first scan → last scan + credit window) with ─
      const sessionEndTs = s.end + CREDIT_PER_SCAN_MIN * 60_000;
      const startSlot = toShiftSlot(s.start) - minSlot;
      const endSlot = toShiftSlot(sessionEndTs) - minSlot;

      for (let i = Math.max(0, startSlot); i <= Math.min(displaySlots - 1, endSlot); i++) {
        slots[i] = '─';
      }

      // Overlay ▪ at exact scan slots
      for (const ts of s.scanTs) {
        const slot = toShiftSlot(ts) - minSlot;
        if (slot >= 0 && slot < displaySlots) slots[slot] = '▪';
      }
    }

    console.log(`${day} ${slots.join('')}`);
  }

  console.log(`${'─'.repeat(DATE_WIDTH + 1 + displaySlots)}`);
  console.log('Legend:  ▪ scan   ─ in-session gap   · idle\n');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
